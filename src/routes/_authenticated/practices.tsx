import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/atap/AppShell";
import { useLanguage } from "@/components/atap/LanguageProvider";
import { getPracticeWorkspace, setLessonProgress } from "@/lib/atap/practice.functions";

export const Route = createFileRoute("/_authenticated/practices")({
  head: () => ({
    meta: [
      { title: "Farmer training modules — AgriGhar ATAP" },
      {
        name: "description",
        content:
          "Sowing, crop protection, harvest, preservation and value creation practice guidance for farmers, available in five languages.",
      },
      { property: "og:title", content: "Farmer training modules — AgriGhar ATAP" },
      {
        property: "og:description",
        content: "Stage-by-stage farming practice training with do and do-not notes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PracticesPage,
});

function PracticesPage() {
  const { locale, t } = useLanguage();
  const queryClient = useQueryClient();
  const fetchWorkspace = useServerFn(getPracticeWorkspace);
  const setProgress = useServerFn(setLessonProgress);
  const [openModule, setOpenModule] = useState<string | null>(null);

  const workspace = useQuery({
    queryKey: ["atap", "practice-workspace", locale],
    queryFn: () => fetchWorkspace({ data: { locale } }),
  });

  const mutate = useMutation({
    mutationFn: (input: { moduleId: string; lessonKey: string; done: boolean }) =>
      setProgress({ data: input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["atap", "practice-workspace"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const modules = workspace.data?.modules ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <PageHeader
        eyebrow="B2B · Farmer practice library"
        title={t("practices.title")}
        description={t("practices.description")}
      />

      {workspace.isLoading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
      {!workspace.isLoading && modules.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("practices.empty")}</p>
      )}

      <div className="space-y-4">
        {modules.map((m) => {
          const open = openModule === m.id;
          return (
            <section key={m.id} className="rounded-xl border border-border bg-card">
              <button
                type="button"
                className="flex w-full flex-wrap items-center justify-between gap-3 p-5 text-left"
                onClick={() => setOpenModule(open ? null : m.id)}
                aria-expanded={open}
              >
                <span>
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-foreground">
                    {m.stageLabel}
                  </span>
                  <h2 className="font-display text-lg font-semibold">{m.title}</h2>
                  <span className="mt-1 block max-w-2xl text-sm text-muted-foreground">{m.summary}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {m.completed}/{m.total} {t("practices.progress")} ·{" "}
                  {m.complete ? t("practices.ready") : t("practices.inProgress")}
                </span>
              </button>

              {open && (
                <div className="space-y-4 border-t border-border p-5">
                  {m.lessons.map((lesson) => {
                    const done = m.completedKeys.includes(lesson.lessonKey);
                    return (
                      <article key={lesson.id} className="rounded-lg border border-border p-4">
                        <label className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-1 size-4 accent-primary"
                            checked={done}
                            onChange={(e) =>
                              mutate.mutate({
                                moduleId: m.id,
                                lessonKey: lesson.lessonKey,
                                done: e.target.checked,
                              })
                            }
                          />
                          <span className="font-medium">{lesson.title}</span>
                        </label>
                        <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                          {lesson.body}
                        </p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {lesson.doNotes.length > 0 && (
                            <div>
                              <h3 className="text-xs font-semibold uppercase tracking-wide text-primary">
                                {t("practices.do")}
                              </h3>
                              <ul className="mt-1 list-disc space-y-1 pl-4 text-sm">
                                {lesson.doNotes.map((n) => (
                                  <li key={n}>{n}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {lesson.dontNotes.length > 0 && (
                            <div>
                              <h3 className="text-xs font-semibold uppercase tracking-wide text-destructive">
                                {t("practices.dont")}
                              </h3>
                              <ul className="mt-1 list-disc space-y-1 pl-4 text-sm">
                                {lesson.dontNotes.map((n) => (
                                  <li key={n}>{n}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                  {m.sourceAttribution && (
                    <p className="text-xs text-muted-foreground">
                      {t("practices.source")}: {m.sourceAttribution} · {t("common.synthetic")}
                    </p>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
