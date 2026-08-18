/**
 * Offline-first parcel draft queue (browser only).
 *
 * Field capture must survive connectivity loss, so drafts live in
 * localStorage keyed by a stable `clientDraftId`. That id is the server-side
 * idempotency key, which is what stops a reconnect replay from creating a
 * duplicate farm record.
 */
import type { LocalFarmDraft } from "@/lib/atap/farmer";

const KEY_PREFIX = "atap.farm.drafts.";

function storageKey(subjectUserId: string) {
  return `${KEY_PREFIX}${subjectUserId}`;
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function newDraftId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `draft_${crypto.randomUUID()}`;
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function readDrafts(subjectUserId: string): LocalFarmDraft[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(storageKey(subjectUserId));
    const parsed = raw ? (JSON.parse(raw) as LocalFarmDraft[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeDrafts(subjectUserId: string, drafts: LocalFarmDraft[]): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(storageKey(subjectUserId), JSON.stringify(drafts));
}

/** Upsert by clientDraftId so repeated edits never fan out into new drafts. */
export function upsertDraft(subjectUserId: string, draft: LocalFarmDraft): LocalFarmDraft[] {
  const drafts = readDrafts(subjectUserId);
  const index = drafts.findIndex((d) => d.clientDraftId === draft.clientDraftId);
  if (index >= 0) drafts[index] = draft;
  else drafts.push(draft);
  writeDrafts(subjectUserId, drafts);
  return drafts;
}

export function removeDrafts(subjectUserId: string, clientDraftIds: readonly string[]): LocalFarmDraft[] {
  const keep = readDrafts(subjectUserId).filter((d) => !clientDraftIds.includes(d.clientDraftId));
  writeDrafts(subjectUserId, keep);
  return keep;
}
