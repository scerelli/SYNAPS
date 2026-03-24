import { z } from "zod";
import {
  BIOMARKER_STATUSES,
  BLOOD_TYPES,
  DIETARY_PREFERENCES,
  MEAL_TYPES,
  NODE_TYPES,
  REMINDER_SOURCES,
  SLEEP_QUALITY_MAX,
  SLEEP_QUALITY_MIN,
} from "./constants.js";

export const registerSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const userProfileSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  dateOfBirth: z.coerce.date(),
  sex: z.enum(["male", "female", "other"]),
  bloodType: z.enum(BLOOD_TYPES).nullable().optional(),
  heightCm: z.number().positive().max(300).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  dietaryPreference: z.enum(DIETARY_PREFERENCES).default("omnivore"),
  smokingStatus: z.enum(["never", "former", "current"]).default("never"),
  cigarettesPerDay: z.number().int().min(1).max(200).optional(),
  smokeQuitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const allergySchema = z.object({
  name: z.string().min(1).max(200),
  severity: z.enum(["mild", "moderate", "severe"]).nullable().optional(),
});

export const allergyCreateSchema = allergySchema;
export const allergyUpdateSchema = allergySchema.partial();

export const reportCreateSchema = z.object({
  title: z.string().min(1).max(500),
  reportDate: z.coerce.date(),
  tagIds: z.array(z.string().cuid()).max(10).optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export const reportUpdateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  reportDate: z.coerce.date().optional(),
  tagIds: z.array(z.string().cuid()).max(10).optional(),
  notes: z.string().max(5000).nullable().optional(),
  facility: z.string().max(300).nullable().optional(),
  examType: z.string().max(200).nullable().optional(),
  doctorName: z.string().max(200).nullable().optional(),
  doctorSpecialty: z.string().max(200).nullable().optional(),
});

export const reportListSchema = z.object({
  cursor: z.string().cuid().optional(),
  limit: z.number().int().min(1).max(50).default(20),
  tagIds: z.array(z.string().cuid()).max(10).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  search: z.string().max(200).optional(),
});

export const reportChatSchema = z.object({
  id: z.string().cuid(),
  message: z.string().min(1).max(2000),
});

export const reportEntryCreateSchema = z.object({
  reportId: z.string().cuid(),
  biomarkerName: z.string().min(1).max(200),
  value: z.number(),
  unit: z.string().min(1).max(50),
  referenceMin: z.number().nullable().optional(),
  referenceMax: z.number().nullable().optional(),
  status: z.enum(BIOMARKER_STATUSES).nullable().optional(),
});

export const reportEntryUpdateSchema = reportEntryCreateSchema
  .omit({ reportId: true })
  .partial();

export const settingSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string(),
});

export const conditionCreateSchema = z.object({
  name: z.string().min(1).max(300),
  diagnosedAt: z.coerce.date().nullable().optional(),
  resolvedAt: z.coerce.date().nullable().optional(),
  isCurrent: z.boolean().default(true),
  notes: z.string().max(5000).nullable().optional(),
});

export const conditionUpdateSchema = conditionCreateSchema.partial();

export const sleepLogCreateSchema = z.object({
  date: z.coerce.date(),
  hoursSlept: z.number().min(0).max(24),
  quality: z
    .number()
    .int()
    .min(SLEEP_QUALITY_MIN)
    .max(SLEEP_QUALITY_MAX)
    .nullable()
    .optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const sleepLogUpdateSchema = sleepLogCreateSchema.partial();

export const dietLogCreateSchema = z.object({
  date: z.coerce.date(),
  mealType: z.enum(MEAL_TYPES),
  description: z.string().min(1).max(2000),
  calories: z.number().int().min(0).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const dietLogUpdateSchema = dietLogCreateSchema.partial();

export const graphNodeCreateSchema = z.object({
  nodeType: z.enum(NODE_TYPES),
  label: z.string().min(1).max(300),
  metadata: z.record(z.unknown()).default({}),
  reportId: z.string().cuid().nullable().optional(),
  conditionId: z.string().cuid().nullable().optional(),
});

export const graphEdgeCreateSchema = z.object({
  sourceId: z.string().cuid(),
  targetId: z.string().cuid(),
  relationship: z.string().min(1).max(200),
  weight: z.number().min(-1).max(1).default(0),
  metadata: z.record(z.unknown()).default({}),
});

export const reminderCreateSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  isRecurring: z.boolean().default(false),
  cronExpr: z.string().max(100).nullable().optional(),
  source: z.enum(REMINDER_SOURCES).default("manual"),
});

export const reminderUpdateSchema = reminderCreateSchema.partial();

export const idSchema = z.object({
  id: z.string().cuid(),
});

export const cursorSchema = z.object({
  cursor: z.string().cuid().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

export const analyzeNotesSchema = z.object({
  id: z.string().cuid(),
  notes: z.string().min(1).max(10000),
});

export const medicationCreateSchema = z.object({
  name: z.string().min(1).max(200),
  dosage: z.string().max(100).optional(),
  frequency: z.enum(["daily", "twice_daily", "weekly", "monthly", "as_needed", "other"]).default("daily"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  isActive: z.boolean().default(true),
  notes: z.string().max(500).optional(),
});

export const medicationUpdateSchema = medicationCreateSchema.partial().extend({
  id: z.string().cuid(),
});

export const weightLogCreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weightKg: z.number().positive().max(500),
  bodyFatPct: z.number().min(1).max(70).optional(),
  waistCm: z.number().positive().max(300).optional(),
  notes: z.string().max(500).optional(),
});

export const weightLogListSchema = z.object({
  limit: z.number().int().min(1).max(200).default(90),
});
