import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/atap/AppShell";
import { FlagBadge, StateBadge } from "@/components/atap/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  acceptQuote,
  createMarketProfile,
  createRfq,
  decideDispute,
  decideMarketProfile,
  delistListing,
  getMarketplaceWorkspace,
  publishListing,
  raiseDispute,
  saveListing,
  searchListings,
  submitMarketProfile,
  submitQuote,
  transitionOrder,
  type ListingRow,
} from "@/lib/atap/marketplace.functions";
import type { MarketPartyKind, MarketSide } from "@/lib/atap/marketplace";
import { kindDefaultSide } from "@/lib/atap/marketplace";

export const Route = createFileRoute("/_authenticated/market")({
  head: () => ({
    meta: [
      { title: "Inputs & produce marketplace — AgriGhar ATAP" },
      {
        name: "description",
        content:
          "Neutral commerce onboarding for input and equipment sellers, buyers, traders and processors: catalog listings, RFQ and order shell, and human-reviewed disputes.",
      },
      { property: "og:title", content: "Inputs & produce marketplace — AgriGhar ATAP" },
      {
        property: "og:description",
        content:
          "Seller and buyer onboarding, listing quality gates, RFQ/order workflow and dispute escalation to human review.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MarketPage,
});

const KIND_LABEL: Record<MarketPartyKind, string> = {
  input_supplier: "Input supplier (seed, fertiliser, crop protection)",
  equipment_supplier: "Equipment supplier (sale only)",
  buyer_trader: "Buyer / trader",
  processor: "Processor",
  fpo_aggregator: "FPO aggregator",
};

function MarketPage() {
  const queryClient = useQueryClient();
  const fetchWorkspace = useServerFn(getMarketplaceWorkspace);
  const createProfile = useServerFn(createMarketProfile);
  const submitProfile = useServerFn(submitMarketProfile);
  const decideProfile = useServerFn(decideMarketProfile);
  const saveListingFn = useServerFn(saveListing);
  const publishListingFn = useServerFn(publishListing);
  const delistFn = useServerFn(delistListing);
  const search = useServerFn(searchListings);
  const createRfqFn = useServerFn(createRfq);
  const quoteFn = useServerFn(submitQuote);
  const acceptFn = useServerFn(acceptQuote);
  const transitionFn = useServerFn(transitionOrder);
  const disputeFn = useServerFn(raiseDispute);
  const decideDisputeFn = useServerFn(decideDispute);

  const workspace = useQuery({
    queryKey: ["atap", "marketplace"],
    queryFn: () => fetchWorkspace(),
  });
  const data = workspace.data;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["atap", "marketplace"] });
  const fail = (e: Error) => toast.error(e.message);

  // profile form
  const [partyKind, setPartyKind] = useState<MarketPartyKind>("input_supplier");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [profileCategories, setProfileCategories] = useState<string[]>([]);
  const [regions, setRegions] = useState("TS-WGL");

  // listing form
  const [listingProfileId, setListingProfileId] = useState("");
  const [listing, setListing] = useState({
    category: "seed",
    title: "",
    description: "",
    unit: "kg",
    priceMin: "",
    priceMax: "",
    minOrderQty: "",
    regionCode: "TS-WGL",
    qualityNotes: "",
  });

  // rfq form
  const [rfqProfileId, setRfqProfileId] = useState("");
  const [rfq, setRfq] = useState({
    category: "produce_grain",
    title: "",
    quantity: "",
    unit: "MT",
    deliveryRegion: "TS-WGL",
    notes: "",
    isAggregated: false,
    authorityRef: "",
  });

  // discovery
  const [query, setQuery] = useState({ category: "", region: "", maxPrice: "" });
  const [results, setResults] = useState<ListingRow[] | null>(null);

  // quote / dispute inputs
  const [quoteDraft, setQuoteDraft] = useState({ rfqId: "", sellerProfileId: "", price: "", note: "" });
  const [disputeDraft, setDisputeDraft] = useState({ orderId: "", category: "quality_mismatch", summary: "" });
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});

  const sellerProfiles = useMemo(
    () => (data?.myProfiles ?? []).filter((p) => p.side === "seller"),
    [data],
  );
  const buyerProfiles = useMemo(
    () => (data?.myProfiles ?? []).filter((p) => p.side === "buyer"),
    [data],
  );

  const createProfileMutation = useMutation({
    mutationFn: () =>
      createProfile({
        data: {
          partyKind,
          side: kindDefaultSide(partyKind) as MarketSide,
          displayName,
          contactEmail: email,
          categories: profileCategories,
          regions: regions.split(",").map((r) => r.trim()).filter(Boolean),
        },
      }),
    onSuccess: async () => {
      toast.success("Commerce profile drafted");
      setDisplayName("");
      setEmail("");
      setProfileCategories([]);
      await refresh();
    },
    onError: fail,
  });

  const listingMutation = useMutation({
    mutationFn: () =>
      saveListingFn({
        data: {
          sellerProfileId: listingProfileId || sellerProfiles[0]?.id || "",
          category: listing.category,
          title: listing.title,
          description: listing.description,
          unit: listing.unit,
          priceMin: listing.priceMin ? Number(listing.priceMin) : null,
          priceMax: listing.priceMax ? Number(listing.priceMax) : null,
          minOrderQty: listing.minOrderQty ? Number(listing.minOrderQty) : null,
          regionCode: listing.regionCode || null,
          qualityNotes: listing.qualityNotes,
        },
      }),
    onSuccess: async (res) => {
      toast.success(`Listing saved — quality score ${res.qualityScore}/100`);
      await refresh();
    },
    onError: fail,
  });

  const rfqMutation = useMutation({
    mutationFn: () =>
      createRfqFn({
        data: {
          buyerProfileId: rfqProfileId || buyerProfiles[0]?.id || "",
          category: rfq.category,
          title: rfq.title,
          quantity: Number(rfq.quantity || 0),
          unit: rfq.unit,
          deliveryRegion: rfq.deliveryRegion || null,
          notes: rfq.notes,
          isAggregated: rfq.isAggregated,
          authorityRef: rfq.authorityRef || null,
        },
      }),
    onSuccess: async () => {
      toast.success("RFQ published to sellers");
      setRfq((r) => ({ ...r, title: "", quantity: "", notes: "" }));
      await refresh();
    },
    onError: fail,
  });

  const searchMutation = useMutation({
    mutationFn: () =>
      search({
        data: {
          category: query.category || null,
          region: query.region || null,
          maxPrice: query.maxPrice ? Number(query.maxPrice) : null,
        },
      }),
    onSuccess: (res) => setResults(res.results),
    onError: fail,
  });

  if (workspace.isLoading) {
    return <main className="mx-auto max-w-6xl px-6 py-12 text-sm text-muted-foreground">Loading…</main>;
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12 text-sm text-muted-foreground">
        Marketplace workspace unavailable.
      </main>
    );
  }

  if (!data.flags.baseCommerce) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 px-6 py-12">
        <PageHeader
          eyebrow="B5"
          title="Inputs & produce marketplace"
          description="The base commerce slice is currently deactivated by configuration. No seller or buyer onboarding is accepted while the flag is off."
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-10 px-6 py-10">
      <PageHeader
        eyebrow="B5 — base commerce"
        title="Inputs & produce marketplace"
        description="Neutral commerce onboarding for sellers and buyers. Listing quality, consent and matching rules apply identically on every commercial plan; disputes always reach a human reviewer."
      />

      <section className="grid gap-3 sm:grid-cols-5">
        {[
          ["Published listings", data.summary.publishedListings],
          ["Awaiting review", data.summary.pendingListings],
          ["Open RFQs", data.summary.openRfqs],
          ["Live orders", data.summary.liveOrders],
          ["Disputes in human review", data.summary.disputesInHumanReview],
        ].map(([label, value]) => (
          <div key={String(label)} className="panel p-4">
            <p className="text-2xl font-semibold">{value}</p>
            <p className="field-hint">{label}</p>
          </div>
        ))}
      </section>

      <section className="panel space-y-3 p-5">
        <h2 className="font-display text-sm font-semibold">Activation state</h2>
        <div className="flex flex-wrap gap-4 text-xs">
          <span className="flex items-center gap-2">
            Base commerce <FlagBadge enabled={data.flags.baseCommerce} />
          </span>
          <span className="flex items-center gap-2">
            FPO aggregated RFQ <FlagBadge enabled={data.flags.aggregatedRfq} />
          </span>
          <span className="flex items-center gap-2">
            Sponsored placement (D-15) <FlagBadge enabled={data.flags.sponsoredPlacement} />
          </span>
          <span className="flex items-center gap-2">
            Dispute workflow <FlagBadge enabled={data.flags.disputeWorkflow} />
          </span>
        </div>
        <p className="field-hint">
          Sponsored placement exists as schema only. No sponsored surface is rendered and ranking ignores
          sponsorship until decision D-15 is taken. Equipment rental, warehousing, export, auctions, carbon
          credits and logistics are out of scope for this slice and rejected server-side.
        </p>
      </section>

      {/* ------------------------------------------------- onboarding */}
      <section className="panel space-y-4 p-5">
        <h2 className="font-display text-sm font-semibold">1 · Commerce onboarding</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="field-hint">Party kind</span>
            <select
              className="field-base"
              value={partyKind}
              onChange={(e) => setPartyKind(e.target.value as MarketPartyKind)}
            >
              {Object.entries(KIND_LABEL).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="field-hint">Side (derived from party kind)</span>
            <input className="field-base" value={kindDefaultSide(partyKind)} readOnly />
          </label>
          <label className="space-y-1">
            <span className="field-hint">Legal / trade name</span>
            <input
              className="field-base"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Synthetic Agri Inputs Pvt Ltd"
            />
          </label>
          <label className="space-y-1">
            <span className="field-hint">Contact email</span>
            <input
              className="field-base"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sales@example.com"
            />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="field-hint">Regions (comma separated)</span>
            <input className="field-base" value={regions} onChange={(e) => setRegions(e.target.value)} />
          </label>
        </div>
        <div className="space-y-2">
          <p className="field-hint">Categories</p>
          <div className="flex flex-wrap gap-2">
            {data.categories.map((c) => {
              const active = profileCategories.includes(c.code);
              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() =>
                    setProfileCategories((prev) =>
                      active ? prev.filter((x) => x !== c.code) : [...prev, c.code],
                    )
                  }
                  className={`rounded-full border px-3 py-1 text-xs ${
                    active ? "border-primary bg-primary/10 font-semibold" : "border-border"
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
        <Button
          onClick={() => createProfileMutation.mutate()}
          disabled={createProfileMutation.isPending || !displayName}
        >
          Create draft profile
        </Button>

        <div className="space-y-2 pt-2">
          {data.myProfiles.length === 0 ? (
            <p className="field-hint">No commerce profile yet.</p>
          ) : (
            data.myProfiles.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">
                    {p.display_name} · {p.side}
                  </p>
                  <p className="field-hint">
                    {KIND_LABEL[p.party_kind]} · {p.categories.join(", ") || "no categories"}
                  </p>
                  {p.decision_note ? <p className="field-hint">Reviewer: {p.decision_note}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <StateBadge state={p.state} />
                  {(p.state === "draft" || p.state === "rejected") && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        submitProfile({ data: { profileId: p.id } })
                          .then(() => {
                            toast.success("Submitted for review");
                            return refresh();
                          })
                          .catch(fail)
                      }
                    >
                      Submit for review
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ------------------------------------------------- listings */}
      {sellerProfiles.length > 0 && (
        <section className="panel space-y-4 p-5">
          <h2 className="font-display text-sm font-semibold">2 · Catalog listing</h2>
          <p className="field-hint">
            Publishing requires an approved seller profile and a quality score of at least{" "}
            {data.minPublishScore}/100. No commercial plan changes either requirement.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="field-hint">Seller profile</span>
              <select
                className="field-base"
                value={listingProfileId || sellerProfiles[0]?.id || ""}
                onChange={(e) => setListingProfileId(e.target.value)}
              >
                {sellerProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name} ({p.state})
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="field-hint">Category</span>
              <select
                className="field-base"
                value={listing.category}
                onChange={(e) => setListing({ ...listing, category: e.target.value })}
              >
                {data.categories.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="field-hint">Title</span>
              <input
                className="field-base"
                value={listing.title}
                onChange={(e) => setListing({ ...listing, title: e.target.value })}
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="field-hint">Description (40+ characters for full quality credit)</span>
              <textarea
                className="field-base min-h-20"
                value={listing.description}
                onChange={(e) => setListing({ ...listing, description: e.target.value })}
              />
            </label>
            {(
              [
                ["priceMin", "Price min"],
                ["priceMax", "Price max"],
                ["minOrderQty", "Min order qty"],
                ["unit", "Unit"],
                ["regionCode", "Region code"],
                ["qualityNotes", "Quality / certification notes"],
              ] as const
            ).map(([field, label]) => (
              <label key={field} className="space-y-1">
                <span className="field-hint">{label}</span>
                <input
                  className="field-base"
                  value={listing[field]}
                  onChange={(e) => setListing({ ...listing, [field]: e.target.value })}
                />
              </label>
            ))}
          </div>
          <Button onClick={() => listingMutation.mutate()} disabled={listingMutation.isPending}>
            Save listing draft
          </Button>

          <div className="space-y-2 pt-2">
            {data.myListings.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">{l.title || "(untitled)"}</p>
                  <p className="field-hint">
                    {l.category} · quality {l.quality_score}/100
                    {l.review_note ? ` · ${l.review_note}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StateBadge state={l.status} />
                  {l.status !== "published" ? (
                    <Button
                      size="sm"
                      onClick={() =>
                        publishListingFn({ data: { listingId: l.id } })
                          .then((r) => {
                            toast.success(`Published (quality ${r.score}/100)`);
                            return refresh();
                          })
                          .catch(fail)
                      }
                    >
                      Publish
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        delistFn({ data: { listingId: l.id, note: "withdrawn by seller" } })
                          .then(() => refresh())
                          .catch(fail)
                      }
                    >
                      Delist
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------- discovery */}
      <section className="panel space-y-4 p-5">
        <h2 className="font-display text-sm font-semibold">3 · Search & discovery</h2>
        <p className="field-hint">
          Ranking uses query fit and listing quality only. Seller plan and sponsorship are not ranking
          inputs, so two identical listings always rank identically.
        </p>
        <div className="grid gap-3 sm:grid-cols-4">
          <select
            className="field-base"
            value={query.category}
            onChange={(e) => setQuery({ ...query, category: e.target.value })}
          >
            <option value="">Any category</option>
            {data.categories.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
          <input
            className="field-base"
            placeholder="Region code"
            value={query.region}
            onChange={(e) => setQuery({ ...query, region: e.target.value })}
          />
          <input
            className="field-base"
            placeholder="Max price"
            value={query.maxPrice}
            onChange={(e) => setQuery({ ...query, maxPrice: e.target.value })}
          />
          <Button onClick={() => searchMutation.mutate()} disabled={searchMutation.isPending}>
            Search
          </Button>
        </div>
        <div className="space-y-2">
          {(results ?? data.publishedListings).map((l) => (
            <div key={l.id} className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium">{l.title}</p>
              <p className="field-hint">
                {l.category} · {l.region_code ?? "any region"} ·{" "}
                {l.price_min != null ? `${l.price_min}–${l.price_max ?? l.price_min}/${l.unit}` : "price on request"}{" "}
                · quality {l.quality_score}/100
              </p>
            </div>
          ))}
          {(results ?? data.publishedListings).length === 0 ? (
            <p className="field-hint">No published listings match.</p>
          ) : null}
        </div>
      </section>

      {/* ------------------------------------------------- RFQ */}
      {buyerProfiles.length > 0 && (
        <section className="panel space-y-4 p-5">
          <h2 className="font-display text-sm font-semibold">4 · Sourcing request (RFQ)</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="field-hint">Buyer profile</span>
              <select
                className="field-base"
                value={rfqProfileId || buyerProfiles[0]?.id || ""}
                onChange={(e) => setRfqProfileId(e.target.value)}
              >
                {buyerProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name} ({p.state})
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="field-hint">Category</span>
              <select
                className="field-base"
                value={rfq.category}
                onChange={(e) => setRfq({ ...rfq, category: e.target.value })}
              >
                {data.categories.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="field-hint">Requirement title</span>
              <input
                className="field-base"
                value={rfq.title}
                onChange={(e) => setRfq({ ...rfq, title: e.target.value })}
              />
            </label>
            <label className="space-y-1">
              <span className="field-hint">Quantity</span>
              <input
                className="field-base"
                value={rfq.quantity}
                onChange={(e) => setRfq({ ...rfq, quantity: e.target.value })}
              />
            </label>
            <label className="space-y-1">
              <span className="field-hint">Unit</span>
              <input
                className="field-base"
                value={rfq.unit}
                onChange={(e) => setRfq({ ...rfq, unit: e.target.value })}
              />
            </label>
          </div>
          <label className="flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={rfq.isAggregated}
              onChange={(e) => setRfq({ ...rfq, isAggregated: e.target.checked })}
            />
            <span>
              This is FPO aggregated member demand. Requires an approved delegated purchasing authority rule
              for the tenant and the aggregated-RFQ flag; both are checked server-side and currently{" "}
              {data.flags.aggregatedRfq ? "flag-enabled" : "flag-disabled"}.
            </span>
          </label>
          {rfq.isAggregated && (
            <input
              className="field-base"
              placeholder="Authority reference (board resolution id)"
              value={rfq.authorityRef}
              onChange={(e) => setRfq({ ...rfq, authorityRef: e.target.value })}
            />
          )}
          <Button onClick={() => rfqMutation.mutate()} disabled={rfqMutation.isPending}>
            Publish RFQ
          </Button>
        </section>
      )}

      {/* ------------------------------------------------- open RFQs / quotes */}
      <section className="panel space-y-3 p-5">
        <h2 className="font-display text-sm font-semibold">5 · Open requests & quotes</h2>
        {data.openRfqs.length === 0 ? (
          <p className="field-hint">No open sourcing requests.</p>
        ) : (
          data.openRfqs.map((r) => {
            const quotes = data.quotes.filter((q) => q.rfq_id === r.id);
            const isOwner = r.created_by === data.userId;
            return (
              <div key={r.id} className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{r.title}</p>
                    <p className="field-hint">
                      {r.category} · {r.quantity} {r.unit} · {r.delivery_region ?? "any region"}
                      {r.is_aggregated ? " · aggregated demand" : ""}
                    </p>
                  </div>
                  <StateBadge state={r.status} />
                </div>

                {!isOwner && sellerProfiles.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-3">
                    <input
                      className="field-base"
                      placeholder="Quote price"
                      value={quoteDraft.rfqId === r.id ? quoteDraft.price : ""}
                      onChange={(e) =>
                        setQuoteDraft({
                          rfqId: r.id,
                          sellerProfileId: sellerProfiles[0]?.id ?? "",
                          price: e.target.value,
                          note: quoteDraft.note,
                        })
                      }
                    />
                    <input
                      className="field-base"
                      placeholder="Note"
                      value={quoteDraft.rfqId === r.id ? quoteDraft.note : ""}
                      onChange={(e) => setQuoteDraft({ ...quoteDraft, rfqId: r.id, note: e.target.value })}
                    />
                    <Button
                      size="sm"
                      onClick={() =>
                        quoteFn({
                          data: {
                            rfqId: r.id,
                            sellerProfileId: sellerProfiles[0]?.id ?? "",
                            price: Number(quoteDraft.price || 0),
                            note: quoteDraft.note,
                          },
                        })
                          .then(() => {
                            toast.success("Quote submitted");
                            setQuoteDraft({ rfqId: "", sellerProfileId: "", price: "", note: "" });
                            return refresh();
                          })
                          .catch(fail)
                      }
                    >
                      Submit quote
                    </Button>
                  </div>
                )}

                {quotes.map((q) => (
                  <div key={q.id} className="flex items-center justify-between gap-2 rounded border border-border/70 p-2">
                    <p className="field-hint">
                      {q.price}/{q.unit} · {q.note || "no note"} · {q.status}
                    </p>
                    {isOwner && q.status === "submitted" ? (
                      <Button
                        size="sm"
                        onClick={() =>
                          acceptFn({ data: { quoteId: q.id } })
                            .then(() => {
                              toast.success("Order created from quote");
                              return refresh();
                            })
                            .catch(fail)
                        }
                      >
                        Accept & create order
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            );
          })
        )}
      </section>

      {/* ------------------------------------------------- orders + disputes */}
      <section className="panel space-y-3 p-5">
        <h2 className="font-display text-sm font-semibold">6 · Orders & disputes</h2>
        {data.orders.length === 0 ? (
          <p className="field-hint">No orders yet.</p>
        ) : (
          data.orders.map((o) => {
            const isSeller = o.seller_user_id === data.userId;
            const dispute = data.disputes.find((d) => d.order_id === o.id);
            return (
              <div key={o.id} className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {o.quantity} {o.unit} @ {o.agreed_price ?? "—"} · {isSeller ? "you sell" : "you buy"}
                  </p>
                  <StateBadge state={o.status} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {isSeller && o.status === "created" && (
                    <Button
                      size="sm"
                      onClick={() =>
                        transitionFn({ data: { orderId: o.id, next: "accepted", note: "accepted" } })
                          .then(() => refresh())
                          .catch(fail)
                      }
                    >
                      Accept order
                    </Button>
                  )}
                  {isSeller && o.status === "accepted" && (
                    <Button
                      size="sm"
                      onClick={() =>
                        transitionFn({ data: { orderId: o.id, next: "fulfilled", note: "dispatched" } })
                          .then(() => refresh())
                          .catch(fail)
                      }
                    >
                      Mark fulfilled
                    </Button>
                  )}
                  {!isSeller && (o.status === "fulfilled" || o.status === "accepted") && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        transitionFn({ data: { orderId: o.id, next: "closed", note: "closed by buyer" } })
                          .then(() => refresh())
                          .catch(fail)
                      }
                    >
                      Close order
                    </Button>
                  )}
                </div>

                {dispute ? (
                  <p className="field-hint">
                    Dispute {dispute.category} · <StateBadge state={dispute.status} />{" "}
                    {dispute.resolution_note ?? "awaiting human reviewer"}
                  </p>
                ) : data.flags.disputeWorkflow ? (
                  <div className="grid gap-2 sm:grid-cols-3">
                    <input
                      className="field-base"
                      placeholder="Dispute category"
                      value={disputeDraft.orderId === o.id ? disputeDraft.category : "quality_mismatch"}
                      onChange={(e) =>
                        setDisputeDraft({ ...disputeDraft, orderId: o.id, category: e.target.value })
                      }
                    />
                    <input
                      className="field-base"
                      placeholder="What went wrong (20+ chars)"
                      value={disputeDraft.orderId === o.id ? disputeDraft.summary : ""}
                      onChange={(e) =>
                        setDisputeDraft({ ...disputeDraft, orderId: o.id, summary: e.target.value })
                      }
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        disputeFn({
                          data: {
                            orderId: o.id,
                            category: disputeDraft.category || "quality_mismatch",
                            summary: disputeDraft.summary,
                          },
                        })
                          .then(() => {
                            toast.success("Dispute routed to human review");
                            setDisputeDraft({ orderId: "", category: "quality_mismatch", summary: "" });
                            return refresh();
                          })
                          .catch(fail)
                      }
                    >
                      Raise dispute
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </section>

      {/* ------------------------------------------------- operator queues */}
      {data.canReview && (
        <section className="panel space-y-5 p-5">
          <h2 className="font-display text-sm font-semibold">Market operator review</h2>

          <div className="space-y-2">
            <p className="field-hint">Commerce profiles awaiting decision</p>
            {data.reviewProfiles.length === 0 ? (
              <p className="field-hint">Queue empty.</p>
            ) : (
              data.reviewProfiles.map((p) => (
                <div key={p.id} className="space-y-2 rounded-lg border border-border p-3">
                  <p className="text-sm font-medium">
                    {p.display_name} · {KIND_LABEL[p.party_kind]}
                  </p>
                  <p className="field-hint">
                    {p.categories.join(", ")} · {p.regions.join(", ")} · {p.contact_email}
                  </p>
                  <textarea
                    className="field-base min-h-16"
                    placeholder="Decision note (required, 10+ chars)"
                    value={decisionNotes[p.id] ?? ""}
                    onChange={(e) => setDecisionNotes({ ...decisionNotes, [p.id]: e.target.value })}
                  />
                  <div className="flex gap-2">
                    {(["approved", "rejected"] as const).map((decision) => (
                      <Button
                        key={decision}
                        size="sm"
                        variant={decision === "approved" ? "default" : "secondary"}
                        onClick={() =>
                          decideProfile({
                            data: { profileId: p.id, decision, note: decisionNotes[p.id] ?? "" },
                          })
                            .then(() => {
                              toast.success(`Profile ${decision}`);
                              return refresh();
                            })
                            .catch(fail)
                        }
                      >
                        {decision === "approved" ? "Approve" : "Reject"}
                      </Button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-2">
            <p className="field-hint">Disputes in human review</p>
            {data.reviewDisputes.length === 0 ? (
              <p className="field-hint">Queue empty.</p>
            ) : (
              data.reviewDisputes.map((d) => (
                <div key={d.id} className="space-y-2 rounded-lg border border-border p-3">
                  <p className="text-sm font-medium">{d.category}</p>
                  <p className="field-hint">{d.summary}</p>
                  <textarea
                    className="field-base min-h-16"
                    placeholder="Resolution note (required, 10+ chars)"
                    value={decisionNotes[d.id] ?? ""}
                    onChange={(e) => setDecisionNotes({ ...decisionNotes, [d.id]: e.target.value })}
                  />
                  <div className="flex gap-2">
                    {(["resolved", "rejected"] as const).map((next) => (
                      <Button
                        key={next}
                        size="sm"
                        variant={next === "resolved" ? "default" : "secondary"}
                        onClick={() =>
                          decideDisputeFn({
                            data: { disputeId: d.id, next, resolutionNote: decisionNotes[d.id] ?? "" },
                          })
                            .then(() => {
                              toast.success(`Dispute ${next} by human reviewer`);
                              return refresh();
                            })
                            .catch(fail)
                        }
                      >
                        {next === "resolved" ? "Resolve" : "Reject"}
                      </Button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}
    </main>
  );
}
