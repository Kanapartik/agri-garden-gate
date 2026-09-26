import { useLanguage } from "@/components/atap/LanguageProvider";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  { key: "overview", label: "Overview" },
  { key: "receivables", label: "Receivables" },
  { key: "payables", label: "Payables" },
  { key: "members", label: "Farmer ledger" },
  { key: "grants", label: "Scheme & grant funds" },
  { key: "reconciliation", label: "Bank reconciliation" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function money(value: number): string {
  const { t } = useLanguage();
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

export function FpoAccountsSection({ tenantId }: { tenantId: string }) {
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
    "Transaction recorded",
  );
  const settle = useAction(
    (i: { entryId: string; amountSettled: number; waive?: boolean }) =>
      settleFn({ data: { tenantId, ...i } }),
    "Settlement updated",
  );
  const reconcile = useAction(
    (i: { entryId: string; bankReference: string; reconciled: boolean }) =>
      reconcileFn({ data: { tenantId, ...i } }),
    "Reconciliation updated",
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
    "Grant fund recorded",
  );
  const addReceipt = useAction(
    (i: { grantId: string; amount: number }) => receiptFn({ data: { tenantId, ...i } }),
    "Grant receipt recorded",
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
    "Utilization recorded",
  );
  const setUc = useAction(
    (i: { grantId: string; state: UcState }) => ucFn({ data: { tenantId, ...i } }),
    "Utilization certificate updated",
  );

  if (!tenantId) {
    return (
      <p className="text-sm text-muted-foreground">{t("fpo.ui.198bbf5ada")}</p>
    );
  }
  if (board.isLoading) {
    return <p className="text-sm text-muted-foreground">{t("fpo.ui.ad1b46a1a8")}</p>;
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
    { label: "Money received", value: money(data.summary.inflow) },
    { label: "Money paid", value: money(data.summary.outflow) },
    { label: "Net position", value: money(data.summary.net) },
    { label: "Receivables", value: money(data.summary.receivable) },
    { label: "Payables", value: money(data.summary.payable) },
    { label: "Unreconciled lines", value: String(data.summary.unreconciled) },
  ];

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">{t("fpo.ui.7e46f390af")}</h2>
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
        {TABS.map((t) => (
          <Button
            key={t.key}
            size="sm"
            variant={tab === t.key ? "default" : "outline"}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </Button>
        ))}
      </nav>

      {tab === "overview" ? (
        <div className="space-y-4">
          <div className={card}>
            <h3 className="text-sm font-semibold text-foreground">{t("fpo.ui.b0e3606a17")}</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2">{t("fpo.ui.a3c686e711")}</th>
                    <th className="py-2">{t("fpo.ui.27548c4fc9")}</th>
                    <th className="py-2">{t("fpo.ui.dc9d4584a5")}</th>
                    <th className="py-2">{t("fpo.ui.f8ee57ec86")}</th>
                    <th className="py-2">{t("fpo.ui.f056d0d56a")}</th>
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
                        {t("fpo.ui.2f6a8bb337")}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          {data.canManage ? (
            <div className={card}>
              <h3 className="text-sm font-semibold text-foreground">{t("fpo.ui.e5471e8509")}</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <select
                  className={input}
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as LedgerDirection)}
                  aria-label={t("fpo.ui.fd8e45bac7")}
                >
                  <option value="inflow">{t("fpo.ui.0516e7a593")}</option>
                  <option value="outflow">{t("fpo.ui.cad0561ea6")}</option>
                </select>
                <select
                  className={input}
                  value={category}
                  onChange={(e) => setCategory(e.target.value as LedgerCategory)}
                  aria-label={t("fpo.ui.a3c686e711")}
                >
                  {LEDGER_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {LEDGER_CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </select>
                <input
                  className={input}
                  placeholder={t("fpo.ui.55f8ebc805")}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <input
                  className={input}
                  placeholder={t("fpo.ui.81e85186a4")}
                  value={party}
                  onChange={(e) => setParty(e.target.value)}
                />
                <select
                  className={input}
                  value={memberId}
                  onChange={(e) => setMemberId(e.target.value)}
                  aria-label={t("fpo.ui.6853c98a6f")}
                >
                  <option value="">{t("fpo.ui.29e3bbfefa")}</option>
                  {data.memberOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.display_name}
                    </option>
                  ))}
                </select>
                <input
                  className={input}
                  placeholder={t("fpo.ui.4ecd3f6465")}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <input
                  className={input}
                  placeholder={t("fpo.ui.c1397e52c9")}
                  value={settled}
                  onChange={(e) => setSettled(e.target.value)}
                />
                <input
                  className={input}
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  aria-label={t("fpo.ui.4c1aeebc43")}
                />
                <input
                  className={input}
                  placeholder={t("fpo.ui.bfef4081b9")}
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
                {t("fpo.ui.acc8ebd9b6")}</Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("fpo.ui.4b053057f3")}</p>
          )}

          <div className={card}>
            <h3 className="text-sm font-semibold text-foreground">{t("fpo.ui.29da6324eb")}</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2">{t("fpo.ui.eb9a4bc1c0")}</th>
                    <th className="py-2">{t("fpo.ui.1a7b7c1b33")}</th>
                    <th className="py-2">{t("fpo.ui.a3c686e711")}</th>
                    <th className="py-2">{t("fpo.ui.43dc8532f7")}</th>
                    <th className="py-2">{t("fpo.ui.f8ee57ec86")}</th>
                    <th className="py-2">{t("fpo.ui.bae7d5be70")}</th>
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
                          {e.direction === "inflow" ? " · money in" : " · money out"}
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
                        {t("fpo.ui.2f6a8bb337")}</td>
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
            {tab === "receivables" ? "Receivables" : "Payables"}
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
                      {e.member_name ?? e.party_name ?? "—"} {t("fpo.ui.6e49fc01a7")}{" "}{e.due_date ?? "not set"} ·{" "}
                      {LEDGER_CATEGORY_LABEL[e.category]}
                      {e.overdue ? " · overdue" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">{money(e.outstanding)}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("fpo.ui.de04fa0e29")}{" "}{money(e.amount)} · {PAYMENT_STATE_LABEL[e.payment_state]}
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
                      {t("fpo.ui.af65de6cfc")}</Button>
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
                      {t("fpo.ui.efc960c1e5")}</Button>
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
                      {t("fpo.ui.2b12ecbd21")}</Button>
                  </div>
                ) : null}
              </div>
            ))}
            {(tab === "receivables" ? receivables : payables).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("fpo.ui.5c00b685d4")}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "members" ? (
        <div className={card}>
          <h3 className="text-sm font-semibold text-foreground">{t("fpo.ui.6134496b06")}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("fpo.ui.14be65a0f5")}</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">{t("fpo.ui.6853c98a6f")}</th>
                  <th className="py-2">{t("fpo.ui.965435b4c7")}</th>
                  <th className="py-2">{t("fpo.ui.c319280cf3")}</th>
                  <th className="py-2">{t("fpo.ui.9557818f17")}</th>
                  <th className="py-2">{t("fpo.ui.db0c5176f1")}</th>
                  <th className="py-2">{t("fpo.ui.f056d0d56a")}</th>
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
                      {t("fpo.ui.e08ce9cf55")}</td>
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
              <h3 className="text-sm font-semibold text-foreground">{t("fpo.ui.5c4ba74b79")}</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <input
                  className={input}
                  placeholder={t("fpo.ui.ea01887b60")}
                  value={grantTitle}
                  onChange={(e) => setGrantTitle(e.target.value)}
                />
                <input
                  className={input}
                  placeholder={t("fpo.ui.29af8e7a97")}
                  value={funder}
                  onChange={(e) => setFunder(e.target.value)}
                />
                <input
                  className={input}
                  placeholder={t("fpo.ui.88d674c398")}
                  value={sanctioned}
                  onChange={(e) => setSanctioned(e.target.value)}
                />
                <input
                  className={input}
                  placeholder={t("fpo.ui.a8accce0bd")}
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
                {t("fpo.ui.91aa715121")}</Button>
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
                    {t("fpo.ui.dc5295e394")}<span className="block font-medium text-foreground">
                      {money(g.position.sanctioned)}
                    </span>
                  </p>
                  <p>
                    {t("fpo.ui.27548c4fc9")}<span className="block font-medium text-foreground">
                      {money(g.position.received)}
                    </span>
                  </p>
                  <p>
                    {t("fpo.ui.633b318e39")}<span className="block font-medium text-foreground">
                      {money(g.position.utilized)}
                    </span>
                  </p>
                  <p>
                    {t("fpo.ui.e209df0ab9")}<span className="block font-medium text-foreground">
                      {money(g.position.balance)}
                    </span>
                  </p>
                  <p>
                    {t("fpo.ui.853d427e25")}<span className="block font-medium text-foreground">
                      {money(g.position.awaitingRelease)}
                    </span>
                  </p>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("fpo.ui.ea3c24ad24")}{" "}{g.position.utilizationPercent}{t("fpo.ui.aa8e98adb2")}{" "}
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
                    {open ? "Hide utilization" : `Utilization (${rows.length})`}
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
                        {t("fpo.ui.daf9982e1c")}</Button>
                      {g.uc_state === "pending" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={setUc.isPending}
                          onClick={() => setUc.mutate({ grantId: g.id, state: "submitted" })}
                        >
                          {t("fpo.ui.12b9e71e68")}</Button>
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
                      <p className="text-sm text-muted-foreground">{t("fpo.ui.4cb43a2fb7")}</p>
                    ) : null}
                    {data.canManage ? (
                      <div className="grid gap-3 sm:grid-cols-3">
                        <input
                          className={input}
                          placeholder={t("fpo.ui.a0fb821bda")}
                          value={utilPurpose}
                          onChange={(e) => setUtilPurpose(e.target.value)}
                        />
                        <input
                          className={input}
                          placeholder={t("fpo.ui.4ecd3f6465")}
                          value={utilAmount}
                          onChange={(e) => setUtilAmount(e.target.value)}
                        />
                        <input
                          className={input}
                          placeholder={t("fpo.ui.1e65e5c7ee")}
                          value={voucher}
                          onChange={(e) => setVoucher(e.target.value)}
                        />
                        <Button
                          size="sm"
                          disabled={addUtilization.isPending || !utilPurpose || !utilAmount}
                          onClick={() => addUtilization.mutate({ grantId: g.id })}
                        >
                          {t("fpo.ui.cda8187e91")}</Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
          {data.grants.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("fpo.ui.5f71a16bb1")}</p>
          ) : null}
        </div>
      ) : null}

      {tab === "reconciliation" ? (
        <div className={card}>
          <h3 className="text-sm font-semibold text-foreground">{t("fpo.ui.e8c820e0ad")}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {data.summary.unreconciled} {t("fpo.ui.0c98fbfcfb")}{" "}
            {money(data.summary.unreconciledAmount)} {t("fpo.ui.5d185c06b8")}</p>
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
                {t("fpo.ui.a6632109c1")}</p>
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
  const [value, setValue] = useState("");
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-sm font-medium text-foreground">{description}</p>
      <p className="text-xs text-muted-foreground">{meta}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          className={`${input} sm:w-64`}
          placeholder={t("fpo.ui.1033343538")}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button
          size="sm"
          disabled={disabled || !value.trim()}
          onClick={() => onSubmit(value.trim())}
        >
          {t("fpo.ui.eaa3b366b0")}</Button>
      </div>
    </div>
  );
}
