import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StateBadge } from "@/components/atap/StatusBadge";
import {
  getSchemeIntelligence,
  reassessSchemeEligibility,
  setSchemeEligibilityBucket,
} from "@/lib/atap/fpoOpportunities.functions";
import {
  ELIGIBILITY_BUCKET_LABEL,
  ELIGIBILITY_BUCKETS,
  FPO_SETTABLE_BUCKETS,
  isDecisionBucket,
  type EligibilityBucket,
} from "@/lib/atap/fpoOpportunities";

export function FpoSchemesSection({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const intelFn = useServerFn(getSchemeIntelligence);
  const reassessFn = useServerFn(reassessSchemeEligibility);
  const setBucketFn = useServerFn(setSchemeEligibilityBucket);

  const intel = useQuery({
    queryKey: ["fpo-scheme-intelligence", tenantId],
    queryFn: () => intelFn({ data: { tenantId } }),
    enabled: Boolean(tenantId),
  });

  const [bucket, setBucket] = useState<EligibilityBucket | "">("");
  const [search, setSearch] = useState("");

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["fpo-scheme-intelligence", tenantId] });
  };

  const reassess = useMutation({
    mutationFn: (schemeId: string) => reassessFn({ data: { tenantId, schemeId } }),
    onSuccess: async () => {
      toast.success("Advisory assessment refreshed from the FPO profile");
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: (input: { schemeId: string; bucket: EligibilityBucket }) =>
      setBucketFn({ data: { tenantId, ...input } }),
    onSuccess: async () => {
      toast.success("Scheme status updated");
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cards = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (intel.data?.cards ?? []).filter((c) => {
      if (bucket && c.bucket !== bucket) return false;
      if (term && !`${c.title} ${c.code} ${c.summary}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [intel.data, bucket, search]);

  if (!tenantId) {
    return (
      <section className="panel p-5 text-sm text-muted-foreground">
        Select an FPO organization to see scheme eligibility.
      </section>
    );
  }
  if (intel.isLoading) {
    return <section className="panel p-5 text-sm">Loading scheme intelligence…</section>;
  }
  if (intel.isError) {
    return (
      <section className="panel p-5 text-sm text-muted-foreground">
        {(intel.error as Error).message}
      </section>
    );
  }

  const data = intel.data!;

  return (
    <div className="space-y-6">
      <section className="panel space-y-3 p-5">
        <h2 className="font-display text-base font-semibold">FPO scheme intelligence</h2>
        <p className="field-hint">{data.advisory}</p>
        <div className="flex flex-wrap gap-2 text-sm">
          {ELIGIBILITY_BUCKETS.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBucket(bucket === b ? "" : b)}
              className={`rounded-md border px-3 py-1 ${bucket === b ? "border-primary" : "border-border"}`}
            >
              {ELIGIBILITY_BUCKET_LABEL[b]} · {data.counts[b]}
            </button>
          ))}
        </div>
        <input
          className="field-base"
          placeholder="Search schemes"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </section>

      <div className="space-y-4">
        {cards.map((c) => (
          <article key={c.id} className="panel space-y-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-semibold">{c.title}</h3>
                <p className="text-sm text-muted-foreground">{c.code}</p>
              </div>
              <StateBadge state={c.bucket} />
            </div>
            <p className="text-sm">{c.summary}</p>

            <div className="text-sm">
              <p className="field-hint">Why this FPO may be eligible</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {c.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>

            {c.missing.length ? (
              <div className="text-sm">
                <p className="field-hint">Information still needed</p>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {c.missing.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <p className="field-hint">
              {c.sourceName ? `Source: ${c.sourceName}` : "Source: derived from FPO profile"}
              {c.assessedAt ? ` · last updated ${c.assessedAt.slice(0, 10)}` : " · not yet saved"}
            </p>

            {isDecisionBucket(c.bucket) ? (
              <p className="text-sm text-muted-foreground">
                This outcome was recorded by the authorized reviewer and cannot be edited here.
              </p>
            ) : null}

            {data.canManage ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={reassess.isPending}
                  onClick={() => reassess.mutate(c.id)}
                >
                  Re-check against profile
                </Button>
                {FPO_SETTABLE_BUCKETS.filter((b) => b !== c.bucket).map((b) => (
                  <Button
                    key={b}
                    size="sm"
                    variant="outline"
                    disabled={update.isPending || isDecisionBucket(c.bucket)}
                    onClick={() => update.mutate({ schemeId: c.id, bucket: b })}
                  >
                    Mark {ELIGIBILITY_BUCKET_LABEL[b]}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="field-hint">
                Only an FPO admin or scheme reviewer can update scheme status.
              </p>
            )}
          </article>
        ))}
      </div>

      {cards.length === 0 ? (
        <section className="panel p-5 text-sm text-muted-foreground">
          No published schemes match these filters.
        </section>
      ) : null}
    </div>
  );
}
