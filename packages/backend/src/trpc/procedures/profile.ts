import {
  allergyCreateSchema,
  allergyUpdateSchema,
  idSchema,
  userProfileSchema,
} from "@synaps/shared";
import { authedProcedure, protectedProcedure, router } from "../trpc.js";

export const profileRouter = router({
  get: authedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.profile.findUnique({
      where: { userId: ctx.session.userId },
      include: { allergies: true, user: { select: { name: true, email: true } } },
    });
  }),

  create: authedProcedure
    .input(userProfileSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.profile.create({
        data: {
          userId: ctx.session.userId,
          dateOfBirth: input.dateOfBirth!,
          sex: input.sex!,
          bloodType: input.bloodType,
          heightCm: input.heightCm,
          latitude: input.latitude,
          longitude: input.longitude,
          dietaryPreference: input.dietaryPreference,
          smokingStatus: input.smokingStatus,
          cigarettesPerDay: input.cigarettesPerDay,
          smokeQuitDate: input.smokeQuitDate ? new Date(input.smokeQuitDate) : null,
        },
        include: { allergies: true },
      });
    }),

  update: protectedProcedure
    .input(userProfileSchema.partial())
    .mutation(async ({ ctx, input }) => {
      if (input.name) {
        await ctx.prisma.user.update({
          where: { id: ctx.session.userId },
          data: { name: input.name },
        });
      }
      return ctx.prisma.profile.update({
        where: { userId: ctx.session.userId },
        data: {
          ...(input.dateOfBirth !== undefined && { dateOfBirth: input.dateOfBirth }),
          ...(input.sex !== undefined && { sex: input.sex }),
          ...(input.bloodType !== undefined && { bloodType: input.bloodType }),
          ...(input.heightCm !== undefined && { heightCm: input.heightCm }),
          ...(input.latitude !== undefined && { latitude: input.latitude }),
          ...(input.longitude !== undefined && { longitude: input.longitude }),
          ...(input.dietaryPreference !== undefined && {
            dietaryPreference: input.dietaryPreference,
          }),
          ...(input.smokingStatus !== undefined && {
            smokingStatus: input.smokingStatus,
          }),
          ...(input.cigarettesPerDay !== undefined && {
            cigarettesPerDay: input.cigarettesPerDay,
          }),
          ...(input.smokeQuitDate !== undefined && {
            smokeQuitDate: input.smokeQuitDate ? new Date(input.smokeQuitDate) : null,
          }),
        },
        include: { allergies: true },
      });
    }),

  addAllergy: protectedProcedure
    .input(allergyCreateSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.allergy.create({
        data: { ...input, profileId: ctx.profileId! },
      });
    }),

  updateAllergy: protectedProcedure
    .input(allergyUpdateSchema.extend({ id: idSchema.shape.id }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.allergy.update({ where: { id }, data });
    }),

  removeAllergy: protectedProcedure
    .input(idSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.allergy.delete({ where: { id: input.id } });
    }),
});
