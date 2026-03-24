export const DEFAULT_TAGS = [
  { name: "Blood Test", slug: "blood-test", color: "#ef4444" },
  { name: "Urine Test", slug: "urine-test", color: "#f97316" },
  { name: "Imaging", slug: "imaging", color: "#8b5cf6" },
  { name: "Cardiology", slug: "cardiology", color: "#ec4899" },
  { name: "Ophthalmology", slug: "ophthalmology", color: "#06b6d4" },
  { name: "Dermatology", slug: "dermatology", color: "#84cc16" },
  { name: "Dental", slug: "dental", color: "#14b8a6" },
  { name: "Endocrinology", slug: "endocrinology", color: "#f59e0b" },
  { name: "General Checkup", slug: "general-checkup", color: "#10b981" },
  { name: "Neurology", slug: "neurology", color: "#6366f1" },
  { name: "Allergy Test", slug: "allergy-test", color: "#f43f5e" },
  { name: "Nutrition", slug: "nutrition", color: "#22c55e" },
  { name: "Mental Health", slug: "mental-health", color: "#a855f7" },
  { name: "Orthopedics", slug: "orthopedics", color: "#64748b" },
  { name: "Other", slug: "other", color: "#71717a" },
] as const;

export const DIETARY_PREFERENCES = [
  "omnivore",
  "vegetarian",
  "vegan",
  "pescatarian",
  "keto",
  "paleo",
  "other",
] as const;

export const BLOOD_TYPES = [
  "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-",
] as const;

export const MEAL_TYPES = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
] as const;

export const BIOMARKER_STATUSES = [
  "normal",
  "high",
  "low",
  "critical-high",
  "critical-low",
] as const;

export const SLEEP_QUALITY_MIN = 1;
export const SLEEP_QUALITY_MAX = 5;

export const MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024;

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export const NODE_TYPES = [
  "biomarker",
  "condition",
  "lifestyle",
  "environmental",
  "symptom",
  "medication",
] as const;

export const ACTIVITY_TYPES = [
  "run",
  "walk",
  "gym",
  "swim",
  "cycling",
  "yoga",
  "sport",
  "other",
] as const;

export const REMINDER_SOURCES = ["ai", "manual"] as const;

export const AI_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "it", label: "Italiano" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
  { code: "nl", label: "Nederlands" },
  { code: "pl", label: "Polski" },
  { code: "ru", label: "Русский" },
  { code: "zh", label: "中文" },
  { code: "ja", label: "日本語" },
  { code: "ar", label: "العربية" },
] as const;

export type AiLanguageCode = (typeof AI_LANGUAGES)[number]["code"];

export const CLAUDE_MODEL = "claude-sonnet-4-5";
