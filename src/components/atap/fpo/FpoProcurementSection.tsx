import { useLanguage } from "@/components/atap/LanguageProvider";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StateBadge } from "@/components/atap/StatusBadge";
import {
  createProcurementCampaign,
  getCampaignDetail,
  getProcurementBoard,
  raiseRfqFromDemand,
  recordDistribution,
  recordDistributionPayment,
  recordMemberDemand,
  recordSupplierQuote,
  selectSupplierQuote,
  setCampaignStatus,
  setDemandAuthorization,
} from "@/lib/atap/fpoProcurement.functions";
import {
  INPUT_CATEGORIES,
  INPUT_CATEGORY_LABEL,
  PROCUREMENT_STATUS_LABEL,
  nextCampaignStatuses,
  type InputCategory,
  type ProcurementStatus,
} from "@/lib/atap/fpoProcurement";

export function FpoProcurementSection({ tenantId }: { tenantId: string }) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const boardFn = useServerFn(getProcurementBoard);
  const detailFn = useServerFn(getCampaignDetail);
  const createFn = useServerFn(createProcurementCampaign);
  const statusFn = useServerFn(setCampaignStatus);
  const demandFn = useServerFn(recordMemberDemand);
  const authFn = useServerFn(setDemandAuthorization);
  const rfqFn = useServerFn(raiseRfqFromDemand);
  const quoteFn = useServerFn(recordSupplierQuote);
  const selectFn = useServerFn(selectSupplierQuote);
  const distFn = useServerFn(recordDistribution);
  const payFn = useServerFn(recordDistributionPayment);

  const [openId, setOpenId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<InputCategory>("seed");
  const [season, setSeason] = useState("");
  const [memberId, setMemberId] = useState("");
  const [product, setProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("kg");
  const [price, setPrice] = useState("");
  const [quoteRfqId, setQuoteRfqId] = useState("");
  const [supplier, setSupplier] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [transport, setTransport] = useState("");
  const [certification, setCertification] = useState("");

  const board = useQuery({
    queryKey: ["fpo-procurement-board", tenantId],
    queryFn: () => boardFn({ data: { tenantId } }),
    enabled: Boolean(tenantId),
  });

  const detail = useQuery({
    queryKey: ["fpo-procurement-detail", tenantId, openId],
    queryFn: () => detailFn({ data: { tenantId, campaignId: openId ?? "" } }),
    enabled: Boolean(tenantId && openId),
  });

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["fpo-procurement-board", tenantId] });
    await qc.invalidateQueries({ queryKey: ["fpo-procurement-detail", tenantId] });
  };

  const useAction = <T,>(fn: (input: T) => Promise<unknown>, message: string) =>
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
        data: { tenantId, name, inputCategory: category, season: season || null },
      }),
    "Procurement campaign created as a draft",
  );
  const move = useAction(
    (input: { campaignId: string; status: ProcurementStatus }) =>
      statusFn({ data: { tenantId, ...input } }),
    "Campaign stage updated",
  );
  const addDemand = useAction(
    () =>
      demandFn({
        data: {
          tenantId,
          campaignId: openId ?? "",
          memberId: memberId || null,
          productName: product,
          quantity: Number(quantity),
          unit,
          indicativePrice: price ? Number(price) : null,
          memberAuthorized: false,
        },
      }),
    "Member demand recorded",
  );
  const authorize = useAction(
    (input: { demandId: string; authorized: boolean }) => authFn({ data: { tenantId, ...input } }),
    "Member authorization updated",
  );
  const raiseRfq = useAction(
    (input: { productName: string; unit: string }) =>
      rfqFn({ data: { tenantId, campaignId: openId ?? "", ...input } }),
    "RFQ raised for aggregated demand",
  );
  const addQuote = useAction(
    () =>
      quoteFn({
        data: {
          tenantId,
          rfqId: quoteRfqId,
          supplierName: supplier,
          unitPrice: Number(unitPrice),
          transportCost: transport ? Number(transport) : 0,
          certificationLabel: certification || null,
        },
      }),
    "Supplier quote recorded",
  );
  const choose = useAction(
    (input: { rfqId: string; quoteId: string }) => selectFn({ data: { tenantId, ...input } }),
    "Supplier selection recorded and audited",
  );
  const distribute = useAction(
    (input: {
      memberId: string | null;
      productName: string;
      quantity: number;
      unit: string;
      amountDue: number;
    }) => distFn({ data: { tenantId, campaignId: openId ?? "", ...input } }),
    "Distribution recorded",
  );
  const collect = useAction(
    (input: { distributionId: string; amountCollected: number }) =>
      payFn({ data: { tenantId, ...input } }),
    "Payment recorded",
  );

  if (!tenantId) {
    return (
      <section className="panel p-5 text-sm text-muted-foreground">
        {t("fpo.ui.dd3fbcdfff")}</section>
    );
  }
  if (board.isLoading) return <section className="panel p-5 text-sm">{t("fpo.ui.7f0cdf8dd6")}</section>;
  if (board.isError) {
    return (
      <section className="panel p-5 text-sm text-muted-foreground">
        {(board.error as Error).message}
      </section>
    );
  }

  const data = board.data!;
  const d = detail.data;

  return (
    <div className="space-y-6">
      <section className="panel space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold">{t("fpo.ui.e176ac9754")}</h2>
            <p className="field-hint">{data.disclaimer}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {(
              [
                "collecting_demand",
                "rfq_open",
                "quotes_received",
                "ordered",
                "closed",
              ] as ProcurementStatus[]
            ).map((s) => (
              <span key={s} className="rounded-md border border-border px-2 py-1">
                {PROCUREMENT_STATUS_LABEL[s]}: <strong>{data.counts[s]}</strong>
              </span>
            ))}
          </div>
        </div>

        {data.canManage ? (
          <div className="flex flex-wrap gap-2">
            <input
              className="input-field max-w-xs"
              placeholder={t("fpo.ui.aa5d0e720b")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <select
              className="input-field max-w-xs"
              value={category}
              onChange={(e) => setCategory(e.target.value as InputCategory)}
            >
              {INPUT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {INPUT_CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
            <input
              className="input-field max-w-[10rem]"
              placeholder={t("fpo.ui.62255f5671")}
              value={season}
              onChange={(e) => setSeason(e.target.value)}
            />
            <Button
              size="sm"
              disabled={!name.trim() || create.isPending}
              onClick={() => create.mutate(undefined as never)}
            >
              {t("fpo.ui.ebcad11747")}</Button>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2">{t("fpo.ui.69390e1665")}</th>
                <th className="py-2">{t("fpo.ui.a3c686e711")}</th>
                <th className="py-2">{t("fpo.ui.ca6d0e3aaa")}</th>
                <th className="py-2">{t("fpo.ui.41dfc0a6c9")}</th>
                <th className="py-2">{t("fpo.ui.c3cd636a58")}</th>
              </tr>
            </thead>
            <tbody>
              {data.campaigns.map((c) => (
                <tr key={c.id} className="border-t border-border align-top">
                  <td className="py-2">
                    <button
                      className="text-left font-medium underline"
                      onClick={() => setOpenId(c.id)}
                    >
                      {c.name}
                    </button>
                    <div className="field-hint">{c.season ?? "No season recorded"}</div>
                  </td>
                  <td className="py-2">{INPUT_CATEGORY_LABEL[c.input_category]}</td>
                  <td className="py-2">
                    <StateBadge state={PROCUREMENT_STATUS_LABEL[c.status]} />
                  </td>
                  <td className="py-2 text-xs">
                    {c.demand_window_start ?? "—"} → {c.demand_window_end ?? "—"}
                  </td>
                  <td className="py-2">
                    {data.canManage ? (
                      <select
                        className="input-field"
                        value=""
                        onChange={(e) =>
                          move.mutate({
                            campaignId: c.id,
                            status: e.target.value as ProcurementStatus,
                          })
                        }
                      >
                        <option value="">{t("fpo.ui.c0a3ef619a")}</option>
                        {nextCampaignStatuses(c.status).map((s) => (
                          <option key={s} value={s}>
                            {PROCUREMENT_STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="field-hint">{t("fpo.ui.5559dd041f")}</span>
                    )}
                  </td>
                </tr>
              ))}
              {data.campaigns.length === 0 ? (
                <tr>
                  <td className="py-4 text-sm text-muted-foreground" colSpan={5}>
                    {t("fpo.ui.8de4794654")}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {openId && detail.isLoading ? (
        <section className="panel p-5 text-sm">{t("fpo.ui.4dab908a85")}</section>
      ) : null}

      {d ? (
        <section className="panel space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold">{d.campaign.name}</h3>
            <Button variant="ghost" size="sm" onClick={() => setOpenId(null)}>
              {t("fpo.ui.bbfa773e5a")}</Button>
          </div>

          <div className="rounded-md border border-border p-3 text-xs">
            {t("fpo.ui.d0ffad8560")}{" "}<strong>{d.authorization.authorized}</strong> {t("fpo.ui.de04fa0e29")}{" "}
            <strong>{d.authorization.total}</strong> {t("fpo.ui.607de24183")}{" "}
            {d.authorization.reason ?? "Ready to order."}
          </div>

          <div>
            <h4 className="text-sm font-semibold">{t("fpo.ui.dae0ff7920")}</h4>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">{t("fpo.ui.dd3b86d1ef")}</th>
                  <th className="py-2">{t("fpo.ui.b25928c699")}</th>
                  <th className="py-2">{t("fpo.ui.991f4cba92")}</th>
                  <th className="py-2">{t("fpo.ui.1cb449c112")}</th>
                  <th className="py-2">{t("fpo.ui.3da8cf8509")}</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {d.aggregated.map((a) => (
                  <tr key={`${a.product_name}-${a.unit}`} className="border-t border-border">
                    <td className="py-2">{a.product_name}</td>
                    <td className="py-2">
                      {a.total_quantity} {a.unit}
                    </td>
                    <td className="py-2">
                      {a.authorized_quantity} {a.unit}
                    </td>
                    <td className="py-2">{a.member_count}</td>
                    <td className="py-2">{a.indicative_value ?? "—"}</td>
                    <td className="py-2">
                      {d.canManage ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            raiseRfq.mutate({ productName: a.product_name, unit: a.unit })
                          }
                        >
                          {t("fpo.ui.18540ff81f")}</Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {d.aggregated.length === 0 ? (
                  <tr>
                    <td className="py-3 text-sm text-muted-foreground" colSpan={6}>
                      {t("fpo.ui.3a1ae17887")}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {d.canRecordDemand ? (
            <div className="flex flex-wrap gap-2">
              <select
                className="input-field max-w-xs"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
              >
                <option value="">{t("fpo.ui.f0f0f64a10")}</option>
                {d.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name}
                  </option>
                ))}
              </select>
              <input
                className="input-field max-w-xs"
                placeholder={t("fpo.ui.dd3b86d1ef")}
                value={product}
                onChange={(e) => setProduct(e.target.value)}
              />
              <input
                className="input-field max-w-[8rem]"
                placeholder={t("fpo.ui.44f6af6945")}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
              <input
                className="input-field max-w-[6rem]"
                placeholder={t("fpo.ui.f6b935ab33")}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
              <input
                className="input-field max-w-[9rem]"
                placeholder={t("fpo.ui.8e0934a0bd")}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
              <Button
                size="sm"
                disabled={!product.trim() || !Number(quantity)}
                onClick={() => addDemand.mutate(undefined as never)}
              >
                {t("fpo.ui.5bb23811a7")}</Button>
            </div>
          ) : null}

          <div>
            <h4 className="text-sm font-semibold">{t("fpo.ui.7d603f963d")}</h4>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">{t("fpo.ui.6853c98a6f")}</th>
                  <th className="py-2">{t("fpo.ui.dd3b86d1ef")}</th>
                  <th className="py-2">{t("fpo.ui.44f6af6945")}</th>
                  <th className="py-2">{t("fpo.ui.5e25ce007a")}</th>
                </tr>
              </thead>
              <tbody>
                {d.demand.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="py-2">{row.member_name}</td>
                    <td className="py-2">{row.product_name}</td>
                    <td className="py-2">
                      {row.quantity} {row.unit}
                    </td>
                    <td className="py-2">
                      {row.member_authorized ? (
                        <StateBadge state="Authorized" />
                      ) : d.canRecordDemand ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => authorize.mutate({ demandId: row.id, authorized: true })}
                        >
                          {t("fpo.ui.5bfa01c5bf")}</Button>
                      ) : (
                        <span className="field-hint">{t("fpo.ui.96f608c16c")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-semibold">{t("fpo.ui.f4384f5a23")}</h4>
            {d.rfqs.map((rfq) => (
              <div key={rfq.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium">
                    {rfq.product_name} — {rfq.aggregated_quantity} {rfq.unit}
                  </div>
                  <div className="field-hint">{t("fpo.ui.6b19201632")}{" "}{rfq.delivery_by ?? "not specified"}</div>
                </div>
                <table className="mt-2 w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2">{t("fpo.ui.55edd46287")}</th>
                      <th className="py-2">{t("fpo.ui.1f5574e30c")}</th>
                      <th className="py-2">{t("fpo.ui.90f6c6dfa8")}</th>
                      <th className="py-2">{t("fpo.ui.70440046a3")}</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {rfq.quotes.map((q) => (
                      <tr key={q.id} className="border-t border-border align-top">
                        <td className="py-2">
                          {q.supplier_name}
                          <div className="field-hint">
                            {q.certification_label ?? "No certification declared"}
                          </div>
                        </td>
                        <td className="py-2">
                          {q.landed_cost}
                          <div className="field-hint">{q.workings}</div>
                        </td>
                        <td className="py-2">{q.landed_cost_per_unit}</td>
                        <td className="py-2 text-xs">
                          {q.is_lowest_landed_cost ? <div>{t("fpo.ui.7b3ab7d562")}</div> : null}
                          {q.flags.map((f) => (
                            <div key={f}>{f}</div>
                          ))}
                        </td>
                        <td className="py-2">
                          {rfq.selected_quote_id === q.id ? (
                            <StateBadge state="Selected" />
                          ) : d.canManage ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => choose.mutate({ rfqId: rfq.id, quoteId: q.id })}
                            >
                              {t("fpo.ui.cfce526861")}</Button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                    {rfq.quotes.length === 0 ? (
                      <tr>
                        <td className="py-3 text-sm text-muted-foreground" colSpan={5}>
                          {t("fpo.ui.f91f8e49ac")}</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            ))}

            {d.canManage && d.rfqs.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                <select
                  className="input-field max-w-xs"
                  value={quoteRfqId}
                  onChange={(e) => setQuoteRfqId(e.target.value)}
                >
                  <option value="">{t("fpo.ui.46e3cb1e1e")}</option>
                  {d.rfqs.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.product_name}
                    </option>
                  ))}
                </select>
                <input
                  className="input-field max-w-xs"
                  placeholder={t("fpo.ui.1b6428e32f")}
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                />
                <input
                  className="input-field max-w-[8rem]"
                  placeholder={t("fpo.ui.3c6c777f4d")}
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                />
                <input
                  className="input-field max-w-[9rem]"
                  placeholder={t("fpo.ui.3981affbec")}
                  value={transport}
                  onChange={(e) => setTransport(e.target.value)}
                />
                <input
                  className="input-field max-w-[11rem]"
                  placeholder={t("fpo.ui.c9e5cafa69")}
                  value={certification}
                  onChange={(e) => setCertification(e.target.value)}
                />
                <Button
                  size="sm"
                  disabled={!quoteRfqId || !supplier.trim() || !unitPrice}
                  onClick={() => addQuote.mutate(undefined as never)}
                >
                  {t("fpo.ui.64a68796fd")}</Button>
              </div>
            ) : null}
          </div>

          <div>
            <h4 className="text-sm font-semibold">{t("fpo.ui.918005aa0a")}</h4>
            <p className="field-hint">
              {t("fpo.ui.145caf2928")}{" "}{d.settlement.amount_due}{t("fpo.ui.3a14e9240a")}{" "}{d.settlement.amount_collected}{t("fpo.ui.e6e6133600")}{" "}
              {d.settlement.outstanding}.
            </p>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">{t("fpo.ui.6853c98a6f")}</th>
                  <th className="py-2">{t("fpo.ui.dd3b86d1ef")}</th>
                  <th className="py-2">{t("fpo.ui.44f6af6945")}</th>
                  <th className="py-2">{t("fpo.ui.145caf2928")}</th>
                  <th className="py-2">{t("fpo.ui.b41a92bed0")}</th>
                </tr>
              </thead>
              <tbody>
                {d.distributions.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="py-2">{row.member_name}</td>
                    <td className="py-2">{row.product_name}</td>
                    <td className="py-2">
                      {row.quantity} {row.unit}
                    </td>
                    <td className="py-2">{row.amount_due}</td>
                    <td className="py-2">
                      <StateBadge state={row.payment_state} />
                      {d.canManage && row.payment_state !== "paid" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="ml-2"
                          onClick={() =>
                            collect.mutate({
                              distributionId: row.id,
                              amountCollected: row.amount_due,
                            })
                          }
                        >
                          {t("fpo.ui.5be0d1c966")}</Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {d.distributions.length === 0 ? (
                  <tr>
                    <td className="py-3 text-sm text-muted-foreground" colSpan={5}>
                      {t("fpo.ui.21703099d7")}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            {d.canManage && d.aggregated.length > 0 ? (
              <Button
                size="sm"
                variant="secondary"
                className="mt-2"
                onClick={() =>
                  distribute.mutate({
                    memberId: d.demand[0]?.member_id ?? null,
                    productName: d.aggregated[0]!.product_name,
                    quantity: d.demand[0]?.quantity ?? 1,
                    unit: d.aggregated[0]!.unit,
                    amountDue:
                      (d.demand[0]?.indicative_price_per_unit ?? 0) * (d.demand[0]?.quantity ?? 1),
                  })
                }
              >
                {t("fpo.ui.c769dca4a4")}</Button>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
