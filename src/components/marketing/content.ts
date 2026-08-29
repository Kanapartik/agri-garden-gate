/**
 * Public website copy (Slice W1). Kept as data so the three marketing routes
 * compose from one source and translations/edits stay in a single place.
 */

export const PAIN_POINTS = [
  {
    title: "Farmers repeat the same journey",
    body: "Identity, farm and crop information is collected again for every scheme, lender, insurer, buyer or service provider.",
  },
  {
    title: "Data is fragmented",
    body: "Farm records sit across disconnected systems, formats and institutions, making verification and reuse difficult.",
  },
  {
    title: "Partners integrate one by one",
    body: "Custom connections increase cost, delay delivery and make every district or program feel like a new build.",
  },
  {
    title: "Trust is unclear",
    body: "Farmers cannot always see who uses their data, for what purpose, or how to withdraw access.",
  },
  {
    title: "Programs stop at enrollment",
    body: "Registrations and MOUs may grow while completed value actions, adoption and field outcomes remain unproven.",
  },
] as const;

export const STAKEHOLDERS = [
  {
    audience: "Farmers",
    title: "One trusted farm record. More useful paths forward.",
    body: "Reduce repeated data entry, control consent, keep a traceable farm history, and reach schemes, markets, finance and insurance through connected services.",
    authority: "The farmer decides what is shared, with whom and for how long.",
  },
  {
    audience: "FPOs",
    title: "Stronger member operations without replacing local relationships.",
    body: "Assisted onboarding, delegated administration, collective procurement and market access, with the FPO's own membership model intact.",
    authority: "Membership and representation authority stays with the FPO.",
  },
  {
    audience: "Government",
    title: "Configurable scheme delivery with evidence at every step.",
    body: "Beneficiary verification, governed data exchange, human-reviewed workflows, audit trails and aggregate program insight.",
    authority: "Statutory authority and eligibility rulings stay with the department.",
  },
  {
    audience: "Banks & insurers",
    title: "Consented signals and connected workflows, with decisions retained.",
    body: "Integrate farm evidence and workflow support while keeping origination, underwriting and claims processes in your own systems of record.",
    authority: "Underwriting and claims decisions stay with the institution.",
  },
  {
    audience: "Agritechs & developers",
    title: "Integrate once through neutral, governed rails.",
    body: "Documented APIs, webhooks and consented farm-data scopes under the same access conditions as first-party Agrivah experiences.",
    authority: "Equal tier, equal policy path — no privileged first-party route.",
  },
  {
    audience: "Buyers & processors",
    title: "Transactions backed by traceability and provenance.",
    body: "Connect to produce workflows with governed quality, farm-history and provenance signals, subject to farmer consent and transparent operating rules.",
    authority: "Commercial terms remain between buyer and seller.",
  },
] as const;

export const LAYERS = [
  {
    title: "Core platform",
    body: "Identity, tenancy, consent, audit, security and enterprise foundations.",
  },
  {
    title: "Agriculture domain",
    body: "Farm and parcel records, crop state, season history and governed data structures.",
  },
  {
    title: "Intelligence layer",
    body: "Grounded AI, specialist models and analytics that remain explainable and overridable.",
  },
  {
    title: "Workflow rails",
    body: "Scheme, order, payment, loan and claims orchestration without taking regulated authority.",
  },
  {
    title: "Partner & engagement",
    body: "Open APIs, webhooks, developer tools and focused reference experiences.",
  },
] as const;

export const ALLOCATION = [
  { value: "45%", label: "Core platform foundations" },
  { value: "35%", label: "Reusable domain services" },
  { value: "20%", label: "Focused user engagement" },
] as const;

export const INTEGRATIONS = [
  {
    title: "Government & schemes",
    body: "Configurable applications, verification, workflow and status exchange.",
  },
  {
    title: "Banks & insurers",
    body: "Consented signals, document exchange and assisted decision workflows.",
  },
  {
    title: "FPOs & field networks",
    body: "Member onboarding, delegated administration and assisted service delivery.",
  },
  {
    title: "Agritechs & developers",
    body: "Documented APIs, webhooks, sandbox access and neutral service tiers.",
  },
  {
    title: "Buyers & market partners",
    body: "Orders, payment orchestration, provenance and transaction events.",
  },
  {
    title: "KYC, GIS, imagery & IoT",
    body: "Replaceable provider adapters that keep external complexity outside the core.",
  },
] as const;

export const ADVANTAGES = [
  {
    title: "Farmer-controlled consent",
    body: "Data sharing is purpose-scoped, visible and revocable. No partner receives default ownership of the farmer relationship.",
  },
  {
    title: "AI advises; people decide",
    body: "AI may summarise, detect and recommend. Credit, claims and eligibility outcomes stay human-controlled, explainable and appealable.",
  },
  {
    title: "Neutral partner access",
    body: "First-party and third-party experiences use equivalent APIs, data scopes, service levels and governance rules.",
  },
  {
    title: "Configuration, not custom forks",
    body: "Shared APIs, canonical data and configurable workflows make the next district or partner faster to onboard.",
  },
  {
    title: "Offline and assisted by design",
    body: "Field and FPO-assisted journeys support low-bandwidth realities instead of assuming every farmer is always connected.",
  },
  {
    title: "Auditable by construction",
    body: "Consent decisions, role grants, approvals and data access write append-only audit events.",
  },
] as const;

export const PROOFS = [
  {
    title: "Trust proof",
    body: "A farmer can establish identity, register a farm, grant or revoke consent and see a reliable audit trail.",
  },
  {
    title: "Government workflow proof",
    body: "A real scheme can be configured, human-reviewed and completed with a traceable outcome.",
  },
  {
    title: "Ecosystem proof",
    body: "A bank, insurer or agritech can integrate through governed APIs without privileged access.",
  },
  {
    title: "Field usability proof",
    body: "The experience works in low-bandwidth settings with offline and assisted onboarding paths.",
  },
  {
    title: "Repeatability proof",
    body: "A second district can be configured with materially less effort than the first.",
  },
] as const;

export const ROADMAP = [
  {
    stage: "Now · Phase 0",
    title: "Discovery & foundation",
    body: "Validate the operating model, legal path, anchor partnership, platform skeleton and API choices.",
    timing: "Indicative: 0–3 months",
    active: true,
  },
  {
    stage: "Next · Phase 1",
    title: "District / FPO MVP",
    body: "Prove a real value loop with farmer onboarding, scheme integration and partner participation.",
    timing: "Indicative: 3–8 months after Phase 0",
    active: false,
  },
  {
    stage: "Later · Phases 2–3",
    title: "Multi-district to state",
    body: "Demonstrate configuration-based replication, ecosystem depth and operating maturity.",
    timing: "Timing follows evidence",
    active: false,
  },
  {
    stage: "Later · Phases 4–5",
    title: "National to international",
    body: "Scale only after network economics, institutional integration and jurisdiction flexibility are proven.",
    timing: "Not yet committed",
    active: false,
  },
] as const;

/** What already runs in the product today — each links into the app. */
export const LIVE_CAPABILITIES = [
  {
    title: "Farmer command centre",
    body: "Five-year cropping history with input costs, yield, revenue, district benchmarks and MSP overlay.",
    to: "/farm-history",
  },
  {
    title: "FPO operations workspace",
    body: "Members, aggregation, procurement, produce lots, ledgers, schemes and consent-scoped member insight.",
    to: "/fpo",
  },
  {
    title: "Insurance command centre",
    body: "Cover reconciliation, risk surveillance and claims workflow where every decision keeps a human author.",
    to: "/insurer",
  },
  {
    title: "Scheme discovery & review",
    body: "Configurable scheme definitions, farmer-facing eligibility discovery and human review queues.",
    to: "/discovery",
  },
  {
    title: "Offline field capture",
    body: "Season records captured without signal, queued on device and replayed idempotently on reconnect.",
    to: "/farm-history",
  },
  {
    title: "Official reference data",
    body: "CACP MSP and PMFBY rate tables with field-level provenance, so every number states its source.",
    to: "/intelligence",
  },
] as const;

export const AGENDA = [
  {
    period: "Days 1–30",
    body: "Mobilize, choose candidate contexts and validate the operating model.",
  },
  { period: "Days 31–60", body: "Design the core data, API, identity and consent foundations." },
  {
    period: "Days 61–90",
    body: "Commit to a narrow MVP with partners, owners, budget and exit metrics.",
  },
] as const;

export const TEAM_PROOF = [
  { value: "14+ yrs", label: "Agriculture research and livelihood projects" },
  { value: "25+ yrs", label: "Enterprise product and digital transformation" },
  { value: "30+ yrs", label: "Agronomy and farm development" },
  { value: "39 yrs", label: "Public and rural development leadership" },
] as const;

export const TEAM = [
  {
    name: "Dr. Sowmini Sunkara",
    role: "Founder · Strategy & business development",
    body: "PhD in Biotechnology with 14+ years across national and international rural-livelihood, agri-value-chain, FPO and grassroots-innovation projects.",
    credentials: [
      "World Bank-funded rural inclusion exposure",
      "Entrepreneurship ventures",
      "Trained thousands of farmers, SHG women and students",
    ],
  },
  {
    name: "Ramakrishna Veeramachaneni",
    role: "Senior Product Advisor",
    body: "Technology leader with 25+ years in Oracle Supply Chain Management, quality assurance and digital transformation.",
    credentials: [
      "Scalable enterprise applications",
      "Agile delivery leadership",
      "Pharma, telecom, healthcare, manufacturing",
    ],
  },
  {
    name: "N. Raghu Ram",
    role: "Director · Farm Development",
    body: "Agronomist and agri-consultant with 30+ years in sustainable and organic farming, in India and abroad.",
    credentials: ["Farm development", "Bamboo and biochar", "Climate-resilient agriculture"],
  },
  {
    name: "Gopala Krishna (GK) Ayitam",
    role: "Agri-Business Expert",
    body: "Consulting practitioner with three decades across 10+ countries and 23 Indian states.",
    credentials: [
      "85+ assignments",
      "100+ capacity-building engagements",
      "Value chains, inclusive finance, FPOs and cooperatives",
    ],
  },
  {
    name: "Dr. Radhika Meenakshi Shankar",
    role: "Entrepreneurship Development Expert",
    body: "Doctorate holder with 20+ years of academic experience in finance and entrepreneurship.",
    credentials: [
      "Incubation and startup mentoring",
      "MSME consulting since 2011",
      "20,000+ entrepreneurs trained",
    ],
  },
  {
    name: "Dr. R. Kalpana Sastry",
    role: "Agri-Incubation Expert",
    body: "Former ICAR Agricultural Research Service scientist with 30+ years in research and innovation management.",
    credentials: [
      "Technology commercialization",
      "Intellectual property and innovation management",
      "NABARD-funded agri-innovation hub",
    ],
  },
  {
    name: "Anitha Galigutta",
    role: "Manager · Admin & Operations",
    body: "Hands-on operations professional supporting disciplined delivery beyond the technology layer.",
    credentials: ["Storage and inventory", "Product safety and packaging", "Process improvement"],
  },
] as const;

export const DPI_DISCLAIMER =
  "Agrivah is designed with public-interest principles, but does not represent itself as an official Digital Public Infrastructure operator or national standard without formal designation by a competent authority.";

export const SYNTHETIC_DISCLAIMER =
  "Development and sandbox environments run on synthetic organisations, consumers and purposes. External KYC, identity, GIS, payment, government, bank, insurer and employment systems sit behind replaceable adapters.";
