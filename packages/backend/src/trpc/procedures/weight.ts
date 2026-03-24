import { idSchema, weightLogCreateSchema, weightLogListSchema } from "@synaps/shared";
import { protectedProcedure, router } from "../trpc.js";
import { updateWeightMetrics } from "../../services/metrics.service.js";

export const weightRouter = router({
  list: protectedProcedure
    .input(weightLogListSchema)
    .query(async ({ ctx, input }) => {
      const { profileId } = ctx;
      return ctx.prisma.weightLog.findMany({
        where: { profileId },
        orderBy: { date: "desc" },
        take: input.limit,
      });
    }),

  create: protectedProcedure
    .input(weightLogCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const { profileId } = ctx;
      const result = await ctx.prisma.weightLog.create({
        data: {
          profileId,
          date: new Date(input.date),
          weightKg: input.weightKg,
          bodyFatPct: input.bodyFatPct,
          waistCm: input.waistCm,
          notes: input.notes,
        },
      });
      await updateWeightMetrics(
        profileId,
        input.weightKg,
        input.bodyFatPct ?? null,
        input.waistCm ?? null,
      );
      return result;
    }),

  delete: protectedProcedure.input(idSchema).mutation(async ({ ctx, input }) => {
    const { profileId } = ctx;
    await ctx.prisma.weightLog.findFirstOrThrow({
      where: { id: input.id, profileId },
    });
    return ctx.prisma.weightLog.delete({ where: { id: input.id } });
  }),
});
