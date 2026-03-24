import type { Job } from "bullmq";
import { prisma } from "../db/prisma.js";
import { analyzeReportImage, analyzeReportPdf } from "../services/claude.service.js";
import { updateBiomarkerMetrics } from "../services/metrics.service.js";
import { associateReportTags, createReportEntries } from "../lib/report-helpers.js";

export type AnalyzeReportPayload = {
  reportId: string;
  fileId: string;
  filePath: string;
  mimeType: string;
  analysisId: string;
};

export async function processAnalyzeReport(job: Job<AnalyzeReportPayload>): Promise<void> {
  const { reportId, filePath, mimeType, analysisId } = job.data;

  await prisma.aiAnalysis.update({
    where: { id: analysisId },
    data: { status: "processing" },
  });

  try {
    const result =
      mimeType === "application/pdf"
        ? await analyzeReportPdf(filePath)
        : await analyzeReportImage(filePath, mimeType);

    const report = await prisma.report.findUnique({
      where: { id: reportId },
      select: { title: true, notes: true, profileId: true },
    });

    const updates: { title?: string; notes?: string } = {};
    if (report && result.suggestedTitle && report.title === "Untitled") {
      updates.title = result.suggestedTitle;
    }
    if (report && result.summary && !report.notes) {
      updates.notes = result.summary;
    }

    await prisma.$transaction(async (tx) => {
      if (Object.keys(updates).length > 0) {
        await tx.report.update({ where: { id: reportId }, data: updates });
      }

      await createReportEntries(tx, reportId, result.entries);
      await associateReportTags(tx, reportId, result.suggestedTagSlugs);

      await tx.aiAnalysis.update({
        where: { id: analysisId },
        data: {
          rawResponse: result.rawResponse,
          modelUsed: result.modelUsed,
          tokensUsed: result.tokensUsed,
          status: "completed",
        },
      });
    });

    if (report?.profileId && result.entries.length > 0) {
      await updateBiomarkerMetrics(
        report.profileId,
        result.entries.map((e) => ({ biomarkerName: e.biomarkerName, value: e.value })),
      );
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    await prisma.aiAnalysis.update({
      where: { id: analysisId },
      data: { status: "failed", errorMessage: message },
    });
    throw e;
  }
}
