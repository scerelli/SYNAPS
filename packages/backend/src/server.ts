import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import {
  fastifyTRPCPlugin,
  type FastifyTRPCPluginOptions,
} from "@trpc/server/adapters/fastify";
import { MAX_UPLOAD_SIZE_BYTES } from "@synaps/shared";
import { appRouter, type AppRouter } from "./trpc/router.js";
import { createContext } from "./trpc/context.js";
import { registerUploadRoutes } from "./routes/upload.js";
import { registerFileRoutes } from "./routes/files.js";
import { auth } from "./lib/auth.js";

const PORT = Number(process.env.PORT ?? 3000);

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true,
  });
  await app.register(cookie);
  await app.register(multipart, {
    limits: { fileSize: MAX_UPLOAD_SIZE_BYTES },
  });

  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request, reply) {
      const url = new URL(
        request.url,
        `http://${request.headers.host}`,
      );
      const headers = new Headers();
      Object.entries(request.headers).forEach(([key, value]) => {
        if (value) headers.append(key, value.toString());
      });
      let body: string | undefined;
      if (request.body !== undefined && request.body !== null) {
        body = JSON.stringify(request.body);
      }
      const req = new Request(url.toString(), {
        method: request.method,
        headers,
        ...(body !== undefined ? { body } : {}),
      });
      const response = await auth.handler(req);
      reply.status(response.status);
      response.headers.forEach((value, key) => {
        if (key === "set-cookie") return;
        reply.header(key, value);
      });
      const cookies = response.headers.getSetCookie();
      for (const cookie of cookies) {
        reply.header("set-cookie", cookie);
      }
      const text = await response.text();
      reply.send(text || null);
    },
  });

  await app.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    trpcOptions: {
      router: appRouter,
      createContext,
    } satisfies FastifyTRPCPluginOptions<AppRouter>["trpcOptions"],
  });

  await registerUploadRoutes(app);
  await registerFileRoutes(app);

  app.get("/api/health", async () => ({ status: "ok" }));

  await app.listen({ port: PORT, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
