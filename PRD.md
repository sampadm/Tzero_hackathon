# Product Requirements Document
## Tzero BYOA — Bring Your Own Asset
**Version:** 1.0 — MVP
**Author:** Product Manager, Tzero
**Status:** Draft
**Last Updated:** 2026-03-26

---

## 1. Problem Statement

Tokenizing real-world assets requires translating complex legal documents — like equity term sheets — into secure, on-chain smart contracts. Today, this translation is entirely manual, demanding rare and expensive cross-domain expertise (legal + blockchain), drastically slowing time-to-market, and introducing high risk of human error when converting nuanced legal conditions into immutable code.

Private company asset owners and their intermediaries (law firms, placement agents, transfer agents) have no self-service path to bring assets onto Tzero's platform. Every tokenization engagement is custom, slow, and costly — limiting Tzero's ability to scale its asset base.

**BYOA** solves this by introducing an AI-driven onboarding workflow on Tzero.com that:
- Accepts standardized equity term sheets (NVCA-format PDFs)
- Uses an AI pipeline to extract key financial parameters, compliance rules, and asset logic
- Automatically generates secure, compliant ERC-3643 smart contract code
- Routes through a dual-approval gate (intermediary + Tzero compliance) before deployment on Ethereum mainnet
- Triggers a listing request on Tzero's secondary market upon successful deployment

---

## 2. Business Success Metrics

| Metric | Definition | MVP Target |
|---|---|---|
| **Time-to-Market** | Days from term sheet upload to deployed smart contract | Reduce from estimated 30–90 days (manual) to < 10 business days |
| **AI Extraction Accuracy** | % of term sheet fields correctly extracted without human correction | ≥ 85% on NVCA-standard documents |
| **Compliance Gate Pass Rate** | % of submissions approved by Tzero compliance on first review (no rework) | ≥ 70% |
| **Fee per Tokenization** | Revenue captured per successfully deployed asset | Tiered: flat fee + % of AUM above threshold (rates TBD by finance) |
| **User Experience (CSAT)** | Post-onboarding satisfaction score from intermediary firms | ≥ 4/5 average |
| **Pilot Throughput** | Number of assets successfully tokenized in first 6 months | 5–20 assets |

---

## 3. Personas & Key User Journeys

### Persona 1 — The Intermediary (Primary User)
**Who:** A professional at a law firm, placement agent, or transfer agent acting on behalf of a private company asset owner.
**Technical sophistication:** High — comfortable with legal documents, financial terms, compliance requirements. Limited blockchain expertise.
**Goal:** Efficiently onboard a client's equity asset onto Tzero with minimal back-and-forth, get to a deployed contract fast.
**Pain today:** Manual process is slow, opaque, requires deep coordination with Tzero's internal team.

#### User Journey — Intermediary

```
1. REGISTRATION & FIRM ONBOARDING
   └── Intermediary firm receives invite or applies for BYOA access
   └── Firm-level account created on Tzero.com
   └── Firm completes KYB (Know Your Business) verification
   └── Account activated — single firm login with access to BYOA dashboard

2. ASSET SUBMISSION INITIATION
   └── Intermediary logs in → navigates to BYOA section on Tzero.com
   └── Clicks "Onboard New Asset"
   └── Fills in basic asset metadata:
       - Asset name
       - Issuing company name
       - Asset type (Equity — pre-selected for MVP)
       - Estimated asset valuation (for fee calculation)
       - Jurisdiction (US — pre-selected for MVP)

3. TERM SHEET UPLOAD
   └── Uploads NVCA-format PDF term sheet
   └── System validates file format and size
   └── AI pipeline processes document (async — status indicator shown)
   └── Extraction results displayed:
       - Parsed financial parameters (valuation cap, liquidation preference, pro-rata rights, etc.)
       - Compliance rules detected (accredited investor requirement, Reg D / Reg S flag)
       - Asset logic (conversion terms, dividend rights, voting rights)
       - Confidence score per field (HIGH / MEDIUM / LOW)
       - LOW-confidence fields flagged for review

4. INTERMEDIARY REVIEW & OVERRIDE
   └── Intermediary reviews all extracted fields in a structured form UI
   └── Can edit any field — overrides are logged with timestamp and user
   └── Low-confidence fields are highlighted — intermediary must explicitly confirm or correct each
   └── Once all fields confirmed → intermediary submits for Tzero compliance review
   └── Intermediary sees status update: "Submitted for Tzero Compliance Review"

5. TZERO COMPLIANCE REVIEW (async)
   └── Tzero internal reviewer receives notification
   └── Reviews extracted parameters + intermediary overrides
   └── Can: Approve / Request Changes / Reject with reason
   └── If changes requested → intermediary is notified, returns to step 4 with comments
   └── Once approved → pipeline advances

6. SMART CONTRACT GENERATION
   └── System auto-generates ERC-3643 compliant smart contract code
   └── Human-readable contract summary generated alongside code
   └── Both displayed to intermediary for final review:
       - Contract summary (plain English)
       - Generated Solidity code (read-only view)
   └── Intermediary confirms: "This matches my client's intent" → approves
   └── Tzero compliance does final sign-off on generated contract

7. DEPLOYMENT
   └── Tzero deploys contract to Ethereum mainnet
   └── Transaction hash returned — visible in dashboard
   └── Asset status updated: "Deployed — Pending Listing Activation"
   └── Listing request automatically triggered to Tzero's trading team

8. POST-DEPLOYMENT
   └── Intermediary receives deployment confirmation with:
       - Contract address
       - Transaction hash
       - Human-readable summary PDF (downloadable)
       - Fee invoice generated
   └── Tzero trading team activates listing separately (out of BYOA scope)
```

---

### Persona 2 — Tzero Compliance Reviewer (Internal User)
**Who:** Tzero internal legal/compliance team member responsible for reviewing submissions before deployment.
**Goal:** Quickly verify that extracted parameters are accurate, compliant with US regulations (Reg D/Reg S), and that the generated contract correctly reflects intent.
**Pain today:** No structured tooling — reviews are ad hoc via email/docs.

#### User Journey — Tzero Compliance Reviewer

```
1. NOTIFICATION
   └── Receives in-platform notification + email when intermediary submits for review

2. REVIEW DASHBOARD
   └── Sees queue of pending submissions
   └── Opens submission → views:
       - Original uploaded PDF (side-by-side)
       - AI-extracted fields with confidence scores
       - Intermediary overrides (highlighted in diff view)
       - Compliance flags raised by AI (Reg D/Reg S applicability, accredited investor gate)

3. DECISION
   └── Approve → advances to contract generation
   └── Request Changes → adds comments per field → notifies intermediary
   └── Reject → adds reason → notifies intermediary → case closed

4. CONTRACT SIGN-OFF (second gate)
   └── After contract is generated, reviewer does final review of Solidity code + summary
   └── Approves → Tzero deploys
```

---

## 4. Technical Success Metrics

| Metric | Target |
|---|---|
| **AI Extraction Latency** | Term sheet processed and results displayed in < 60 seconds |
| **Contract Generation Latency** | Smart contract generated in < 30 seconds after dual approval |
| **Extraction Field Accuracy** | ≥ 85% of fields correctly parsed on NVCA-standard PDFs without human correction |
| **System Uptime** | 99.5% uptime for the BYOA onboarding portal |
| **Deployment Success Rate** | ≥ 99% of Tzero-approved contracts successfully deployed on first attempt |
| **Audit Log Completeness** | 100% of field overrides, approvals, and rejections logged with user + timestamp |

---

## 5. Scope of MVP

### In Scope
- Firm-level account creation and authentication (integrated with Tzero's existing auth system)
- Asset metadata capture form
- NVCA-format PDF upload + AI extraction pipeline
- Structured extraction review UI with confidence scoring and override capability
- Dual-approval gate: intermediary review → Tzero compliance review
- ERC-3643 smart contract auto-generation (Ethereum mainnet)
- Human-readable contract summary generation
- Tzero-controlled deployment to Ethereum mainnet
- Post-deployment confirmation with contract address, transaction hash, downloadable summary PDF
- Automatic listing request trigger to Tzero's trading team
- Asset valuation capture for tiered fee calculation
- Fee invoice generation (flat fee + AUM % above threshold)
- Status tracking dashboard for intermediary (submission status, review status, deployment status)
- Email notifications for key state transitions
- Full audit log of all actions (overrides, approvals, rejections, deployments)
- US regulatory compliance: Reg D / Reg S / accredited investor rules enforced in contract logic
- Tzero.com design system adherence

### Out of Scope for MVP
- Individual user seat management within a firm
- Non-equity asset types (debt, real estate, funds)
- Non-US jurisdictions
- Non-NVCA / unstructured term sheet formats
- Secondary market listing activation (handled by separate Tzero team workflow)
- Self-service deployment by intermediary
- Blockchain networks other than Ethereum mainnet
- Secondary market trading UI
- Mobile application
- API access for intermediaries (future)
- Bulk asset onboarding

---

## 6. Technical Considerations

### AI Pipeline
- **Document Parsing:** PDF text extraction with layout awareness (handle multi-column NVCA formats). Libraries: AWS Textract, Google Document AI, or open-source (pdfplumber + LLM).
- **Parameter Extraction:** LLM-based extraction (e.g., Claude API or GPT-4) with a structured output schema mapping to known NVCA equity term sheet fields. Prompt-engineered for NVCA-standard documents.
- **Confidence Scoring:** Per-field confidence score based on extraction certainty. Fields below threshold flagged for human review. Threshold tunable post-launch.
- **Compliance Rule Detection:** Rule-based layer on top of extraction — flags Reg D / Reg S applicability based on extracted investor type, geography, and offering size fields.

### Smart Contract Generation
- **Standard:** ERC-3643 (T-REX protocol) — permissioned token standard designed for regulated securities.
- **Approach:** Template-based generation — a library of pre-audited ERC-3643 contract templates parameterized by extracted fields. Reduces risk vs. fully generative code. Templates cover: standard equity, preferred equity with liquidation preference, equity with conversion rights.
- **Audit:** All templates must be pre-audited by a third-party smart contract auditor before MVP launch.
- **Output:** Solidity source code + ABI + deployment bytecode.

### Deployment Infrastructure
- Tzero-controlled deployment wallet (multisig recommended).
- Deployment triggered only after dual approval is recorded in audit log.
- Transaction monitoring — confirm on-chain inclusion before marking as deployed.
- Gas estimation and management handled by Tzero (not exposed to intermediary).

### Data & Security
- All uploaded PDFs and extracted data encrypted at rest (AES-256) and in transit (TLS 1.3).
- Extracted term sheet data and generated contracts stored in Tzero's secure infrastructure — never exposed to third parties.
- Audit log immutable — append-only, tamper-evident.
- Role-based access: firm account can only see their own submissions.
- Tzero compliance reviewers can see all submissions.

### Integration Points
- **Tzero Auth System:** Firm accounts created within existing Tzero.com authentication infrastructure.
- **Tzero Trading Platform:** Post-deployment, BYOA sends a structured listing request payload to Tzero's internal trading team workflow.
- **Billing System:** Fee invoice generated and sent to Tzero's billing system upon successful deployment.
- **Notification System:** Email notifications via Tzero's existing email infrastructure (SendGrid or equivalent).

### Infrastructure & Cost (MVP Constraints)
- **Team:** 1–2 external engineers.
- **Budget:** Minimize cost — lean on managed services, avoid custom infrastructure.
- **Recommended Stack:**
  - Backend: Node.js or Python (FastAPI) on AWS Lambda / Railway / Render (serverless-first to minimize ops)
  - AI: Claude API or OpenAI API (pay-per-use, no model hosting cost)
  - PDF Parsing: pdfplumber (open source) + LLM extraction
  - Database: PostgreSQL (managed — Supabase or AWS RDS)
  - File Storage: AWS S3 (encrypted)
  - Frontend: React (Next.js) — Tzero design system components
  - Smart Contract: Hardhat for compilation/deployment scripts
  - Ethereum RPC: Infura or Alchemy (managed node — no self-hosted node)

---

## 7. UI Style Preferences

- Must strictly conform to **Tzero.com's existing design system** — typography, color palette, component library, spacing, and interaction patterns.
- BYOA is a new section/module within Tzero.com — accessible via authenticated navigation (e.g., "Tokenize an Asset" or "Asset Onboarding" in the dashboard nav).
- Key UI principles for this workflow:
  - **Progressive disclosure** — multi-step wizard pattern, one clear action per screen.
  - **Status transparency** — always visible submission status (e.g., "In Review," "Changes Requested," "Deployed") with timestamps.
  - **Confidence visualization** — color-coded field confidence (green/yellow/red) in the extraction review UI, without being visually overwhelming.
  - **Side-by-side review** — original PDF viewable alongside extracted fields during review step.
  - **Audit trail visibility** — intermediary can see a timeline of all actions taken on their submission.

---

## 8. Corner Cases

### AI Extraction
| Scenario | Handling |
|---|---|
| PDF is scanned image (not text-based) | Reject with error message: "Please upload a text-based PDF. Scanned images are not supported." |
| Term sheet is missing critical fields (e.g., valuation cap absent) | Flag missing required fields — block progression until intermediary manually enters value |
| Ambiguous or contradictory clauses in term sheet | AI flags the specific clause, marks field as LOW confidence, requires intermediary review |
| Term sheet references external documents ("as defined in Schedule A") | AI flags dependency — intermediary prompted to manually enter the referenced value |
| PDF contains multiple term sheets (multi-asset upload) | Reject with error — one term sheet per submission for MVP |

### Dual Approval Gate
| Scenario | Handling |
|---|---|
| Tzero compliance requests changes after intermediary already approved | Intermediary receives notification, returns to review step — prior approval invalidated, must re-approve after changes |
| Tzero compliance rejects submission | Intermediary notified with reason — submission closed, new submission required |
| Intermediary abandons workflow mid-step | Draft state saved — intermediary can resume from last completed step |
| Intermediary submits, then wants to withdraw before Tzero review | Allow withdrawal — submission cancelled, audit log updated |

### Deployment
| Scenario | Handling |
|---|---|
| Ethereum network congestion causes deployment failure | Retry logic with exponential backoff — intermediary notified if unresolved after 3 attempts, Tzero ops team alerted |
| Gas price spike increases deployment cost significantly | Tzero absorbs gas cost (not passed to intermediary in MVP) — ops team alerted for high-gas events |
| Contract deployment succeeds but transaction not confirmed within timeout | Monitor mempool — alert Tzero ops team, do not mark as deployed until confirmed |
| Duplicate submission (same asset submitted twice) | Detect by company name + asset name combination — warn intermediary of potential duplicate before submission |

### Compliance
| Scenario | Handling |
|---|---|
| Asset valuation entered is implausibly low or high | Soft warning to intermediary — does not block, but logged for Tzero compliance reviewer attention |
| Term sheet indicates non-accredited investors | AI flags as non-compliant with Reg D — Tzero compliance reviewer alerted, submission blocked from auto-advancing |
| Issuing company is foreign-incorporated (non-US) | Flagged for Tzero compliance review — may require Reg S treatment; reviewer decides |

### Account & Access
| Scenario | Handling |
|---|---|
| Firm account not yet KYB-verified tries to submit | Blocked — prompt to complete KYB before submitting assets |
| Tzero compliance reviewer is unavailable (OOO) | No automated escalation in MVP — ops team manages reviewer coverage manually |

---

## 9. Open Questions (Post-MVP Roadmap Inputs)

1. **Fee structure specifics** — exact flat fee amount and AUM % threshold to be defined by Tzero finance team.
2. **Tzero compliance SLA** — formalize a target review turnaround time as volume grows.
3. **Multi-user firm seats** — individual roles within a firm (admin, submitter) needed as firm usage scales.
4. **API access for intermediaries** — programmatic submission for high-volume firms.
5. **Additional asset types** — convertible notes, debt instruments as next expansion after equity MVP.
6. **International jurisdictions** — EU MiCA, UK FCA as next compliance layer.
7. **Non-NVCA term sheet support** — expanding AI extraction to handle unstructured / law-firm-specific formats.
8. **Smart contract template expansion** — additional equity structures beyond standard/preferred/convertible.
9. **Secondary blockchain support** — L2s (Polygon, Base) for lower gas cost once volume warrants.
