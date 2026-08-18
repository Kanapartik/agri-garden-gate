import { STATUS_LABEL, type OnboardingStatus, type StepStatus } from "@/lib/atap/onboarding";
import { cn } from "@/lib/utils";

const STATUS_CLASS: Record<OnboardingStatus, string> = {
  draft: "bg-status-draft text-status-draft-foreground",
  pending: "bg-status-pending text-status-pending-foreground",
  activated: "bg-status-activated text-status-activated-foreground",
  rejected: "bg-status-rejected text-status-rejected-foreground",
  withdrawn: "bg-status-neutral text-status-neutral-foreground",
};

const STEP_CLASS: Record<StepStatus, string> = {
  not_started: "bg-status-draft text-status-draft-foreground",
  in_progress: "bg-status-pending text-status-pending-foreground",
  complete: "bg-status-activated text-status-activated-foreground",
};

const STEP_LABEL: Record<StepStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  complete: "Complete",
};

const base =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide";

export function StatusBadge({
  status,
  className,
}: {
  status: OnboardingStatus;
  className?: string;
}) {
  return (
    <span className={cn(base, STATUS_CLASS[status], className)}>{STATUS_LABEL[status]}</span>
  );
}

export function StepStatusBadge({
  status,
  className,
}: {
  status: StepStatus;
  className?: string;
}) {
  return <span className={cn(base, STEP_CLASS[status], className)}>{STEP_LABEL[status]}</span>;
}

export function FlagBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={cn(
        base,
        enabled
          ? "bg-status-activated text-status-activated-foreground"
          : "bg-status-neutral text-status-neutral-foreground",
      )}
    >
      {enabled ? "On" : "Off"}
    </span>
  );
}
