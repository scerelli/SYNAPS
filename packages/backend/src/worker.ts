import "dotenv/config";
import { Worker } from "bullmq";
import pino from "pino";
import { createRedisConnection } from "./lib/redis.js";
import {
  processAnalyzeReport,
  type AnalyzeReportPayload,
} from "./jobs/analyze-report.job.js";

const logger = pino();

const connection = createRedisConnection();

const analyzeWorker = new Worker(
  "analyze-report",
  processAnalyzeReport,
  { connection: connection as never, concurrency: 2 },
);

analyzeWorker.on("completed", (job) => {
  logger.info(`Job ${job.id} completed for report ${job.data.reportId}`);
});

analyzeWorker.on("failed", (job, err) => {
  logger.error(`Job ${job?.id} failed: ${err.message}`);
});

async function shutdown() {
  logger.info("Shutting down worker...");
  await analyzeWorker.close();
  await connection.quit();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

logger.info("Worker started, listening for jobs...");
