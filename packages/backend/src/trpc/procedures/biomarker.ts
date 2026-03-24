import { z } from "zod";
import { protectedProcedure, router } from "../trpc.js";

export const biomarkerRouter = router({
  biomarkerNames: protectedProcedure.query(async ({ ctx }) => {
    const { profileId } = ctx;
    const entries = await ctx.prisma.reportEntry.findMany({
      where: { report: { profileId } },
      select: { biomarkerName: true, unit: true },
    });
    const map = new Map<string, { count: number; unit: string }>();
    for (const e of entries) {
      const existing = map.get(e.biomarkerName);
      if (existing) existing.count++;
      else map.set(e.biomarkerName, { count: 1, unit: e.unit });
    }
    return Array.from(map.entries())
      .map(([name, { count, unit }]) => ({ name, count, unit }))
      .sort((a, b) => b.count - a.count);
  }),

  timeSeries: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const { profileId } = ctx;
      const entries = await ctx.prisma.reportEntry.findMany({
        where: {
          biomarkerName: input.name,
          report: { profileId },
        },
        include: { report: { select: { reportDate: true } } },
        orderBy: { report: { reportDate: "asc" } },
      });

      const metricState = await ctx.prisma.metricState.findUnique({
        where: {
          profileId_domain_metricKey: {
            profileId,
            domain: "biomarker",
            metricKey: input.name,
          },
        },
      });

      return {
        points: entries.map((e) => ({
          date: e.report.reportDate.toISOString(),
          value: e.value,
          unit: e.unit,
          referenceMin: e.referenceMin,
          referenceMax: e.referenceMax,
          status: e.status,
        })),
        ema: metricState?.ema ?? null,
        trend: metricState
          ? (() => {
              const stdDev = Math.sqrt(metricState.emVar);
              const threshold = stdDev * 0.2;
              if (metricState.shortEma > metricState.ema + threshold)
                return "increasing" as const;
              if (metricState.shortEma < metricState.ema - threshold)
                return "decreasing" as const;
              return "stable" as const;
            })()
          : null,
        zScore:
          metricState && metricState.emVar > 0
            ? (metricState.lastValue - metricState.ema) /
              Math.sqrt(metricState.emVar)
            : null,
      };
    }),
});
