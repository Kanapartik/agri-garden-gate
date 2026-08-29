/**
 * Browser-only persistence for the slice C4 offline capture queue.
 *
 * localStorage is used deliberately: the payloads are small structured rows,
 * the store must be readable synchronously during first render, and the queue
 * has to survive a hard reload on a low-end field device. All logic lives in
 * `offlineQueue.ts`; this module only reads and writes.
 */
import type { QueuedOp } from "@/lib/atap/offlineQueue";

const KEY_PREFIX = "atap.season.queue.";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function storageKey(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

export function readQueue(userId: string): QueuedOp[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    const parsed = raw ? (JSON.parse(raw) as QueuedOp[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeQueue(userId: string, queue: readonly QueuedOp[]): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(queue));
  } catch {
    // Storage full or blocked: keep the in-memory queue so the current session
    // can still sync; nothing to escalate to the farmer here.
  }
}

export function clearQueue(userId: string): void {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(storageKey(userId));
}
