import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import { prisma } from "../db/prisma.js";
import { auth } from "../lib/auth.js";
import { fromNodeHeaders } from "better-auth/node";

export async function createContext({ req }: CreateFastifyContextOptions) {
  let session = null;
  try {
    session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to resolve session");
  }

  req.log.debug({ authenticated: !!session, userId: session?.user.id }, "tRPC context");

  return {
    prisma,
    session: session
      ? { userId: session.user.id, authenticated: true as const }
      : { userId: "", authenticated: false as const },
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
