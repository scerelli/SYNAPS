import Anthropic from "@anthropic-ai/sdk";
import { settingSchema, idSchema } from "@synaps/shared";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc.js";
import { encrypt, decrypt } from "../../lib/encryption.js";

const ENCRYPTED_KEYS = new Set(["claude_api_key"]);

export const settingsRouter = router({
  get: protectedProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ ctx, input }) => {
      const setting = await ctx.prisma.settings.findUnique({
        where: { key: input.key },
      });
      if (!setting) return null;
      if (ENCRYPTED_KEYS.has(input.key)) {
        return { ...setting, value: decrypt(setting.value) };
      }
      return setting;
    }),

  getAll: protectedProcedure.query(async ({ ctx }) => {
    const settings = await ctx.prisma.settings.findMany();
    return settings.map((s) => {
      if (ENCRYPTED_KEYS.has(s.key)) {
        return { ...s, value: "••••••••" };
      }
      return s;
    });
  }),

  set: protectedProcedure
    .input(settingSchema)
    .mutation(async ({ ctx, input }) => {
      const value = ENCRYPTED_KEYS.has(input.key)
        ? encrypt(input.value)
        : input.value;

      return ctx.prisma.settings.upsert({
        where: { key: input.key },
        update: { value },
        create: { key: input.key, value },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ key: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.settings.deleteMany({ where: { key: input.key } });
    }),

  testClaudeConnection: protectedProcedure.mutation(async ({ ctx }) => {
    const setting = await ctx.prisma.settings.findUnique({
      where: { key: "claude_api_key" },
    });
    if (!setting) {
      return { success: false, error: "No API key configured" };
    }
    try {
      const apiKey = decrypt(setting.value);
      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 10,
        messages: [{ role: "user", content: "Reply with OK" }],
      });
      return { success: true, model: response.model };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      return { success: false, error: message };
    }
  }),
});
