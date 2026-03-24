import { TRPCError } from "@trpc/server";
import {
  analyzeNotesSchema,
  idSchema,
  reportChatSchema,
  reportCreateSchema,
  reportEntryCreateSchema,
  reportEntryUpdateSchema,
  reportListSchema,
  reportUpdateSchema,
} from "@synaps/shared";
import { protectedProcedure, router } from "../trpc.js";
import { chatWithReport, extractFromNotes } from "../../services/claude.service.js";
import { updateBiomarkerMetrics } from "../../services/metrics.service.js";
import { associateReportTags, createReportEntries, findOrCreateDoctor } from "../../lib/report-helpers.js";

const REPORT_INCLUDE = {
  files: true,
  entries: { orderBy: { biomarkerName: "asc" } },
  aiAnalyses: { orderBy: { createdAt: "desc" } },
  tags: { include: { tag: true } },
  doctor: true,
} as const;

export const reportRouter = router({
  list: protectedProcedure
    .input(reportListSchema)
    .query(async ({ ctx, input }) => {
      const { profileId } = ctx;
      const { cursor, limit, tagIds, dateFrom, dateTo, search } = input;
      const where = {
        profileId,
        deletedAt: null,
        ...(tagIds?.length && { tags: { some: { tagId: { in: tagIds } } } }),
        ...(dateFrom || dateTo
          ? {
              reportDate: {
                ...(dateFrom && { gte: dateFrom }),
                ...(dateTo && { lte: dateTo }),
              },
            }
          : {}),
        ...(search && {
          title: { contains: search, mode: "insensitive" as const },
        }),
      };

      const items = await ctx.prisma.report.findMany({
        where,
        take: limit + 1,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        orderBy: { reportDate: "desc" },
        include: {
          files: true,
          tags: { include: { tag: true } },
          _count: { select: { entries: true, aiAnalyses: true } },
        },
      });

      let nextCursor: string | undefined;
      if (items.length > limit) {
        const next = items.pop();
        nextCursor = next?.id;
      }

      return { items, nextCursor };
    }),

  get: protectedProcedure.input(idSchema).query(async ({ ctx, input }) => {
    const { profileId } = ctx;
    const report = await ctx.prisma.report.findFirst({
      where: { id: input.id, profileId, deletedAt: null },
      include: REPORT_INCLUDE,
    });
    if (!report) throw new TRPCError({ code: "NOT_FOUND" });
    return report;
  }),

  create: protectedProcedure
    .input(reportCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const { profileId } = ctx;
      const { tagIds, ...rest } = input;
      return ctx.prisma.report.create({
        data: {
          ...rest,
          profileId,
          ...(tagIds?.length && {
            tags: { create: tagIds.map((tagId) => ({ tagId })) },
          }),
        },
        include: REPORT_INCLUDE,
      });
    }),

  update: protectedProcedure
    .input(reportUpdateSchema.extend({ id: idSchema.shape.id }))
    .mutation(async ({ ctx, input }) => {
      const { id, tagIds, doctorName, doctorSpecialty, ...data } = input;

      let doctorId: string | null | undefined;
      if (doctorName !== undefined) {
        if (!doctorName) {
          doctorId = null;
        } else {
          const doctor = await findOrCreateDoctor(ctx.prisma, doctorName, doctorSpecialty);
          doctorId = doctor.id;
        }
      }

      return ctx.prisma.report.update({
        where: { id },
        data: {
          ...data,
          ...(doctorId !== undefined && { doctorId }),
          ...(tagIds !== undefined && {
            tags: {
              deleteMany: {},
              create: tagIds.map((tagId) => ({ tagId })),
            },
          }),
        },
        include: REPORT_INCLUDE,
      });
    }),

  delete: protectedProcedure.input(idSchema).mutation(async ({ ctx, input }) => {
    return ctx.prisma.report.update({
      where: { id: input.id },
      data: { deletedAt: new Date() },
    });
  }),

  addEntry: protectedProcedure
    .input(reportEntryCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const { profileId } = ctx;
      const result = await ctx.prisma.reportEntry.create({ data: input });
      await updateBiomarkerMetrics(profileId, [{ biomarkerName: input.biomarkerName, value: input.value }]);
      return result;
    }),

  updateEntry: protectedProcedure
    .input(reportEntryUpdateSchema.extend({ id: idSchema.shape.id }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.reportEntry.update({ where: { id }, data });
    }),

  deleteEntry: protectedProcedure.input(idSchema).mutation(async ({ ctx, input }) => {
    return ctx.prisma.reportEntry.delete({ where: { id: input.id } });
  }),

  chat: protectedProcedure
    .input(reportChatSchema)
    .mutation(async ({ ctx, input }) => {
      const { profileId } = ctx;
      const report = await ctx.prisma.report.findFirst({
        where: { id: input.id, profileId, deletedAt: null },
        include: REPORT_INCLUDE,
      });
      if (!report) throw new TRPCError({ code: "NOT_FOUND" });

      const answer = await chatWithReport(report, input.message);
      return { answer };
    }),

  analyzeNotes: protectedProcedure
    .input(analyzeNotesSchema)
    .mutation(async ({ ctx, input }) => {
      const { profileId } = ctx;
      const report = await ctx.prisma.report.findFirst({
        where: { id: input.id, profileId, deletedAt: null },
      });
      if (!report) throw new TRPCError({ code: "NOT_FOUND" });

      const extracted = await extractFromNotes(input.notes);

      return ctx.prisma.$transaction(async (tx) => {
        const updates: { title?: string; notes?: string } = {};
        if (!report.title || report.title === "Untitled") updates.title = extracted.title;
        if (!report.notes) updates.notes = extracted.cleanedNotes;

        if (Object.keys(updates).length > 0) {
          await tx.report.update({ where: { id: input.id }, data: updates });
        }

        await createReportEntries(tx, input.id, extracted.entries);
        await updateBiomarkerMetrics(profileId, extracted.entries.map((e) => ({ biomarkerName: e.biomarkerName, value: e.value })));
        await associateReportTags(tx, input.id, extracted.tagSlugs);

        return tx.report.findFirst({
          where: { id: input.id },
          include: REPORT_INCLUDE,
        });
      });
    }),
});
