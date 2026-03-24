import { protectedProcedure, router } from "../trpc.js";

export const exportRouter = router({
  full: protectedProcedure.query(async ({ ctx }) => {
    const { profileId } = ctx;

    const [profile, reports, graphNodes, graphEdges] = await Promise.all([
      ctx.prisma.profile.findUnique({
        where: { id: profileId },
        include: {
          allergies: true,
          conditions: true,
          sleepLogs: true,
          dietLogs: true,
          reminders: true,
          activityLogs: true,
          healthDiaries: true,
          metricStates: true,
          weightLogs: true,
          medications: true,
          user: { select: { name: true, email: true } },
        },
      }),
      ctx.prisma.report.findMany({
        where: { profileId, deletedAt: null },
        include: {
          entries: true,
          tags: { include: { tag: true } },
          files: {
            select: {
              id: true,
              originalName: true,
              mimeType: true,
              sizeBytes: true,
              createdAt: true,
            },
          },
        },
        orderBy: { reportDate: "desc" },
      }),
      ctx.prisma.graphNode.findMany({
        where: { profileId },
      }),
      ctx.prisma.graphEdge.findMany({
        where: { sourceNode: { profileId } },
      }),
    ]);

    return { profile, reports, graphNodes, graphEdges };
  }),
});
