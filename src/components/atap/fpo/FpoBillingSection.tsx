import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  actOnVoucher,
  createVoucher,
  getBillingBoard,
  settleVoucher,
  type VoucherRow,
} from "@/lib/atap/fpoBilling.functions";
import {
  availableActions,
  VOUCHER_ACTION_LABEL,
  VOUCHER_STAGE_HINT,
  VOUCHER_STAGE_LABEL,
  VOUCHER_STAGES,
  type VoucherAction,
  type VoucherStage,
} from "@/lib/atap/fpoBilling";
import {
  LEDGER_CATEGORIES,
  LEDGER_CATEGORY_LABEL,
  PAYMENT_STATE_LABEL,
  type LedgerCategory,
  type LedgerDirection,
} from "@/lib/atap/fpoAccounts";

const input =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";
const card = "rounded-lg border border-border bg-card p-4";

function money(value: number): string {
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

function when(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const STAGE_TONE: Record<VoucherStage, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_check: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  checked: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  returned: "bg-destructive/15 text-destructive",
};

function StageChip({ stage }: { stage: VoucherStage }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STAGE_TONE[stage]}`}
      title={VOUCHER_STAGE_HINT[stage]}
    >
      {VOUCHER_STAGE_LABEL[stage]}
    </span>
  );
}

function printVoucher(v: VoucherRow, orgLabel: string) {
  const rows: Array<[string, string]> = [
    ["Voucher no.", v.voucher_number ?? "—"],
    ["Type", v.direction === "inflow" ? "Collection / receipt" : "Payment / expense"],
    ["Category", LEDGER_CATEGORY_LABEL[v.category]],
    ["Date", when(v.entry_date)],
    ["Particulars", v.description],
    ["Party / member", v.member_name ?? v.party_name ?? "—"],
    ["Amount", money(v.amount)],
    ["Settled", money(v.amount_settled)],
    ["Outstanding", money(v.outstanding)],
    ["Reference", v.reference ?? "—"],
    ["Prepared by", `${v.maker_name ?? "—"} (${when(v.maker_at)})`],
    ["Verified by", `${v.checker_name ?? "—"} (${when(v.checker_at)})`],
    ["Approved by", `${v.approver_name ?? "—"} (${when(v.approver_at)})`],
    ["Stage", VOUCHER_STAGE_LABEL[v.workflow_stage]],
  ];
  const html = `<!doctype html><html><head><title>${v.voucher_number ?? "Voucher"}</title>
<style>
body{font-family:ui-sans-serif,system-ui,sans-serif;margin:32px;color:#1c1917}
h1{font-size:18px;margin:0 0 4px}
p.sub{margin:0 0 20px;color:#57534e;font-size:12px}
table{border-collapse:collapse;width:100%;font-size:13px}
th,td{border:1px solid #d6d3d1;padding:8px 10px;text-align:left;vertical-align:top}
th{width:34%;background:#f5f5f4;font-weight:600}
.sign{margin-top:48px;display:flex;justify-content:space-between;font-size:12px;color:#57534e}
.sign div{border-top:1px solid #a8a29e;padding-top:6px;width:28%;text-align:center}
</style></head><body>
<h1>${orgLabel}</h1><p class="sub">Billing &amp; collections voucher — internal control record, not a statutory book entry.</p>
<table>${rows.map(([k, val]) => `<tr><th>${k}</th><td>${String(val)}</td></tr>`).join("")}</table>
<div class="sign"><div>Maker</div><div>Checker</div><div>Approver</div></div>
</body></html>`;
  const w = window.open("", "_blank", "width=820,height=900");
  if (!w) {
    toast.error("Allow pop-ups to print this voucher");
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}

export function FpoBillingSection({
  tenantId,
  orgLabel = "Farmer Producer Organization",
}: {
  tenantId: string;
  orgLabel?: string;
}) {
  const qc = useQueryClient();
  const boardFn = useServerFn(getBillingBoard);
  const createFn = useServerFn(createVoucher);
  const actFn = useServerFn(actOnVoucher);
  const settleFn = useServerFn(settleVoucher);

  const [lane, setLane] = useState<VoucherStage | "all">("pending_check");
  const [direction, setDirection] = useState<LedgerDirection>("inflow");
  const [category, setCategory] = useState<LedgerCategory>("membership_fee");
  const [description, setDescription] = useState("");
  const [party, setParty] = useState("");
  const [memberId, setMemberId] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [remarksFor, setRemarksFor] = useState<string | null>(null);
  const [remarks, setRemarks] = useState("");
  const [settleFor, setSettleFor] = useState<string | null>(null);
  const [settleAmount, setSettleAmount] = useState("");
  const [settleRef, setSettleRef] = useState("");

  const board = useQuery({
    queryKey: ["fpo-billing-board", tenantId],
    queryFn: () => boardFn({ data: { tenantId } }),
    enabled: Boolean(tenantId),
  });

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["fpo-billing-board", tenantId] });
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

  const create = useAction(
    (i: { submit: boolean }) =>
      createFn({
        data: {
          tenantId,
          direction,
          category,
          description,
          partyName: party || null,
          memberId: memberId || null,
          amount: Number(amount || 0),
          dueDate: dueDate || null,
          reference: reference || null,
          note: note || null,
          submit: i.submit,
        },
      }),
    "Voucher prepared",
  );
  const act = useAction(
    (i: { voucherId: string; action: VoucherAction; reason?: string | null }) =>
      actFn({ data: { tenantId, ...i } }),
    "Voucher updated",
  );
  const settle = useAction(
    (i: { voucherId: string; amountSettled: number; bankReference?: string | null }) =>
      settleFn({ data: { tenantId, ...i } }),
    "Settlement recorded",
  );

  const data = board.data;
  const vouchers = data?.vouchers ?? [];

  const visible = useMemo(
    () => (lane === "all" ? vouchers : vouchers.filter((v) => v.workflow_stage === lane)),
    [vouchers, lane],
  );

  const selectedMember = data?.members.find((m) => m.id === memberId) ?? null;

  const resetForm = () => {
    setDescription("");
    setParty("");
    setMemberId("");
    setAmount("");
    setDueDate("");
    setReference("");
    setNote("");
  };

  if (board.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading billing &amp; collections…</p>;
  }
  if (board.error) {
    return <p className="text-sm text-destructive">{(board.error as Error).message}</p>;
  }
  if (!data) return null;

  const s = data.summary;

  return (
    <div className="space-y-6">
      <div className={`${card} space-y-2`}>
        <h3 className="text-base font-semibold text-foreground">Billing &amp; collections</h3>
        <p className="text-sm text-muted-foreground">
          One place for member collections and operating expenses, with a maker, checker and approver step on every voucher.{" "}{data.disclaimer}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Awaiting verification", value: s.awaitingCheck, hint: "Checker action due" },
          { label: "Awaiting approval", value: s.awaitingApproval, hint: "Approver action due" },
          { label: "Returned for correction", value: s.returned, hint: "Back with the maker" },
          {
            label: "Approved, not settled",
            value: s.approvedUnsettled,
            hint: money(s.approvedUnsettledAmount),
          },
        ].map((kpi) => (
          <div key={kpi.label} className={card}>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{kpi.value}</p>
            <p className="text-xs text-muted-foreground">{kpi.hint}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["all", ...VOUCHER_STAGES] as Array<VoucherStage | "all">).map((key) => {
          const count =
            key === "all"
              ? vouchers.length
              : (s.lanes.find((l) => l.stage === key)?.count ?? 0);
          return (
            <button
              key={key}
              type="button"
              onClick={() => setLane(key)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                lane === key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {key === "all" ? "All vouchers" : VOUCHER_STAGE_LABEL[key]} ({count})
            </button>
          );
        })}
        <div className="ml-auto">
          {data.canMake ? (
            <Button size="sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Close" : "New voucher"}
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">
              Your role can view vouchers but not prepare them.</span>
          )}
        </div>
      </div>

      {showForm && data.canMake ? (
        <div className={`${card} space-y-4`}>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["inflow", "Collection / receipt"],
                ["outflow", "Payment / expense"],
              ] as Array<[LedgerDirection, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setDirection(key);
                  setCategory(key === "inflow" ? "membership_fee" : "expense");
                }}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  direction === key
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Category</span>
              <select
                className={input}
                value={category}
                onChange={(e) => setCategory(e.target.value as LedgerCategory)}
              >
                {LEDGER_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {LEDGER_CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Amount (₹)</span>
              <input
                className={input}
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span className="text-muted-foreground">Particulars</span>
              <input
                className={input}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this collection or expense for?'
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Member (optional)</span>
              <select
                className={input}
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
              >
                <option value="">Not member-linked</option>
                {data.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name}
                    {m.village ? ` · ${m.village}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Other party (optional)</span>
              <input className={input} value={party} onChange={(e) => setParty(e.target.value)} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Due date</span>
              <input
                className={input}
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Bill / receipt reference</span>
              <input
                className={input}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span className="text-muted-foreground">Note for the checker</span>
              <input className={input} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          </div>

          {selectedMember ? (
            <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              {selectedMember.display_name} currently owes the FPO{" "}
              <strong className="text-foreground">{money(selectedMember.owesFpo)}</strong> and is owed{" "}<strong className="text-foreground">{money(selectedMember.fpoOwes)}</strong> on approved vouchers.</p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={create.isPending}
              onClick={() =>
                create.mutate(
                  { submit: true },
                  {
                    onSuccess: () => {
                      resetForm();
                      setLane("pending_check");
                    },
                  },
                )
              }
            >
              Save &amp; send for verification</Button>
            <Button
              size="sm"
              variant="outline"
              disabled={create.isPending}
              onClick={() =>
                create.mutate(
                  { submit: false },
                  {
                    onSuccess: () => {
                      resetForm();
                      setLane("draft");
                    },
                  },
                )
              }
            >
              Save as draft</Button>
          </div>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <p className={`${card} text-sm text-muted-foreground`}>
          Nothing in this stage right now.</p>
      ) : (
        <div className="space-y-3">
          {visible.map((v) => {
            const actions = availableActions(v, data.roles, data.actorUserId);
            return (
              <div key={v.id} className={`${card} space-y-3`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {v.voucher_number ?? "—"}
                      </span>
                      <StageChip stage={v.workflow_stage} />
                      {v.overdue ? (
                        <span className="rounded-full bg-destructive/15 px-2.5 py-0.5 text-xs font-medium text-destructive">
                          Overdue</span>
                      ) : null}
                    </div>
                    <p className="mt-1 font-medium text-foreground">{v.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.direction === "inflow" ? "Collection" : "Expense"} ·{" "}
                      {LEDGER_CATEGORY_LABEL[v.category]} · {when(v.entry_date)}
                      {v.member_name ? ` · ${v.member_name}` : ""}
                      {v.party_name ? ` · ${v.party_name}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-foreground">{money(v.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {PAYMENT_STATE_LABEL[v.payment_state]} · open{" "}{money(v.outstanding)}
                    </p>
                  </div>
                </div>

                <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                  <p>
                    Prepared:{" "}<span className="text-foreground">{v.maker_name ?? "—"}</span>{" "}
                    {when(v.maker_at)}
                  </p>
                  <p>
                    Verified:{" "}<span className="text-foreground">{v.checker_name ?? "—"}</span>{" "}
                    {when(v.checker_at)}
                  </p>
                  <p>
                    Approved:{" "}<span className="text-foreground">{v.approver_name ?? "—"}</span>{" "}
                    {when(v.approver_at)}
                  </p>
                </div>

                {v.returned_reason ? (
                  <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                    Returned:{" "}{v.returned_reason}
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  {actions
                    .filter((a) => a !== "return")
                    .map((a) => (
                      <Button
                        key={a}
                        size="sm"
                        variant={a === "approve" ? "default" : "outline"}
                        disabled={act.isPending}
                        onClick={() => act.mutate({ voucherId: v.id, action: a })}
                      >
                        {VOUCHER_ACTION_LABEL[a]}
                      </Button>
                    ))}
                  {actions.includes("return") ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setRemarksFor(remarksFor === v.id ? null : v.id);
                        setRemarks("");
                      }}
                    >
                      Return for correction</Button>
                  ) : null}
                  {v.workflow_stage === "approved" && v.outstanding > 0 && data.canApprove ? (
                    <Button
                      size="sm"
                      onClick={() => {
                        setSettleFor(settleFor === v.id ? null : v.id);
                        setSettleAmount(String(v.amount));
                        setSettleRef("");
                      }}
                    >
                      Record settlement</Button>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={() => printVoucher(v, orgLabel)}>
                    Print voucher</Button>
                </div>

                {remarksFor === v.id ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="min-w-[240px] flex-1 space-y-1 text-sm">
                      <span className="text-muted-foreground">Remarks for the maker</span>
                      <input
                        className={input}
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="What needs correcting?'
                      />
                    </label>
                    <Button
                      size="sm"
                      disabled={act.isPending}
                      onClick={() =>
                        act.mutate(
                          { voucherId: v.id, action: "return", reason: remarks },
                          { onSuccess: () => setRemarksFor(null) },
                        )
                      }
                    >
                      Return</Button>
                  </div>
                ) : null}

                {settleFor === v.id ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="space-y-1 text-sm">
                      <span className="text-muted-foreground">Amount settled (₹)</span>
                      <input
                        className={input}
                        type="number"
                        min="0"
                        value={settleAmount}
                        onChange={(e) => setSettleAmount(e.target.value)}
                      />
                    </label>
                    <label className="min-w-[200px] flex-1 space-y-1 text-sm">
                      <span className="text-muted-foreground">Bank / UTR reference</span>
                      <input
                        className={input}
                        value={settleRef}
                        onChange={(e) => setSettleRef(e.target.value)}
                      />
                    </label>
                    <Button
                      size="sm"
                      disabled={settle.isPending}
                      onClick={() =>
                        settle.mutate(
                          {
                            voucherId: v.id,
                            amountSettled: Number(settleAmount || 0),
                            bankReference: settleRef || null,
                          },
                          { onSuccess: () => setSettleFor(null) },
                        )
                      }
                    >
                      Save settlement</Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
