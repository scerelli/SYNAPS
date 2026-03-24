import { z } from "zod";
import { idSchema } from "@synaps/shared";
import { protectedProcedure, router } from "../trpc.js";

const conditionCreateSchema = z.object({
  name: z.string().min(1).max(300),
  diagnosedAt: z.coerce.date().nullable().optional(),
  isCurrent: z.boolean().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

const conditionUpdateSchema = z.object({
  id: idSchema.shape.id,
  name: z.string().min(1).max(300).optional(),
  diagnosedAt: z.coerce.date().nullable().optional(),
  resolvedAt: z.coerce.date().nullable().optional(),
  isCurrent: z.boolean().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export const conditionRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { profileId } = ctx;
    return ctx.prisma.condition.findMany({
      where: { profileId },
      orderBy: { createdAt: "desc" },
    });
  }),

  create: protectedProcedure
    .input(conditionCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const { profileId } = ctx;
      return ctx.prisma.condition.create({
        data: { ...input, profileId },
      });
    }),

  update: protectedProcedure
    .input(conditionUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.condition.update({ where: { id }, data });
    }),

  delete: protectedProcedure.input(idSchema).mutation(async ({ ctx, input }) => {
    return ctx.prisma.condition.delete({ where: { id: input.id } });
  }),
});
