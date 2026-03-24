import { idSchema, medicationCreateSchema, medicationUpdateSchema } from "@synaps/shared";
import { protectedProcedure, router } from "../trpc.js";

export const medicationRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.medication.findMany({
      where: { profileId: ctx.profileId! },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });
  }),

  create: protectedProcedure
    .input(medicationCreateSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.medication.create({
        data: {
          ...input,
          startDate: input.startDate ? new Date(input.startDate) : null,
          profileId: ctx.profileId!,
        },
      });
    }),

  update: protectedProcedure
    .input(medicationUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await ctx.prisma.medication.findFirstOrThrow({
        where: { id, profileId: ctx.profileId! },
      });
      return ctx.prisma.medication.update({
        where: { id },
        data: {
          ...data,
          ...(data.startDate !== undefined && {
            startDate: data.startDate ? new Date(data.startDate) : null,
          }),
        },
      });
    }),

  delete: protectedProcedure
    .input(idSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.medication.findFirstOrThrow({
        where: { id: input.id, profileId: ctx.profileId! },
      });
      return ctx.prisma.medication.delete({ where: { id: input.id } });
    }),
});
