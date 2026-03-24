import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc.js";
import { getMetricSnapshot } from "../../services/metrics.service.js";

export const metricsRouter = router({
  snapshot: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.profileId) throw new TRPCError({ code: "UNAUTHORIZED" });
    return getMetricSnapshot(ctx.profileId);
  }),
});
