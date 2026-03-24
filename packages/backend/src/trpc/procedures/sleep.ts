import { z } from "zod";
import { idSchema } from "@synaps/shared";
import { protectedProcedure, router } from "../trpc.js";
import { updateSleepMetrics } from "../../services/metrics.service.js";

const sleepUpsertSchema = z.object({
  date: z.string().date(),
  hoursSlept: z.number().min(0).max(24),
  quality: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const sleepRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { profileId } = ctx;
    return ctx.prisma.sleepLog.findMany({
      where: { profileId },
      orderBy: { date: "desc" },
      take: 90,
    });
  }),

  upsert: protectedProcedure
    .input(sleepUpsertSchema)
    .mutation(async ({ ctx, input }) => {
      const { profileId } = ctx;
      const date = new Date(input.date);
      const { hoursSlept, quality, notes } = input;
      const result = await ctx.prisma.sleepLog.upsert({
        where: { profileId_date: { profileId, date } },
        create: { profileId, date, hoursSlept, quality, notes },
        update: { hoursSlept, quality, notes },
      });
      await updateSleepMetrics(profileId, input.hoursSlept, input.quality ?? null);
      return result;
    }),

  delete: protectedProcedure.input(idSchema).mutation(async ({ ctx, input }) => {
    return ctx.prisma.sleepLog.delete({ where: { id: input.id } });
  }),
});
