import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context.js";

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;

const isAuthed = middleware(({ ctx, next }) => {
  if (!ctx.session.authenticated) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session as { userId: string; authenticated: true },
    },
  });
});

const hasProfile = middleware(async ({ ctx, next }) => {
  if (!ctx.session.authenticated) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const profile = await ctx.prisma.profile.findUnique({
    where: { userId: ctx.session.userId },
  });
  if (!profile) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found" });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session as { userId: string; authenticated: true },
      profileId: profile.id,
    },
  });
});

export const authedProcedure = t.procedure.use(isAuthed);
export const protectedProcedure = t.procedure.use(hasProfile);
