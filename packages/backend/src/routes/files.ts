import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import { prisma } from "../db/prisma.js";
import { auth } from "../lib/auth.js";
import { fromNodeHeaders } from "better-auth/node";

export async function registerFileRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/files/:fileId", async (request, reply) => {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });
    if (!session) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { fileId } = request.params as { fileId: string };

    const file = await prisma.reportFile.findUnique({
      where: { id: fileId },
      include: { report: { select: { profile: { select: { userId: true } } } } },
    });

    if (!file) {
      return reply.status(404).send({ error: "File not found" });
    }

    if (file.report.profile.userId !== session.user.id) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    try {
      await stat(file.storagePath);
    } catch {
      return reply.status(404).send({ error: "File not found on disk" });
    }

    reply.header("Content-Type", file.mimeType);
    reply.header(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(file.originalName)}"`,
    );

    return reply.send(createReadStream(file.storagePath));
  });
}
