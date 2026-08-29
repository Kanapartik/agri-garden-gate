# Public Website Refresh — Agrivah Landing (Slice W1)

## What you uploaded

A standalone static site (`index.html`, `style.css`, `base.css`, `app.js`, three WebP images) presenting Agrivah as neutral shared rails for agriculture: pain points, stakeholder value tabs, five-layer solution stack, integration fabric, advantages, execution proofs, evidence-led roadmap, 90-day engagement, team credentials, closing call to action, light/dark toggle and scroll reveals.

## Review of it

Strong: the narrative order is genuinely persuasive, the neutrality/roadmap disclaimers are well judged, and the copy is specific rather than generic AI marketing text.

Weak points to fix in the better version:
- It is a separate static page, disconnected from the live app — no route into sign-in, role journeys, or the working dashboards you already built.
- Its own fonts, colours, theme toggle and reveal script duplicate what the app already has (Sora/Manrope, design tokens, existing shell), so it would drift from the product.
- Stakeholder value is hidden behind a tab that shows one panel at a time; a visitor scanning the page sees only the farmer case.
- No route-level SEO for the sub-stories, no structured data, and no proof of the product actually existing (screens, live capability list).
- Team section is a wall of long paragraphs; credentials get lost.

## The better version

Rebuild the Agrivah story natively inside the app as the public marketing surface, using the project's own design tokens and components — nothing hardcoded, no second stylesheet.

Pages (public, no login required):
1. `/` — new landing: hero, thesis strip, pain points, stakeholder value (all six shown as a scannable grid, not one tab panel), five-layer platform stack, integration fabric, advantages, execution proofs + North Star, evidence-led roadmap, 90-day engagement block, closing CTA.
2. `/platform` — deeper page for the solution layers, integration adapters and neutrality guarantees (expanded from `/architecture` content, keeping that route working).
3. `/team` — the team and ability-to-deliver page, restructured as credential cards with a headline experience strip so names and expertise scan quickly.

Everything else stays untouched: `/auth`, all `_authenticated` routes, server functions, database, RLS.

Content upgrades over the upload:
- Real product proof section listing what already runs today (farmer 5-year history and command centre, FPO operations workspace, insurance command centre, offline field capture, official MSP/PMFBY reference data), each linking into the app for signed-in users.
- Primary calls to action point to sign-in and role journeys instead of dead in-page anchors.
- Keep the neutrality and "not an official DPI operator" disclaimers verbatim in substance.
- Stakeholder cards call out where authority stays with the institution, matching the platform's non-negotiables.

Design direction: the app's existing Sora/Manrope typography and deep-surface/accent tokens, dark editorial hero, generous whitespace, thin rules and numbered layers. No new palette, no purple gradients, no theme toggle duplication.

## Technical notes

- Images: the three WebP files registered as Lovable Asset pointers and imported; no binaries committed into the repo.
- New route files `src/routes/platform.tsx` and `src/routes/team.tsx`; rewrite of `src/routes/index.tsx`. Shared marketing sections extracted into `src/components/marketing/*` so the three pages compose from one set of primitives.
- Each route gets its own `head()` with unique title, description, `og:title`, `og:description`, `og:type`, `twitter:card`, plus `og:image`/`twitter:image` from the hosted hero asset URL.
- Reveal-on-scroll handled by a small CSS-only or IntersectionObserver hook honouring `prefers-reduced-motion`; no extra dependency.
- Public header/footer navigation added for signed-out visitors in the existing shell, leaving the authenticated navigation exactly as it is.
- Organization JSON-LD on the landing page.
- No migration, no schema change, no policy change in this slice.

## Verification

Typecheck, existing test suite (must stay green), and a browser pass over `/`, `/platform`, `/team` at mobile and desktop widths checking headings, contrast and that sign-in links resolve.
