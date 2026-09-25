# Slice F14 — Consent-gated farmer monitoring notes + AI issue summary

## What FPO operators get
A new **Field monitoring** tab in the FPO workspace:
- Pick a member farmer. Notes can only be written/read if that farmer has an active consent for **Membership & farm planning** (`fpo_member_management`). Without it, the tab shows "Consent required" and nothing else.
- Add a monitoring note: date observed, crop, category (pest, disease, water, soil, weather, input, market, other), severity (low/medium/high), free-text observation.
- Note history per farmer, newest first.
- **Summarize with AI** button: produces a short summary of emerging issues across that farmer's recent notes (last 90 days), plus 3–5 suggested follow-up questions for the next field visit. Streams into the panel.
- Every AI output is labelled "Advisory draft — not a decision". The operator can **Save** it as a reviewed summary (records who reviewed) or discard it. No AI output changes any status, application, claim or payment.

## Authority rules (server-side)
- Write notes: tenant_admin, onboarding_officer, field_agent of that FPO. Read: those plus viewer/auditor. Platform admin inherits.
- Every read, write and AI run re-checks active consent in the handler; revoked consent immediately blocks access (existing notes stay stored but hidden).
- Only the notes text, crop, category, severity and dates go to the model — no name, phone, bank, insurance or parcel coordinates. The farmer is referred to by member reference only.
- Audit events: `fpo.monitoring.note.create`, `fpo.monitoring.read`, `fpo.monitoring.ai_summary` (with note count, model, no content), `fpo.monitoring.summary.save`.
- AI failures (rate limit, credits, refusal) are shown plainly; no auto-retry loops.

## Technical details
- Migration (additive): `fpo_monitoring_notes` (tenant_id, member_id, farmer_user_id, author_id, observed_on, crop, category, severity, body, is_synthetic) and `fpo_monitoring_summaries` (tenant_id, member_id, summary, questions jsonb, model, note_ids uuid[], reviewed_by, reviewed_at). GRANTs to authenticated/service_role, RLS: tenant role + active consent via a security-definer `fpo_has_member_consent(member_id, purpose)` helper.
- `src/lib/atap/fpoMonitoring.ts` — pure: categories, role gates, note → redacted prompt payload builder, output clamping.
- `src/lib/atap/fpoMonitoring.functions.ts` — `listMonitoring`, `createNote`, `saveSummary` (createServerFn + requireSupabaseAuth).
- `src/routes/api/fpo-monitoring-summary.ts` — authenticated streaming route (bearer checked, consent re-checked) using AI SDK `streamText` via Lovable AI Gateway Responses API, model `openai/gpt-6-astra`, reasoning `low`, `store:false`; structured result (summary + questions) parsed with fallback.
- `src/components/atap/fpo/FpoMonitoringSection.tsx`; add `monitoring` section (phase 14) to `fpo.ts`, i18n label, render in `fpo.tsx`.
- Synthetic seed: ~6 notes for the demo farmer in Guntur Chilli Growers FPO.
- Tests: role gates, consent gate, redaction (no PII in prompt payload), output clamping. One live gateway call verified.

## Open [VALIDATE]
- Is `fpo_member_management` the right consent purpose, or should monitoring get its own new purpose (would require farmers to re-consent)?

Stops at the slice exit gate after delivery.
