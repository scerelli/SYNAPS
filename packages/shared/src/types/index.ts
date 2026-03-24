import { z } from "zod";
import {
  allergySchema,
  conditionCreateSchema,
  dietLogCreateSchema,
  graphEdgeCreateSchema,
  graphNodeCreateSchema,
  loginSchema,
  registerSchema,
  reminderCreateSchema,
  reportCreateSchema,
  reportEntryCreateSchema,
  reportListSchema,
  settingSchema,
  sleepLogCreateSchema,
  userProfileSchema,
} from "../schemas.js";
import type { BIOMARKER_STATUSES } from "../constants.js";

export type UserProfile = z.infer<typeof userProfileSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AllergyInput = z.infer<typeof allergySchema>;
export type ReportCreate = z.infer<typeof reportCreateSchema>;
export type ReportListInput = z.infer<typeof reportListSchema>;
export type ReportEntryCreate = z.infer<typeof reportEntryCreateSchema>;
export type SettingInput = z.infer<typeof settingSchema>;
export type ConditionCreate = z.infer<typeof conditionCreateSchema>;
export type SleepLogCreate = z.infer<typeof sleepLogCreateSchema>;
export type DietLogCreate = z.infer<typeof dietLogCreateSchema>;
export type GraphNodeCreate = z.infer<typeof graphNodeCreateSchema>;
export type GraphEdgeCreate = z.infer<typeof graphEdgeCreateSchema>;
export type ReminderCreate = z.infer<typeof reminderCreateSchema>;

export type Session = {
  userId: string;
  authenticated: boolean;
};

export type BiomarkerStatus = (typeof BIOMARKER_STATUSES)[number];

export type AiExtractedEntry = {
  biomarkerName: string;
  value: number;
  unit: string;
  referenceMin: number | null;
  referenceMax: number | null;
  status: BiomarkerStatus | null;
};

export type AiAnalysisResult = {
  entries: AiExtractedEntry[];
  summary: string;
  suggestedTitle: string | null;
  suggestedTagSlugs: string[];
  doctorName: string | null;
  doctorSpecialty: string | null;
  facilityName: string | null;
  examType: string | null;
  rawResponse: string;
  modelUsed: string;
  tokensUsed: number | null;
};
