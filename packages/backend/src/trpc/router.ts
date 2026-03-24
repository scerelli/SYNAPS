import { router } from "./trpc.js";
import { authRouter } from "./procedures/auth.js";
import { profileRouter } from "./procedures/profile.js";
import { reportRouter } from "./procedures/report.js";
import { tagRouter } from "./procedures/tag.js";
import { settingsRouter } from "./procedures/settings.js";
import { graphRouter } from "./procedures/graph.js";
import { conditionRouter } from "./procedures/condition.js";
import { sleepRouter } from "./procedures/sleep.js";
import { dietRouter } from "./procedures/diet.js";
import { reminderRouter } from "./procedures/reminder.js";
import { environmentRouter } from "./procedures/environment.js";
import { exportRouter } from "./procedures/export.js";
import { activityRouter } from "./procedures/activity.js";
import { diaryRouter } from "./procedures/diary.js";
import { metricsRouter } from "./procedures/metrics.js";
import { weightRouter } from "./procedures/weight.js";
import { medicationRouter } from "./procedures/medication.js";
import { biomarkerRouter } from "./procedures/biomarker.js";

export const appRouter = router({
  auth: authRouter,
  profile: profileRouter,
  report: reportRouter,
  tag: tagRouter,
  settings: settingsRouter,
  graph: graphRouter,
  condition: conditionRouter,
  sleep: sleepRouter,
  diet: dietRouter,
  reminder: reminderRouter,
  environment: environmentRouter,
  export: exportRouter,
  activity: activityRouter,
  diary: diaryRouter,
  metrics: metricsRouter,
  weight: weightRouter,
  medication: medicationRouter,
  biomarker: biomarkerRouter,
});

export type AppRouter = typeof appRouter;
