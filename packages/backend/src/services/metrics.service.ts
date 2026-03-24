import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";

const TAU = {
  sleep: { hours: 9.5, quality: 9.5, deficit: 9.5 },
  wellbeing: { energy: 6.2, mood: 6.2, pain: 6.2, composite: 6.2 },
  diet: { dailyCalories: 13.5, proteinG: 13.5, carbsG: 13.5, fatG: 13.5, proteinRatio: 13.5 },
  activity: { volume: 19.5, weeklyMinutes: 19.5, intensity: 13.5 },
  body: { weight: 19.5, bodyFat: 19.5, waist: 19.5 },
} as const;

const BIOMARKER_TAU = 62.4;

const MET_VALUES: Record<string, number> = {
  run: 8.0,
  walk: 3.3,
  gym: 5.0,
  swim: 6.0,
  cycling: 7.5,
  yoga: 3.0,
  sport: 6.0,
  other: 4.0,
};

async function updateMetric(
  client: Prisma.TransactionClient,
  profileId: string,
  domain: string,
  metricKey: string,
  value: number,
  tau: number,
  now: Date,
): Promise<void> {
  const existing = await client.metricState.findUnique({
    where: { profileId_domain_metricKey: { profileId, domain, metricKey } },
  });

  if (!existing) {
    await client.metricState.create({
      data: {
        profileId,
        domain,
        metricKey,
        ema: value,
        emVar: 0,
        shortEma: value,
        sampleCount: 1,
        lastValue: value,
        lastUpdatedAt: now,
        tau,
      },
    });
    return;
  }

  const deltaDays = (now.getTime() - existing.lastUpdatedAt.getTime()) / (1000 * 60 * 60 * 24);
  const alpha = 1 - Math.exp(-deltaDays / tau);
  const alphaShort = 1 - Math.exp(-deltaDays / (tau / 3));

  const delta = value - existing.ema;
  const newEma = existing.ema + alpha * delta;
  const newEmVar = (1 - alpha) * (existing.emVar + alpha * delta * delta);
  const newShortEma = alphaShort * value + (1 - alphaShort) * existing.shortEma;

  await client.metricState.update({
    where: { profileId_domain_metricKey: { profileId, domain, metricKey } },
    data: {
      ema: newEma,
      emVar: newEmVar,
      shortEma: newShortEma,
      sampleCount: existing.sampleCount + 1,
      lastValue: value,
      lastUpdatedAt: now,
      tau,
    },
  });
}

export async function updateSleepMetrics(
  profileId: string,
  hoursSlept: number,
  quality: number | null,
): Promise<void> {
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await updateMetric(tx, profileId, "sleep", "hours", hoursSlept, TAU.sleep.hours, now);
    await updateMetric(tx, profileId, "sleep", "deficit", hoursSlept - 8, TAU.sleep.deficit, now);
    if (quality !== null) {
      await updateMetric(tx, profileId, "sleep", "quality", quality, TAU.sleep.quality, now);
    }
  });
}

export async function updateDietMetrics(profileId: string, date: Date): Promise<void> {
  const logs = await prisma.dietLog.findMany({
    where: { profileId, date },
  });

  const totalCalories = logs.reduce((s, l) => s + (l.calories ?? 0), 0);
  const totalProtein = logs.reduce((s, l) => s + (l.proteinG ?? 0), 0);
  const totalCarbs = logs.reduce((s, l) => s + (l.carbsG ?? 0), 0);
  const totalFat = logs.reduce((s, l) => s + (l.fatG ?? 0), 0);
  const proteinRatio = totalCalories > 0 ? (totalProtein * 4) / totalCalories : 0;

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await updateMetric(tx, profileId, "diet", "dailyCalories", totalCalories, TAU.diet.dailyCalories, now);
    await updateMetric(tx, profileId, "diet", "proteinG", totalProtein, TAU.diet.proteinG, now);
    await updateMetric(tx, profileId, "diet", "carbsG", totalCarbs, TAU.diet.carbsG, now);
    await updateMetric(tx, profileId, "diet", "fatG", totalFat, TAU.diet.fatG, now);
    await updateMetric(tx, profileId, "diet", "proteinRatio", proteinRatio, TAU.diet.proteinRatio, now);
  });
}

export async function updateActivityMetrics(
  profileId: string,
  activityType: string,
  durationMinutes: number,
  intensityLevel: number | null,
): Promise<void> {
  const met = MET_VALUES[activityType] ?? 4.0;
  const intensity = intensityLevel ?? 3;
  const volume = durationMinutes * intensity * met;

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await updateMetric(tx, profileId, "activity", "volume", volume, TAU.activity.volume, now);
    await updateMetric(tx, profileId, "activity", "weeklyMinutes", durationMinutes, TAU.activity.weeklyMinutes, now);
    await updateMetric(tx, profileId, "activity", "intensity", intensity, TAU.activity.intensity, now);
  });
}

export async function updateWellbeingMetrics(
  profileId: string,
  energyLevel: number | null,
  moodLevel: number | null,
  painLevel: number | null,
): Promise<void> {
  const nonNullCount = [energyLevel, moodLevel, painLevel].filter((v) => v !== null).length;

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    if (energyLevel !== null) {
      await updateMetric(tx, profileId, "wellbeing", "energy", energyLevel, TAU.wellbeing.energy, now);
    }
    if (moodLevel !== null) {
      await updateMetric(tx, profileId, "wellbeing", "mood", moodLevel, TAU.wellbeing.mood, now);
    }
    if (painLevel !== null) {
      await updateMetric(tx, profileId, "wellbeing", "pain", painLevel, TAU.wellbeing.pain, now);
    }
    if (nonNullCount >= 2) {
      const weightSum =
        (energyLevel !== null ? 1 : 0) +
        (moodLevel !== null ? 1 : 0) +
        (painLevel !== null ? 0.5 : 0);
      const composite =
        ((energyLevel ?? 0) + (moodLevel ?? 0) - (painLevel ?? 0) * 0.5) / weightSum;
      await updateMetric(tx, profileId, "wellbeing", "composite", composite, TAU.wellbeing.composite, now);
    }
  });
}

export async function updateWeightMetrics(
  profileId: string,
  weightKg: number,
  bodyFatPct: number | null,
  waistCm: number | null,
): Promise<void> {
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await updateMetric(tx, profileId, "body", "weight", weightKg, TAU.body.weight, now);
    if (bodyFatPct !== null) {
      await updateMetric(tx, profileId, "body", "bodyFat", bodyFatPct, TAU.body.bodyFat, now);
    }
    if (waistCm !== null) {
      await updateMetric(tx, profileId, "body", "waist", waistCm, TAU.body.waist, now);
    }
  });
}

export async function updateBiomarkerMetrics(
  profileId: string,
  entries: Array<{ biomarkerName: string; value: number }>,
): Promise<void> {
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    for (const entry of entries) {
      await updateMetric(tx, profileId, "biomarker", entry.biomarkerName, entry.value, BIOMARKER_TAU, now);
    }
  });
}

type MetricValue = {
  ema: number;
  lastValue: number;
  trend: "increasing" | "decreasing" | "stable";
  zScore: number | null;
  sampleCount: number;
};

type MetricSnapshot = {
  sleep: Record<string, MetricValue>;
  diet: Record<string, MetricValue>;
  activity: Record<string, MetricValue>;
  wellbeing: Record<string, MetricValue>;
  biomarkers: Record<string, MetricValue>;
  body: Record<string, MetricValue>;
  allosticLoad: number | null;
};

function toMetricValue(state: {
  ema: number;
  emVar: number;
  shortEma: number;
  lastValue: number;
  sampleCount: number;
}): MetricValue {
  const stdDev = Math.sqrt(state.emVar);
  const threshold = stdDev * 0.2;

  let trend: "increasing" | "decreasing" | "stable";
  if (state.shortEma > state.ema + threshold) {
    trend = "increasing";
  } else if (state.shortEma < state.ema - threshold) {
    trend = "decreasing";
  } else {
    trend = "stable";
  }

  const zScore = state.emVar > 0 ? (state.lastValue - state.ema) / stdDev : null;

  return {
    ema: state.ema,
    lastValue: state.lastValue,
    trend,
    zScore,
    sampleCount: state.sampleCount,
  };
}

export async function getMetricSnapshot(profileId: string, heightCm?: number): Promise<MetricSnapshot> {
  const states = await prisma.metricState.findMany({ where: { profileId } });

  const sleep: Record<string, MetricValue> = {};
  const diet: Record<string, MetricValue> = {};
  const activity: Record<string, MetricValue> = {};
  const wellbeing: Record<string, MetricValue> = {};
  const biomarkers: Record<string, MetricValue> = {};
  const body: Record<string, MetricValue> = {};

  for (const state of states) {
    const mv = toMetricValue(state);
    if (state.domain === "sleep") sleep[state.metricKey] = mv;
    else if (state.domain === "diet") diet[state.metricKey] = mv;
    else if (state.domain === "activity") activity[state.metricKey] = mv;
    else if (state.domain === "wellbeing") wellbeing[state.metricKey] = mv;
    else if (state.domain === "biomarker") biomarkers[state.metricKey] = mv;
    else if (state.domain === "body") body[state.metricKey] = mv;
  }

  const biomarkerStates = states.filter((s) => s.domain === "biomarker");
  const bodyStates = states.filter((s) => s.domain === "body");
  let allosticLoad: number | null = null;

  {
    let riskCount = 0;
    let available = 0;

    const crp = biomarkerStates.find((s) => s.metricKey === "CRP");
    if (crp) {
      available++;
      if (crp.lastValue > 3.0) riskCount++;
    }

    const hdl = biomarkerStates.find((s) => s.metricKey === "HDL");
    if (hdl) {
      available++;
      if (hdl.lastValue < 40) riskCount++;
    }

    const hba1c = biomarkerStates.find((s) => s.metricKey === "HbA1c");
    if (hba1c) {
      available++;
      if (hba1c.lastValue > 6.5) riskCount++;
    }

    const waist = bodyStates.find((s) => s.metricKey === "waist");
    if (waist && heightCm) {
      available++;
      if (waist.lastValue / heightCm > 0.5) riskCount++;
    }

    if (available > 0) {
      allosticLoad = riskCount / available;
    }
  }

  return { sleep, diet, activity, wellbeing, biomarkers, body, allosticLoad };
}
