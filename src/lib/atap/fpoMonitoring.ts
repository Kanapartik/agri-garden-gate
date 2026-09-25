/**
 * FPO field monitoring — pure domain logic (no I/O).
 * Consent and role gates here are re-checked server-side and by RLS.
 */
export const MONITORING_PURPOSE = "fpo_member_management";

export const MONITORING_CATEGORIES = [
  "pest",
  "disease",
  "water",
  "soil",
  "weather",
  "input",
  "market",
  "other",
] as const;
export type MonitoringCategory = (typeof MONITORING_CATEGORIES)[number];

export const MONITORING_SEVERITIES = ["low", "medium", "high"] as const;
export type MonitoringSeverity = (typeof MONITORING_SEVERITIES)[number];

export const AI_DISCLAIMER =
  "Advisory draft — not a decision. Review it against the field before acting.";

const WRITE_ROLES = ["platform_admin", "tenant_admin", "onboarding_officer", "field_agent"];
const READ_ROLES = [...WRITE_ROLES, "viewer", "auditor"];

export function canWriteMonitoring(roles: string[]): boolean {
  return roles.some((r) => WRITE_ROLES.includes(r));
}
export function canReadMonitoring(roles: string[]): boolean {
  return roles.some((r) => READ_ROLES.includes(r));
}

export function hasMonitoringConsent(purposes: string[]): boolean {
  return purposes.includes(MONITORING_PURPOSE);
}

export interface NoteForPrompt {
  observed_on: string;
  crop: string | null;
  category: string;
  severity: string;
  body: string;
}

/**
 * Only observation fields reach the model — never names, contacts, bank,
 * insurance or coordinates. Phone-like digit runs and emails are scrubbed.
 */
export function redactText(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .replace(/\+?\d[\d\s-]{8,}\d/g, "[number]")
    .slice(0, 1200);
}

export function buildPromptPayload(memberRef: string, notes: NoteForPrompt[]): string {
  const lines = notes
    .slice(0, 40)
    .map(
      (n) =>
        `- ${n.observed_on} | ${n.crop ?? "unspecified crop"} | ${n.category} | severity ${n.severity}: ${redactText(n.body)}`,
    );
  return `Member ${memberRef} — field monitoring notes (oldest to newest):\n${lines.join("\n")}`;
}

export const SYSTEM_PROMPT = `You assist a Farmer Producer Organization field officer in India.
From the monitoring notes, write:
1. A short summary (at most 120 words) of emerging or worsening farm issues, citing dates.
2. Between 3 and 5 follow-up questions the officer should ask on the next visit.
You never make decisions about loans, insurance claims, scheme eligibility or payments, and you never recommend specific pesticide doses.
Reply ONLY with JSON: {"summary": string, "questions": string[]}`;

export interface AiSummary {
  summary: string;
  questions: string[];
}

/** Clamp and validate model output; tolerant of surrounding text. */
export function parseAiSummary(raw: string): AiSummary {
  const match = raw.match(/\{[\s\S]*\}/);
  let summary = "";
  let questions: string[] = [];
  if (match) {
    try {
      const obj = JSON.parse(match[0]) as { summary?: unknown; questions?: unknown };
      summary = typeof obj.summary === "string" ? obj.summary : "";
      questions = Array.isArray(obj.questions)
        ? obj.questions.filter((q): q is string => typeof q === "string")
        : [];
    } catch {
      /* fall through */
    }
  }
  if (!summary) summary = raw.trim();
  return {
    summary: summary.slice(0, 1500),
    questions: questions.map((q) => q.trim()).filter(Boolean).slice(0, 5),
  };
}
