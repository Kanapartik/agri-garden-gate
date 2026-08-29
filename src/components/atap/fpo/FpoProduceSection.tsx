import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StateBadge } from "@/components/atap/StatusBadge";
import {
  createProduceLot,
  getProduceBoard,
  getProduceLotDetail,
  publishLotToMarketplace,
  recordBuyerEnquiry,
  recordProduceContribution,
  setEnquiryStatus,
  setProduceLotStatus,
  updateProduceContribution,
} from "@/lib/atap/fpoProduce.functions";
import {
  BUYER_TYPES,
  ENQUIRY_STATUS_LABEL,
  LOGISTICS_KIND_LABEL,
  nextEnquiryStatuses,
  nextLotStatuses,
  PRODUCE_LOT_STATUS_LABEL,
  type EnquiryStatus,
  type ProduceLotStatus,
} from "@/lib/atap/fpoProduce";

const input =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";
const card = "rounded-lg border border-border bg-card p-4";

export function FpoProduceSection({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const boardFn = useServerFn(getProduceBoard);
  const detailFn = useServerFn(getProduceLotDetail);
  const createFn = useServerFn(createProduceLot);
  const statusFn = useServerFn(setProduceLotStatus);
  const contribFn = useServerFn(recordProduceContribution);
  const contribUpdateFn = useServerFn(updateProduceContribution);
  const enquiryFn = useServerFn(recordBuyerEnquiry);
  const enquiryStatusFn = useServerFn(setEnquiryStatus);
  const publishFn = useServerFn(publishLotToMarketplace);

  const [openId, setOpenId] = useState<string | null>(null);
  const [commodity, setCommodity] = useState("");
  const [variety, setVariety] = useState("");
  const [season, setSeason] = useState("");
  const [expected, setExpected] = useState("");
  const [reserve, setReserve] = useState("");
  const [memberId, setMemberId] = useState("");
  const [memberQty, setMemberQty] = useState("");
  const [buyer, setBuyer] = useState("");
  const [buyerType, setBuyerType] = useState<string>("buyer");
  const [offerPrice, setOfferPrice] = useState("");
  const [offerQty, setOfferQty] = useState("");
  const [payTerms, setPayTerms] = useState("");
  const [delTerms, setDelTerms] = useState("");

  const board = useQuery({
    queryKey: ["fpo-produce-board", tenantId],
    queryFn: () => boardFn({ data: { tenantId } }),
    enabled: Boolean(tenantId),
  });

  const detail = useQuery({
    queryKey: ["fpo-produce-detail", tenantId, openId],
    queryFn: () => detailFn({ data: { tenantId, lotId: openId ?? "" } }),
    enabled: Boolean(tenantId && openId),
  });

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["fpo-produce-board", tenantId] });
    await qc.invalidateQueries({ queryKey: ["fpo-produce-detail", tenantId] });
  };

  const useAction = <T,>(fn: (i: T) => Promise<unknown>, message: string) =>
    useMutation({
      mutationFn: fn,
      onSuccess: async () => {
        toast.success(message);
        await invalidate();
      },
      onError: (e: Error) => toast.error(e.message),
    });

  const create = useAction(
    () =>
      createFn({
        data: {
          tenantId,
          commodity,
          variety: variety || null,
          season: season || null,
          expectedQuantity: expected ? Number(expected) : 0,
          reservePrice: reserve ? Number(reserve) : null,
        },
      }),
    "Produce lot created as planned",
  );
  const move = useAction(
    (i: { lotId: string; status: ProduceLotStatus }) => statusFn({ data: { tenantId, ...i } }),
    "Lot stage updated",
  );
  const addContribution = useAction(
    () =>
      contribFn({
        data: {
          tenantId,
          lotId: openId ?? "",
          memberId: memberId || null,
          expectedQuantity: Number(memberQty),
        },
      }),
    "Member produce declaration recorded",
  );
  const confirmContribution = useAction(
    (i: { contributionId: string; confirmedQuantity?: number; deliveredQuantity?: number }) =>
      contribUpdateFn({ data: { tenantId, lotId: openId ?? "", ...i } }),
    "Member quantities updated",
  );
  const addEnquiry = useAction(
    () =>
      enquiryFn({
        data: {
          tenantId,
          lotId: openId ?? "",
          buyerName: buyer,
          buyerType,
          offeredPrice: offerPrice ? Number(offerPrice) : null,
          quantity: offerQty ? Number(offerQty) : null,
          paymentTerms: payTerms || null,
          deliveryTerms: delTerms || null,
        },
      }),
    "Buyer enquiry recorded",
  );
  const respond = useAction(
    (i: { enquiryId: string; status: EnquiryStatus }) =>
      enquiryStatusFn({ data: { tenantId, ...i } }),
    "Buyer enquiry updated",
  );

  if (!tenantId) {
    return <p className="text-sm text-muted-foreground">Select an FPO organization first.</p>;
  }
  if (board.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading produce and market linkage…</p>;
  }
  if (board.error) {
    return <p className="text-sm text-destructive">{(board.error as Error).message}</p>;
  }

  const data = board.data!;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{data.disclaimer}</p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Produce lots" value={String(data.lots.length)} />
        <Metric
          label="Aggregated quantity"
          value={`${data.lots.reduce((s, l) => s + l.aggregated_quantity, 0)} ${data.lots[0]?.unit ?? "quintal"}`}
        />
        <Metric label="Open buyer enquiries" value={String(data.openEnquiries)} />
        <Metric label="Commodities" value={String(data.windows.length)} />
      </div>

      <section className={card}>
        <h3 className="text-sm font-semibold">Mandi price observations</h3>
        {data.prices.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No price observations recorded yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.prices.map((p) => (
              <li
                key={`${p.commodity}-${p.basis}`}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2 text-sm last:border-0"
              >
                <span className="font-medium">
                  {p.commodity}{" "}
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
                    {p.basis_label}
                  </span>
                </span>
                <span>
                  ₹{p.latest_price}/{p.unit} · {p.market_name} · {p.observed_on}
                </span>
                <span className="w-full text-xs text-muted-foreground">{p.basis_note}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <h3 className="text-sm font-semibold">Harvest windows by commodity</h3>
        {data.windows.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No lots planned yet.</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm">
            {data.windows.map((w) => (
              <li key={w.commodity} className="flex flex-wrap justify-between gap-2">
                <span className="font-medium">{w.commodity}</span>
                <span className="text-muted-foreground">
                  {w.aggregated}/{w.expected} {w.unit} aggregated · {w.lots} lot(s) ·{" "}
                  {w.window_start ?? "window TBD"} → {w.window_end ?? "TBD"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.canManage ? (
        <section className={card}>
          <h3 className="text-sm font-semibold">Create a produce lot</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <input
              className={input}
              placeholder="Commodity"
              value={commodity}
              onChange={(e) => setCommodity(e.target.value)}
            />
            <input
              className={input}
              placeholder="Variety"
              value={variety}
              onChange={(e) => setVariety(e.target.value)}
            />
            <input
              className={input}
              placeholder="Season"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
            />
            <input
              className={input}
              placeholder="Expected quantity"
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
            />
            <input
              className={input}
              placeholder="Reserve price / unit"
              value={reserve}
              onChange={(e) => setReserve(e.target.value)}
            />
          </div>
          <Button
            className="mt-3"
            size="sm"
            disabled={!commodity || create.isPending}
            onClick={() => create.mutate(undefined as never)}
          >
            Create lot
          </Button>
        </section>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Produce lots</h3>
        {data.lots.length === 0 ? (
          <p className="text-sm text-muted-foreground">No produce lots yet.</p>
        ) : null}
        {data.lots.map((lot) => (
          <div key={lot.id} className={card}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">
                  {lot.commodity}
                  {lot.variety ? ` · ${lot.variety}` : ""}
                  {lot.lot_code ? ` · ${lot.lot_code}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {lot.aggregated_quantity}/{lot.expected_quantity} {lot.unit} aggregated
                  {lot.reserve_price_per_unit
                    ? ` · reserve ₹${lot.reserve_price_per_unit}/${lot.unit}`
                    : " · no reserve price set"}
                  {lot.season ? ` · ${lot.season}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StateBadge state={PRODUCE_LOT_STATUS_LABEL[lot.status]} />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setOpenId(openId === lot.id ? null : lot.id)}
                >
                  {openId === lot.id ? "Close" : "Open"}
                </Button>
              </div>
            </div>

            {data.canManage && nextLotStatuses(lot.status).length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {nextLotStatuses(lot.status).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant="secondary"
                    disabled={move.isPending}
                    onClick={() => move.mutate({ lotId: lot.id, status: s })}
                  >
                    {PRODUCE_LOT_STATUS_LABEL[s]}
                  </Button>
                ))}
              </div>
            ) : null}

            {openId === lot.id ? (
              detail.isLoading ? (
                <p className="mt-4 text-sm text-muted-foreground">Loading lot…</p>
              ) : detail.error ? (
                <p className="mt-4 text-sm text-destructive">{(detail.error as Error).message}</p>
              ) : detail.data ? (
                <div className="mt-5 space-y-5 border-t border-border pt-4">
                  {!detail.data.readiness.ready ? (
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {detail.data.readiness.reasons.map((r) => (
                        <li key={r}>• {r}</li>
                      ))}
                    </ul>
                  ) : null}

                  <div>
                    <h4 className="text-sm font-semibold">Member declarations</h4>
                    <p className="text-xs text-muted-foreground">
                      {detail.data.aggregation.members} member(s) ·{" "}
                      {detail.data.aggregation.confirmed} {detail.data.aggregation.unit} confirmed (
                      {detail.data.aggregation.confirmation_rate}%) ·{" "}
                      {detail.data.aggregation.delivered} delivered ·{" "}
                      {detail.data.aggregation.outstanding_delivery} outstanding
                    </p>
                    <ul className="mt-2 space-y-2">
                      {detail.data.contributions.map((c) => (
                        <li
                          key={c.id}
                          className="flex flex-wrap items-center justify-between gap-2 text-sm"
                        >
                          <span>
                            {c.member_name} — {c.expected_quantity} expected /{" "}
                            {c.confirmed_quantity} confirmed / {c.delivered_quantity} delivered{" "}
                            {c.unit}
                          </span>
                          {detail.data.canRecordContribution ? (
                            <span className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  confirmContribution.mutate({
                                    contributionId: c.id,
                                    confirmedQuantity: c.expected_quantity,
                                  })
                                }
                              >
                                Confirm expected
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  confirmContribution.mutate({
                                    contributionId: c.id,
                                    deliveredQuantity: c.confirmed_quantity,
                                  })
                                }
                              >
                                Mark delivered
                              </Button>
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                    {detail.data.canRecordContribution ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <select
                          className={`${input} sm:w-56`}
                          value={memberId}
                          onChange={(e) => setMemberId(e.target.value)}
                        >
                          <option value="">Unlinked member</option>
                          {detail.data.members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.display_name}
                            </option>
                          ))}
                        </select>
                        <input
                          className={`${input} sm:w-40`}
                          placeholder="Expected qty"
                          value={memberQty}
                          onChange={(e) => setMemberQty(e.target.value)}
                        />
                        <Button
                          size="sm"
                          disabled={!memberQty || addContribution.isPending}
                          onClick={() => addContribution.mutate(undefined as never)}
                        >
                          Add declaration
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold">Buyer & processor enquiries</h4>
                    {detail.data.enquiries.length === 0 ? (
                      <p className="mt-1 text-sm text-muted-foreground">No enquiries yet.</p>
                    ) : (
                      <ul className="mt-2 space-y-3">
                        {detail.data.enquiries.map((e) => (
                          <li key={e.id} className="rounded-md border border-border p-3 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-medium">
                                {e.buyer_name} · {e.buyer_type}
                                {e.is_highest_price ? " · highest live offer" : ""}
                              </span>
                              <StateBadge state={ENQUIRY_STATUS_LABEL[e.status]} />
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {e.workings ?? "No price quoted"}
                              {e.vs_reserve != null ? ` · ₹${e.vs_reserve} vs reserve` : ""}
                              {e.payment_terms ? ` · ${e.payment_terms}` : ""}
                              {e.delivery_terms ? ` · ${e.delivery_terms}` : ""}
                            </p>
                            {e.flags.length > 0 ? (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Flags: {e.flags.join("; ")}
                              </p>
                            ) : null}
                            {detail.data.canManage ? (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {nextEnquiryStatuses(e.status).map((s) => (
                                  <Button
                                    key={s}
                                    size="sm"
                                    variant={s === "accepted" ? "default" : "outline"}
                                    disabled={respond.isPending}
                                    onClick={() => respond.mutate({ enquiryId: e.id, status: s })}
                                  >
                                    {ENQUIRY_STATUS_LABEL[s]}
                                  </Button>
                                ))}
                              </div>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                    {detail.data.canManage ? (
                      <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                        <input
                          className={input}
                          placeholder="Buyer name"
                          value={buyer}
                          onChange={(ev) => setBuyer(ev.target.value)}
                        />
                        <select
                          className={input}
                          value={buyerType}
                          onChange={(ev) => setBuyerType(ev.target.value)}
                        >
                          {BUYER_TYPES.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                        <input
                          className={input}
                          placeholder="Offer / unit"
                          value={offerPrice}
                          onChange={(ev) => setOfferPrice(ev.target.value)}
                        />
                        <input
                          className={input}
                          placeholder="Quantity"
                          value={offerQty}
                          onChange={(ev) => setOfferQty(ev.target.value)}
                        />
                        <input
                          className={input}
                          placeholder="Payment terms"
                          value={payTerms}
                          onChange={(ev) => setPayTerms(ev.target.value)}
                        />
                        <input
                          className={input}
                          placeholder="Delivery terms"
                          value={delTerms}
                          onChange={(ev) => setDelTerms(ev.target.value)}
                        />
                        <Button
                          size="sm"
                          disabled={!buyer || addEnquiry.isPending}
                          onClick={() => addEnquiry.mutate(undefined as never)}
                        >
                          Record enquiry
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  {detail.data.prices.length > 0 ? (
                    <div>
                      <h4 className="text-sm font-semibold">
                        {detail.data.lot.commodity} price context
                      </h4>
                      <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                        {detail.data.prices.map((p) => (
                          <li key={`${p.commodity}-${p.basis}`}>
                            <span className="font-semibold">{p.basis_label}</span> ₹{p.latest_price}
                            /{p.unit} · {p.market_name} · {p.observed_on} — {p.basis_note}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null
            ) : null}
          </div>
        ))}
      </section>

      <section className={card}>
        <h3 className="text-sm font-semibold">Logistics, storage & processing options</h3>
        {data.logistics.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No options listed yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {data.logistics.map((l) => (
              <li key={l.id} className="flex flex-wrap justify-between gap-2">
                <span className="font-medium">
                  {LOGISTICS_KIND_LABEL[l.kind]} — {l.provider_name}
                </span>
                <span className="text-muted-foreground">
                  {l.location ?? "Location not stated"}
                  {l.capacity ? ` · ${l.capacity} ${l.capacity_unit ?? ""}` : ""}
                  {l.rate ? ` · ₹${l.rate} ${l.rate_basis ?? ""}` : ""}
                  {l.contact ? ` · ${l.contact}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
