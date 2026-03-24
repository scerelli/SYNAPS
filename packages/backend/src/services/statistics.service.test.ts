import { describe, it, expect } from "vitest";
import {
  pearsonPValue,
  pearsonCI,
  benjaminiHochberg,
  computeCorrelations,
  computeTrends,
  computePainAreaFrequency,
  buildDailyDataset,
  computeCrossDomainCorrelations,
} from "./statistics.service.js";

function makeDate(offset: number): Date {
  return new Date(2024, 0, 1 + offset);
}

function isoDate(offset: number): string {
  return makeDate(offset).toISOString().split("T")[0]!;
}

// ─── pearsonPValue ────────────────────────────────────────────────────────────

describe("pearsonPValue", () => {
  it("returns 1 for n < 4", () => {
    expect(pearsonPValue(0.9, 3)).toBe(1);
    expect(pearsonPValue(0.9, 2)).toBe(1);
  });

  it("returns 1 for r = 0 (no correlation)", () => {
    expect(pearsonPValue(0, 30)).toBeCloseTo(1, 2);
  });

  it("returns p < 0.05 for r = 0.5, n = 30", () => {
    // t ≈ 3.05, df = 28 → p ≈ 0.005
    expect(pearsonPValue(0.5, 30)).toBeLessThan(0.05);
  });

  it("returns p > 0.05 for r = 0.1, n = 30 (weak, not significant)", () => {
    // t ≈ 0.54, df = 28 → p ≈ 0.59
    expect(pearsonPValue(0.1, 30)).toBeGreaterThan(0.05);
  });

  it("is two-tailed: p(r) === p(-r)", () => {
    expect(pearsonPValue(0.4, 50)).toBeCloseTo(pearsonPValue(-0.4, 50), 10);
  });

  it("approaches 0 for r close to 1 (no crash)", () => {
    expect(pearsonPValue(0.9999, 30)).toBeGreaterThanOrEqual(0);
    expect(pearsonPValue(0.9999, 30)).toBeLessThan(0.05);
    expect(pearsonPValue(-0.9999, 30)).toBeGreaterThanOrEqual(0);
  });

  it("returns valid number — no NaN or Infinity", () => {
    for (const r of [-1, -0.5, 0, 0.5, 1]) {
      const p = pearsonPValue(r, 50);
      expect(isFinite(p)).toBe(true);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });
});

// ─── pearsonCI ────────────────────────────────────────────────────────────────

describe("pearsonCI", () => {
  it("returns [-1, 1] for n < 4", () => {
    expect(pearsonCI(0.5, 3)).toEqual([-1, 1]);
  });

  it("CI contains r", () => {
    const r = 0.5;
    const [lo, hi] = pearsonCI(r, 50);
    expect(lo).toBeLessThan(r);
    expect(hi).toBeGreaterThan(r);
  });

  it("CI narrows as n increases", () => {
    const [lo30, hi30] = pearsonCI(0.5, 30);
    const [lo100, hi100] = pearsonCI(0.5, 100);
    expect(hi30 - lo30).toBeGreaterThan(hi100 - lo100);
  });

  it("CI midpoint (in Fisher z-space) is approximately r", () => {
    const r = 0.3;
    const [lo, hi] = pearsonCI(r, 80);
    const zMid = (Math.atanh(lo) + Math.atanh(hi)) / 2;
    expect(Math.tanh(zMid)).toBeCloseTo(r, 3);
  });

  it("CI is symmetric for r = 0", () => {
    const [lo, hi] = pearsonCI(0, 50);
    expect(lo + hi).toBeCloseTo(0, 3);
  });

  it("returns values in [-1, 1]", () => {
    for (const r of [-0.9, -0.5, 0, 0.5, 0.9]) {
      const [lo, hi] = pearsonCI(r, 30);
      expect(lo).toBeGreaterThanOrEqual(-1);
      expect(hi).toBeLessThanOrEqual(1);
    }
  });
});

// ─── benjaminiHochberg ────────────────────────────────────────────────────────

describe("benjaminiHochberg", () => {
  it("rejects nothing when all p-values are large", () => {
    expect(benjaminiHochberg([0.5, 0.6, 0.8])).toEqual([false, false, false]);
  });

  it("rejects clearly significant p-values", () => {
    const result = benjaminiHochberg([0.001, 0.002, 0.9]);
    expect(result[0]).toBe(true);
    expect(result[1]).toBe(true);
    expect(result[2]).toBe(false);
  });

  it("single p-value below alpha is rejected", () => {
    expect(benjaminiHochberg([0.03])).toEqual([true]);
  });

  it("single p-value above alpha is not rejected", () => {
    expect(benjaminiHochberg([0.06])).toEqual([false]);
  });

  it("respects custom alpha", () => {
    expect(benjaminiHochberg([0.04], 0.01)).toEqual([false]);
    expect(benjaminiHochberg([0.04], 0.05)).toEqual([true]);
  });

  it("step-up procedure: rejects first k that pass threshold", () => {
    // 5 tests sorted: 0.005, 0.01, 0.02, 0.08, 0.3
    // BH thresholds: 1/5*0.05=0.01, 2/5*0.05=0.02, 3/5*0.05=0.03, 4/5*0.05=0.04, 5/5*0.05=0.05
    // k=1: 0.005 ≤ 0.01 ✓, k=2: 0.01 ≤ 0.02 ✓, k=3: 0.02 ≤ 0.03 ✓, k=4: 0.08 > 0.04 ✗
    // → reject first 3
    const result = benjaminiHochberg([0.005, 0.01, 0.02, 0.08, 0.3]);
    expect(result).toEqual([true, true, true, false, false]);
  });

  it("handles empty array", () => {
    expect(benjaminiHochberg([])).toEqual([]);
  });

  it("preserves original index order after sorting", () => {
    // p-values given in descending order: [0.9, 0.001]
    // After BH: index 1 (p=0.001) should be true, index 0 (p=0.9) false
    const result = benjaminiHochberg([0.9, 0.001]);
    expect(result[0]).toBe(false);
    expect(result[1]).toBe(true);
  });
});

// ─── computeCorrelations ─────────────────────────────────────────────────────

describe("computeCorrelations", () => {
  it("returns empty for 0 or 1 series", () => {
    expect(computeCorrelations([])).toEqual([]);
    expect(computeCorrelations([{ name: "A", points: [{ date: makeDate(0), value: 1 }] }])).toEqual([]);
  });

  it("skips pairs with fewer than 3 shared dates", () => {
    const series = [
      { name: "A", points: [makeDate(0), makeDate(1)].map((date, i) => ({ date, value: i + 1 })) },
      { name: "B", points: [makeDate(0), makeDate(1)].map((date, i) => ({ date, value: i + 1 })) },
    ];
    expect(computeCorrelations(series)).toEqual([]);
  });

  it("computes r = 1 for perfectly correlated series", () => {
    const dates = Array.from({ length: 6 }, (_, i) => makeDate(i));
    const series = [
      { name: "A", points: dates.map((date, i) => ({ date, value: i + 1 })) },
      { name: "B", points: dates.map((date, i) => ({ date, value: (i + 1) * 2 + 3 })) },
    ];
    const [result] = computeCorrelations(series);
    expect(result?.pearson).toBeCloseTo(1, 3);
  });

  it("computes r = -1 for perfectly anti-correlated series", () => {
    const dates = Array.from({ length: 6 }, (_, i) => makeDate(i));
    const series = [
      { name: "A", points: dates.map((date, i) => ({ date, value: i + 1 })) },
      { name: "B", points: dates.map((date, i) => ({ date, value: 6 - i })) },
    ];
    const [result] = computeCorrelations(series);
    expect(result?.pearson).toBeCloseTo(-1, 3);
  });

  it("only uses shared dates", () => {
    // A has dates 1-3, B has dates 3-5 → only date 3 shared → skipped
    const series = [
      { name: "A", points: [0, 1, 2].map(i => ({ date: makeDate(i), value: i })) },
      { name: "B", points: [2, 3, 4].map(i => ({ date: makeDate(i), value: i })) },
    ];
    expect(computeCorrelations(series)).toEqual([]);
  });

  it("returns both (A,B) and (A,C) pairs", () => {
    const dates = Array.from({ length: 5 }, (_, i) => makeDate(i));
    const series = [
      { name: "A", points: dates.map((date, i) => ({ date, value: i })) },
      { name: "B", points: dates.map((date, i) => ({ date, value: i })) },
      { name: "C", points: dates.map((date, i) => ({ date, value: i })) },
    ];
    expect(computeCorrelations(series)).toHaveLength(3);
  });
});

// ─── computeTrends ────────────────────────────────────────────────────────────

describe("computeTrends", () => {
  it("skips series with fewer than 3 points", () => {
    const series = [{ name: "A", points: [{ date: makeDate(0), value: 1 }, { date: makeDate(1), value: 2 }] }];
    expect(computeTrends(series)).toEqual([]);
  });

  it("detects positive slope for linearly increasing series", () => {
    const series = [{ name: "A", points: Array.from({ length: 5 }, (_, i) => ({ date: makeDate(i), value: i })) }];
    expect(computeTrends(series)[0]?.slope).toBeGreaterThan(0);
  });

  it("detects negative slope for linearly decreasing series", () => {
    const series = [{ name: "A", points: Array.from({ length: 5 }, (_, i) => ({ date: makeDate(i), value: 10 - i })) }];
    expect(computeTrends(series)[0]?.slope).toBeLessThan(0);
  });

  it("returns slope ≈ 0 for flat series", () => {
    const series = [{ name: "A", points: Array.from({ length: 5 }, (_, i) => ({ date: makeDate(i), value: 5 })) }];
    expect(computeTrends(series)[0]?.slope).toBeCloseTo(0, 4);
  });

  it("returns null zScore when variance is zero (flat series)", () => {
    const series = [{ name: "A", points: Array.from({ length: 5 }, (_, i) => ({ date: makeDate(i), value: 5 })) }];
    expect(computeTrends(series)[0]?.zScore).toBeNull();
  });

  it("returns rSquared = 1 for perfectly linear series", () => {
    const series = [{ name: "A", points: Array.from({ length: 6 }, (_, i) => ({ date: makeDate(i), value: i * 3 + 1 })) }];
    expect(computeTrends(series)[0]?.rSquared).toBeCloseTo(1, 3);
  });

  it("slope is in units per day", () => {
    // value increases by 2 per day
    const series = [{ name: "A", points: Array.from({ length: 5 }, (_, i) => ({ date: makeDate(i), value: i * 2 })) }];
    expect(computeTrends(series)[0]?.slope).toBeCloseTo(2, 3);
  });
});

// ─── computePainAreaFrequency ─────────────────────────────────────────────────

describe("computePainAreaFrequency", () => {
  it("returns empty when no entries have pain > 0", () => {
    const entries = [
      { date: makeDate(0), painLevel: 0, painArea: null },
      { date: makeDate(1), painLevel: null, painArea: null },
    ];
    expect(computePainAreaFrequency(entries)).toEqual([]);
  });

  it("normalises area name to lowercase", () => {
    const entries = [
      { date: makeDate(0), painLevel: 5, painArea: "Head" },
      { date: makeDate(1), painLevel: 3, painArea: "head" },
    ];
    const result = computePainAreaFrequency(entries);
    expect(result).toHaveLength(1);
    expect(result[0]?.area).toBe("head");
    expect(result[0]?.count).toBe(2);
  });

  it("computes average pain per area", () => {
    const entries = [
      { date: makeDate(0), painLevel: 4, painArea: "back" },
      { date: makeDate(1), painLevel: 8, painArea: "back" },
    ];
    expect(computePainAreaFrequency(entries)[0]?.avgPain).toBeCloseTo(6, 1);
  });

  it("computes frequency as share of pain days", () => {
    const entries = [
      { date: makeDate(0), painLevel: 5, painArea: "head" },
      { date: makeDate(1), painLevel: 3, painArea: "back" },
      { date: makeDate(2), painLevel: 3, painArea: "back" },
    ];
    const result = computePainAreaFrequency(entries);
    const back = result.find(r => r.area === "back");
    expect(back?.frequency).toBeCloseTo(2 / 3, 2);
  });

  it("sorts by count descending", () => {
    const entries = [
      { date: makeDate(0), painLevel: 3, painArea: "back" },
      { date: makeDate(1), painLevel: 3, painArea: "head" },
      { date: makeDate(2), painLevel: 3, painArea: "head" },
    ];
    const result = computePainAreaFrequency(entries);
    expect(result[0]?.area).toBe("head");
  });

  it("ignores entries where painLevel is 0", () => {
    const entries = [
      { date: makeDate(0), painLevel: 0, painArea: "head" },
      { date: makeDate(1), painLevel: 5, painArea: "back" },
    ];
    const result = computePainAreaFrequency(entries);
    expect(result).toHaveLength(1);
    expect(result[0]?.area).toBe("back");
  });
});

// ─── buildDailyDataset ────────────────────────────────────────────────────────

describe("buildDailyDataset", () => {
  const empty = { sleepLogs: [], diaryEntries: [], activityLogs: [], dietLogs: [], weightLogs: [] };

  it("returns empty array for no data", () => {
    expect(buildDailyDataset(empty)).toEqual([]);
  });

  it("creates one entry per unique date", () => {
    const result = buildDailyDataset({
      ...empty,
      sleepLogs: [
        { date: makeDate(0), hoursSlept: 7, quality: 4 },
        { date: makeDate(1), hoursSlept: 6, quality: 3 },
      ],
    });
    expect(result).toHaveLength(2);
  });

  it("aggregates activity minutes and volume on the same day", () => {
    const date = makeDate(0);
    const result = buildDailyDataset({
      ...empty,
      activityLogs: [
        { date, durationMinutes: 30, activityType: "run", intensityLevel: 3 },
        { date, durationMinutes: 20, activityType: "walk", intensityLevel: 2 },
      ],
    });
    expect(result[0]?.activityMinutes).toBe(50);
    expect(result[0]?.activityVolume).toBeGreaterThan(0);
  });

  it("aggregates diet calories on the same day, ignoring nulls", () => {
    const date = makeDate(0);
    const result = buildDailyDataset({
      ...empty,
      dietLogs: [
        { date, calories: 500 },
        { date, calories: 300 },
        { date, calories: null },
      ],
    });
    expect(result[0]?.calories).toBe(800);
  });

  it("merges all domains onto a single date key", () => {
    const date = makeDate(0);
    const result = buildDailyDataset({
      sleepLogs: [{ date, hoursSlept: 7.5, quality: 4 }],
      diaryEntries: [{ date, energyLevel: 4, moodLevel: 3, painLevel: 2 }],
      activityLogs: [{ date, durationMinutes: 30, activityType: "gym", intensityLevel: 3 }],
      dietLogs: [{ date, calories: 2000 }],
      weightLogs: [{ date, weightKg: 72 }],
    });
    expect(result).toHaveLength(1);
    const day = result[0]!;
    expect(day.sleepHours).toBe(7.5);
    expect(day.sleepQuality).toBe(4);
    expect(day.energyLevel).toBe(4);
    expect(day.moodLevel).toBe(3);
    expect(day.painLevel).toBe(2);
    expect(day.activityMinutes).toBe(30);
    expect(day.calories).toBe(2000);
    expect(day.weightKg).toBe(72);
  });

  it("uses MET_VALUES for volume calculation", () => {
    const date = makeDate(0);
    // run: MET=8.0, intensity=3, duration=10 → volume = 10*3*8 = 240
    const result = buildDailyDataset({
      ...empty,
      activityLogs: [{ date, durationMinutes: 10, activityType: "run", intensityLevel: 3 }],
    });
    expect(result[0]?.activityVolume).toBeCloseTo(240, 3);
  });

  it("falls back to MET=4 for unknown activity type", () => {
    const date = makeDate(0);
    const result = buildDailyDataset({
      ...empty,
      activityLogs: [{ date, durationMinutes: 10, activityType: "unknown_sport", intensityLevel: 2 }],
    });
    expect(result[0]?.activityVolume).toBeCloseTo(80, 3);
  });
});

// ─── computeCrossDomainCorrelations ──────────────────────────────────────────

describe("computeCrossDomainCorrelations", () => {
  it("returns empty for data below minN threshold", () => {
    const data = Array.from({ length: 30 }, (_, i) => ({
      date: isoDate(i),
      sleepHours: 7,
      energyLevel: 4,
    }));
    expect(computeCrossDomainCorrelations(data, 45)).toEqual([]);
  });

  it("detects strong positive correlation between two perfectly linked domains", () => {
    // sleep and energy move in lockstep over 60 days
    const data = Array.from({ length: 60 }, (_, i) => ({
      date: isoDate(i),
      sleepHours: 5 + (i % 5) * 0.5,
      energyLevel: 1 + (i % 5),
    }));
    const result = computeCrossDomainCorrelations(data, 45);
    const corr = result.find(c => c.metricA === "sleepHours" && c.metricB === "energyLevel" && c.lagDays === 0);
    expect(corr).toBeDefined();
    expect(corr!.pearson).toBeGreaterThan(0.8);
  });

  it("filters correlations with |r| < 0.2", () => {
    const data = Array.from({ length: 60 }, (_, i) => ({
      date: isoDate(i),
      sleepHours: 7 + (i % 2 === 0 ? 0.1 : -0.1),
      energyLevel: 3 + (i % 13 === 0 ? 1 : 0),
    }));
    const result = computeCrossDomainCorrelations(data, 45);
    result.forEach(c => expect(Math.abs(c.pearson)).toBeGreaterThanOrEqual(0.2));
  });

  it("assigns confidence tiers based on nEff", () => {
    const data = Array.from({ length: 200 }, (_, i) => ({
      date: isoDate(i),
      sleepHours: 5 + (i % 5) * 0.4,
      energyLevel: 1 + (i % 5),
    }));
    const result = computeCrossDomainCorrelations(data, 45);
    const corr = result.find(c => c.metricA === "sleepHours" && c.metricB === "energyLevel" && c.lagDays === 0);
    if (corr) {
      expect(["low", "moderate", "high"]).toContain(corr.confidence);
      if (corr.nEff >= 120) expect(corr.confidence).toBe("high");
      else if (corr.nEff >= 60) expect(corr.confidence).toBe("moderate");
      else expect(corr.confidence).toBe("low");
    }
  });

  it("lag=1 detects a relationship where sleep yesterday predicts energy today", () => {
    // Construct: energy[i] = sleep[i-1] exactly
    // At lag=1: A(t-1)=sleep[t-1], B(t)=energy[t]=sleep[t-1] → r=1
    const sleepSeq = [5, 7, 6, 8, 5, 9, 6, 7, 5, 8, 6, 9, 5, 7, 8, 6, 9, 5, 7, 6,
                      8, 5, 9, 6, 7, 5, 8, 6, 9, 5, 7, 8, 6, 9, 5, 7, 6, 8, 5, 9,
                      6, 7, 5, 8, 6, 9, 5, 7, 8, 6, 9, 5, 7, 6, 8, 5, 9, 6, 7, 5];
    const data = Array.from({ length: 60 }, (_, i) => ({
      date: isoDate(i),
      sleepHours: sleepSeq[i]!,
      energyLevel: i === 0 ? sleepSeq[0]! : sleepSeq[i - 1]!, // energy[i] = sleep[i-1]
    }));
    const result = computeCrossDomainCorrelations(data, 45);
    const lag1 = result.find(c => c.metricA === "sleepHours" && c.metricB === "energyLevel" && c.lagDays === 1);
    expect(lag1).toBeDefined();
    expect(Math.abs(lag1!.pearson)).toBeGreaterThan(0.95);
  });

  it("skips within-domain pairs at lag 0", () => {
    const data = Array.from({ length: 60 }, (_, i) => ({
      date: isoDate(i),
      sleepHours: 7,
      sleepQuality: 4,
    }));
    const result = computeCrossDomainCorrelations(data, 45);
    const samedomainLag0 = result.find(
      c => c.metricA === "sleepHours" && c.metricB === "sleepQuality" && c.lagDays === 0
    );
    expect(samedomainLag0).toBeUndefined();
  });

  it("CI bounds contain the Pearson r", () => {
    const data = Array.from({ length: 60 }, (_, i) => ({
      date: isoDate(i),
      sleepHours: 5 + (i % 5) * 0.5,
      energyLevel: 1 + (i % 5),
    }));
    const result = computeCrossDomainCorrelations(data, 45);
    result.forEach(c => {
      expect(c.ci[0]).toBeLessThanOrEqual(c.pearson);
      expect(c.ci[1]).toBeGreaterThanOrEqual(c.pearson);
    });
  });

  it("FDR-significant correlations have p-value consistent with BH threshold", () => {
    const data = Array.from({ length: 60 }, (_, i) => ({
      date: isoDate(i),
      sleepHours: 5 + (i % 5) * 0.5,
      energyLevel: 1 + (i % 5),
    }));
    const result = computeCrossDomainCorrelations(data, 45);
    const significant = result.filter(c => c.significant);
    significant.forEach(c => {
      expect(c.pValue).toBeLessThanOrEqual(0.05);
    });
  });
});
