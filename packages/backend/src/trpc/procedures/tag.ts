import { publicProcedure, protectedProcedure, router } from "../trpc.js";
import { z } from "zod";

export const tagRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.prisma.tag.findMany({ orderBy: { name: "asc" } });
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const slug =
        input.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") ||
        input.name.toLowerCase().replace(/\s+/g, "-").slice(0, 50);
      return ctx.prisma.tag.create({
        data: { name: input.name, slug, color: input.color ?? "#6366f1" },
      });
    }),
});
