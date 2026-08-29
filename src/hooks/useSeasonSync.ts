/**
 * Slice C4 — offline capture sync loop for farmer season records.
 *
 * Responsibilities:
 *  - hold the device queue (persisted in localStorage) in React state;
 *  - report connectivity and pending/blocked counts to the UI;
 *  - flush due operations when online, on reconnect, and on an interval;
 *  - never replay an operation the server has since changed (last-write-wins
 *    by timestamp, server side newer wins).
 *
 * The server functions themselves stay the single authority: this hook only
 * decides when to call them, and every call carries the device `clientOpId`
 * so a replay is idempotent.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  dueOps,
  enqueue,
  isSuperseded,
  locallyDeletedIds,
  markFailed,
  newOpId,
  optimisticSeasons,
  queueCounts,
  removeOps,
  syncSummary,
  type QueuedOp,
  type SeasonQueuePayload,
} from "@/lib/atap/offlineQueue";
import { readQueue, writeQueue } from "@/lib/atap/offlineStore";

const FLUSH_INTERVAL_MS = 15000;

export interface SeasonSyncHandlers {
  upsert: (payload: SeasonQueuePayload & { client_op_id: string }) => Promise<unknown>;
  remove: (input: { id: string }) => Promise<unknown>;
  onFlushed: () => Promise<unknown> | unknown;
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setOnline(window.navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}

export function useSeasonSync(
  userId: string | null,
  handlers: SeasonSyncHandlers,
  serverRows: ReadonlyArray<{ id: string; updated_at?: string | null }>,
) {
  const online = useOnlineStatus();
  const [queue, setQueue] = useState<QueuedOp[]>([]);
  const [flushing, setFlushing] = useState(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const rowsRef = useRef(serverRows);
  rowsRef.current = serverRows;

  useEffect(() => {
    if (!userId) return;
    setQueue(readQueue(userId));
  }, [userId]);

  const persist = useCallback(
    (next: QueuedOp[]) => {
      if (userId) writeQueue(userId, next);
      setQueue(next);
      return next;
    },
    [userId],
  );

  const queueSeason = useCallback(
    (payload: SeasonQueuePayload, clientOpId?: string) => {
      const now = new Date().toISOString();
      const op: QueuedOp = {
        clientOpId: clientOpId ?? newOpId(),
        kind: "season_upsert",
        payload,
        createdAt: now,
        updatedAt: now,
        attempts: 0,
        status: "pending",
        lastError: null,
      };
      persist(enqueue(readQueue(userId ?? ""), op));
      return op.clientOpId;
    },
    [persist, userId],
  );

  const queueDelete = useCallback(
    (id: string) => {
      const now = new Date().toISOString();
      const op: QueuedOp = {
        clientOpId: newOpId(),
        kind: "season_delete",
        payload: { id },
        createdAt: now,
        updatedAt: now,
        attempts: 0,
        status: "pending",
        lastError: null,
      };
      persist(enqueue(readQueue(userId ?? ""), op));
    },
    [persist, userId],
  );

  const discard = useCallback(
    (clientOpId: string) => {
      persist(removeOps(readQueue(userId ?? ""), [clientOpId]));
    },
    [persist, userId],
  );

  const flush = useCallback(async () => {
    if (!userId || !online || flushing) return;
    const current = readQueue(userId);
    const due = dueOps(current, Date.now());
    if (due.length === 0) return;

    setFlushing(true);
    let working = current;
    let anySucceeded = false;

    for (const op of due) {
      if (isSuperseded(op, rowsRef.current)) {
        // Server truth is newer; drop the stale device edit rather than
        // overwrite it.
        working = removeOps(working, [op.clientOpId]);
        continue;
      }
      try {
        if (op.kind === "season_delete") {
          await handlersRef.current.remove({ data: (op.payload as { id: string }) } as never);
        } else {
          await handlersRef.current.upsert({
            ...(op.payload as SeasonQueuePayload),
            client_op_id: op.clientOpId,
          });
        }
        working = removeOps(working, [op.clientOpId]);
        anySucceeded = true;
      } catch (error) {
        working = markFailed(
          working,
          op.clientOpId,
          error instanceof Error ? error.message : "Could not reach the server",
        );
      }
      persist(working);
    }

    setFlushing(false);
    if (anySucceeded) await handlersRef.current.onFlushed();
  }, [flushing, online, persist, userId]);

  // Flush on reconnect and on a slow interval while pending work remains.
  useEffect(() => {
    if (!online) return;
    void flush();
    const timer = window.setInterval(() => void flush(), FLUSH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [flush, online, queue.length]);

  const counts = useMemo(() => queueCounts(queue), [queue]);

  return {
    online,
    flushing,
    queue,
    counts,
    summary: syncSummary(counts, online),
    optimistic: useMemo(() => optimisticSeasons(queue), [queue]),
    deletedIds: useMemo(() => locallyDeletedIds(queue), [queue]),
    queueSeason,
    queueDelete,
    discard,
    flush,
  };
}
