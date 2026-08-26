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

  const wrap = <T,>(fn: (input: T) => Promise<unknown>, message: string) =>
    useMutation({
      mutationFn: fn,
      onSuccess: async () => {
        toast.success(message);
        await invalidate();
      },
      onError: (e: Error) => toast.error(e.message),
    });

  const create = wrap(
    () =>
      createFn({
        data: { tenantId, name, inputCategory: category, season: season || null },
      }),
    "Procurement campaign created as a draft",
  );
  const move = wrap(
    (input: { campaignId: string; status: ProcurementStatus }) =>
      statusFn({ data: { tenantId, ...input } }),
    "Campaign stage updated",
  );
  const addDemand = wrap(
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
  const authorize = wrap(
    (input: { demandId: string; authorized: boolean }) =>
      authFn({ data: { tenantId, ...input } }),
    "Member authorization updated",
  );
  const raiseRfq = wrap(
    (input: { productName: string; unit: string }) =>
      rfqFn({ data: { tenantId, campaignId: openId ?? "", ...input } }),
    "RFQ raised for aggregated demand",
  );
  const addQuote = wrap(
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
  const choose = wrap(
    (input: { rfqId: string; quoteId: string }) => selectFn({ data: { tenantId, ...input } }),
    "Supplier selection recorded and audited",
  );
  const distribute = wrap(
    (input: { memberId: string | null; productName: string; quantity: number; unit: string; amountDue: number }) =>
      distFn({ data: { tenantId, campaignId: openId ?? "", ...input } }),
    "Distribution recorded",
  );
  const collect = wrap(
    (input: { distributionId: string; amountCollected: number }) =>
      payFn({ data: { tenantId, ...input } }),
    "Payment recorded",
  );

  if (!tenantId) {
    return (
      <section className="panel p-5 text-sm text-muted-foreground">
        Select an FPO organization to see input procurement.
      </section>
    );
  }
  if (board.isLoading) return <section className="panel p-5 text-sm">Loading procurement…</section>;
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
            <h2 className="font-display text-base font-semibold">Input procurement</h2>
            <p className="field-hint">{data.disclaimer}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {(["collecting_demand", "rfq_open", "quotes_received", "ordered", "closed"] as ProcurementStatus[]).map(
              (s) => (
                <span key={s} className="rounded-md border border-border px-2 py-1">
                  {PROCUREMENT_STATUS_LABEL[s]}: <strong>{data.counts[s]}</strong>
                </span>
              ),
            )}
          </div>
        </div>

        {data.canManage ? (
          <div className="flex flex-wrap gap-2">
            <input
              className="input-field max-w-xs"
              placeholder="Campaign name"
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
              placeholder="Season"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
            />
            <Button size="sm" disabled={!name.trim() || create.isPending} onClick={() => create.mutate(undefined as never)}>
              Open campaign
            </Button>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2">Campaign</th>
                <th className="py-2">Category</th>
                <th className="py-2">Stage</th>
                <th className="py-2">Window</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.campaigns.map((c) => (
                <tr key={c.id} className="border-t border-border align-top">
                  <td className="py-2">
                    <button className="text-left font-medium underline" onClick={() => setOpenId(c.id)}>
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
                          move.mutate({ campaignId: c.id, status: e.target.value as ProcurementStatus })
                        }
                      >
                        <option value="">Move to…</option>
                        {nextCampaignStatuses(c.status).map((s) => (
                          <option key={s} value={s}>
                            {PROCUREMENT_STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="field-hint">View only</span>
                    )}
                  </td>
                </tr>
              ))}
              {data.campaigns.length === 0 ? (
                <tr>
                  <td className="py-4 text-sm text-muted-foreground" colSpan={5}>
                    No procurement campaigns yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {openId && detail.isLoading ? (
        <section className="panel p-5 text-sm">Loading campaign…</section>
      ) : null}

      {d ? (
        <section className="panel space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold">{d.campaign.name}</h3>
            <Button variant="ghost" size="sm" onClick={() => setOpenId(null)}>
              Close
            </Button>
          </div>

          <div className="rounded-md border border-border p-3 text-xs">
            Member authorization: <strong>{d.authorization.authorized}</strong> of{" "}
            <strong>{d.authorization.total}</strong> demand lines authorized.{" "}
            {d.authorization.reason ?? "Ready to order."}
          </div>

          <div>
            <h4 className="text-sm font-semibold">Aggregated demand</h4>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">Product</th>
                  <th className="py-2">Total</th>
                  <th className="py-2">Authorized</th>
                  <th className="py-2">Members</th>
                  <th className="py-2">Indicative value</th>
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
                          onClick={() => raiseRfq.mutate({ productName: a.product_name, unit: a.unit })}
                        >
                          Raise RFQ
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {d.aggregated.length === 0 ? (
                  <tr>
                    <td className="py-3 text-sm text-muted-foreground" colSpan={6}>
                      No member demand recorded yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {d.canRecordDemand ? (
            <div className="flex flex-wrap gap-2">
              <select className="input-field max-w-xs" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                <option value="">Unlinked member</option>
                {d.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name}
                  </option>
                ))}
              </select>
              <input
                className="input-field max-w-xs"
                placeholder="Product"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
              />
              <input
                className="input-field max-w-[8rem]"
                placeholder="Quantity"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
              <input
                className="input-field max-w-[6rem]"
                placeholder="Unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
              <input
                className="input-field max-w-[9rem]"
                placeholder="Indicative price"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
              <Button
                size="sm"
                disabled={!product.trim() || !Number(quantity)}
                onClick={() => addDemand.mutate(undefined as never)}
              >
                Record demand
              </Button>
            </div>
          ) : null}

          <div>
            <h4 className="text-sm font-semibold">Member demand lines</h4>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">Member</th>
                  <th className="py-2">Product</th>
                  <th className="py-2">Quantity</th>
                  <th className="py-2">Authorization</th>
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
                          Record member authorization
                        </Button>
                      ) : (
                        <span className="field-hint">Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-semibold">RFQs and supplier quotes</h4>
            {d.rfqs.map((rfq) => (
              <div key={rfq.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium">
                    {rfq.product_name} — {rfq.aggregated_quantity} {rfq.unit}
                  </div>
                  <div className="field-hint">Delivery by {rfq.delivery_by ?? "not specified"}</div>
                </div>
                <table className="mt-2 w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2">Supplier</th>
                      <th className="py-2">Landed cost</th>
                      <th className="py-2">Per unit</th>
                      <th className="py-2">Notes</th>
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
                          {q.is_lowest_landed_cost ? <div>Lowest landed cost</div> : null}
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
                              Select supplier
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                    {rfq.quotes.length === 0 ? (
                      <tr>
                        <td className="py-3 text-sm text-muted-foreground" colSpan={5}>
                          No quotes recorded for this RFQ yet.
                        </td>
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
                  <option value="">Select RFQ</option>
                  {d.rfqs.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.product_name}
                    </option>
                  ))}
                </select>
                <input
                  className="input-field max-w-xs"
                  placeholder="Supplier name"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                />
                <input
                  className="input-field max-w-[8rem]"
                  placeholder="Unit price"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                />
                <input
                  className="input-field max-w-[9rem]"
                  placeholder="Transport cost"
                  value={transport}
                  onChange={(e) => setTransport(e.target.value)}
                />
                <input
                  className="input-field max-w-[11rem]"
                  placeholder="Certification"
                  value={certification}
                  onChange={(e) => setCertification(e.target.value)}
                />
                <Button
                  size="sm"
                  disabled={!quoteRfqId || !supplier.trim() || !unitPrice}
                  onClick={() => addQuote.mutate(undefined as never)}
                >
                  Record quote
                </Button>
              </div>
            ) : null}
          </div>

          <div>
            <h4 className="text-sm font-semibold">Distribution and settlement</h4>
            <p className="field-hint">
              Due {d.settlement.amount_due}; collected {d.settlement.amount_collected}; outstanding{" "}
              {d.settlement.outstanding}.
            </p>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">Member</th>
                  <th className="py-2">Product</th>
                  <th className="py-2">Quantity</th>
                  <th className="py-2">Due</th>
                  <th className="py-2">Payment</th>
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
                          Record full payment
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {d.distributions.length === 0 ? (
                  <tr>
                    <td className="py-3 text-sm text-muted-foreground" colSpan={5}>
                      Nothing distributed yet.
                    </td>
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
                Record a distribution line
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
