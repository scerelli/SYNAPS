import { z } from "zod";
import { idSchema } from "@synaps/shared";
import { protectedProcedure, router } from "../trpc.js";
import { updateWellbeingMetrics } from "../../services/metrics.service.js";

const diaryUpsertSchema = z.object({
  date: z.string().date(),
  energyLevel: z.number().int().min(1).max(5).nullable().optional(),
  moodLevel: z.number().int().min(1).max(5).nullable().optional(),
  painLevel: z.number().int().min(0).max(10).nullable().optional(),
  painArea: z.string().max(200).nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
});

export const diaryRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { profileId } = ctx;
    return ctx.prisma.healthDiary.findMany({
      where: { profileId },
      orderBy: { date: "desc" },
      take: 90,
    });
  }),

  upsert: protectedProcedure.input(diaryUpsertSchema).mutation(async ({ ctx, input }) => {
    const { profileId } = ctx;
    const { date, ...rest } = input;
    const dateObj = new Date(date);
    const result = await ctx.prisma.healthDiary.upsert({
      where: { profileId_date: { profileId, date: dateObj } },
      create: { ...rest, date: dateObj, profileId },
      update: rest,
    });
    await updateWellbeingMetrics(profileId, result.energyLevel, result.moodLevel, result.painLevel);
    return result;
  }),

  delete: protectedProcedure.input(idSchema).mutation(async ({ ctx, input }) => {
    return ctx.prisma.healthDiary.delete({ where: { id: input.id } });
  }),
});
