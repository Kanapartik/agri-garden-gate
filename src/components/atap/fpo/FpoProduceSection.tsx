import { useLanguage } from "@/components/atap/LanguageProvider";
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
  const { t } = useLanguage();
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

  const publishLot = useMutation({
    mutationFn: (lotId: string) => publishFn({ data: { tenantId, lotId } }),
    onSuccess: async (result) => {
      if (result.status === "listed") {
        toast.success(t("fpo.ui.fb55f02e77"));
      } else {
        toast.info(
          t("fpo.ui.1b494e5e36"),
        );
      }
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
    return <p className="text-sm text-muted-foreground">{t("fpo.ui.cd34fb3ddf")}</p>;
  }
  if (board.isLoading) {
    return <p className="text-sm text-muted-foreground">{t("fpo.ui.d5c7f2ad66")}</p>;
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
        <h3 className="text-sm font-semibold">{t("fpo.ui.0a2097509f")}</h3>
        {data.prices.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("fpo.ui.87cf7dea00")}</p>
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
        <h3 className="text-sm font-semibold">{t("fpo.ui.139f010e8a")}</h3>
        {data.windows.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("fpo.ui.96339dd4ed")}</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm">
            {data.windows.map((w) => (
              <li key={w.commodity} className="flex flex-wrap justify-between gap-2">
                <span className="font-medium">{w.commodity}</span>
                <span className="text-muted-foreground">
                  {w.aggregated}/{w.expected} {w.unit} {t("fpo.ui.ae3340d676")}{" "}{w.lots} {t("fpo.ui.b7ed028a0c")}{" "}
                  {w.window_start ?? "window TBD"} → {w.window_end ?? "TBD"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.canManage ? (
        <section className={card}>
          <h3 className="text-sm font-semibold">{t("fpo.ui.0513c5c08f")}</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <input
              className={input}
              placeholder={t("fpo.ui.38dfc23319")}
              value={commodity}
              onChange={(e) => setCommodity(e.target.value)}
            />
            <input
              className={input}
              placeholder={t("fpo.ui.85e646fbb9")}
              value={variety}
              onChange={(e) => setVariety(e.target.value)}
            />
            <input
              className={input}
              placeholder={t("fpo.ui.62255f5671")}
              value={season}
              onChange={(e) => setSeason(e.target.value)}
            />
            <input
              className={input}
              placeholder={t("fpo.ui.24c24bc097")}
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
            />
            <input
              className={input}
              placeholder={t("fpo.ui.7c98a3a52b")}
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
            {t("fpo.ui.548e6304fa")}</Button>
        </section>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">{t("fpo.ui.0c84c5517a")}</h3>
        {data.lots.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("fpo.ui.dc1e842fe3")}</p>
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
                  {lot.aggregated_quantity}/{lot.expected_quantity} {lot.unit} {t("fpo.ui.a1036feb49")}{lot.reserve_price_per_unit
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
                <p className="mt-4 text-sm text-muted-foreground">{t("fpo.ui.5961f7dcc5")}</p>
              ) : detail.error ? (
                <p className="mt-4 text-sm text-destructive">{(detail.error as Error).message}</p>
              ) : detail.data ? (
                <div className="mt-5 space-y-5 border-t border-border pt-4">
                  {lot.marketplace_listing_id ? (
                    <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                      {t("fpo.ui.9c48af5f06")}</p>
                  ) : detail.data.canManage && detail.data.readiness.ready ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        disabled={publishLot.isPending}
                        onClick={() => publishLot.mutate(lot.id)}
                      >
                        {publishLot.isPending ? "Listing…" : "List on marketplace"}
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {t("fpo.ui.d6bc603ba0")}</span>
                    </div>
                  ) : null}
                  {!detail.data.readiness.ready ? (
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {detail.data.readiness.reasons.map((r) => (
                        <li key={r}>• {r}</li>
                      ))}
                    </ul>
                  ) : null}

                  <div>
                    <h4 className="text-sm font-semibold">{t("fpo.ui.42140ad886")}</h4>
                    <p className="text-xs text-muted-foreground">
                      {detail.data.aggregation.members} {t("fpo.ui.b83f2ba0f2")}{" "}
                      {detail.data.aggregation.confirmed} {detail.data.aggregation.unit} {t("fpo.ui.0bdab2f8cc")}{detail.data.aggregation.confirmation_rate}%) ·{" "}
                      {detail.data.aggregation.delivered} {t("fpo.ui.adc6bad0fe")}{" "}
                      {detail.data.aggregation.outstanding_delivery} {t("fpo.ui.b5efd49071")}</p>
                    <ul className="mt-2 space-y-2">
                      {detail.data.contributions.map((c) => (
                        <li
                          key={c.id}
                          className="flex flex-wrap items-center justify-between gap-2 text-sm"
                        >
                          <span>
                            {c.member_name} — {c.expected_quantity} {t("fpo.ui.b80ef48c91")}{" "}
                            {c.confirmed_quantity} {t("fpo.ui.36f9a4b466")}{" "}{c.delivered_quantity} {t("fpo.ui.f818910a3e")}{" "}
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
                                {t("fpo.ui.b280d24701")}</Button>
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
                                {t("fpo.ui.2a90783e08")}</Button>
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
                          <option value="">{t("fpo.ui.f0f0f64a10")}</option>
                          {detail.data.members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.display_name}
                            </option>
                          ))}
                        </select>
                        <input
                          className={`${input} sm:w-40`}
                          placeholder={t("fpo.ui.6dc390e221")}
                          value={memberQty}
                          onChange={(e) => setMemberQty(e.target.value)}
                        />
                        <Button
                          size="sm"
                          disabled={!memberQty || addContribution.isPending}
                          onClick={() => addContribution.mutate(undefined as never)}
                        >
                          {t("fpo.ui.c1d360df47")}</Button>
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold">{t("fpo.ui.9fa53cabe4")}</h4>
                    {detail.data.enquiries.length === 0 ? (
                      <p className="mt-1 text-sm text-muted-foreground">{t("fpo.ui.455b7dc123")}</p>
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
                                {t("fpo.ui.2a476f8687")}{" "}{e.flags.join("; ")}
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
                          placeholder={t("fpo.ui.8eb808e9e2")}
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
                          placeholder={t("fpo.ui.3c1692002e")}
                          value={offerPrice}
                          onChange={(ev) => setOfferPrice(ev.target.value)}
                        />
                        <input
                          className={input}
                          placeholder={t("fpo.ui.44f6af6945")}
                          value={offerQty}
                          onChange={(ev) => setOfferQty(ev.target.value)}
                        />
                        <input
                          className={input}
                          placeholder={t("fpo.ui.8744d51917")}
                          value={payTerms}
                          onChange={(ev) => setPayTerms(ev.target.value)}
                        />
                        <input
                          className={input}
                          placeholder={t("fpo.ui.1e5e2846ec")}
                          value={delTerms}
                          onChange={(ev) => setDelTerms(ev.target.value)}
                        />
                        <Button
                          size="sm"
                          disabled={!buyer || addEnquiry.isPending}
                          onClick={() => addEnquiry.mutate(undefined as never)}
                        >
                          {t("fpo.ui.5276d23571")}</Button>
                      </div>
                    ) : null}
                  </div>

                  {detail.data.prices.length > 0 ? (
                    <div>
                      <h4 className="text-sm font-semibold">
                        {detail.data.lot.commodity} {t("fpo.ui.2b68f9c098")}</h4>
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
        <h3 className="text-sm font-semibold">{t("fpo.ui.1be6d818a3")}</h3>
        {data.logistics.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("fpo.ui.8b98eafa16")}</p>
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
