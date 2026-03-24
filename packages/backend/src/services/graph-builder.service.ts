import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { getClientAndLanguage } from "./claude.service.js";
import {
  computeCorrelations,
  computeTrends,
  correlationToWeight,
  buildDailyDataset,
  computeCrossDomainCorrelations,
  computePainAreaFrequency,
} from "./statistics.service.js";
import type { BiomarkerTimeSeries } from "./statistics.service.js";
import { getMetricSnapshot } from "./metrics.service.js";
import { CLAUDE_MODEL, NODE_TYPES } from "@synaps/shared";

const GRAPH_BUILD_PROMPT = `You are a medical knowledge graph builder. Analyze the patient's health data and build a knowledge graph that shows meaningful connections between biomarkers, conditions, lifestyle factors, and symptoms.

Return ONLY a JSON object with this exact structure:
{
  "nodes": [
    { "id": "n1", "nodeType": "biomarker|condition|lifestyle|symptom|medication", "label": "exact name", "metadata": {} }
  ],
  "edges": [
    { "source": "n1", "target": "n2", "relationship": "correlates_with|indicates|influences|associated_with|treated_by|causes", "weight": 0.1 }
  ]
}

Rules for nodes:
- Only create nodes for entities with actual evidence in the data
- biomarker: named measurement (Glucose, Hemoglobin, etc.)
- condition: diagnosed condition, disease, or chronic allergy/intolerance
- lifestyle: dietary preference, significant lifestyle factor (NOT allergies — those are conditions)
- symptom: reported symptom
- medication: drug or supplement
- metadata can include: { unit, avgValue, lastStatus } for biomarkers; { isCurrent } for conditions

Rules for edges:
- Only create edges when there is clinical or statistical evidence
- Weight 0.1–0.3: weak link, 0.4–0.6: moderate, 0.7–0.9: strong, 1.0: definitive
- Positive weight = positive/direct relationship
- Each edge must reference valid node IDs from the nodes array
- Maximum 50 edges

CRITICAL — Temporal causality rule:
- The lifestyle data (dietaryPreference, allergies) is a CURRENT snapshot only. It does NOT reflect the patient's history.
- NEVER infer that a current lifestyle caused a condition unless diagnosedAt clearly postdates the lifestyle change or there is strong established clinical evidence (e.g., celiac disease ↔ gluten).
- If a condition was diagnosed before the current diet was adopted, do NOT draw a causal edge between them.
- Use "associated_with" (not "causes") for lifestyle↔condition edges when the temporal relationship is unknown.

Return valid JSON only, no markdown.`;

type RawNode = {
  id: string;
  nodeType: string;
  label: string;
  metadata: Record<string, unknown>;
};

type RawEdge = {
  source: string;
  target: string;
  relationship: string;
  weight: number;
};

function parseGraphResponse(raw: string): { nodes: RawNode[]; edges: RawEdge[] } {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match?.[0] ?? "{}") as {
      nodes?: unknown[];
      edges?: unknown[];
    };

    const validNodeTypes = new Set<string>(NODE_TYPES);

    const nodes: RawNode[] = (parsed.nodes ?? [])
      .filter(
        (n): n is RawNode =>
          typeof n === "object" &&
          n !== null &&
          typeof (n as RawNode).id === "string" &&
          typeof (n as RawNode).label === "string" &&
          validNodeTypes.has((n as RawNode).nodeType),
      )
      .map((n) => ({
        id: (n as RawNode).id,
        nodeType: (n as RawNode).nodeType,
        label: (n as RawNode).label,
        metadata:
          typeof (n as RawNode).metadata === "object" &&
          (n as RawNode).metadata !== null
            ? (n as RawNode).metadata
            : {},
      }));

    const nodeIds = new Set(nodes.map((n) => n.id));

    const edges: RawEdge[] = (parsed.edges ?? [])
      .filter(
        (e): e is RawEdge =>
          typeof e === "object" &&
          e !== null &&
          typeof (e as RawEdge).source === "string" &&
          typeof (e as RawEdge).target === "string" &&
          typeof (e as RawEdge).relationship === "string" &&
          typeof (e as RawEdge).weight === "number" &&
          nodeIds.has((e as RawEdge).source) &&
          nodeIds.has((e as RawEdge).target),
      )
      .map((e) => ({
        source: (e as RawEdge).source,
        target: (e as RawEdge).target,
        relationship: (e as RawEdge).relationship,
        weight: Math.max(-1, Math.min(1, (e as RawEdge).weight)),
      }));

    return { nodes, edges };
  } catch {
    return { nodes: [], edges: [] };
  }
}

export async function buildGraphForProfile(profileId: string): Promise<void> {
  const profileHeight = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { heightCm: true },
  });

  const [reports, conditions, profile, metricSnapshot, latestWeight, medications, sleepLogs, diaryEntries, activityLogs, dietLogs, weightLogs] = await Promise.all([
    prisma.report.findMany({
      where: { profileId, deletedAt: null },
      include: {
        entries: { orderBy: { biomarkerName: "asc" } },
        tags: { include: { tag: true } },
      },
      orderBy: { reportDate: "desc" },
      take: 50,
    }),
    prisma.condition.findMany({ where: { profileId } }),
    prisma.profile.findUnique({
      where: { id: profileId },
      select: {
        dietaryPreference: true,
        heightCm: true,
        smokingStatus: true,
        cigarettesPerDay: true,
        smokeQuitDate: true,
        allergies: { select: { name: true, severity: true } },
      },
    }),
    getMetricSnapshot(profileId, profileHeight?.heightCm ?? undefined),
    prisma.weightLog.findFirst({
      where: { profileId },
      orderBy: { date: "desc" },
    }),
    prisma.medication.findMany({
      where: { profileId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.sleepLog.findMany({ where: { profileId }, select: { date: true, hoursSlept: true, quality: true } }),
    prisma.healthDiary.findMany({ where: { profileId }, select: { date: true, energyLevel: true, moodLevel: true, painLevel: true, painArea: true } }),
    prisma.activityLog.findMany({ where: { profileId }, select: { date: true, durationMinutes: true, activityType: true, intensityLevel: true } }),
    prisma.dietLog.findMany({ where: { profileId }, select: { date: true, calories: true } }),
    prisma.weightLog.findMany({ where: { profileId }, select: { date: true, weightKg: true }, orderBy: { date: "desc" }, take: 90 }),
  ]);

  const biomarkerMap = new Map<
    string,
    { unit: string; values: number[]; statuses: string[]; points: Array<{ date: Date; value: number }> }
  >();
  for (const report of reports) {
    for (const entry of report.entries) {
      if (!biomarkerMap.has(entry.biomarkerName)) {
        biomarkerMap.set(entry.biomarkerName, {
          unit: entry.unit,
          values: [],
          statuses: [],
          points: [],
        });
      }
      const bm = biomarkerMap.get(entry.biomarkerName)!;
      bm.values.push(entry.value);
      bm.points.push({ date: report.reportDate, value: entry.value });
      if (entry.status) bm.statuses.push(entry.status);
    }
  }

  const biomarkers = Array.from(biomarkerMap.entries()).map(([name, data]) => ({
    name,
    unit: data.unit,
    measurementCount: data.values.length,
    avgValue: parseFloat(
      (data.values.reduce((a, b) => a + b, 0) / data.values.length).toFixed(2),
    ),
    lastValue: data.values[0],
    statuses: [...new Set(data.statuses)],
  }));

  const timeSeries: BiomarkerTimeSeries[] = Array.from(biomarkerMap.entries()).map(([name, data]) => ({
    name,
    points: data.points,
  }));

  const correlations = computeCorrelations(timeSeries);
  const trends = computeTrends(timeSeries);

  const dailyData = buildDailyDataset({ sleepLogs, diaryEntries, activityLogs, dietLogs, weightLogs });
  const crossCorrelations = computeCrossDomainCorrelations(dailyData);
  const painFrequency = computePainAreaFrequency(diaryEntries);

  const heightCm = profile?.heightCm ?? null;
  const bmi =
    latestWeight && heightCm
      ? parseFloat((latestWeight.weightKg / Math.pow(heightCm / 100, 2)).toFixed(1))
      : null;

  const smokingStatus = profile?.smokingStatus ?? "never";
  const smokingInfo = smokingStatus === "current"
    ? `current, ${profile?.cigarettesPerDay ?? "?"} cig/day`
    : smokingStatus === "former"
      ? `former, quit ${profile?.smokeQuitDate ? profile.smokeQuitDate.toISOString().split("T")[0] : "unknown"}`
      : "never";

  const METRIC_LABELS: Record<string, string> = {
    sleepHours: "sleep hours", sleepQuality: "sleep quality",
    energyLevel: "energy", moodLevel: "mood", painLevel: "pain",
    activityMinutes: "activity minutes", activityVolume: "activity volume (MET-min)",
    calories: "daily calories", weightKg: "weight",
  };

  const crossCorrText = crossCorrelations.length > 0
    ? `WITHIN-PERSON CROSS-DOMAIN CORRELATIONS (N-of-1, FDR-corrected, min n=45):\n` +
      `(Confidence based on effective N after autocorrelation adjustment. These are correlational signals, not proven causal relationships.)\n` +
      crossCorrelations.slice(0, 12).map(c =>
        `${METRIC_LABELS[c.metricA] ?? c.metricA} ${c.lagDays > 0 ? `(lag ${c.lagDays}d) ` : ""}↔ ${METRIC_LABELS[c.metricB] ?? c.metricB}: ` +
        `r=${c.pearson > 0 ? "+" : ""}${c.pearson}, 95%CI=[${c.ci[0]},${c.ci[1]}], n=${c.n} (nEff=${c.nEff}), ${c.confidence} confidence${c.significant ? ", FDR-significant" : ", not FDR-significant"}`
      ).join("\n")
    : "WITHIN-PERSON CORRELATIONS: Insufficient data (need ≥45 co-observations per pair).";

  const painText = painFrequency.length > 0
    ? `PAIN AREA FREQUENCY:\n` + painFrequency.map(p =>
        `${p.area}: ${p.count} episodes, avg pain ${p.avgPain}/10, ${Math.round(p.frequency * 100)}% of pain days`
      ).join("\n")
    : "";

  const context = {
    biomarkers,
    conditions: conditions.map((c) => ({
      name: c.name,
      isCurrent: c.isCurrent,
      diagnosedAt: c.diagnosedAt ? c.diagnosedAt.toISOString().split("T")[0] : null,
      resolvedAt: c.resolvedAt ? c.resolvedAt.toISOString().split("T")[0] : null,
      notes: c.notes,
    })),
    lifestyle: {
      dietaryPreference: profile?.dietaryPreference,
      allergies: profile?.allergies.map((a) => a.name) ?? [],
      smoking: smokingInfo,
    },
    latestBodyMeasurements: latestWeight
      ? {
          weightKg: latestWeight.weightKg,
          ...(bmi !== null && { bmi }),
          ...(latestWeight.bodyFatPct !== null && { bodyFatPct: latestWeight.bodyFatPct }),
          ...(latestWeight.waistCm !== null && { waistCm: latestWeight.waistCm }),
        }
      : null,
    activeMedications: medications.map((m) => ({
      name: m.name,
      dosage: m.dosage ?? null,
      frequency: m.frequency,
    })),
    statisticalCorrelations: correlations.slice(0, 20).map((c) => ({
      between: [c.biomarkerA, c.biomarkerB],
      pearson: c.pearson,
      n: c.n,
    })),
    crossDomainCorrelations: crossCorrText,
    painAreaFrequency: painText,
    trends: trends.map((t) => ({
      biomarker: t.biomarkerName,
      trend: t.slope > 0.01 ? "increasing" : t.slope < -0.01 ? "decreasing" : "stable",
      zScore: t.zScore,
    })),
    metrics: metricSnapshot,
  };

  const pearsonByPair = new Map<string, number>();
  for (const c of correlations) {
    pearsonByPair.set(`${c.biomarkerA}|${c.biomarkerB}`, c.pearson);
    pearsonByPair.set(`${c.biomarkerB}|${c.biomarkerA}`, c.pearson);
  }

  const { client } = await getClientAndLanguage();

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    temperature: 0,
    system: GRAPH_BUILD_PROMPT,
    messages: [{ role: "user", content: JSON.stringify(context) }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const raw = textBlock?.type === "text" ? textBlock.text : "";
  const graphData = parseGraphResponse(raw);

  if (graphData.nodes.length === 0) return;

  await prisma.$transaction(async (tx) => {
    await tx.graphNode.deleteMany({ where: { profileId } });

    const nodeIdMap = new Map<string, string>();
    const nodeLabelMap = new Map<string, string>();
    for (const node of graphData.nodes) {
      const created = await tx.graphNode.create({
        data: {
          profileId,
          nodeType: node.nodeType,
          label: node.label,
          metadata: node.metadata as unknown as Prisma.InputJsonObject,
        },
        select: { id: true },
      });
      nodeIdMap.set(node.id, created.id);
      nodeLabelMap.set(node.id, node.label);
    }

    for (const edge of graphData.edges) {
      const sourceId = nodeIdMap.get(edge.source);
      const targetId = nodeIdMap.get(edge.target);
      if (!sourceId || !targetId || sourceId === targetId) continue;

      const sourceLabel = nodeLabelMap.get(edge.source) ?? "";
      const targetLabel = nodeLabelMap.get(edge.target) ?? "";
      const statKey = `${sourceLabel}|${targetLabel}`;
      const pearson = pearsonByPair.get(statKey);
      const weight = pearson !== undefined
        ? correlationToWeight(pearson)
        : edge.weight;

      await tx.graphEdge.create({
        data: {
          sourceId,
          targetId,
          relationship: edge.relationship,
          weight,
        },
      });
    }
  });
}
