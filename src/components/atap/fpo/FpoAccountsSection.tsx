import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/atap/LanguageProvider";
import { fill } from "@/lib/i18n.fpoWs";
import { StateBadge } from "@/components/atap/StatusBadge";
import {
  getAccountsBoard,
  reconcileLedgerEntry,
  recordGrantFund,
  recordGrantReceipt,
  recordGrantUtilization,
  recordLedgerEntry,
  recordSettlement,
  setGrantUcState,
} from "@/lib/atap/fpoAccounts.functions";
import {
  LEDGER_CATEGORIES,
  LEDGER_CATEGORY_LABEL,
  PAYMENT_STATE_LABEL,
  UC_STATE_LABEL,
  type LedgerCategory,
  type LedgerDirection,
  type UcState,
} from "@/lib/atap/fpoAccounts";

const input =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";
const card = "rounded-lg border border-border bg-card p-4";

const TABS = [
  { key: "overview", label: "fpo.acc.tOverview" },
  { key: "receivables", label: "fpo.acc.tRecv" },
  { key: "payables", label: "fpo.acc.tPay" },
  { key: "members", label: "fpo.acc.tLedger" },
  { key: "grants", label: "fpo.acc.tGrants" },
  { key: "reconciliation", label: "fpo.acc.tRecon" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function money(value: number): string {
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

export function FpoAccountsSection({ tenantId }: { tenantId: string }) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const boardFn = useServerFn(getAccountsBoard);
  const entryFn = useServerFn(recordLedgerEntry);
  const settleFn = useServerFn(recordSettlement);
  const reconcileFn = useServerFn(reconcileLedgerEntry);
  const grantFn = useServerFn(recordGrantFund);
  const receiptFn = useServerFn(recordGrantReceipt);
  const utilFn = useServerFn(recordGrantUtilization);
  const ucFn = useServerFn(setGrantUcState);

  const [tab, setTab] = useState<TabKey>("overview");
  const [direction, setDirection] = useState<LedgerDirection>("inflow");
  const [category, setCategory] = useState<LedgerCategory>("produce_sale");
  const [description, setDescription] = useState("");
  const [party, setParty] = useState("");
  const [memberId, setMemberId] = useState("");
  const [amount, setAmount] = useState("");
  const [settled, setSettled] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [reference, setReference] = useState("");

  const [grantTitle, setGrantTitle] = useState("");
  const [funder, setFunder] = useState("");
  const [sanctioned, setSanctioned] = useState("");
  const [received, setReceived] = useState("");
  const [openGrantId, setOpenGrantId] = useState<string | null>(null);
  const [utilPurpose, setUtilPurpose] = useState("");
  const [utilAmount, setUtilAmount] = useState("");
  const [voucher, setVoucher] = useState("");

  const board = useQuery({
    queryKey: ["fpo-accounts-board", tenantId],
    queryFn: () => boardFn({ data: { tenantId } }),
    enabled: Boolean(tenantId),
  });

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["fpo-accounts-board", tenantId] });
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

  const addEntry = useAction(
    () =>
      entryFn({
        data: {
          tenantId,
          direction,
          category,
          description,
          partyName: party || null,
          memberId: memberId || null,
          amount: Number(amount || 0),
          amountSettled: Number(settled || 0),
          dueDate: dueDate || null,
          reference: reference || null,
        },
      }),
    t("fpo.acc.tx"),
  );
  const settle = useAction(
    (i: { entryId: string; amountSettled: number; waive?: boolean }) =>
      settleFn({ data: { tenantId, ...i } }),
    t("fpo.acc.settle"),
  );
  const reconcile = useAction(
    (i: { entryId: string; bankReference: string; reconciled: boolean }) =>
      reconcileFn({ data: { tenantId, ...i } }),
    t("fpo.acc.reconUpd"),
  );
  const addGrant = useAction(
    () =>
      grantFn({
        data: {
          tenantId,
          title: grantTitle,
          funderName: funder,
          sanctionedAmount: Number(sanctioned || 0),
          receivedAmount: Number(received || 0),
        },
      }),
    t("fpo.acc.grantRec"),
  );
  const addReceipt = useAction(
    (i: { grantId: string; amount: number }) => receiptFn({ data: { tenantId, ...i } }),
    t("fpo.acc.grantRcpt"),
  );
  const addUtilization = useAction(
    (i: { grantId: string }) =>
      utilFn({
        data: {
          tenantId,
          grantId: i.grantId,
          purpose: utilPurpose,
          amount: Number(utilAmount || 0),
          voucherReference: voucher || null,
        },
      }),
    t("fpo.acc.util"),
  );
  const setUc = useAction(
    (i: { grantId: string; state: UcState }) => ucFn({ data: { tenantId, ...i } }),
    t("fpo.acc.ucUpd"),
  );

  if (!tenantId) {
    return (
      <p className="text-sm text-muted-foreground">Select an organization to view accounts.</p>
    );
  }
  if (board.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading finance records…</p>;
  }
  if (board.error) {
    return <p className="text-sm text-destructive">{(board.error as Error).message}</p>;
  }
  const data = board.data;
  if (!data) return null;

  const entries = data.entries;
  const receivables = entries.filter((e) => e.direction === "inflow" && e.outstanding > 0);
  const payables = entries.filter((e) => e.direction === "outflow" && e.outstanding > 0);
  const unreconciled = entries.filter((e) => !e.is_reconciled && e.amount_settled > 0);

  const metrics = [
    { label: t("fpo.acc.mIn"), value: money(data.summary.inflow) },
    { label: t("fpo.acc.mOut"), value: money(data.summary.outflow) },
    { label: t("fpo.acc.mNet"), value: money(data.summary.net) },
    { label: t("fpo.acc.tRecv"), value: money(data.summary.receivable) },
    { label: t("fpo.acc.tPay"), value: money(data.summary.payable) },
    { label: t("fpo.acc.mUnrec"), value: String(data.summary.unreconciled) },
  ];

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">{t("fpo.acc.title")}</h2>
        <p className="text-sm text-muted-foreground">{data.disclaimer}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((m) => (
          <div key={m.label} className={card}>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{m.label}</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{m.value}</p>
          </div>
        ))}
      </div>

      <nav className="flex flex-wrap gap-2">
        {TABS.map((tb) => (
          <Button
            key={tb.key}
            size="sm"
            variant={tab === tb.key ? "default" : "outline"}
            onClick={() => setTab(tb.key)}
          >
            {t(tb.label)}
          </Button>
        ))}
      </nav>

      {tab === "overview" ? (
        <div className="space-y-4">
          <div className={card}>
            <h3 className="text-sm font-semibold text-foreground">{t("fpo.acc.byCat")}</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2">{t("fpo.acc.cCat")}</th>
                    <th className="py-2">{t("fpo.acc.cRecv")}</th>
                    <th className="py-2">{t("fpo.acc.cPaid")}</th>
                    <th className="py-2">{t("fpo.acc.cOut")}</th>
                    <th className="py-2">{t("fpo.acc.cEnt")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.categories.map((c) => (
                    <tr key={c.category} className="border-t border-border">
                      <td className="py-2 text-foreground">{c.label}</td>
                      <td className="py-2">{money(c.inflow)}</td>
                      <td className="py-2">{money(c.outflow)}</td>
                      <td className="py-2">{money(c.outstanding)}</td>
                      <td className="py-2">{c.entries}</td>
                    </tr>
                  ))}
                  {data.categories.length === 0 ? (
                    <tr>
                      <td className="py-3 text-muted-foreground" colSpan={5}>
                        {t("fpo.acc.noTx")}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          {data.canManage ? (
            <div className={card}>
              <h3 className="text-sm font-semibold text-foreground">Record a transaction</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <select
                  className={input}
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as LedgerDirection)}
                  aria-label="Direction"
                >
                  <option value="inflow">{t("fpo.acc.in")}</option>
                  <option value="outflow">{t("fpo.acc.outO")}</option>
                </select>
                <select
                  className={input}
                  value={category}
                  onChange={(e) => setCategory(e.target.value as LedgerCategory)}
                  aria-label="Category"
                >
                  {LEDGER_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {LEDGER_CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </select>
                <input
                  className={input}
                  placeholder={t("fpo.acc.desc")}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <input
                  className={input}
                  placeholder={t("fpo.acc.party")}
                  value={party}
                  onChange={(e) => setParty(e.target.value)}
                />
                <select
                  className={input}
                  value={memberId}
                  onChange={(e) => setMemberId(e.target.value)}
                  aria-label="Member"
                >
                  <option value="">{t("fpo.acc.notMem")}</option>
                  {data.memberOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.display_name}
                    </option>
                  ))}
                </select>
                <input
                  className={input}
                  placeholder={t("fpo.acc.amt")}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <input
                  className={input}
                  placeholder={t("fpo.acc.amtSet")}
                  value={settled}
                  onChange={(e) => setSettled(e.target.value)}
                />
                <input
                  className={input}
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  aria-label="Due date"
                />
                <input
                  className={input}
                  placeholder={t("fpo.acc.ref")}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>
              <Button
                className="mt-3"
                size="sm"
                disabled={addEntry.isPending || !description || !amount}
                onClick={() => addEntry.mutate(undefined as never)}
              >
                {t("fpo.acc.recTx")}</Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("fpo.acc.readOnly")}</p>
          )}

          <div className={card}>
            <h3 className="text-sm font-semibold text-foreground">{t("fpo.acc.recent")}</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2">{t("fpo.acc.cDate")}</th>
                    <th className="py-2">{t("fpo.acc.cTx")}</th>
                    <th className="py-2">{t("fpo.acc.cCat")}</th>
                    <th className="py-2">{t("fpo.acc.cAmt")}</th>
                    <th className="py-2">{t("fpo.acc.cOut")}</th>
                    <th className="py-2">{t("fpo.acc.cStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.slice(0, 25).map((e) => (
                    <tr key={e.id} className="border-t border-border">
                      <td className="py-2 whitespace-nowrap">{e.entry_date}</td>
                      <td className="py-2 text-foreground">
                        {e.description}
                        <span className="block text-xs text-muted-foreground">
                          {e.member_name ?? e.party_name ?? "—"}
                          {e.direction === "inflow" ? ` · ${t("fpo.acc.in")}` : ` · ${t("fpo.acc.outO")}`}
                        </span>
                      </td>
                      <td className="py-2">{LEDGER_CATEGORY_LABEL[e.category]}</td>
                      <td className="py-2">{money(e.amount)}</td>
                      <td className="py-2">{money(e.outstanding)}</td>
                      <td className="py-2">
                        <StateBadge state={e.payment_state} />
                      </td>
                    </tr>
                  ))}
                  {entries.length === 0 ? (
                    <tr>
                      <td className="py-3 text-muted-foreground" colSpan={6}>
                        {t("fpo.acc.noTx")}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "receivables" || tab === "payables" ? (
        <div className={card}>
          <h3 className="text-sm font-semibold text-foreground">
            {tab === "receivables" ? t("fpo.acc.tRecv") : t("fpo.acc.tPay")}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {tab === "receivables"
              ? `Overdue receivable: ${money(data.summary.overdueReceivable)}`
              : `Overdue payable: ${money(data.summary.overduePayable)}`}
          </p>
          <div className="mt-3 space-y-3">
            {(tab === "receivables" ? receivables : payables).map((e) => (
              <div key={e.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">{e.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.member_name ?? e.party_name ?? "—"} · due{" "}{e.due_date ?? "not set"} ·{" "}
                      {LEDGER_CATEGORY_LABEL[e.category]}
                      {e.overdue ? " · overdue" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">{money(e.outstanding)}</p>
                    <p className="text-xs text-muted-foreground">
                      of{" "}{money(e.amount)} · {PAYMENT_STATE_LABEL[e.payment_state]}
                    </p>
                  </div>
                </div>
                {data.canManage ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={settle.isPending}
                      onClick={() => settle.mutate({ entryId: e.id, amountSettled: e.amount })}
                    >
                      {t("fpo.acc.full")}</Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={settle.isPending}
                      onClick={() =>
                        settle.mutate({
                          entryId: e.id,
                          amountSettled: Math.round(e.amount / 2),
                        })
                      }
                    >
                      {t("fpo.acc.half")}</Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={settle.isPending}
                      onClick={() =>
                        settle.mutate({
                          entryId: e.id,
                          amountSettled: e.amount_settled,
                          waive: true,
                        })
                      }
                    >
                      {t("fpo.acc.waive")}</Button>
                  </div>
                ) : null}
              </div>
            ))}
            {(tab === "receivables" ? receivables : payables).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing outstanding here.</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "members" ? (
        <div className={card}>
          <h3 className="text-sm font-semibold text-foreground">Farmer ledger</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("fpo.acc.separate")}</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">{t("fpo.acc.cMember")}</th>
                  <th className="py-2">{t("fpo.acc.cPaidTo")}</th>
                  <th className="py-2">{t("fpo.acc.cColl")}</th>
                  <th className="py-2">{t("fpo.acc.cPayTo")}</th>
                  <th className="py-2">{t("fpo.acc.cDue")}</th>
                  <th className="py-2">{t("fpo.acc.cEnt")}</th>
                </tr>
              </thead>
              <tbody>
                {data.members.map((m) => (
                  <tr key={m.memberId} className="border-t border-border">
                    <td className="py-2 text-foreground">{m.memberName}</td>
                    <td className="py-2">{money(m.credited)}</td>
                    <td className="py-2">{money(m.debited)}</td>
                    <td className="py-2">{money(m.outstandingToMember)}</td>
                    <td className="py-2">{money(m.outstandingFromMember)}</td>
                    <td className="py-2">{m.entries}</td>
                  </tr>
                ))}
                {data.members.length === 0 ? (
                  <tr>
                    <td className="py-3 text-muted-foreground" colSpan={6}>
                      {t("fpo.acc.noMemTx")}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "grants" ? (
        <div className="space-y-4">
          {data.canManage ? (
            <div className={card}>
              <h3 className="text-sm font-semibold text-foreground">Record a grant sanction</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <input
                  className={input}
                  placeholder={t("fpo.acc.gTitle")}
                  value={grantTitle}
                  onChange={(e) => setGrantTitle(e.target.value)}
                />
                <input
                  className={input}
                  placeholder={t("fpo.acc.funder")}
                  value={funder}
                  onChange={(e) => setFunder(e.target.value)}
                />
                <input
                  className={input}
                  placeholder={t("fpo.acc.sanc")}
                  value={sanctioned}
                  onChange={(e) => setSanctioned(e.target.value)}
                />
                <input
                  className={input}
                  placeholder={t("fpo.acc.recSoFar")}
                  value={received}
                  onChange={(e) => setReceived(e.target.value)}
                />
              </div>
              <Button
                className="mt-3"
                size="sm"
                disabled={addGrant.isPending || !grantTitle || !funder || !sanctioned}
                onClick={() => addGrant.mutate(undefined as never)}
              >
                {t("fpo.acc.recGrant")}</Button>
            </div>
          ) : null}

          {data.grants.map((g) => {
            const rows = data.utilizations.filter((u) => u.grant_id === g.id);
            const open = openGrantId === g.id;
            return (
              <div key={g.id} className={card}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{g.title}</p>
                    <p className="text-xs text-muted-foreground">{g.funder_name}</p>
                  </div>
                  <StateBadge state={g.uc_state} />
                </div>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5">
                  <p>
                    {t("fpo.acc.gSanc")}<span className="block font-medium text-foreground">
                      {money(g.position.sanctioned)}
                    </span>
                  </p>
                  <p>
                    {t("fpo.acc.gRecv")}<span className="block font-medium text-foreground">
                      {money(g.position.received)}
                    </span>
                  </p>
                  <p>
                    {t("fpo.acc.gUtil")}<span className="block font-medium text-foreground">
                      {money(g.position.utilized)}
                    </span>
                  </p>
                  <p>
                    {t("fpo.acc.gBal")}<span className="block font-medium text-foreground">
                      {money(g.position.balance)}
                    </span>
                  </p>
                  <p>
                    {t("fpo.acc.gAwait")}<span className="block font-medium text-foreground">
                      {money(g.position.awaitingRelease)}
                    </span>
                  </p>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Utilization{" "}{g.position.utilizationPercent}% of funds received · certificate:{" "}
                  {UC_STATE_LABEL[g.uc_state]}
                  {g.reporting_deadline ? ` · reporting by ${g.reporting_deadline}` : ""}
                </p>
                {g.position.actions.length > 0 ? (
                  <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                    {g.position.actions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setOpenGrantId(open ? null : g.id)}
                  >
                    {open ? t("fpo.acc.hideUtil") : fill(t("fpo.acc.utilN"), { n: rows.length })}
                  </Button>
                  {data.canManage ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={addReceipt.isPending || g.position.awaitingRelease <= 0}
                        onClick={() =>
                          addReceipt.mutate({
                            grantId: g.id,
                            amount: g.next_installment_amount ?? g.position.awaitingRelease,
                          })
                        }
                      >
                        {t("fpo.acc.inst")}</Button>
                      {g.uc_state === "pending" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={setUc.isPending}
                          onClick={() => setUc.mutate({ grantId: g.id, state: "submitted" })}
                        >
                          {t("fpo.acc.uc")}</Button>
                      ) : null}
                    </>
                  ) : null}
                </div>

                {open ? (
                  <div className="mt-3 space-y-2 border-t border-border pt-3">
                    {rows.map((u) => (
                      <div key={u.id} className="flex flex-wrap justify-between gap-2 text-sm">
                        <span className="text-foreground">
                          {u.purpose}
                          <span className="block text-xs text-muted-foreground">
                            {u.spent_on}
                            {u.voucher_reference ? ` · ${u.voucher_reference}` : ""}
                          </span>
                        </span>
                        <span>{money(u.amount)}</span>
                      </div>
                    ))}
                    {rows.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No utilization recorded yet.</p>
                    ) : null}
                    {data.canManage ? (
                      <div className="grid gap-3 sm:grid-cols-3">
                        <input
                          className={input}
                          placeholder={t("fpo.acc.purpose")}
                          value={utilPurpose}
                          onChange={(e) => setUtilPurpose(e.target.value)}
                        />
                        <input
                          className={input}
                          placeholder={t("fpo.acc.amt")}
                          value={utilAmount}
                          onChange={(e) => setUtilAmount(e.target.value)}
                        />
                        <input
                          className={input}
                          placeholder={t("fpo.acc.vRef")}
                          value={voucher}
                          onChange={(e) => setVoucher(e.target.value)}
                        />
                        <Button
                          size="sm"
                          disabled={addUtilization.isPending || !utilPurpose || !utilAmount}
                          onClick={() => addUtilization.mutate({ grantId: g.id })}
                        >
                          {t("fpo.acc.recUtil")}</Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
          {data.grants.length === 0 ? (
            <p className="text-sm text-muted-foreground">No grant funds recorded yet.</p>
          ) : null}
        </div>
      ) : null}

      {tab === "reconciliation" ? (
        <div className={card}>
          <h3 className="text-sm font-semibold text-foreground">Bank reconciliation</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {data.summary.unreconciled} settled line(s) worth{" "}
            {money(data.summary.unreconciledAmount)} are not yet matched to a bank reference.</p>
          <div className="mt-3 space-y-3">
            {unreconciled.map((e) => (
              <ReconcileRow
                key={e.id}
                description={e.description}
                meta={`${e.entry_date} · ${money(e.amount_settled)} settled · ${LEDGER_CATEGORY_LABEL[e.category]}`}
                disabled={!data.canReconcile || reconcile.isPending}
                onSubmit={(bankReference) =>
                  reconcile.mutate({ entryId: e.id, bankReference, reconciled: true })
                }
              />
            ))}
            {unreconciled.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("fpo.acc.bankRef")}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ReconcileRow({
  description,
  meta,
  disabled,
  onSubmit,
}: {
  description: string;
  meta: string;
  disabled: boolean;
  onSubmit: (bankReference: string) => void;
}) {
  const { t } = useLanguage();
  const [value, setValue] = useState("");
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-sm font-medium text-foreground">{description}</p>
      <p className="text-xs text-muted-foreground">{meta}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          className={`${input} sm:w-64`}
          placeholder={t("fpo.acc.bRef")}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button
          size="sm"
          disabled={disabled || !value.trim()}
          onClick={() => onSubmit(value.trim())}
        >
          {t("fpo.acc.reconciled")}</Button>
      </div>
    </div>
  );
}
