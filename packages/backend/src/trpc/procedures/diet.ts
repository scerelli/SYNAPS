import { z } from "zod";
import { idSchema, MEAL_TYPES } from "@synaps/shared";
import { protectedProcedure, router } from "../trpc.js";
import { estimateMealCalories } from "../../services/claude.service.js";
import { updateDietMetrics } from "../../services/metrics.service.js";

const dietListSchema = z.object({
  date: z.string().date().optional(),
});

const dietCreateSchema = z.object({
  date: z.string().date(),
  mealType: z.enum(MEAL_TYPES),
  description: z.string().min(1).max(2000),
  notes: z.string().max(2000).nullable().optional(),
});

export const dietRouter = router({
  list: protectedProcedure
    .input(dietListSchema)
    .query(async ({ ctx, input }) => {
      const { profileId } = ctx;
      return ctx.prisma.dietLog.findMany({
        where: {
          profileId,
          ...(input.date ? { date: new Date(input.date) } : {}),
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 100,
      });
    }),

  create: protectedProcedure
    .input(dietCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const { profileId } = ctx;
      const { date, ...rest } = input;

      let calories: number | null = null;
      let proteinG: number | null = null;
      let carbsG: number | null = null;
      let fatG: number | null = null;
      let caloriesAi = false;

      try {
        const estimate = await estimateMealCalories(input.description);
        if (estimate.calories > 0) {
          calories = estimate.calories;
          proteinG = estimate.protein;
          carbsG = estimate.carbs;
          fatG = estimate.fat;
          caloriesAi = true;
        }
      } catch {
      }

      const result = await ctx.prisma.dietLog.create({
        data: {
          ...rest,
          date: new Date(date),
          profileId,
          calories,
          caloriesAi,
          proteinG,
          carbsG,
          fatG,
        },
      });
      await updateDietMetrics(profileId, new Date(input.date));
      return result;
    }),

  delete: protectedProcedure.input(idSchema).mutation(async ({ ctx, input }) => {
    return ctx.prisma.dietLog.delete({ where: { id: input.id } });
  }),
});
