import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import type { FastifyInstance } from "fastify";
import { ALLOWED_MIME_TYPES, MAX_UPLOAD_SIZE_BYTES } from "@synaps/shared";
import { prisma } from "../db/prisma.js";
import { auth } from "../lib/auth.js";
import { fromNodeHeaders } from "better-auth/node";
import { analyzeReportImage, analyzeReportPdf } from "../services/claude.service.js";
import { associateReportTags, createReportEntries, findOrCreateDoctor } from "../lib/report-helpers.js";

const MAGIC_BYTES: Record<string, number[]> = {
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/webp": [0x52, 0x49, 0x46, 0x46],
  "application/pdf": [0x25, 0x50, 0x44, 0x46],
};

function validateMagicBytes(buffer: Buffer, declaredMime: string): boolean {
  const expected = MAGIC_BYTES[declaredMime];
  if (!expected) return false;
  for (let idx = 0; idx < expected.length; idx++) {
    if (buffer[idx] !== expected[idx]) return false;
  }
  return true;
}

function sanitizeFilename(raw: string): string {
  return basename(raw).replace(/[^\w.\-]/g, "_").slice(0, 200) || "file";
}

const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? resolve(process.env.UPLOAD_DIR)
  : resolve(process.cwd(), "uploads");

async function analyzeAndStore(
  reportId: string,
  filePath: string,
  mimeType: string,
): Promise<void> {
  const analysis = await prisma.aiAnalysis.create({
    data: { reportId, rawResponse: "", modelUsed: "", status: "processing" },
  });

  try {
    const result =
      mimeType === "application/pdf"
        ? await analyzeReportPdf(filePath)
        : await analyzeReportImage(filePath, mimeType);

    const report = await prisma.report.findUnique({
      where: { id: reportId },
      select: { title: true, notes: true },
    });

    await prisma.$transaction(async (tx) => {
      const updates: {
        title?: string;
        notes?: string;
        facility?: string;
        examType?: string;
        doctorId?: string;
      } = {};

      if (report?.title === "Untitled" && result.suggestedTitle) {
        updates.title = result.suggestedTitle;
      }
      if (!report?.notes && result.summary) {
        updates.notes = result.summary;
      }
      if (result.facilityName) {
        updates.facility = result.facilityName;
      }
      if (result.examType) {
        updates.examType = result.examType;
      }
      if (result.doctorName) {
        const doctor = await findOrCreateDoctor(tx, result.doctorName, result.doctorSpecialty);
        updates.doctorId = doctor.id;
      }

      if (Object.keys(updates).length > 0) {
        await tx.report.update({ where: { id: reportId }, data: updates });
      }

      await createReportEntries(tx, reportId, result.entries);
      await associateReportTags(tx, reportId, result.suggestedTagSlugs);

      await tx.aiAnalysis.update({
        where: { id: analysis.id },
        data: {
          rawResponse: result.rawResponse,
          modelUsed: result.modelUsed,
          tokensUsed: result.tokensUsed,
          status: "completed",
        },
      });
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    await prisma.aiAnalysis.update({
      where: { id: analysis.id },
      data: { status: "failed", errorMessage: message },
    });
  }
}

export async function registerUploadRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/upload", async (request, reply) => {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });
    if (!session) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const parts = request.parts();
    let reportId: string | undefined;
    const savedFiles: Array<{ id: string; path: string; mimeType: string }> = [];

    try {
      for await (const part of parts) {
        if (part.type === "field" && part.fieldname === "reportId") {
          reportId = String(part.value);
          continue;
        }

        if (part.type !== "file") continue;

        if (!reportId) {
          await part.toBuffer();
          return reply.status(400).send({ error: "reportId must come before file fields" });
        }

        const report = await prisma.report.findFirst({
          where: { id: reportId, profile: { userId: session.user.id }, deletedAt: null },
          select: { id: true },
        });
        if (!report) {
          await part.toBuffer();
          return reply.status(403).send({ error: "Report not found or access denied" });
        }

        const mimeType = part.mimetype;
        if (!ALLOWED_MIME_TYPES.includes(mimeType as (typeof ALLOWED_MIME_TYPES)[number])) {
          await part.toBuffer();
          return reply.status(400).send({ error: `Unsupported file type: ${mimeType}` });
        }

        const chunks: Buffer[] = [];
        let totalSize = 0;
        for await (const chunk of part.file) {
          totalSize += chunk.length;
          if (totalSize > MAX_UPLOAD_SIZE_BYTES) {
            part.file.resume();
            return reply.status(413).send({ error: "File exceeds 20MB limit" });
          }
          chunks.push(Buffer.from(chunk));
        }

        const buffer = Buffer.concat(chunks);

        if (!validateMagicBytes(buffer, mimeType)) {
          return reply.status(400).send({ error: "File content does not match declared type" });
        }

        const dir = join(UPLOAD_DIR, reportId);
        await mkdir(dir, { recursive: true });

        const safeFilename = `${randomUUID()}-${sanitizeFilename(part.filename)}`;
        const filePath = join(dir, safeFilename);
        await writeFile(filePath, buffer);

        const fileRecord = await prisma.reportFile.create({
          data: {
            reportId,
            originalName: sanitizeFilename(part.filename),
            storagePath: filePath,
            mimeType,
            sizeBytes: buffer.length,
          },
        });

        savedFiles.push({ id: fileRecord.id, path: filePath, mimeType });
      }

      const results = await Promise.allSettled(
        savedFiles.map((file) => analyzeAndStore(reportId!, file.path, file.mimeType)),
      );
      const analyzed = results.filter((r) => r.status === "fulfilled").length;
      results.forEach((r, i) => {
        if (r.status === "rejected") {
          request.log.error({ err: r.reason, fileId: savedFiles[i]?.id }, "Analysis failed");
        }
      });

      return reply.send({ files: savedFiles.map((f) => f.id), analyzed });
    } catch (err) {
      for (const file of savedFiles) {
        await unlink(file.path).catch(() => undefined);
        await prisma.reportFile.delete({ where: { id: file.id } }).catch(() => undefined);
      }
      const msg = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, "Upload failed");
      return reply.status(500).send({ error: `Upload failed: ${msg}` });
    }
  });
}
