import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";
import { idSchema, graphNodeCreateSchema, graphEdgeCreateSchema, CLAUDE_MODEL } from "@synaps/shared";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc.js";
import { buildGraphForProfile } from "../../services/graph-builder.service.js";
import {
  buildDailyDataset,
  computeCrossDomainCorrelations,
  computePainAreaFrequency,
} from "../../services/statistics.service.js";
import { getClientAndLanguage } from "../../services/claude.service.js";
import { prisma } from "../../db/prisma.js";

export const graphRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { profileId } = ctx;

    const [nodes, edges] = await Promise.all([
      ctx.prisma.graphNode.findMany({
        where: { profileId },
        orderBy: { createdAt: "asc" },
      }),
      ctx.prisma.graphEdge.findMany({
        where: { sourceNode: { profileId } },
      }),
    ]);

    return { nodes, edges };
  }),

  rebuild: protectedProcedure.mutation(async ({ ctx }) => {
    const { profileId } = ctx;
    await buildGraphForProfile(profileId);
    await prisma.settings.deleteMany({ where: { key: `graph_narrative_${profileId}` } });
    const [nodeCount, edgeCount] = await Promise.all([
      ctx.prisma.graphNode.count({ where: { profileId } }),
      ctx.prisma.graphEdge.count({ where: { sourceNode: { profileId } } }),
    ]);
    return { nodeCount, edgeCount };
  }),

  addNode: protectedProcedure
    .input(graphNodeCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const { profileId } = ctx;
      const metadata: Prisma.InputJsonObject = (input.metadata ?? {}) as Prisma.InputJsonObject;
      return ctx.prisma.graphNode.create({
        data: {
          profileId,
          nodeType: input.nodeType,
          label: input.label,
          metadata,
          reportId: input.reportId,
          conditionId: input.conditionId,
        },
      });
    }),

  deleteNode: protectedProcedure
    .input(idSchema)
    .mutation(async ({ ctx, input }) => {
      const { profileId } = ctx;
      const node = await ctx.prisma.graphNode.findFirst({
        where: { id: input.id, profileId },
      });
      if (!node) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.prisma.graphNode.delete({ where: { id: input.id } });
    }),

  addEdge: protectedProcedure
    .input(graphEdgeCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const { profileId } = ctx;
      const [source, target] = await Promise.all([
        ctx.prisma.graphNode.findFirst({ where: { id: input.sourceId, profileId } }),
        ctx.prisma.graphNode.findFirst({ where: { id: input.targetId, profileId } }),
      ]);
      if (!source || !target) throw new TRPCError({ code: "NOT_FOUND" });
      const metadata: Prisma.InputJsonObject = (input.metadata ?? {}) as Prisma.InputJsonObject;
      return ctx.prisma.graphEdge.create({
        data: { ...input, metadata },
      });
    }),

  deleteEdge: protectedProcedure
    .input(idSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.graphEdge.delete({ where: { id: input.id } });
    }),

  clear: protectedProcedure.mutation(async ({ ctx }) => {
    const { profileId } = ctx;
    await ctx.prisma.graphNode.deleteMany({ where: { profileId } });
  }),

  stats: protectedProcedure.query(async ({ ctx }) => {
    const { profileId } = ctx;
    const [nodeCount, edgeCount] = await Promise.all([
      ctx.prisma.graphNode.count({ where: { profileId } }),
      ctx.prisma.graphEdge.count({ where: { sourceNode: { profileId } } }),
    ]);
    return { nodeCount, edgeCount };
  }),

  updateNodeMetadata: protectedProcedure
    .input(z.object({ id: z.string().cuid(), metadata: z.record(z.unknown()) }))
    .mutation(async ({ ctx, input }) => {
      const { profileId } = ctx;
      const node = await ctx.prisma.graphNode.findFirst({
        where: { id: input.id, profileId },
      });
      if (!node) throw new TRPCError({ code: "NOT_FOUND" });
      const metadata: Prisma.InputJsonObject = input.metadata as Prisma.InputJsonObject;
      return ctx.prisma.graphNode.update({
        where: { id: input.id },
        data: { metadata },
      });
    }),

  getNarrative: protectedProcedure.query(async ({ ctx }) => {
    const { profileId } = ctx;
    const key = `graph_narrative_${profileId}`;
    const cached = await prisma.settings.findUnique({ where: { key } });
    return { narrative: cached?.value ?? null };
  }),

  generateNarrative: protectedProcedure.mutation(async ({ ctx }) => {
    const { profileId } = ctx;

    const [sleepLogs, diaryEntries, activityLogs, dietLogs, weightLogs, nodes, edges] = await Promise.all([
      prisma.sleepLog.findMany({ where: { profileId }, select: { date: true, hoursSlept: true, quality: true } }),
      prisma.healthDiary.findMany({ where: { profileId }, select: { date: true, energyLevel: true, moodLevel: true, painLevel: true, painArea: true } }),
      prisma.activityLog.findMany({ where: { profileId }, select: { date: true, durationMinutes: true, activityType: true, intensityLevel: true } }),
      prisma.dietLog.findMany({ where: { profileId }, select: { date: true, calories: true } }),
      prisma.weightLog.findMany({ where: { profileId }, select: { date: true, weightKg: true }, orderBy: { date: "desc" }, take: 90 }),
      ctx.prisma.graphNode.findMany({ where: { profileId }, orderBy: { createdAt: "asc" } }),
      ctx.prisma.graphEdge.findMany({ where: { sourceNode: { profileId } } }),
    ]);

    const dailyData = buildDailyDataset({ sleepLogs, diaryEntries, activityLogs, dietLogs, weightLogs });
    const crossCorrelations = computeCrossDomainCorrelations(dailyData, 30);
    const painFrequency = computePainAreaFrequency(diaryEntries);

    const METRIC_LABELS: Record<string, string> = {
      sleepHours: "sleep hours", sleepQuality: "sleep quality",
      energyLevel: "energy", moodLevel: "mood", painLevel: "pain",
      activityMinutes: "activity minutes", activityVolume: "activity volume (MET-min)",
      calories: "daily calories", weightKg: "weight",
    };

    const crossCorrText = crossCorrelations.length > 0
      ? `WITHIN-PERSON CROSS-DOMAIN CORRELATIONS (N-of-1, FDR-corrected, min n=30):\n` +
        crossCorrelations.slice(0, 12).map(c =>
          `${METRIC_LABELS[c.metricA] ?? c.metricA} ${c.lagDays > 0 ? `(lag ${c.lagDays}d) ` : ""}↔ ${METRIC_LABELS[c.metricB] ?? c.metricB}: ` +
          `r=${c.pearson > 0 ? "+" : ""}${c.pearson}, 95%CI=[${c.ci[0]},${c.ci[1]}], n=${c.n}, ${c.confidence} confidence${c.significant ? ", FDR-significant" : ", not FDR-significant"}`
        ).join("\n")
      : "WITHIN-PERSON CORRELATIONS: Insufficient data (need ≥30 co-observations per pair).";

    const painText = painFrequency.length > 0
      ? `PAIN AREA FREQUENCY:\n` + painFrequency.map(p =>
          `${p.area}: ${p.count} episodes, avg pain ${p.avgPain}/10, ${Math.round(p.frequency * 100)}% of pain days`
        ).join("\n")
      : "";

    const graphSummaryContext = {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodeTypes: [...new Set(nodes.map(n => n.nodeType))],
      crossDomainCorrelations: crossCorrText,
      painAreaFrequency: painText,
    };

    const SUMMARIZE_PROMPT = `You are a personal health analyst reviewing a user's self-tracked health data.

METHODOLOGICAL NOTE: These are N-of-1 within-person correlations computed on longitudinal self-tracked data. All correlations have been FDR-corrected (Benjamini-Hochberg, α=0.05) to control false discovery rate. Correlations with n<30 are excluded. Present findings as "signals worth monitoring" not established causal relationships. Always note confidence level and sample size.

Based on the provided data, produce a concise health summary (3–5 paragraphs) covering:
1. The most notable cross-domain correlations found in this person's data, with their confidence level and sample size
2. Any lag effects that suggest one domain predicts another the next day
3. Pain area patterns if present
4. Key caveats about the N-of-1 methodology and the distinction between correlation and causation
5. 2–3 actionable observations worth monitoring

Be precise about effect sizes. Do not fabricate data not present. Respond in the user's language if detectable.`;

    const { client } = await getClientAndLanguage();

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: SUMMARIZE_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(graphSummaryContext) }],
    });

    const textBlock = response.content.find(b => b.type === "text");
    const narrative = textBlock?.type === "text" ? textBlock.text : "";

    const key = `graph_narrative_${profileId}`;
    await prisma.settings.upsert({
      where: { key },
      create: { key, value: narrative },
      update: { value: narrative },
    });

    return { narrative };
  }),
});
