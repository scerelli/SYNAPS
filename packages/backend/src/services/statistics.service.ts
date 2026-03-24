import * as ss from "simple-statistics";
import { format } from "date-fns";
import jStat from "jstat";

export type BiomarkerTimeSeries = {
  name: string;
  points: Array<{ date: Date; value: number }>;
};

export type CorrelationResult = {
  biomarkerA: string;
  biomarkerB: string;
  pearson: number;
  n: number;
};

export type TrendResult = {
  biomarkerName: string;
  slope: number;
  rSquared: number;
  zScore: number | null;
};

export function computeCorrelations(series: BiomarkerTimeSeries[]): CorrelationResult[] {
  const results: CorrelationResult[] = [];

  for (let i = 0; i < series.length; i++) {
    for (let j = i + 1; j < series.length; j++) {
      const seriesA = series[i];
      const seriesB = series[j];
      if (!seriesA || !seriesB) continue;

      const aMap = new Map(seriesA.points.map((p) => [format(p.date, "yyyy-MM-dd"), p.value]));
      const bMap = new Map(seriesB.points.map((p) => [format(p.date, "yyyy-MM-dd"), p.value]));

      const sharedDates = [...aMap.keys()].filter((d) => bMap.has(d));
      if (sharedDates.length < 3) continue;

      const aValues = sharedDates.map((d) => aMap.get(d) ?? 0);
      const bValues = sharedDates.map((d) => bMap.get(d) ?? 0);

      try {
        const pearson = ss.sampleCorrelation(aValues, bValues);
        if (isFinite(pearson)) {
          results.push({
            biomarkerA: seriesA.name,
            biomarkerB: seriesB.name,
            pearson: parseFloat(pearson.toFixed(3)),
            n: sharedDates.length,
          });
        }
      } catch {
        continue;
      }
    }
  }

  return results;
}

export function computeTrends(series: BiomarkerTimeSeries[]): TrendResult[] {
  return series
    .filter((s) => s.points.length >= 3)
    .map((s) => {
      const sorted = [...s.points].sort((a, b) => a.date.getTime() - b.date.getTime());
      const first = sorted[0];
      if (!first) return null;
      const t0 = first.date.getTime();
      const xyPairs: [number, number][] = sorted.map((p) => [
        (p.date.getTime() - t0) / (1000 * 60 * 60 * 24),
        p.value,
      ]);

      const regression = ss.linearRegression(xyPairs);
      const rSquared = ss.rSquared(xyPairs, (x) => regression.m * x + regression.b);

      const values = sorted.map((p) => p.value);
      const mean = ss.mean(values);
      const std = ss.standardDeviation(values);
      const latest = values[values.length - 1] ?? 0;
      const zScore = std > 0 ? parseFloat(((latest - mean) / std).toFixed(2)) : null;

      return {
        biomarkerName: s.name,
        slope: parseFloat(regression.m.toFixed(4)),
        rSquared: parseFloat(rSquared.toFixed(3)),
        zScore,
      };
    })
    .filter((r): r is TrendResult => r !== null);
}

export function correlationToWeight(pearson: number): number {
  return parseFloat(Math.max(-1, Math.min(1, pearson)).toFixed(3));
}

export function pearsonPValue(r: number, n: number): number {
  if (n < 4) return 1;
  const rClamped = Math.max(-0.9999999, Math.min(0.9999999, r));
  const tStat = rClamped * Math.sqrt((n - 2) / (1 - rClamped * rClamped));
  return 2 * (1 - jStat.studentt.cdf(Math.abs(tStat), n - 2));
}

export function pearsonCI(r: number, n: number): [number, number] {
  if (n < 4) return [-1, 1];
  const z = Math.atanh(r);
  const se = 1 / Math.sqrt(n - 3);
  const zCrit = 1.96;
  return [
    parseFloat(Math.tanh(z - zCrit * se).toFixed(3)),
    parseFloat(Math.tanh(z + zCrit * se).toFixed(3)),
  ];
}

export function benjaminiHochberg(
  pValues: number[],
  alpha = 0.05,
): boolean[] {
  const n = pValues.length;
  const indexed = pValues.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  let lastSignificant = -1;
  for (let k = 0; k < n; k++) {
    if ((indexed[k]?.p ?? 1) <= ((k + 1) / n) * alpha) lastSignificant = k;
  }
  const significant = new Array(n).fill(false);
  for (let k = 0; k <= lastSignificant; k++) {
    const idx = indexed[k]?.i;
    if (idx !== undefined) significant[idx] = true;
  }
  return significant;
}

export type CrossDomainCorrelation = {
  domainA: string;
  metricA: string;
  domainB: string;
  metricB: string;
  pearson: number;
  ci: [number, number];
  pValue: number;
  significant: boolean;
  n: number;
  nEff: number;
  lagDays: number;
  confidence: "low" | "moderate" | "high";
};

export type DailyDataPoint = {
  date: string;
  sleepHours?: number;
  sleepQuality?: number;
  energyLevel?: number;
  moodLevel?: number;
  painLevel?: number;
  activityMinutes?: number;
  activityVolume?: number;
  calories?: number;
  weightKg?: number;
};

function effectiveN(values: number[]): number {
  const n = values.length;
  if (n < 4) return n;
  const mean = ss.mean(values);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    den += (values[i]! - mean) ** 2;
    if (i > 0) num += (values[i]! - mean) * (values[i - 1]! - mean);
  }
  const r1 = den > 0 ? num / den : 0;
  const nEff = n * (1 - r1) / (1 + r1);
  return Math.max(4, Math.round(nEff));
}

export function computeCrossDomainCorrelations(
  data: DailyDataPoint[],
  minN = 45,
  alpha = 0.05,
): CrossDomainCorrelation[] {
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));

  const metrics: Array<{ domain: string; key: keyof DailyDataPoint }> = [
    { domain: "sleep", key: "sleepHours" },
    { domain: "sleep", key: "sleepQuality" },
    { domain: "wellbeing", key: "energyLevel" },
    { domain: "wellbeing", key: "moodLevel" },
    { domain: "wellbeing", key: "painLevel" },
    { domain: "activity", key: "activityMinutes" },
    { domain: "activity", key: "activityVolume" },
    { domain: "diet", key: "calories" },
    { domain: "body", key: "weightKg" },
  ];

  const candidates: Array<Omit<CrossDomainCorrelation, "significant">> = [];

  for (let lag = 0; lag <= 2; lag++) {
    for (let i = 0; i < metrics.length; i++) {
      for (let j = i + 1; j < metrics.length; j++) {
        const mA = metrics[i]!;
        const mB = metrics[j]!;

        if (mA.domain === mB.domain && lag === 0) continue;

        const pairs: [number, number][] = [];
        for (let t = lag; t < sorted.length; t++) {
          const dayA = sorted[t - lag]!;
          const dayB = sorted[t]!;
          const vA = dayA[mA.key] as number | undefined;
          const vB = dayB[mB.key] as number | undefined;
          if (vA != null && vB != null) pairs.push([vA, vB]);
        }

        if (pairs.length < minN) continue;

        const aVals = pairs.map(p => p[0]);
        const bVals = pairs.map(p => p[1]);

        let pearson: number;
        try {
          pearson = ss.sampleCorrelation(aVals, bVals);
          if (!isFinite(pearson)) continue;
        } catch {
          continue;
        }

        const n = pairs.length;
        const nEffVal = effectiveN(aVals);
        const pValue = pearsonPValue(pearson, nEffVal);
        const ci = pearsonCI(pearson, nEffVal);

        candidates.push({
          domainA: mA.domain,
          metricA: String(mA.key),
          domainB: mB.domain,
          metricB: String(mB.key),
          pearson: parseFloat(pearson.toFixed(3)),
          ci,
          pValue: parseFloat(pValue.toFixed(4)),
          n,
          nEff: nEffVal,
          lagDays: lag,
          confidence: nEffVal < 60 ? "low" : nEffVal < 120 ? "moderate" : "high",
        });
      }
    }
  }

  const pValues = candidates.map(c => c.pValue);
  const significant = benjaminiHochberg(pValues, alpha);

  return candidates
    .map((c, i) => ({ ...c, significant: significant[i] ?? false }))
    .filter(c => Math.abs(c.pearson) >= 0.2)
    .sort((a, b) => Math.abs(b.pearson) - Math.abs(a.pearson));
}

export function computePainAreaFrequency(
  entries: Array<{ painLevel: number | null; painArea: string | null; date: Date }>,
): Array<{ area: string; count: number; avgPain: number; frequency: number }> {
  const map = new Map<string, { count: number; totalPain: number }>();
  const total = entries.filter(e => e.painLevel != null && e.painLevel > 0).length;

  for (const e of entries) {
    if (!e.painArea || !e.painLevel || e.painLevel === 0) continue;
    const area = e.painArea.toLowerCase().trim();
    const existing = map.get(area) ?? { count: 0, totalPain: 0 };
    map.set(area, { count: existing.count + 1, totalPain: existing.totalPain + e.painLevel });
  }

  return Array.from(map.entries())
    .map(([area, { count, totalPain }]) => ({
      area,
      count,
      avgPain: parseFloat((totalPain / count).toFixed(1)),
      frequency: total > 0 ? parseFloat((count / total).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

export function buildDailyDataset(params: {
  sleepLogs: Array<{ date: Date; hoursSlept: number; quality: number | null }>;
  diaryEntries: Array<{ date: Date; energyLevel: number | null; moodLevel: number | null; painLevel: number | null }>;
  activityLogs: Array<{ date: Date; durationMinutes: number; activityType: string; intensityLevel: number | null }>;
  dietLogs: Array<{ date: Date; calories: number | null }>;
  weightLogs: Array<{ date: Date; weightKg: number }>;
}): DailyDataPoint[] {
  const MET_VALUES: Record<string, number> = {
    run: 8.0, walk: 3.3, gym: 5.0, swim: 6.0,
    cycling: 7.5, yoga: 3.0, sport: 6.0, other: 4.0,
  };

  const map = new Map<string, DailyDataPoint>();

  const getOrCreate = (date: Date): DailyDataPoint => {
    const key = format(date, "yyyy-MM-dd");
    if (!map.has(key)) map.set(key, { date: key });
    return map.get(key)!;
  };

  for (const s of params.sleepLogs) {
    const d = getOrCreate(s.date);
    d.sleepHours = s.hoursSlept;
    if (s.quality != null) d.sleepQuality = s.quality;
  }

  for (const d of params.diaryEntries) {
    const day = getOrCreate(d.date);
    if (d.energyLevel != null) day.energyLevel = d.energyLevel;
    if (d.moodLevel != null) day.moodLevel = d.moodLevel;
    if (d.painLevel != null) day.painLevel = d.painLevel;
  }

  const actByDate = new Map<string, { minutes: number; volume: number }>();
  for (const a of params.activityLogs) {
    const key = format(a.date, "yyyy-MM-dd");
    const met = MET_VALUES[a.activityType] ?? 4.0;
    const intensity = a.intensityLevel ?? 3;
    const volume = a.durationMinutes * intensity * met;
    const existing = actByDate.get(key) ?? { minutes: 0, volume: 0 };
    actByDate.set(key, {
      minutes: existing.minutes + a.durationMinutes,
      volume: existing.volume + volume,
    });
  }
  for (const [key, val] of actByDate) {
    const d = map.get(key) ?? { date: key };
    d.activityMinutes = val.minutes;
    d.activityVolume = val.volume;
    map.set(key, d);
  }

  const calByDate = new Map<string, number>();
  for (const dl of params.dietLogs) {
    const key = format(dl.date, "yyyy-MM-dd");
    if (dl.calories != null) calByDate.set(key, (calByDate.get(key) ?? 0) + dl.calories);
  }
  for (const [key, cal] of calByDate) {
    const d = map.get(key) ?? { date: key };
    d.calories = cal;
    map.set(key, d);
  }

  for (const w of params.weightLogs) {
    const d = getOrCreate(w.date);
    d.weightKg = w.weightKg;
  }

  return Array.from(map.values());
}
