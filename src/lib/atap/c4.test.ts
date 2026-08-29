import { describe, expect, it } from "vitest";
import {
  backoffMs,
  dueOps,
  enqueue,
  isSuperseded,
  locallyDeletedIds,
  markFailed,
  MAX_ATTEMPTS,
  MAX_QUEUE_SIZE,
  newOpId,
  optimisticSeasons,
  queueCounts,
  removeOps,
  syncSummary,
  type QueuedOp,
  type SeasonQueuePayload,
} from "@/lib/atap/offlineQueue";

const payload = (over: Partial<SeasonQueuePayload> = {}): SeasonQueuePayload => ({
  crop_year: 2025,
  season_code: "kharif",
  crop: "Chilli",
  area_acres: 3,
  input_costs: { seed: 4000 },
  ...over,
});

const op = (over: Partial<QueuedOp> = {}): QueuedOp => ({
  clientOpId: "op_1",
  kind: "season_upsert",
  payload: payload(),
  createdAt: "2026-08-29T10:00:00.000Z",
  updatedAt: "2026-08-29T10:00:00.000Z",
  attempts: 0,
  status: "pending",
  lastError: null,
  ...over,
});

describe("op ids", () => {
  it("are unique and namespaced", () => {
    const a = newOpId(() => "aaa");
    expect(a).toBe("op_aaa");
    expect(newOpId()).not.toBe(newOpId());
  });
});

describe("enqueue collapsing", () => {
  it("collapses repeat edits of the same draft into one operation", () => {
    const first = enqueue([], op());
    const second = enqueue(
      first,
      op({ payload: payload({ area_acres: 5 }), updatedAt: "2026-08-29T10:05:00.000Z" }),
    );
    expect(second).toHaveLength(1);
    expect((second[0]!.payload as SeasonQueuePayload).area_acres).toBe(5);
  });

  it("collapses edits that target the same already-synced server row", () => {
    const q = enqueue([], op({ clientOpId: "op_a", payload: payload({ id: "row-1" }) }));
    const next = enqueue(
      q,
      op({ clientOpId: "op_b", payload: payload({ id: "row-1", crop: "Paddy" }) }),
    );
    expect(next).toHaveLength(1);
    expect((next[0]!.payload as SeasonQueuePayload).crop).toBe("Paddy");
  });

  it("keeps separate drafts separate", () => {
    const q = enqueue(enqueue([], op()), op({ clientOpId: "op_2" }));
    expect(q).toHaveLength(2);
  });

  it("re-arms a blocked operation when the farmer edits it again", () => {
    const blocked = [op({ attempts: MAX_ATTEMPTS, status: "blocked", lastError: "boom" })];
    const next = enqueue(blocked, op({ payload: payload({ crop: "Cotton" }) }));
    expect(next[0]!.status).toBe("pending");
    expect(next[0]!.attempts).toBe(0);
    expect(next[0]!.lastError).toBeNull();
  });

  it("caps the device queue length", () => {
    let q: QueuedOp[] = [];
    for (let i = 0; i < MAX_QUEUE_SIZE + 10; i += 1) q = enqueue(q, op({ clientOpId: `op_${i}` }));
    expect(q).toHaveLength(MAX_QUEUE_SIZE);
    expect(q.at(-1)!.clientOpId).toBe(`op_${MAX_QUEUE_SIZE + 9}`);
  });
});

describe("failure handling and backoff", () => {
  it("grows the retry delay and caps it", () => {
    expect(backoffMs(1)).toBe(2000);
    expect(backoffMs(3)).toBe(8000);
    expect(backoffMs(20)).toBe(60000);
  });

  it("parks an operation after repeated failures instead of dropping data", () => {
    let q = [op()];
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) q = markFailed(q, "op_1", "network down");
    expect(q).toHaveLength(1);
    expect(q[0]!.status).toBe("blocked");
    expect(q[0]!.lastError).toBe("network down");
  });

  it("holds a failed operation back until its backoff has elapsed", () => {
    const failed = markFailed([op()], "op_1", "network down");
    const at = new Date(failed[0]!.updatedAt).getTime();
    expect(dueOps(failed, at + 500)).toHaveLength(0);
    expect(dueOps(failed, at + 2500)).toHaveLength(1);
  });

  it("never returns blocked operations as due", () => {
    expect(dueOps([op({ status: "blocked", attempts: MAX_ATTEMPTS })], Date.now())).toHaveLength(0);
  });

  it("attempts oldest capture first", () => {
    const q = [
      op({ clientOpId: "new", createdAt: "2026-08-29T12:00:00.000Z" }),
      op({ clientOpId: "old", createdAt: "2026-08-29T08:00:00.000Z" }),
    ];
    expect(dueOps(q, Date.now()).map((o) => o.clientOpId)).toEqual(["old", "new"]);
  });
});

describe("conflict rule", () => {
  const rows = [{ id: "row-1", updated_at: "2026-08-29T11:00:00.000Z" }];

  it("treats a newer server row as authoritative", () => {
    expect(isSuperseded(op({ payload: payload({ id: "row-1" }) }), rows)).toBe(true);
  });

  it("replays an edit made after the server row changed", () => {
    const later = op({ payload: payload({ id: "row-1" }), updatedAt: "2026-08-29T12:00:00.000Z" });
    expect(isSuperseded(later, rows)).toBe(false);
  });

  it("always replays a brand new offline entry", () => {
    expect(isSuperseded(op(), rows)).toBe(false);
  });
});

describe("device view", () => {
  it("counts pending and blocked separately", () => {
    const counts = queueCounts([op(), op({ clientOpId: "b", status: "blocked" })]);
    expect(counts).toEqual({ pending: 1, blocked: 1, total: 2 });
  });

  it("shows queued upserts newest year first and excludes deletes", () => {
    const list = optimisticSeasons([
      op({ clientOpId: "a", payload: payload({ crop_year: 2023 }) }),
      op({ clientOpId: "b", payload: payload({ crop_year: 2025 }) }),
      op({ clientOpId: "c", kind: "season_delete", payload: { id: "row-9" } }),
    ]);
    expect(list.map((l) => l.crop_year)).toEqual([2025, 2023]);
    expect(locallyDeletedIds([op({ kind: "season_delete", payload: { id: "row-9" } })])).toEqual([
      "row-9",
    ]);
  });

  it("removes operations by id after a successful send", () => {
    expect(removeOps([op(), op({ clientOpId: "b" })], ["op_1"]).map((o) => o.clientOpId)).toEqual([
      "b",
    ]);
  });

  it("explains state in farmer-facing language", () => {
    expect(syncSummary({ pending: 0, blocked: 0, total: 0 }, true)).toContain("saved to your account");
    expect(syncSummary({ pending: 2, blocked: 0, total: 2 }, false)).toContain("saved on this device");
    expect(syncSummary({ pending: 1, blocked: 1, total: 2 }, true)).toContain("need attention");
  });
});
