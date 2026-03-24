import { idSchema, CLAUDE_MODEL } from "@synaps/shared";
import { protectedProcedure, router } from "../trpc.js";
import { getClientAndLanguage } from "../../services/claude.service.js";
import { getMetricSnapshot } from "../../services/metrics.service.js";
import { computeTrends } from "../../services/statistics.service.js";
import type { BiomarkerTimeSeries } from "../../services/statistics.service.js";

const REMINDER_PROMPT = `You are a personal health assistant. Analyze the provided health data and generate personalized, actionable reminders.

Return ONLY a JSON array:
[{ "title": "short title", "description": "1-2 sentences explaining why this is relevant to this person specifically", "dueDate": "YYYY-MM-DD or null" }]

Use the full data provided:
- Age/sex-appropriate preventive screenings (colonoscopy 45+, mammogram women 40+, PSA men 50+)
- Vitamin/supplement needs (B12 for vegans, D for high latitudes or low sun)
- Follow-up for active conditions and recent lab results
- Metric trends: if sleep is declining, wellbeing is dropping, or pain is increasing — flag it
- If allostatic load is elevated (>0.3), suggest repeating the relevant biomarkers
- Biomarker trends: if a value is trending out of range (high z-score), flag it
- Smoking: if current smoker, consider cessation and lung function reminders
- Active medications: consider monitoring reminders if relevant

CRITICAL: Do NOT suggest reminders listed in alreadyDismissed. The user explicitly dismissed those — do not regenerate them or close variants.

Generate 3-6 reminders. Return valid JSON array only, no markdown.`;

export const reminderRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { profileId } = ctx;
    return ctx.prisma.reminder.findMany({
      where: { profileId, isDismissed: false },
      orderBy: { dueDate: "asc" },
    });
  }),

  dismiss: protectedProcedure.input(idSchema).mutation(async ({ ctx, input }) => {
    return ctx.prisma.reminder.update({
      where: { id: input.id },
      data: { isDismissed: true },
    });
  }),

  generate: protectedProcedure.mutation(async ({ ctx }) => {
    const { profileId } = ctx;

    const [profile, conditions, reports, dismissedReminders, metricStates] = await Promise.all([
      ctx.prisma.profile.findUnique({
        where: { id: profileId },
        include: { allergies: true },
      }),
      ctx.prisma.condition.findMany({
        where: { profileId, isCurrent: true },
        take: 10,
      }),
      ctx.prisma.report.findMany({
        where: { profileId, deletedAt: null },
        orderBy: { reportDate: "desc" },
        take: 5,
        select: { title: true, reportDate: true, examType: true },
      }),
      ctx.prisma.reminder.findMany({
        where: { profileId, isDismissed: true, source: "ai" },
        select: { title: true },
        orderBy: { updatedAt: "desc" },
        take: 30,
      }),
      ctx.prisma.metricState.findMany({ where: { profileId } }),
    ]);

    const snap = await getMetricSnapshot(profileId, profile?.heightCm ?? undefined);

    const biomarkerSeries: BiomarkerTimeSeries[] = await (async () => {
      const entries = await ctx.prisma.reportEntry.findMany({
        where: { report: { profileId, deletedAt: null } },
        include: { report: { select: { reportDate: true } } },
        orderBy: { report: { reportDate: "asc" } },
      });
      const map = new Map<string, Array<{ date: Date; value: number }>>();
      for (const e of entries) {
        const pts = map.get(e.biomarkerName) ?? [];
        pts.push({ date: e.report.reportDate, value: e.value });
        map.set(e.biomarkerName, pts);
      }
      return Array.from(map.entries()).map(([name, points]) => ({ name, points }));
    })();

    const trends = computeTrends(biomarkerSeries);
    const concerningTrends = trends
      .filter((t) => t.zScore !== null && Math.abs(t.zScore) > 1.5)
      .map((t) => ({
        biomarker: t.biomarkerName,
        trend: t.slope > 0.01 ? "increasing" : t.slope < -0.01 ? "decreasing" : "stable",
        zScore: t.zScore,
      }));

    const profileData = {
      dateOfBirth: profile?.dateOfBirth,
      sex: profile?.sex,
      dietaryPreference: profile?.dietaryPreference,
      smokingStatus: profile?.smokingStatus,
      allergies: profile?.allergies.map((a) => a.name),
      activeConditions: conditions.map((c) => ({ name: c.name, diagnosedAt: c.diagnosedAt })),
      recentReports: reports.map((r) => ({
        title: r.title,
        date: r.reportDate,
        examType: r.examType,
      })),
      metrics: {
        sleep: {
          hours: snap.sleep["hours"] ? { ema: snap.sleep["hours"].ema, trend: snap.sleep["hours"].trend } : null,
          quality: snap.sleep["quality"] ? { ema: snap.sleep["quality"].ema, trend: snap.sleep["quality"].trend } : null,
        },
        wellbeing: {
          composite: snap.wellbeing["composite"] ? { ema: snap.wellbeing["composite"].ema, trend: snap.wellbeing["composite"].trend } : null,
          pain: snap.wellbeing["pain"] ? { ema: snap.wellbeing["pain"].ema, trend: snap.wellbeing["pain"].trend } : null,
        },
        activity: {
          weeklyMinutes: snap.activity["weeklyMinutes"] ? { ema: snap.activity["weeklyMinutes"].ema, trend: snap.activity["weeklyMinutes"].trend } : null,
        },
        allosticLoad: snap.allosticLoad,
      },
      biomarkerTrends: concerningTrends,
      alreadyDismissed: dismissedReminders.map((r) => r.title),
    };

    const { client, language } = await getClientAndLanguage();

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      temperature: 0,
      system:
        REMINDER_PROMPT +
        (language !== "en"
          ? `\n\nIMPORTANT: Write all title and description fields in the language with code "${language}".`
          : ""),
      messages: [{ role: "user", content: JSON.stringify(profileData) }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const raw = textBlock?.type === "text" ? textBlock.text : "[]";

    let items: Array<{ title: string; description?: string; dueDate?: string }> = [];
    try {
      const match = raw.match(/\[[\s\S]*\]/);
      items = JSON.parse(match?.[0] ?? "[]");
    } catch {
      items = [];
    }

    await ctx.prisma.$transaction(async (tx) => {
      await tx.reminder.deleteMany({
        where: { profileId, source: "ai", isDismissed: false },
      });
      await tx.reminder.createMany({
        data: items.map((item) => ({
          profileId,
          title: item.title,
          description: item.description ?? null,
          dueDate: item.dueDate ? new Date(item.dueDate) : null,
          source: "ai",
        })),
      });
    });

    return { count: items.length };
  }),
});
