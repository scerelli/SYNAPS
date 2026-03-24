import type { Prisma } from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;

export async function findOrCreateDoctor(
  prisma: TransactionClient,
  name: string,
  specialty?: string | null,
): Promise<{ id: string }> {
  let doctor = await prisma.doctor.findFirst({ where: { name } });
  if (!doctor) {
    doctor = await prisma.doctor.create({
      data: { name, specialty: specialty ?? undefined },
    });
  } else if (specialty && !doctor.specialty) {
    doctor = await prisma.doctor.update({
      where: { id: doctor.id },
      data: { specialty },
    });
  }
  return { id: doctor.id };
}

export async function createReportEntries(
  prisma: TransactionClient,
  reportId: string,
  entries: Array<{
    biomarkerName: string;
    value: number;
    unit: string;
    referenceMin?: number | null;
    referenceMax?: number | null;
    status?: string | null;
  }>,
): Promise<void> {
  for (const entry of entries) {
    await prisma.reportEntry.create({ data: { reportId, ...entry } });
  }
}

export async function associateReportTags(
  prisma: TransactionClient,
  reportId: string,
  tagSlugs: string[],
): Promise<void> {
  if (tagSlugs.length === 0) return;
  const tags = await prisma.tag.findMany({
    where: { slug: { in: tagSlugs } },
    select: { id: true },
  });
  for (const tag of tags) {
    await prisma.reportTag.upsert({
      where: { reportId_tagId: { reportId, tagId: tag.id } },
      update: {},
      create: { reportId, tagId: tag.id },
    });
  }
}
