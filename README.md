# Farm Connect Hub

You are implementing AgriGhar ATAP, an onboarding-first, neutral agriculture aggregation platform. Treat the existing project as the source of current code state and this PRD as the product contract.

NON-NEGOTIABLES
1. API/authorization neutrality: equivalent first-party and third-party consumers at the same tier use the same access path and policy.
2. Farmer data access is default-deny and purpose-scoped. Paid entitlements never expand consent.
3. Technical tenancy does not imply government authority, support ownership, FPO membership authority, or blanket farmer-data access.
4. High-stakes bank/insurance/government decisions remain with the authorized human/partner role; do not auto-decide with AI.
5. Build configuration over forks: roles, onboarding steps, evidence requirements, geography, feature activation and policies are configurable.
6. Use synthetic data in development/sandbox. External KYC/identity, GIS, payment, government, bank, insurer and employment systems must be behind adapters.
7. Preserve existing working behavior. Use additive/backward-compatible schema changes where practical.
8. Enforce permissions server-side; UI route hiding is not security.
9. Every sensitive approval, consent, role/tenant grant, credential issue, suspension and data access must be auditable.
10. Do not activate later marketplace, advertising or talent domains unless the current slice explicitly requires them.

DELIVERY METHOD
- First inspect current routes, schema, authorization/RLS, server functions, migrations and tests.
- State the proposed change plan before modifying code.
- Implement one slice only.
- Add/update tests and synthetic fixtures.
- Report migrations, new routes/components, security implications, open [VALIDATE] items and acceptance-test results.
- Stop at the slice exit gate and wait for approval before proceeding.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://agri-garden-gate.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e7da6c45-71b4-4a2a-88b7-86be696c0c9d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Farmer mobile pilot contract

The frozen Siddipet/Raipole pilot decision, mobile API, and consent contract are
indexed in [`docs/mobile/README.md`](./docs/mobile/README.md). Native pilot
applications are available for
[`Android`](./mobile/android/) and [`iOS`](./mobile/ios/).
