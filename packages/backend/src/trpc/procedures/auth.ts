import { publicProcedure, router } from "../trpc.js";

export const authRouter = router({
  session: publicProcedure.query(({ ctx }) => {
    return ctx.session;
  }),

  hasUsers: publicProcedure.query(async ({ ctx }) => {
    const count = await ctx.prisma.user.count();
    return { hasUsers: count > 0 };
  }),
});
