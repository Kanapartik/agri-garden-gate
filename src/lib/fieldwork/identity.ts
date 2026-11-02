export type FieldworkRole = 'enumerator' | 'supervisor' | 'consultant' | 'liaison' | 'leadership';
export function normalizeFieldworkLogin(value: unknown): string | null {
 if (typeof value !== 'string') return null;
 let digits = value.trim().replace(/[\s()+-]/g, '');
 if (!/^\d+$/.test(digits)) return null;
 if (digits.length === 13 && digits.startsWith('234')) digits = digits.slice(3);
 if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
 return /^\d{10}$/.test(digits) ? digits : null;
}
export function validNewFieldworkPassword(value: unknown): value is string {
 return typeof value === 'string' && value.length >= 12 && value.length <= 72 && new TextEncoder().encode(value).byteLength <= 72 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /[0-9]/.test(value) && /[^A-Za-z0-9]/.test(value);
}
export function fieldworkStatus(error: string): number {
 if(error === 'unauthorized' || error === 'invalid_credentials') return 401;
 if(error === 'forbidden') return 403;
 if(error === 'conflict' || error === 'record_locked') return 409;
 if(error === 'password_change_required') return 428;
 if(error === 'try_later') return 429;
 if(['invalid_request','invalid_record','incomplete_record','invalid_location','password_requirements','review_note_required','invalid_action'].includes(error)) return 422;
 return 503;
}
