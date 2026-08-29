/**
 * Slice C4 — offline-first field capture queue (pure logic, no browser APIs).
 *
 * Design rules:
 *  - Every queued operation carries a `clientOpId` minted on the device. That
 *    id is the server-side idempotency key, so a reconnect replay updates the
 *    same row instead of creating a duplicate.
 *  - The queue is append-and-collapse: editing the same draft twice while
 *    offline leaves exactly one pending operation.
 *  - Failures are retried with bounded exponential backoff and never silently
 *    dropped; after `MAX_ATTEMPTS` the operation is parked as `blocked` so the
 *    farmer can see and fix it rather than losing field data.
 *  - Conflict rule is last-write-wins by `updatedAt`, and a server row that is
 *    newer than the queued edit wins — the device never overwrites fresher
 *    server truth silently; the operation is reported as `superseded`.
 */

export type QueueKind = "season_upsert" | "season_delete";
export type QueueStatus = "pending" | "syncing" | "blocked";

export const MAX_ATTEMPTS = 5;
export const MAX_QUEUE_SIZE = 200;

export interface SeasonQueuePayload {
  /** Server row id when this operation edits an already-synced record. */
  id?: string | null;
  farm_id?: string | null;
  crop_year: number;
  season_code: string;
  crop: string;
  area_acres: number;
  input_costs?: Record<string, number>;
  yield_quintal?: number | null;
  price_per_quintal?: number | null;
  revenue_inr?: number | null;
  notes?: string | null;
}

export interface QueuedOp {
  clientOpId: string;
  kind: QueueKind;
  payload: SeasonQueuePayload | { id: string };
  createdAt: string;
  updatedAt: string;
  attempts: number;
  status: QueueStatus;
  lastError?: string | null;
}

export function newOpId(seed?: () => string): string {
  if (seed) return `op_${seed()}`;
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `op_${crypto.randomUUID()}`;
  return `op_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Retry delay in ms for the next attempt: 2s, 4s, 8s, 16s, capped at 60s. */
export function backoffMs(attempts: number): number {
  const raw = 2000 * 2 ** Math.max(0, attempts - 1);
  return Math.min(raw, 60000);
}

/**
 * Insert or collapse an operation. Two operations collapse when they target
 * the same record: same `clientOpId`, or the same already-synced server row.
 */
export function enqueue(queue: readonly QueuedOp[], op: QueuedOp): QueuedOp[] {
  const next = queue.slice();
  const targetId = "id" in op.payload ? (op.payload.id ?? null) : null;
  const index = next.findIndex(
    (q) =>
      q.clientOpId === op.clientOpId ||
      (q.kind === op.kind &&
        targetId !== null &&
        "id" in q.payload &&
        (q.payload.id ?? null) === targetId),
  );

  if (index >= 0) {
    const existing = next[index]!;
    next[index] = {
      ...existing,
      kind: op.kind,
      payload: op.payload,
      updatedAt: op.updatedAt,
      // A fresh edit clears a blocked/failed state so it is retried.
      attempts: 0,
      status: "pending",
      lastError: null,
    };
    return next;
  }

  next.push(op);
  // Oldest entries are dropped only when the device queue is pathologically
  // long; never silently for normal field use.
  return next.length > MAX_QUEUE_SIZE ? next.slice(next.length - MAX_QUEUE_SIZE) : next;
}

export function removeOps(queue: readonly QueuedOp[], clientOpIds: readonly string[]): QueuedOp[] {
  return queue.filter((q) => !clientOpIds.includes(q.clientOpId));
}

export function markFailed(
  queue: readonly QueuedOp[],
  clientOpId: string,
  message: string,
): QueuedOp[] {
  return queue.map((q) => {
    if (q.clientOpId !== clientOpId) return q;
    const attempts = q.attempts + 1;
    return {
      ...q,
      attempts,
      status: attempts >= MAX_ATTEMPTS ? "blocked" : "pending",
      lastError: message.slice(0, 300),
    };
  });
}

/** Operations that may be attempted now, oldest first. */
export function dueOps(queue: readonly QueuedOp[], now: number): QueuedOp[] {
  return queue
    .filter((q) => q.status === "pending")
    .filter((q) => {
      if (q.attempts === 0) return true;
      return now - new Date(q.updatedAt).getTime() >= backoffMs(q.attempts);
    })
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export interface QueueCounts {
  pending: number;
  blocked: number;
  total: number;
}

export function queueCounts(queue: readonly QueuedOp[]): QueueCounts {
  return {
    pending: queue.filter((q) => q.status !== "blocked").length,
    blocked: queue.filter((q) => q.status === "blocked").length,
    total: queue.length,
  };
}

/**
 * Conflict rule: if the server copy of the same row changed after the queued
 * edit was made, the server wins and the queued edit is reported as
 * superseded rather than replayed over fresher truth.
 */
export function isSuperseded(
  op: QueuedOp,
  serverRows: ReadonlyArray<{ id: string; updated_at?: string | null }>,
): boolean {
  const rowId = "id" in op.payload ? (op.payload.id ?? null) : null;
  if (!rowId) return false;
  const row = serverRows.find((r) => r.id === rowId);
  if (!row?.updated_at) return false;
  return new Date(row.updated_at).getTime() > new Date(op.updatedAt).getTime();
}

export interface OptimisticSeason {
  key: string;
  clientOpId: string;
  pending: true;
  blocked: boolean;
  lastError: string | null;
  crop_year: number;
  season_code: string;
  crop: string;
  area_acres: number;
}

/**
 * Rows to show the farmer for work captured offline and not yet accepted by
 * the server. Deletes are excluded (they show as removed optimistically).
 */
export function optimisticSeasons(queue: readonly QueuedOp[]): OptimisticSeason[] {
  return queue
    .filter((q) => q.kind === "season_upsert")
    .map((q) => {
      const p = q.payload as SeasonQueuePayload;
      return {
        key: q.clientOpId,
        clientOpId: q.clientOpId,
        pending: true as const,
        blocked: q.status === "blocked",
        lastError: q.lastError ?? null,
        crop_year: p.crop_year,
        season_code: p.season_code,
        crop: p.crop,
        area_acres: p.area_acres,
      };
    })
    .sort((a, b) => b.crop_year - a.crop_year);
}

/** Server row ids that a queued delete has already removed on the device. */
export function locallyDeletedIds(queue: readonly QueuedOp[]): string[] {
  return queue
    .filter((q) => q.kind === "season_delete")
    .map((q) => (q.payload as { id: string }).id);
}

export function syncSummary(counts: QueueCounts, online: boolean): string {
  if (counts.total === 0) {
    return online ? "All field entries are saved to your account" : "Offline — nothing waiting";
  }
  if (counts.blocked > 0) {
    return `${counts.blocked} entr${counts.blocked === 1 ? "y" : "ies"} need attention before they can be saved`;
  }
  return online
    ? `Saving ${counts.pending} field entr${counts.pending === 1 ? "y" : "ies"}`
    : `${counts.pending} field entr${counts.pending === 1 ? "y" : "ies"} saved on this device, will sync when you are back online`;
}
