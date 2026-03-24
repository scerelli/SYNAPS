import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { DEFAULT_TAGS } from "@synaps/shared";
import { scrypt, randomBytes } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function daysAgo(n: number): Date {
  const d = new Date("2026-03-24");
  d.setDate(d.getDate() - n);
  return d;
}

function dateOnly(d: Date): Date {
  return new Date(d.toISOString().split("T")[0]!);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function noise(amplitude: number): number {
  return (Math.random() - 0.5) * 2 * amplitude;
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = (await scryptAsync(password.normalize("NFKC"), salt, 64, { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 })) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

async function main() {
  console.log("Clearing all data...");
  await prisma.graphEdge.deleteMany({});
  await prisma.graphNode.deleteMany({});
  await prisma.metricState.deleteMany({});
  await prisma.reminder.deleteMany({});
  await prisma.healthDiary.deleteMany({});
  await prisma.activityLog.deleteMany({});
  await prisma.dietLog.deleteMany({});
  await prisma.sleepLog.deleteMany({});
  await prisma.weightLog.deleteMany({});
  await prisma.medication.deleteMany({});
  await prisma.condition.deleteMany({});
  await prisma.reportEntry.deleteMany({});
  await prisma.aiAnalysis.deleteMany({});
  await prisma.reportFile.deleteMany({});
  await prisma.report.deleteMany({});
  await prisma.allergy.deleteMany({});
  await prisma.profile.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.verification.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.settings.deleteMany({});
  await prisma.environmentCache.deleteMany({});

  console.log("Creating demo user...");
  const userId = `demo_${Date.now()}`;
  const user = await prisma.user.create({
    data: {
      id: userId,
      email: "demo@synaps.local",
      name: "Marco Ferretti",
      emailVerified: true,
    },
  });
  const pwHash = await hashPassword("12345");
  await prisma.account.create({
    data: {
      id: `acc_${Date.now()}`,
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      password: pwHash,
    },
  });

  console.log("Seeding tags...");
  for (const tag of DEFAULT_TAGS) {
    await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: { name: tag.name, color: tag.color },
      create: { name: tag.name, slug: tag.slug, color: tag.color },
    });
  }

  console.log("Creating profile...");
  const profile = await prisma.profile.create({
    data: {
      userId: user.id,
      dateOfBirth: new Date("1986-04-12"),
      sex: "male",
      bloodType: "A+",
      heightCm: 178,
      latitude: 45.4642,
      longitude: 9.19,
      dietaryPreference: "omnivore",
      smokingStatus: "never",
      allergies: {
        create: [
          { name: "Dust Mites", severity: "moderate" },
          { name: "Nickel", severity: "mild" },
        ],
      },
    },
  });
  console.log(`Profile created: ${profile.id}`);

  console.log("Creating medications...");
  await prisma.medication.createMany({
    data: [
      {
        profileId: profile.id,
        name: "Levothyroxine",
        dosage: "50 mcg",
        frequency: "daily",
        startDate: new Date("2022-02-15"),
        isActive: true,
      },
      {
        profileId: profile.id,
        name: "Cetirizine",
        dosage: "10 mg",
        frequency: "as needed",
        startDate: new Date("2016-03-01"),
        isActive: true,
      },
    ],
  });

  console.log("Creating conditions...");
  const condHashimoto = await prisma.condition.create({
    data: {
      profileId: profile.id,
      name: "Hashimoto's Thyroiditis",
      diagnosedAt: new Date("2022-01-10"),
      isCurrent: true,
      notes: "Autoimmune hypothyroidism. TSH moderately elevated despite Levothyroxine 50mcg.",
    },
  });
  const condIronAnemia = await prisma.condition.create({
    data: {
      profileId: profile.id,
      name: "Iron Deficiency Anemia",
      diagnosedAt: new Date("2023-05-20"),
      resolvedAt: new Date("2023-11-30"),
      isCurrent: false,
      notes: "Resolved after 6 months of iron supplementation.",
    },
  });
  const condAllergy = await prisma.condition.create({
    data: {
      profileId: profile.id,
      name: "Seasonal Allergic Rhinitis",
      diagnosedAt: new Date("2016-03-15"),
      isCurrent: true,
      notes: "Symptoms mainly spring (March–May). Managed with cetirizine.",
    },
  });

  const tagMap: Record<string, string> = {};
  const allTags = await prisma.tag.findMany();
  for (const t of allTags) tagMap[t.slug] = t.id;

  console.log("Creating reports...");

  const report1 = await prisma.report.create({
    data: {
      profileId: profile.id,
      title: "CBC + Iron Panel",
      reportDate: new Date("2025-07-12"),
      examType: "blood",
      facility: "Ospedale San Raffaele",
      notes: "Anemia work-up. Hemoglobin and iron stores notably low.",
      tags: { create: [{ tagId: tagMap["blood-test"]! }] },
      entries: {
        create: [
          { biomarkerName: "Hemoglobin", value: 11.8, unit: "g/dL", referenceMin: 13.5, referenceMax: 17.5, status: "low" },
          { biomarkerName: "Hematocrit", value: 35.2, unit: "%", referenceMin: 41, referenceMax: 53, status: "low" },
          { biomarkerName: "MCV", value: 72, unit: "fL", referenceMin: 80, referenceMax: 100, status: "low" },
          { biomarkerName: "Ferritin", value: 12, unit: "ng/mL", referenceMin: 15, referenceMax: 200, status: "low" },
          { biomarkerName: "Serum Iron", value: 42, unit: "mcg/dL", referenceMin: 60, referenceMax: 170, status: "low" },
          { biomarkerName: "WBC", value: 6.2, unit: "10³/µL", referenceMin: 4.5, referenceMax: 11, status: "normal" },
          { biomarkerName: "Platelets", value: 245, unit: "10³/µL", referenceMin: 150, referenceMax: 400, status: "normal" },
        ],
      },
      aiAnalyses: {
        create: [{
          modelUsed: "claude-opus-4-6",
          status: "completed",
          tokensUsed: 820,
          rawResponse: "Iron deficiency anemia confirmed. Hemoglobin 11.8 g/dL (low), Ferritin 12 ng/mL (critically low). MCV 72 fL indicates microcytic anemia consistent with iron deficiency. Recommend oral iron supplementation (ferrous sulfate 325mg twice daily with vitamin C) and dietary changes. Follow-up CBC and ferritin in 3 months.",
        }],
      },
    },
  });

  const report2 = await prisma.report.create({
    data: {
      profileId: profile.id,
      title: "Lipid Panel + Metabolic Screen",
      reportDate: new Date("2025-09-20"),
      examType: "blood",
      facility: "Laboratorio Analisi CBA",
      notes: "Routine metabolic check. LDL borderline elevated.",
      tags: { create: [{ tagId: tagMap["blood-test"]! }] },
      entries: {
        create: [
          { biomarkerName: "LDL Cholesterol", value: 128, unit: "mg/dL", referenceMin: null, referenceMax: 100, status: "high" },
          { biomarkerName: "HDL Cholesterol", value: 54, unit: "mg/dL", referenceMin: 40, referenceMax: null, status: "normal" },
          { biomarkerName: "Total Cholesterol", value: 198, unit: "mg/dL", referenceMin: null, referenceMax: 200, status: "normal" },
          { biomarkerName: "Triglycerides", value: 118, unit: "mg/dL", referenceMin: null, referenceMax: 150, status: "normal" },
          { biomarkerName: "Glucose", value: 91, unit: "mg/dL", referenceMin: 70, referenceMax: 100, status: "normal" },
          { biomarkerName: "HbA1c", value: 5.3, unit: "%", referenceMin: null, referenceMax: 5.7, status: "normal" },
          { biomarkerName: "Creatinine", value: 0.92, unit: "mg/dL", referenceMin: 0.7, referenceMax: 1.2, status: "normal" },
          { biomarkerName: "AST", value: 28, unit: "U/L", referenceMin: 10, referenceMax: 40, status: "normal" },
          { biomarkerName: "ALT", value: 32, unit: "U/L", referenceMin: 7, referenceMax: 56, status: "normal" },
        ],
      },
      aiAnalyses: {
        create: [{
          modelUsed: "claude-opus-4-6",
          status: "completed",
          tokensUsed: 910,
          rawResponse: "Lipid panel shows borderline-high LDL at 128 mg/dL (optimal <100 mg/dL). HDL is adequate at 54 mg/dL. Triglycerides normal. Metabolic panel (glucose, HbA1c, creatinine, liver enzymes) all within normal range. Given the LDL trend, consider dietary modification (reduce saturated fat, increase fiber) and reassess in 6 months. If LDL continues to rise, lipid-lowering therapy discussion warranted.",
        }],
      },
    },
  });

  const report3 = await prisma.report.create({
    data: {
      profileId: profile.id,
      title: "Thyroid Function Panel",
      reportDate: new Date("2025-11-08"),
      examType: "blood",
      facility: "Ospedale San Raffaele",
      notes: "TSH still elevated on current Levothyroxine dose. Endocrinology follow-up scheduled.",
      tags: { create: [{ tagId: tagMap["endocrinology"]! }, { tagId: tagMap["blood-test"]! }] },
      entries: {
        create: [
          { biomarkerName: "TSH", value: 4.9, unit: "mIU/L", referenceMin: 0.4, referenceMax: 4.0, status: "high" },
          { biomarkerName: "FT4", value: 0.86, unit: "ng/dL", referenceMin: 0.8, referenceMax: 1.8, status: "normal" },
          { biomarkerName: "FT3", value: 2.8, unit: "pg/mL", referenceMin: 2.3, referenceMax: 4.2, status: "normal" },
          { biomarkerName: "Anti-TPO", value: 320, unit: "IU/mL", referenceMin: null, referenceMax: 35, status: "high" },
          { biomarkerName: "Anti-Thyroglobulin", value: 85, unit: "IU/mL", referenceMin: null, referenceMax: 40, status: "high" },
        ],
      },
      aiAnalyses: {
        create: [{
          modelUsed: "claude-opus-4-6",
          status: "completed",
          tokensUsed: 780,
          rawResponse: "TSH remains elevated at 4.9 mIU/L (above the 0.4–4.0 reference range) despite current Levothyroxine therapy, consistent with undertreated Hashimoto's hypothyroidism. Anti-TPO antibodies markedly elevated (320 IU/mL), confirming active autoimmune activity. FT4 is at the lower end of normal. Dose adjustment of Levothyroxine (likely increase to 75 mcg) should be discussed with the endocrinologist. Recheck TSH/FT4 in 6–8 weeks after any dose change.",
        }],
      },
    },
  });

  const report4 = await prisma.report.create({
    data: {
      profileId: profile.id,
      title: "Vitamin D & Micronutrients",
      reportDate: new Date("2026-01-15"),
      examType: "blood",
      facility: "Laboratorio Analisi CBA",
      notes: "Vitamin D severely deficient. Iron stores normalized. Started Vitamin D3 2000 IU/day.",
      tags: { create: [{ tagId: tagMap["blood-test"]! }] },
      entries: {
        create: [
          { biomarkerName: "Vitamin D (25-OH)", value: 17, unit: "ng/mL", referenceMin: 30, referenceMax: 100, status: "low" },
          { biomarkerName: "Vitamin B12", value: 298, unit: "pg/mL", referenceMin: 200, referenceMax: 900, status: "normal" },
          { biomarkerName: "Magnesium", value: 1.9, unit: "mg/dL", referenceMin: 1.7, referenceMax: 2.5, status: "normal" },
          { biomarkerName: "CRP", value: 1.4, unit: "mg/L", referenceMin: null, referenceMax: 5, status: "normal" },
          { biomarkerName: "Ferritin", value: 76, unit: "ng/mL", referenceMin: 15, referenceMax: 200, status: "normal" },
          { biomarkerName: "Hemoglobin", value: 14.2, unit: "g/dL", referenceMin: 13.5, referenceMax: 17.5, status: "normal" },
        ],
      },
      aiAnalyses: {
        create: [{
          modelUsed: "claude-opus-4-6",
          status: "completed",
          tokensUsed: 845,
          rawResponse: "Vitamin D (25-OH) is severely deficient at 17 ng/mL (optimal 40–60 ng/mL). This is particularly relevant given the patient's Hashimoto's thyroiditis — Vitamin D deficiency is associated with increased autoimmune activity. Supplementation with Vitamin D3 2000–4000 IU/day is strongly recommended, with recheck in 3 months. Positive note: iron stores fully recovered (Ferritin 76 ng/mL), anemia resolved. CRP mildly elevated but within normal range.",
        }],
      },
    },
  });

  const report5 = await prisma.report.create({
    data: {
      profileId: profile.id,
      title: "Annual Blood Panel",
      reportDate: new Date("2026-03-10"),
      examType: "blood",
      facility: "Ospedale San Raffaele",
      notes: "Annual comprehensive panel. LDL continuing upward trend. TSH remains above target.",
      tags: {
        create: [
          { tagId: tagMap["blood-test"]! },
          { tagId: tagMap["general-checkup"]! },
        ],
      },
      entries: {
        create: [
          { biomarkerName: "Hemoglobin", value: 14.9, unit: "g/dL", referenceMin: 13.5, referenceMax: 17.5, status: "normal" },
          { biomarkerName: "LDL Cholesterol", value: 138, unit: "mg/dL", referenceMin: null, referenceMax: 100, status: "high" },
          { biomarkerName: "HDL Cholesterol", value: 51, unit: "mg/dL", referenceMin: 40, referenceMax: null, status: "normal" },
          { biomarkerName: "Total Cholesterol", value: 211, unit: "mg/dL", referenceMin: null, referenceMax: 200, status: "high" },
          { biomarkerName: "Triglycerides", value: 142, unit: "mg/dL", referenceMin: null, referenceMax: 150, status: "normal" },
          { biomarkerName: "TSH", value: 5.1, unit: "mIU/L", referenceMin: 0.4, referenceMax: 4.0, status: "high" },
          { biomarkerName: "FT4", value: 0.88, unit: "ng/dL", referenceMin: 0.8, referenceMax: 1.8, status: "normal" },
          { biomarkerName: "Glucose", value: 94, unit: "mg/dL", referenceMin: 70, referenceMax: 100, status: "normal" },
          { biomarkerName: "HbA1c", value: 5.4, unit: "%", referenceMin: null, referenceMax: 5.7, status: "normal" },
          { biomarkerName: "Vitamin D (25-OH)", value: 28, unit: "ng/mL", referenceMin: 30, referenceMax: 100, status: "low" },
          { biomarkerName: "CRP", value: 1.1, unit: "mg/L", referenceMin: null, referenceMax: 5, status: "normal" },
          { biomarkerName: "Creatinine", value: 0.94, unit: "mg/dL", referenceMin: 0.7, referenceMax: 1.2, status: "normal" },
          { biomarkerName: "Ferritin", value: 82, unit: "ng/mL", referenceMin: 15, referenceMax: 200, status: "normal" },
        ],
      },
      aiAnalyses: {
        create: [{
          modelUsed: "claude-opus-4-6",
          status: "completed",
          tokensUsed: 1120,
          rawResponse: "## Key Findings\n\n**LDL Cholesterol 138 mg/dL — Upward trend** (128 → 138 over 6 months, +7.8%). Now 38% above the <100 mg/dL optimal target. Combined with Total Cholesterol 211 mg/dL, this warrants dietary intervention and close monitoring.\n\n**TSH 5.1 mIU/L — Persistently elevated.** Despite Levothyroxine, TSH remains above range. Endocrinology dose review strongly indicated.\n\n**Vitamin D 28 ng/mL — Improved but still insufficient** (was 17 in January). Continue supplementation and target ≥40 ng/mL.\n\n**Positive:** Hemoglobin 14.9 g/dL — anemia fully resolved. Ferritin 82 ng/mL — iron stores stable. Glucose and HbA1c normal.\n\n## Recommended Actions\n1. Endocrinology visit — Levothyroxine dose adjustment\n2. Mediterranean-style diet to address LDL trend\n3. Increase Vitamin D3 to 3000 IU/day\n4. Repeat lipid panel in 3 months",
        }],
      },
    },
  });

  console.log("Creating sleep logs (180 days)...");
  const sleepData = [];
  for (let i = 1; i <= 180; i++) {
    const d = daysAgo(i);
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const baseHours = isWeekend ? 7.8 : 6.9;
    const hours = clamp(baseHours + noise(0.8), 5.0, 9.5);
    const quality = clamp(Math.round((hours - 5) / 4.5 * 3 + 2 + noise(0.8)), 1, 5);
    sleepData.push({
      profileId: profile.id,
      date: dateOnly(d),
      hoursSlept: parseFloat(hours.toFixed(1)),
      quality,
    });
  }
  await prisma.sleepLog.createMany({ data: sleepData });

  console.log("Creating weight logs (monthly)...");
  const weights = [
    { daysBack: 182, kg: 79.2 },
    { daysBack: 152, kg: 78.8 },
    { daysBack: 122, kg: 78.3 },
    { daysBack: 91, kg: 77.8 },
    { daysBack: 61, kg: 77.4 },
    { daysBack: 30, kg: 77.1 },
    { daysBack: 5, kg: 76.9 },
  ];
  await prisma.weightLog.createMany({
    data: weights.map(w => ({
      profileId: profile.id,
      date: dateOnly(daysAgo(w.daysBack)),
      weightKg: w.kg,
      bodyFatPct: parseFloat((w.kg * 0.168).toFixed(1)),
      waistCm: parseFloat((83 - (79.2 - w.kg) * 0.4).toFixed(1)),
    })),
  });

  console.log("Creating activity logs (90 days)...");
  const activityData = [];
  for (let i = 1; i <= 90; i++) {
    const d = daysAgo(i);
    const dow = d.getDay();
    if (dow === 1 || dow === 3 || dow === 5) {
      activityData.push({
        profileId: profile.id,
        date: dateOnly(d),
        activityType: "run",
        durationMinutes: Math.round(30 + Math.random() * 15),
        intensityLevel: Math.random() > 0.3 ? 4 : 3,
      });
    } else if (dow === 6) {
      activityData.push({
        profileId: profile.id,
        date: dateOnly(d),
        activityType: "gym",
        durationMinutes: Math.round(50 + Math.random() * 15),
        intensityLevel: 4,
      });
    } else if (dow === 0 && Math.random() > 0.4) {
      activityData.push({
        profileId: profile.id,
        date: dateOnly(d),
        activityType: "walk",
        durationMinutes: Math.round(35 + Math.random() * 20),
        intensityLevel: 2,
      });
    }
  }
  await prisma.activityLog.createMany({ data: activityData });

  console.log("Creating health diaries (90 days)...");
  const diaryData = [];
  const sleepByDate: Record<string, number> = {};
  for (const s of sleepData) {
    sleepByDate[s.date.toISOString().split("T")[0]!] = s.hoursSlept;
  }
  for (let i = 1; i <= 90; i++) {
    const d = daysAgo(i);
    const key = d.toISOString().split("T")[0]!;
    const prevKey = daysAgo(i + 1).toISOString().split("T")[0]!;
    const prevSleep = sleepByDate[prevKey] ?? 7;
    const energyBase = clamp((prevSleep - 5.5) / 3 * 3 + 2.5 + noise(0.6), 1, 5);
    const moodBase = clamp(energyBase + noise(0.5), 1, 5);
    const hasPain = Math.random() < 0.2;
    diaryData.push({
      profileId: profile.id,
      date: dateOnly(d),
      energyLevel: Math.round(energyBase),
      moodLevel: Math.round(moodBase),
      painLevel: hasPain ? Math.round(1 + Math.random() * 3) : 0,
      painArea: hasPain ? (Math.random() > 0.5 ? "head" : "lower back") : null,
    });
  }
  await prisma.healthDiary.createMany({ data: diaryData });

  console.log("Creating diet logs (last 21 days)...");
  const meals = [
    { type: "breakfast", items: ["Oatmeal with berries and almonds", "Greek yogurt with granola", "Eggs and toast", "Smoothie bowl", "Muesli with milk"] },
    { type: "lunch", items: ["Chicken salad with avocado", "Pasta with tomato sauce", "Grilled salmon with vegetables", "Lentil soup with bread", "Turkey wrap with greens"] },
    { type: "dinner", items: ["Baked cod with roasted potatoes", "Beef stir-fry with rice", "Vegetable curry with quinoa", "Grilled chicken with salad", "Pasta al pomodoro"] },
    { type: "snack", items: ["Apple and peanut butter", "Mixed nuts", "Protein bar", "Banana"] },
  ];
  const dietData = [];
  for (let i = 0; i < 21; i++) {
    const d = daysAgo(i + 1);
    const mealCount = Math.random() > 0.7 ? 4 : 3;
    for (let m = 0; m < Math.min(mealCount, meals.length); m++) {
      const meal = meals[m]!;
      const desc = meal.items[Math.floor(Math.random() * meal.items.length)]!;
      const calMap: Record<string, number> = { breakfast: 420, lunch: 680, dinner: 720, snack: 180 };
      dietData.push({
        profileId: profile.id,
        date: dateOnly(d),
        mealType: meal.type,
        description: desc,
        calories: Math.round((calMap[meal.type] ?? 500) + noise(80)),
        proteinG: Math.round(15 + Math.random() * 25),
        carbsG: Math.round(40 + Math.random() * 40),
        fatG: Math.round(10 + Math.random() * 20),
      });
    }
  }
  await prisma.dietLog.createMany({ data: dietData });

  console.log("Creating reminders...");
  await prisma.reminder.createMany({
    data: [
      {
        profileId: profile.id,
        title: "TSH follow-up — Endocrinology",
        description: "TSH has been persistently above 4.0 mIU/L for two consecutive tests. Schedule an endocrinology appointment to review Levothyroxine dosage.",
        dueDate: new Date("2026-04-10"),
        source: "ai",
        isDismissed: false,
      },
      {
        profileId: profile.id,
        title: "Fasting lipid panel — LDL trending up",
        description: "LDL increased from 128 to 138 mg/dL over 6 months (+7.8%). A fasting lipid panel in 3 months will confirm the trend before considering dietary or pharmacological intervention.",
        dueDate: new Date("2026-04-20"),
        source: "ai",
        isDismissed: false,
      },
      {
        profileId: profile.id,
        title: "Vitamin D recheck",
        description: "Vitamin D improved from 17 to 28 ng/mL but still below the 30 ng/mL threshold. Recheck after 3 months of supplementation to confirm adequate correction.",
        dueDate: new Date("2026-05-15"),
        source: "ai",
        isDismissed: false,
      },
      {
        profileId: profile.id,
        title: "Annual ophthalmology exam",
        description: "No record of an eye exam in the last 2 years. Recommended annually at age 39+ to screen for early glaucoma and refractive changes.",
        dueDate: null,
        source: "ai",
        isDismissed: false,
      },
    ],
  });

  console.log("Building knowledge graph...");
  const nodes: Record<string, string> = {};

  const createNode = async (nodeType: string, label: string, meta: object, reportId?: string, conditionId?: string) => {
    const n = await prisma.graphNode.create({
      data: { profileId: profile.id, nodeType, label, metadata: meta, reportId: reportId ?? null, conditionId: conditionId ?? null },
    });
    nodes[label] = n.id;
    return n.id;
  };

  await createNode("condition", "Hashimoto's Thyroiditis", { severity: "moderate", status: "active" }, undefined, condHashimoto.id);
  await createNode("condition", "Iron Deficiency Anemia", { severity: "mild", status: "resolved" }, undefined, condIronAnemia.id);
  await createNode("condition", "Seasonal Allergic Rhinitis", { severity: "mild", status: "active" }, undefined, condAllergy.id);

  await createNode("biomarker", "TSH", { latestValue: 5.1, unit: "mIU/L", trend: "stable", status: "high" });
  await createNode("biomarker", "FT4", { latestValue: 0.88, unit: "ng/dL", trend: "stable", status: "normal" });
  await createNode("biomarker", "Anti-TPO", { latestValue: 320, unit: "IU/mL", trend: "stable", status: "high" });
  await createNode("biomarker", "LDL Cholesterol", { latestValue: 138, unit: "mg/dL", trend: "increasing", status: "high" });
  await createNode("biomarker", "HDL Cholesterol", { latestValue: 51, unit: "mg/dL", trend: "decreasing", status: "normal" });
  await createNode("biomarker", "Triglycerides", { latestValue: 142, unit: "mg/dL", trend: "increasing", status: "normal" });
  await createNode("biomarker", "Hemoglobin", { latestValue: 14.9, unit: "g/dL", trend: "increasing", status: "normal" });
  await createNode("biomarker", "Ferritin", { latestValue: 82, unit: "ng/mL", trend: "increasing", status: "normal" });
  await createNode("biomarker", "Vitamin D (25-OH)", { latestValue: 28, unit: "ng/mL", trend: "increasing", status: "low" });
  await createNode("biomarker", "CRP", { latestValue: 1.1, unit: "mg/L", trend: "stable", status: "normal" });
  await createNode("biomarker", "Glucose", { latestValue: 94, unit: "mg/dL", trend: "stable", status: "normal" });

  await createNode("lifestyle", "Omnivore Diet", { detail: "mixed diet, moderate saturated fat" });
  await createNode("lifestyle", "Regular Exercise", { detail: "running 3×/week, gym 1×/week" });
  await createNode("lifestyle", "Sleep Pattern", { detail: "avg 7.1h/night, quality 3/5" });
  await createNode("lifestyle", "Sedentary Work", { detail: "desk job, 8+ hours seated daily" });

  await createNode("environment", "High Latitude — Milan", { detail: "45°N, low UV index in winter", risk: "vitamin D deficiency" });
  await createNode("medication", "Levothyroxine 50mcg", { frequency: "daily", since: "2022-02-15" });
  await createNode("medication", "Cetirizine 10mg", { frequency: "as needed", since: "2016-03-01" });
  await createNode("report", "Annual Blood Panel 2026", { date: "2026-03-10", biomarkerCount: 13 }, report5.id);

  const edges: Array<{ from: string; to: string; relationship: string; weight: number }> = [
    { from: "TSH", to: "Hashimoto's Thyroiditis", relationship: "biomarker_for", weight: 0.9 },
    { from: "Anti-TPO", to: "Hashimoto's Thyroiditis", relationship: "biomarker_for", weight: 0.95 },
    { from: "FT4", to: "TSH", relationship: "inversely_correlated", weight: -0.72 },
    { from: "Hashimoto's Thyroiditis", to: "Levothyroxine 50mcg", relationship: "treated_by", weight: 0.85 },
    { from: "Vitamin D (25-OH)", to: "Hashimoto's Thyroiditis", relationship: "associated_with", weight: 0.42 },
    { from: "High Latitude — Milan", to: "Vitamin D (25-OH)", relationship: "risk_factor_for", weight: 0.65 },
    { from: "Hemoglobin", to: "Iron Deficiency Anemia", relationship: "biomarker_for", weight: 0.88 },
    { from: "Ferritin", to: "Iron Deficiency Anemia", relationship: "biomarker_for", weight: 0.91 },
    { from: "LDL Cholesterol", to: "Triglycerides", relationship: "correlated", weight: 0.58 },
    { from: "Sedentary Work", to: "LDL Cholesterol", relationship: "risk_factor_for", weight: 0.44 },
    { from: "Omnivore Diet", to: "LDL Cholesterol", relationship: "influences", weight: 0.38 },
    { from: "Regular Exercise", to: "HDL Cholesterol", relationship: "improves", weight: 0.51 },
    { from: "Regular Exercise", to: "Triglycerides", relationship: "reduces", weight: -0.48 },
    { from: "Sleep Pattern", to: "CRP", relationship: "associated_with", weight: -0.35 },
    { from: "Seasonal Allergic Rhinitis", to: "Cetirizine 10mg", relationship: "treated_by", weight: 0.75 },
    { from: "Annual Blood Panel 2026", to: "LDL Cholesterol", relationship: "documents", weight: 1.0 },
    { from: "Annual Blood Panel 2026", to: "TSH", relationship: "documents", weight: 1.0 },
    { from: "Annual Blood Panel 2026", to: "Vitamin D (25-OH)", relationship: "documents", weight: 1.0 },
  ];

  for (const e of edges) {
    const sourceId = nodes[e.from];
    const targetId = nodes[e.to];
    if (!sourceId || !targetId) continue;
    await prisma.graphEdge.upsert({
      where: { sourceId_targetId_relationship: { sourceId, targetId, relationship: e.relationship } },
      update: { weight: e.weight },
      create: { sourceId, targetId, relationship: e.relationship, weight: e.weight },
    });
  }

  console.log("\n✓ Demo seed complete.");
  console.log(`  Login:        demo@synaps.local / 12345`);
  console.log(`  Profile:      Marco Ferretti`);
  console.log(`  Conditions:   3 (2 current, 1 resolved)`);
  console.log(`  Medications:  2`);
  console.log(`  Reports:      5 with AI analyses`);
  console.log(`  Sleep logs:   180 days`);
  console.log(`  Weight logs:  7 entries`);
  console.log(`  Activity:     ${activityData.length} sessions (90 days)`);
  console.log(`  Diary:        90 days`);
  console.log(`  Diet:         ${dietData.length} meals (21 days)`);
  console.log(`  Reminders:    4 AI-generated`);
  console.log(`  Graph nodes:  ${Object.keys(nodes).length}`);
  console.log(`  Graph edges:  ${edges.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
