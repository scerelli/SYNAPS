import { z } from "zod";
import { idSchema, ACTIVITY_TYPES } from "@synaps/shared";
import { protectedProcedure, router } from "../trpc.js";
import { updateActivityMetrics } from "../../services/metrics.service.js";

const activityCreateSchema = z.object({
  date: z.string().date(),
  activityType: z.enum(ACTIVITY_TYPES),
  durationMinutes: z.number().int().min(1).max(1440),
  intensityLevel: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const activityRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { profileId } = ctx;
    return ctx.prisma.activityLog.findMany({
      where: { profileId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 90,
    });
  }),

  create: protectedProcedure.input(activityCreateSchema).mutation(async ({ ctx, input }) => {
    const { profileId } = ctx;
    const result = await ctx.prisma.activityLog.create({
      data: {
        profileId,
        date: new Date(input.date),
        activityType: input.activityType,
        durationMinutes: input.durationMinutes,
        intensityLevel: input.intensityLevel ?? null,
        notes: input.notes ?? null,
      },
    });
    await updateActivityMetrics(profileId, input.activityType, input.durationMinutes, input.intensityLevel ?? null);
    return result;
  }),

  delete: protectedProcedure.input(idSchema).mutation(async ({ ctx, input }) => {
    return ctx.prisma.activityLog.delete({ where: { id: input.id } });
  }),
});
