// Farmer QR codes. The QR holds only an opaque random code — no name, phone or
// land data. Scanning it lets an authorised FPO staff member add the farmer to
// the roster as "approval_pending"; it never grants consent or data access.
export const QR_PREFIX = "AGRIVAH-FARMER:";

export function newFarmerCode(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export function qrPayload(code: string): string {
  return `${QR_PREFIX}${code}`;
}

/** Accepts a scanned payload or a typed code; returns the bare code or null. */
export function parseFarmerQr(raw: string): string | null {
  const text = raw.trim().toUpperCase();
  const code = text.startsWith(QR_PREFIX) ? text.slice(QR_PREFIX.length) : text;
  return /^[0-9A-F]{24}$/.test(code) ? code : null;
}

export function formatCode(code: string): string {
  return code.match(/.{1,4}/g)?.join("-") ?? code;
}

export function nextQrMemberRef(existing: string[]): string {
  let max = 0;
  for (const ref of existing) {
    const m = /^QR-(\d+)$/.exec(ref);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `QR-${String(max + 1).padStart(4, "0")}`;
}
