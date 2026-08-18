import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge, StepStatusBadge } from "@/components/atap/StatusBadge";
import { cn } from "@/lib/utils";
import {
  incompleteRequiredSteps,
  stepStatus,
  validateStepValues,
  type FieldDef,
  type FormValue,
  type FormValues,
  type OnboardingStatus,
  type StepDef,
} from "@/lib/atap/onboarding";

export interface GeographyOption {
  code: string;
  name: string;
  level: string;
}

export interface StepperProps {
  steps: StepDef[];
  status: OnboardingStatus;
  initialValues: FormValues;
  initialStepKey?: string | null;
  geographies: GeographyOption[];
  /** Autosave transport. Debounced by the shell; must be idempotent. */
  onSaveStep: (stepKey: string, values: FormValues) => Promise<void>;
  onSubmit: () => Promise<void>;
  submitting?: boolean;
}

type SaveState = "idle" | "saving" | "saved" | "error";

function Field({
  field,
  value,
  error,
  disabled,
  geographies,
  onChange,
}: {
  field: FieldDef;
  value: FormValue | undefined;
  error?: string;
  disabled: boolean;
  geographies: GeographyOption[];
  onChange: (value: FormValue) => void;
}) {
  const id = `field-${field.name}`;
  const invalid = Boolean(error);
  const common = {
    id,
    name: field.name,
    disabled,
    "aria-invalid": invalid,
    "aria-describedby": invalid ? `${id}-error` : undefined,
    className: "field-base",
  } as const;

  const options =
    field.type === "geography"
      ? geographies.filter((g) => !field.level || g.level === field.level).map((g) => g.code)
      : (field.options ?? []);

  const geoLabel = (code: string) => geographies.find((g) => g.code === code)?.name ?? code;

  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {field.label}
        {field.required ? <span className="ml-1 text-field-invalid">*</span> : null}
      </label>
      <div className="mt-1.5">
        {field.type === "textarea" ? (
          <textarea {...common} rows={3} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
        ) : field.type === "select" || field.type === "geography" ? (
          <select {...common} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
            <option value="">Select…</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {field.type === "geography" ? geoLabel(opt) : opt}
              </option>
            ))}
          </select>
        ) : field.type === "multiselect" ? (
          <div className="flex flex-wrap gap-2">
            {(field.options ?? []).map((opt) => {
              const list = Array.isArray(value) ? value : [];
              const checked = list.includes(opt);
              return (
                <label
                  key={opt}
                  className={cn(
                    "cursor-pointer rounded-full border border-border px-3 py-1 text-xs font-medium transition-colors",
                    checked ? "bg-primary text-primary-foreground" : "bg-card hover:bg-secondary",
                    disabled && "cursor-not-allowed opacity-60",
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    disabled={disabled}
                    onChange={() =>
                      onChange(checked ? list.filter((v) => v !== opt) : [...list, opt])
                    }
                  />
                  {opt}
                </label>
              );
            })}
          </div>
        ) : (
          <input
            {...common}
            type={field.type === "number" ? "number" : field.type === "tel" ? "tel" : "text"}
            value={value === null || value === undefined ? "" : String(value)}
            onChange={(e) =>
              onChange(
                field.type === "number"
                  ? e.target.value === ""
                    ? null
                    : Number(e.target.value)
                  : e.target.value,
              )
            }
          />
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Reusable onboarding shell: configuration-driven steps, per-field validation,
 * debounced autosave and visible status states. No journey logic is hardcoded.
 */
export function OnboardingStepper({
  steps,
  status,
  initialValues,
  initialStepKey,
  geographies,
  onSaveStep,
  onSubmit,
  submitting,
}: StepperProps) {
  const readOnly = status !== "draft";
  const startIndex = Math.max(
    0,
    steps.findIndex((s) => s.step_key === initialStepKey),
  );
  const [index, setIndex] = useState(startIndex);
  const [values, setValues] = useState<FormValues>(initialValues);
  const [showErrors, setShowErrors] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const step = steps[Math.min(index, steps.length - 1)];
  const errors = useMemo(() => (step ? validateStepValues(step, values) : {}), [step, values]);
  const missing = useMemo(() => incompleteRequiredSteps(steps, values), [steps, values]);

  const flush = useCallback(
    async (stepKey: string, next: FormValues) => {
      setSaveState("saving");
      try {
        await onSaveStep(stepKey, next);
        setSaveState("saved");
        setSavedAt(new Date().toLocaleTimeString());
      } catch {
        setSaveState("error");
      }
    },
    [onSaveStep],
  );

  useEffect(() => () => (timer.current ? clearTimeout(timer.current) : undefined), []);

  function update(name: string, value: FormValue) {
    if (readOnly || !step) return;
    const next = { ...values, [name]: value };
    setValues(next);
    if (timer.current) clearTimeout(timer.current);
    const stepKey = step.step_key;
    timer.current = setTimeout(() => void flush(stepKey, next), 800);
  }

  async function goTo(nextIndex: number) {
    if (!step) return;
    if (nextIndex > index && Object.keys(errors).length > 0) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    if (!readOnly) {
      if (timer.current) clearTimeout(timer.current);
      await flush(step.step_key, values);
    }
    setIndex(Math.max(0, Math.min(steps.length - 1, nextIndex)));
  }

  if (!step) {
    return <p className="text-sm text-muted-foreground">No steps are configured for this role yet.</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="panel h-fit p-3">
        <div className="flex items-center justify-between px-1 pb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Steps
          </span>
          <StatusBadge status={status} />
        </div>
        <ol className="space-y-1">
          {steps.map((s, i) => (
            <li key={s.step_key}>
              <button
                type="button"
                onClick={() => void goTo(i)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                  i === index ? "bg-secondary text-secondary-foreground" : "hover:bg-secondary/60",
                )}
                aria-current={i === index ? "step" : undefined}
              >
                <span className="truncate">
                  {i + 1}. {s.label}
                </span>
                <StepStatusBadge status={stepStatus(s, values)} />
              </button>
            </li>
          ))}
        </ol>
      </aside>

      <section className="panel p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{step.label}</h2>
            {step.help_text ? <p className="field-hint">{step.help_text}</p> : null}
          </div>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {readOnly
              ? "Read only — this application is no longer a draft."
              : saveState === "saving"
                ? "Saving…"
                : saveState === "error"
                  ? "Autosave failed — retry by editing again."
                  : savedAt
                    ? `Draft saved at ${savedAt}`
                    : "Changes save automatically."}
          </p>
        </div>

        {step.evidence_required.length > 0 ? (
          <div className="mt-4 rounded-md border border-border bg-secondary/50 p-3 text-xs">
            <span className="font-semibold">Evidence required later: </span>
            {step.evidence_required
              .map((e) => `${e.label}${e.optional_in_sandbox ? " (optional in sandbox)" : ""}`)
              .join(", ")}
            . Upload is not part of this baseline slice.
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {step.fields.map((field) => (
            <div key={field.name} className={field.type === "textarea" || field.type === "multiselect" ? "sm:col-span-2" : ""}>
              <Field
                field={field}
                value={values[field.name]}
                error={showErrors ? errors[field.name] : undefined}
                disabled={readOnly}
                geographies={geographies}
                onChange={(v) => update(field.name, v)}
              />
            </div>
          ))}
          {step.fields.length === 0 ? (
            <div className="sm:col-span-2 rounded-md border border-border p-4 text-sm text-muted-foreground">
              {missing.length === 0
                ? "All required steps are complete. Submitting moves this application to Pending for a human reviewer."
                : `Still incomplete: ${missing.join(", ")}.`}
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={() => void goTo(index - 1)} disabled={index === 0}>
            Back
          </Button>
          {index < steps.length - 1 ? (
            <Button onClick={() => void goTo(index + 1)}>Save and continue</Button>
          ) : (
            <Button
              onClick={() => void onSubmit()}
              disabled={readOnly || missing.length > 0 || Boolean(submitting)}
            >
              {submitting ? "Submitting…" : "Submit for review"}
            </Button>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            Step {index + 1} of {steps.length}
          </span>
        </div>
      </section>
    </div>
  );
}
