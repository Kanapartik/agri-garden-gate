import type { FpoSection, MetricCard } from "@/lib/atap/fpo";
import type { AppRole } from "@/lib/atap/policy";

/**
 * FPO Intelligence & Governance command-centre model.
 *
 * These definitions are navigation and presentation metadata only. They grant
 * no authority and expose no additional farmer data. Each destination remains
 * protected by its existing tenant-scoped server function and RLS policy.
 */

export type FpoCapabilityStatus = "operational" | "foundation";

export interface FpoCoreModule {
  key:
    | "farmer_360"
    | "crop_intelligence"
    | "inputs"
    | "procurement_quality"
    | "inventory_traceability"
    | "market_logistics"
    | "finance"
    | "insurance"
    | "governance"
    | "revenue_intelligence";
  title: string;
  description: string;
  section: FpoSection;
  status: FpoCapabilityStatus;
}

export const FPO_CORE_MODULES: FpoCoreModule[] = [
  {
    key: "farmer_360",
    title: "Farmer 360",
    description: "Member registry, consent, land, crop, training and transaction history.",
    section: "farmers",
    status: "operational",
  },
  {
    key: "crop_intelligence",
    title: "Crop intelligence",
    description: "Recorded crop plans and harvest windows; forecasting waits for validated feeds.",
    section: "insights",
    status: "foundation",
  },
  {
    key: "inputs",
    title: "Input management",
    description: "Aggregate member demand, compare supplier quotes and record distribution.",
    section: "procurement",
    status: "operational",
  },
  {
    key: "procurement_quality",
    title: "Procurement & quality",
    description: "Plan aggregation, capture member contributions, grades and buyer enquiries.",
    section: "produce",
    status: "operational",
  },
  {
    key: "inventory_traceability",
    title: "Inventory & traceability",
    description: "Lot-level quantity, storage and source records ready for deeper warehouse links.",
    section: "produce",
    status: "foundation",
  },
  {
    key: "market_logistics",
    title: "Market & logistics",
    description: "Observed prices, buyer offers, marketplace publishing and logistics options.",
    section: "produce",
    status: "operational",
  },
  {
    key: "finance",
    title: "Finance & settlements",
    description: "Receivables, payables, farmer ledger, grants and bank reconciliation.",
    section: "accounts",
    status: "operational",
  },
  {
    key: "insurance",
    title: "Insurance",
    description: "Member cover, policy exposure and consent-bound claim-support records.",
    section: "insurance",
    status: "operational",
  },
  {
    key: "governance",
    title: "Governance & compliance",
    description: "Documents, tasks, roles, audited actions and human approval controls.",
    section: "documents",
    status: "operational",
  },
  {
    key: "revenue_intelligence",
    title: "Revenue intelligence",
    description: "Derived operational signals today; predictive opportunity models come later.",
    section: "insights",
    status: "foundation",
  },
];

export interface FpoOperatingStage {
  key: string;
  label: string;
  detail: string;
  section: FpoSection;
}

export const FPO_OPERATING_CHAIN: FpoOperatingStage[] = [
  {
    key: "member",
    label: "Farmer",
    detail: "Member, land and consent",
    section: "farmers",
  },
  {
    key: "plan",
    label: "Plan",
    detail: "Crop, harvest and input demand",
    section: "insights",
  },
  {
    key: "input",
    label: "Inputs",
    detail: "Bulk sourcing and distribution",
    section: "procurement",
  },
  {
    key: "aggregate",
    label: "Aggregate",
    detail: "Collection and member contribution",
    section: "produce",
  },
  {
    key: "quality",
    label: "Quality & stock",
    detail: "Grade, lot and storage trail",
    section: "produce",
  },
  {
    key: "market",
    label: "Market",
    detail: "Buyer, price and logistics",
    section: "produce",
  },
  {
    key: "settle",
    label: "Settle & govern",
    detail: "Payment, audit and compliance",
    section: "accounts",
  },
];

export type FpoDashboardLens = "executive" | "operations" | "market_finance" | "governance";

export interface FpoLensDefinition {
  key: FpoDashboardLens;
  label: string;
  description: string;
  sections: FpoSection[];
}

export const FPO_DASHBOARD_LENSES: FpoLensDefinition[] = [
  {
    key: "executive",
    label: "CEO / board",
    description: "Organization readiness, member participation, money, risk and governance.",
    sections: ["insights", "accounts", "tasks", "documents"],
  },
  {
    key: "operations",
    label: "Operations",
    description: "Members, input demand, harvest aggregation, lots and time-sensitive work.",
    sections: ["farmers", "procurement", "produce", "tasks"],
  },
  {
    key: "market_finance",
    label: "Market & finance",
    description: "Buyer opportunities, prices, receivables, payables and settlements.",
    sections: ["produce", "accounts", "opportunities", "insights"],
  },
  {
    key: "governance",
    label: "Governance",
    description: "Compliance, permissions, insurance, audit evidence and unresolved tasks.",
    sections: ["documents", "team", "insurance", "insights"],
  },
];

export function defaultFpoDashboardLens(roles: AppRole[]): FpoDashboardLens {
  if (roles.includes("auditor")) return "governance";
  if (roles.includes("field_agent") || roles.includes("onboarding_officer")) return "operations";
  if (roles.includes("tenant_admin") || roles.includes("platform_admin")) return "executive";
  return "market_finance";
}

export interface FpoReadinessInput {
  onboardingCompleteness: number;
  totalMembers: number;
  activeMembers: number;
  missingDocuments: number;
  complianceActions: number;
}

export interface FpoReadiness {
  score: number;
  onboarding: number;
  memberActivation: number;
  compliance: number;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * A transparent operating-readiness indicator, never a credit, scheme,
 * insurance or governance decision score.
 */
export function deriveFpoReadiness(input: FpoReadinessInput): FpoReadiness {
  const onboarding = clampPercent(input.onboardingCompleteness);
  const memberActivation =
    input.totalMembers > 0 ? clampPercent((input.activeMembers / input.totalMembers) * 100) : 0;
  const compliance = clampPercent(100 - input.missingDocuments * 20 - input.complianceActions * 10);
  const score = clampPercent(onboarding * 0.5 + memberActivation * 0.25 + compliance * 0.25);
  return { score, onboarding, memberActivation, compliance };
}

export interface FpoAttentionItem {
  key: string;
  label: string;
  section: FpoSection;
  tone: "urgent" | "attention" | "ready";
}

function metricValue(metrics: MetricCard[], key: string): number {
  const value = metrics.find((metric) => metric.key === key)?.value ?? "0";
  return Number(value.replace(/[^0-9.-]/g, "")) || 0;
}

export function buildFpoAttention(input: {
  completeness: number;
  missingDocuments: string[];
  metrics: MetricCard[];
}): FpoAttentionItem[] {
  const items: FpoAttentionItem[] = [];
  const invited = metricValue(input.metrics, "pendingApprovals");
  const compliance = metricValue(input.metrics, "compliance");

  if (input.completeness < 100) {
    items.push({
      key: "onboarding",
      label: `Complete the organization profile (${input.completeness}% ready)`,
      section: "settings",
      tone: "attention",
    });
  }
  if (input.missingDocuments.length > 0) {
    items.push({
      key: "missing_documents",
      label: `${input.missingDocuments.length} required document(s) are missing`,
      section: "documents",
      tone: "urgent",
    });
  }
  if (compliance > 0) {
    items.push({
      key: "compliance",
      label: `${compliance} compliance action(s) need review`,
      section: "documents",
      tone: "urgent",
    });
  }
  if (invited > 0) {
    items.push({
      key: "member_approvals",
      label: `${invited} farmer membership approval(s) are pending`,
      section: "farmers",
      tone: "attention",
    });
  }

  if (items.length === 0) {
    items.push({
      key: "ready",
      label: "Core organization records are ready — review operational insights",
      section: "insights",
      tone: "ready",
    });
  }
  return items;
}
