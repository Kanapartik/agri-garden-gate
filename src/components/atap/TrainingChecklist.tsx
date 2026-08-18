import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { TRAINING_CHECKLISTS, type TrainingProgress } from "@/lib/atap/district";
import { setTrainingItem } from "@/lib/atap/district.functions";

/**
 * Role readiness checklist. Progress is stored per learner; an FPO/government
 * admin can see their own staff's readiness, nobody else's.
 */
export function TrainingChecklistPanel({
  progress,
  invalidateKey,
  completedKeys,
}: {
  progress: TrainingProgress[];
  invalidateKey: string;
  completedKeys?: Record<string, string[]>;
}) {
  const queryClient = useQueryClient();
  const setItem = useServerFn(setTrainingItem);

  const mutate = useMutation({
    mutationFn: (input: { checklistCode: string; itemKey: string; done: boolean }) =>
      setItem({ data: input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["atap", invalidateKey] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (progress.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No training checklist applies to your current roles.
      </p>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {progress.map((p) => {
        const checklist = TRAINING_CHECKLISTS.find((c) => c.code === p.code);
        const done = new Set(completedKeys?.[p.code] ?? []);
        return (
          <section key={p.code} className="panel p-4">
            <header className="mb-3 flex items-baseline justify-between gap-3">
              <h3 className="font-display text-sm font-semibold">{p.label}</h3>
              <span className="text-xs text-muted-foreground">
                {p.completed}/{p.total} {p.ready ? "· ready" : "· in progress"}
              </span>
            </header>
            <ul className="space-y-2 text-sm">
              {checklist?.items.map((item) => {
                const checked = done.has(item.key) || p.completed === p.total;
                return (
                  <li key={item.key} className="flex items-start gap-2">
                    <input
                      id={`${p.code}-${item.key}`}
                      type="checkbox"
                      className="mt-1 size-4 accent-primary"
                      checked={checked}
                      onChange={(e) =>
                        mutate.mutate({
                          checklistCode: p.code,
                          itemKey: item.key,
                          done: e.target.checked,
                        })
                      }
                    />
                    <label htmlFor={`${p.code}-${item.key}`} className="leading-snug">
                      {item.label}
                      {item.required ? (
                        <span className="ml-1 text-xs text-muted-foreground">(required)</span>
                      ) : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
