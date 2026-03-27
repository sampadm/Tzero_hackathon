# Tzero BYOA — Architecture Design & Implementation Plan

**Version:** 1.0
**Date:** 2026-03-27
**Scope:** Local-only deployment, fully functional with live Claude API and Ethereum Sepolia testnet

---

## Table of Contents

1. [Architectural Principles](#1-architectural-principles)
2. [System Overview](#2-system-overview)
3. [Service Architecture](#3-service-architecture)
4. [Data Model](#4-data-model)
5. [API Design](#5-api-design)
6. [AI Extraction Pipeline](#6-ai-extraction-pipeline)
7. [Smart Contract Architecture](#7-smart-contract-architecture)
8. [Security Design](#8-security-design)
9. [Performance & Scalability](#9-performance--scalability)
10. [Local Development Setup](#10-local-development-setup)
11. [Implementation Plan](#11-implementation-plan)

---

## 1. Architectural Principles

### Guiding Constraints

| Constraint | Implication |
|---|---|
| **Local-only deployment** | Docker Compose replaces cloud infrastructure. No S3, no Lambda, no RDS — equivalents run in containers. |
| **Fully functional flows** | Every step of the PRD user journey must execute end-to-end, including real API calls and real blockchain transactions. |
| **Live AI (Claude API)** | API key stored in `.env`, calls go to Anthropic's production API. No mocking. |
| **Ethereum testnet** | All contracts deploy to Sepolia testnet. Real gas (test ETH), real transaction hashes, real on-chain state. |

### Design Philosophy

- **Service separation over monolith** — frontend, API, worker, and DB run as independent processes. This mirrors a production deployment and keeps concerns isolated even locally.
- **Async by default** — AI extraction and contract generation are long-running operations. They run in a background worker queue, never blocking HTTP responses.
- **Audit-first data model** — every state change is a new record, never an in-place update. Immutable audit trail is a PRD requirement.
- **Security is not optional** — even for a local hackathon build, secrets management, input validation, and dependency scanning are in from day one.

---

## 2. System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Docker Compose Network                        │
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │   Next.js    │    │   FastAPI    │    │   Celery Worker      │  │
│  │  Frontend    │───▶│   Backend   │───▶│  (AI + Contract      │  │
│  │  :3000       │    │   :8000      │    │   Generation)        │  │
│  └──────────────┘    └──────┬───────┘    └──────────┬───────────┘  │
│                             │                        │               │
│                      ┌──────▼───────┐        ┌──────▼───────┐      │
│                      │  PostgreSQL  │        │    Redis      │      │
│                      │  :5432       │        │    :6379      │      │
│                      └──────────────┘        └──────────────┘      │
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐                               │
│  │  Local File  │    │   Hardhat    │                               │
│  │  Storage     │    │   Node       │                               │
│  │  (uploads/)  │    │   :8545      │                               │
│  └──────────────┘    └──────────────┘                               │
└─────────────────────────────────────────────────────────────────────┘
          │                                        │
          ▼                                        ▼
   ┌─────────────┐                        ┌──────────────┐
   │ Claude API  │                        │   Sepolia    │
   │ (Anthropic) │                        │   Testnet    │
   │  external   │                        │  (via Infura │
   └─────────────┘                        │   / Alchemy) │
                                          └──────────────┘
```

### Component Roles

| Component | Tech | Role |
|---|---|---|
| **Frontend** | Next.js 14 (App Router) | UI — wizard flow, review screens, compliance dashboard |
| **Backend API** | FastAPI (Python 3.12) | REST API, auth, business logic, job dispatch |
| **Worker** | Celery + Redis | Async PDF extraction, contract generation, blockchain deployment |
| **Database** | PostgreSQL 16 | All persistent state — firms, assets, extractions, audit log |
| **Queue/Cache** | Redis 7 | Celery task broker + result backend |
| **File Storage** | Local filesystem (`/uploads`) | PDF storage, encrypted at rest with Fernet |
| **Contracts** | Hardhat + Ethers.js | ERC-3643 compilation, deployment to Sepolia |

---

## 3. Service Architecture

### 3.1 Frontend — Next.js 14

**Structure:**
```
frontend/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── layout.tsx
│   ├── dashboard/
│   │   ├── page.tsx                  # Submission queue
│   │   └── layout.tsx
│   ├── onboarding/
│   │   ├── [assetId]/
│   │   │   ├── metadata/page.tsx     # Step 1
│   │   │   ├── upload/page.tsx       # Step 2
│   │   │   ├── review/page.tsx       # Step 3 ← main designed screen
│   │   │   ├── compliance/page.tsx   # Step 4
│   │   │   ├── contract/page.tsx     # Step 5
│   │   │   └── deployment/page.tsx   # Step 6
│   │   └── layout.tsx                # Step nav shell
│   └── admin/
│       ├── queue/page.tsx            # Compliance reviewer queue
│       └── review/[assetId]/page.tsx
├── components/
│   ├── ui/                           # Design token primitives
│   ├── wizard/                       # Step nav, progress strip
│   ├── extraction/                   # Field rows, confidence chips
│   └── contract/                     # Solidity viewer, summary
├── lib/
│   ├── api.ts                        # Typed fetch wrapper
│   └── auth.ts                       # JWT handling
└── styles/
    └── tokens.css                    # CSS vars from parchment-tzero design
```

**Key decisions:**
- App Router (not Pages) — layouts handle the step nav shell cleanly
- No state management library — React Server Components + fetch for reads, client mutations via API routes
- All design tokens from `design-2-parchment-tzero.html` extracted into `tokens.css`
- No raw HTML injection — all dynamic content rendered via React's JSX escaping

### 3.2 Backend — FastAPI

**Structure:**
```
backend/
├── app/
│   ├── main.py
│   ├── api/
│   │   ├── auth.py          # Login, JWT issue/refresh
│   │   ├── firms.py         # Firm onboarding, KYB status
│   │   ├── assets.py        # CRUD for asset submissions
│   │   ├── extractions.py   # Field review, override endpoints
│   │   ├── compliance.py    # Reviewer approve/reject/comment
│   │   ├── contracts.py     # Contract generation trigger + retrieval
│   │   └── deployments.py   # Deployment trigger + status polling
│   ├── models/              # SQLAlchemy ORM models
│   ├── schemas/             # Pydantic request/response schemas
│   ├── services/
│   │   ├── pdf_service.py   # pdfplumber text extraction
│   │   ├── ai_service.py    # Claude API calls
│   │   ├── contract_service.py  # Template selection + rendering
│   │   └── blockchain_service.py # Ethers.js bridge via subprocess
│   ├── workers/
│   │   ├── extraction_task.py   # Celery task: PDF → AI → DB
│   │   ├── contract_task.py     # Celery task: params → Solidity
│   │   └── deployment_task.py   # Celery task: deploy to Sepolia
│   └── core/
│       ├── config.py        # Settings from .env
│       ├── security.py      # JWT, password hashing, file encryption
│       └── database.py      # SQLAlchemy session factory
├── alembic/                 # DB migrations
└── tests/
```

### 3.3 Worker — Celery

Three distinct task types, each on its own queue for independent scaling:

| Queue | Task | Trigger | Duration est. |
|---|---|---|---|
| `extraction` | PDF parse → Claude API → store fields | PDF upload confirmed | 10–45s |
| `contract` | Template render → Solidity compile check | Dual approval complete | 5–15s |
| `deployment` | Sign tx → broadcast → confirm | Contract approved | 30–120s |

Celery result backend is Redis. Frontend polls `/api/assets/{id}/status` every 3 seconds during async operations — no WebSockets needed for MVP.

### 3.4 Contracts — Hardhat

```
contracts/
├── contracts/
│   ├── TzeroToken.sol            # ERC-3643 token (T-REX)
│   ├── IdentityRegistry.sol      # Investor whitelist
│   ├── ComplianceModule.sol      # Reg D / lock-up logic
│   └── interfaces/
├── scripts/
│   ├── deploy.js                 # Called by backend worker
│   └── verify.js
├── templates/
│   ├── standard_equity.sol.j2    # Jinja2 parameterized templates
│   ├── preferred_equity.sol.j2
│   └── convertible_equity.sol.j2
├── hardhat.config.js             # Sepolia network config
└── artifacts/                    # Compiled ABIs + bytecode
```

**Why Jinja2 templates over generative Solidity:** Generative contract code from an LLM is unauditable and unpredictable. Pre-written, pre-audited Solidity templates with parameter injection (token name, supply, lock-up period, etc.) is safer, deterministic, and reviewable.

---

## 4. Data Model

### Entity Relationship Overview

```
Firm ──< User
Firm ──< Asset
Asset ──< ExtractionRun
ExtractionRun ──< ExtractedField
ExtractedField ──< FieldOverride
Asset ──< ComplianceReview
Asset ──< GeneratedContract
Asset ──< Deployment
Asset ──< AuditEvent
```

### Table Definitions

#### `firms`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
name            TEXT NOT NULL
kyb_status      ENUM('pending', 'verified', 'rejected') NOT NULL DEFAULT 'pending'
kyb_verified_at TIMESTAMPTZ
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
```

#### `users`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
firm_id         UUID NOT NULL REFERENCES firms(id)
email           TEXT NOT NULL UNIQUE
password_hash   TEXT NOT NULL
role            ENUM('intermediary', 'compliance_reviewer') NOT NULL
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
```

#### `assets`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
firm_id         UUID NOT NULL REFERENCES firms(id)
created_by      UUID NOT NULL REFERENCES users(id)
ref_number      TEXT NOT NULL UNIQUE   -- EQ-YYYY-NNNN
name            TEXT NOT NULL          -- "Acme Series B Preferred"
company_name    TEXT NOT NULL
asset_type      ENUM('equity') NOT NULL DEFAULT 'equity'
jurisdiction    ENUM('us') NOT NULL DEFAULT 'us'
est_valuation   BIGINT                 -- in USD cents
status          ENUM(
                  'draft',
                  'pdf_processing',
                  'awaiting_intermediary_review',
                  'submitted_for_compliance',
                  'changes_requested',
                  'compliance_approved',
                  'contract_generating',
                  'awaiting_contract_approval',
                  'contract_approved',
                  'deploying',
                  'deployed',
                  'rejected',
                  'withdrawn'
                ) NOT NULL DEFAULT 'draft'
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()

INDEX idx_assets_firm_id (firm_id)
INDEX idx_assets_status (status)
```

#### `pdf_uploads`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
asset_id        UUID NOT NULL REFERENCES assets(id)
original_name   TEXT NOT NULL
stored_path     TEXT NOT NULL          -- local encrypted path
file_size_bytes INTEGER NOT NULL
sha256_hash     TEXT NOT NULL          -- integrity check
uploaded_by     UUID NOT NULL REFERENCES users(id)
uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
```

#### `extraction_runs`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
asset_id        UUID NOT NULL REFERENCES assets(id)
pdf_upload_id   UUID NOT NULL REFERENCES pdf_uploads(id)
status          ENUM('queued', 'running', 'completed', 'failed') NOT NULL DEFAULT 'queued'
claude_model    TEXT NOT NULL          -- model version used
prompt_tokens   INTEGER
completion_tokens INTEGER
started_at      TIMESTAMPTZ
completed_at    TIMESTAMPTZ
error_message   TEXT                   -- populated on failure
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
```

#### `extracted_fields`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
extraction_run_id UUID NOT NULL REFERENCES extraction_runs(id)
field_key       TEXT NOT NULL          -- e.g. 'pre_money_valuation'
field_label     TEXT NOT NULL          -- e.g. 'Pre-Money Valuation'
section         TEXT NOT NULL          -- e.g. 'Valuation & Economics'
ai_value        TEXT                   -- raw AI output
confidence      NUMERIC(4,3) NOT NULL  -- 0.000–1.000
confidence_tier ENUM('high', 'medium', 'low') NOT NULL
source_page     INTEGER
source_quote    TEXT                   -- verbatim text from PDF
requires_review BOOLEAN NOT NULL DEFAULT false
confirmed_at    TIMESTAMPTZ            -- set when intermediary confirms
confirmed_by    UUID REFERENCES users(id)

INDEX idx_extracted_fields_run (extraction_run_id)
```

#### `field_overrides`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
extracted_field_id UUID NOT NULL REFERENCES extracted_fields(id)
overridden_by   UUID NOT NULL REFERENCES users(id)
previous_value  TEXT
new_value       TEXT NOT NULL
reason          TEXT
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
-- Append-only. Never updated or deleted.
```

#### `compliance_reviews`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
asset_id        UUID NOT NULL REFERENCES assets(id)
reviewer_id     UUID NOT NULL REFERENCES users(id)
review_type     ENUM('extraction_review', 'contract_review') NOT NULL
decision        ENUM('approved', 'changes_requested', 'rejected') NOT NULL
comments        JSONB                  -- [{field_key, comment}, ...]
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
-- Append-only. Each decision is a new row.
```

#### `generated_contracts`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
asset_id        UUID NOT NULL REFERENCES assets(id)
template_used   TEXT NOT NULL          -- 'preferred_equity'
solidity_source TEXT NOT NULL          -- full .sol file
abi             JSONB NOT NULL
bytecode        TEXT NOT NULL
human_summary   TEXT NOT NULL          -- plain-English description
parameter_snapshot JSONB NOT NULL      -- extraction values used at generation time
generated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
```

#### `deployments`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
asset_id        UUID NOT NULL REFERENCES assets(id)
contract_id     UUID NOT NULL REFERENCES generated_contracts(id)
network         TEXT NOT NULL DEFAULT 'sepolia'
contract_address TEXT                  -- populated after confirmation
tx_hash         TEXT                   -- recorded immediately on broadcast
block_number    INTEGER                -- populated after confirmation
gas_used        BIGINT
status          ENUM('pending', 'confirmed', 'failed') NOT NULL DEFAULT 'pending'
attempt_count   INTEGER NOT NULL DEFAULT 1
deployed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
confirmed_at    TIMESTAMPTZ
```

#### `audit_events`
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
asset_id        UUID REFERENCES assets(id)
actor_id        UUID REFERENCES users(id)
event_type      TEXT NOT NULL          -- 'field_override', 'status_change', 'review_submitted', etc.
payload         JSONB NOT NULL         -- full event data
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
-- Append-only. No updates, no deletes. Ever.

INDEX idx_audit_asset (asset_id)
INDEX idx_audit_created (created_at)
```

### State Machine — Asset Status

```
draft
  └─[upload PDF]──────────────────▶ pdf_processing
                                        └─[AI done]─▶ awaiting_intermediary_review
                                        └─[AI fail]─▶ draft (retry)

awaiting_intermediary_review
  └─[submit]──────────────────────▶ submitted_for_compliance
  └─[withdraw]────────────────────▶ withdrawn

submitted_for_compliance
  └─[reviewer approves]───────────▶ compliance_approved
  └─[reviewer requests changes]───▶ changes_requested
  └─[reviewer rejects]────────────▶ rejected

changes_requested
  └─[intermediary resubmits]──────▶ submitted_for_compliance

compliance_approved
  └─[auto-trigger contract gen]───▶ contract_generating
                                        └─[done]────▶ awaiting_contract_approval

awaiting_contract_approval
  └─[intermediary + reviewer ok]──▶ contract_approved
  └─[reviewer requests changes]───▶ changes_requested (back to review)

contract_approved
  └─[auto-trigger deploy]─────────▶ deploying
                                        └─[confirmed]▶ deployed
                                        └─[failed]──▶ deploying (retry, max 3)
```

---

## 5. API Design

All endpoints under `/api/v1/`. JWT Bearer auth on all routes except `/auth/*`.

### Auth
```
POST   /auth/login                    # Returns access + refresh tokens
POST   /auth/refresh                  # Rotate refresh token
POST   /auth/logout
```

### Assets
```
GET    /assets                        # List firm's assets (paginated)
POST   /assets                        # Create new submission (step 1 metadata)
GET    /assets/{id}                   # Full asset + current extraction + status
PATCH  /assets/{id}                   # Update draft metadata
DELETE /assets/{id}                   # Withdraw (sets status=withdrawn)

POST   /assets/{id}/upload            # Multipart PDF upload → queues extraction
GET    /assets/{id}/status            # Lightweight status poll (frontend polls this)
POST   /assets/{id}/submit            # Intermediary submits for compliance review
```

### Extractions
```
GET    /assets/{id}/extraction        # Current extraction run + all fields
PATCH  /extractions/fields/{fieldId}  # Override a field value
POST   /extractions/fields/{fieldId}/confirm  # Confirm low-confidence field
```

### Compliance (reviewer-only)
```
GET    /compliance/queue              # Pending review queue
GET    /compliance/{assetId}          # Full submission detail for reviewer
POST   /compliance/{assetId}/decision # Approve / request-changes / reject
```

### Contracts
```
GET    /assets/{id}/contract          # Generated contract + summary
POST   /assets/{id}/contract/approve  # Intermediary approves contract
```

### Deployments
```
GET    /assets/{id}/deployment        # Deployment status + tx hash + address
```

### Response envelope
```json
{
  "data": { ... },
  "meta": { "request_id": "uuid", "timestamp": "iso8601" }
}

// Errors:
{
  "error": {
    "code": "FIELD_REQUIRES_CONFIRMATION",
    "message": "Human-readable message",
    "details": { ... }
  }
}
```

---

## 6. AI Extraction Pipeline

### Step 1 — PDF Text Extraction (pdfplumber)

```python
# backend/app/services/pdf_service.py
def extract_text(file_path: str) -> dict:
    # Returns: {pages: [{page_num, text, tables}], is_image_pdf: bool}
    # Rejects image-only PDFs with clear error
    # Handles multi-column NVCA layout via layout-aware extraction
```

**Failure modes handled:**
- Image PDF → reject immediately, return `is_image_pdf: True`
- Encrypted PDF → catch exception, return error
- Empty/corrupt PDF → catch exception, return error

### Step 2 — Structured Extraction (Claude API)

Single API call with a structured output schema. Using `claude-sonnet-4-6` for extraction — strong JSON adherence, fast, cost-effective.

**Extraction schema (Pydantic → JSON Schema passed to Claude):**

```python
class ExtractionField(BaseModel):
    value: str | None
    confidence: float          # 0.0–1.0
    source_quote: str | None   # verbatim text from document
    source_page: int | None
    notes: str | None          # AI reasoning for low confidence

class TermSheetExtraction(BaseModel):
    # Valuation & Economics
    pre_money_valuation: ExtractionField
    investment_amount: ExtractionField
    post_money_valuation: ExtractionField
    option_pool_pct: ExtractionField
    dividend_rate: ExtractionField
    dividend_type: ExtractionField          # cumulative / non-cumulative

    # Liquidation & Conversion
    liquidation_preference_multiple: ExtractionField
    liquidation_participation: ExtractionField  # participating / non-participating
    conversion_ratio: ExtractionField
    auto_conversion_threshold: ExtractionField

    # Investor Rights
    pro_rata_rights: ExtractionField
    anti_dilution_type: ExtractionField     # broad-based / narrow-based / full-ratchet
    board_seats: ExtractionField
    information_rights: ExtractionField

    # Compliance
    investor_type: ExtractionField          # accredited / qualified institutional
    offering_type: ExtractionField          # reg_d_506b / reg_d_506c / reg_s
    lock_up_period_months: ExtractionField
    transfer_restriction_details: ExtractionField
```

**Prompt strategy:**

```python
EXTRACTION_SYSTEM_PROMPT = """
You are a financial document analyst specializing in NVCA-format equity term sheets.
Extract the requested fields precisely as stated in the document.
- Set confidence 0.9+ only when the value is explicitly and unambiguously stated.
- Set confidence 0.5–0.89 when the value requires interpretation or inference.
- Set confidence below 0.5 when the field is ambiguous, missing, or references an external document.
- For source_quote, copy the exact sentence(s) from the document that support your extraction.
- Never fabricate values. If a field is absent, return null for value.
Return valid JSON matching the provided schema exactly.
"""
```

Claude is called with structured output (tool use) to guarantee parseable JSON. No free-form text response.

### Step 3 — Confidence Tier Assignment & Flag Rules

```python
def assign_tier(confidence: float) -> ConfidenceTier:
    if confidence >= 0.85: return "high"
    if confidence >= 0.60: return "medium"
    return "low"

# Auto-flag for human review:
REQUIRED_FIELDS = ["pre_money_valuation", "investment_amount",
                   "liquidation_preference_multiple", "offering_type"]

# Any required field with low/medium confidence → requires_review = True
# Any field where source_quote is None → requires_review = True
# Any field with "see Schedule" in source_quote → requires_review = True
```

### Step 4 — Compliance Rule Detection (deterministic, not AI)

After extraction, a rule-based layer evaluates compliance implications:

```python
COMPLIANCE_RULES = [
    {
        "id": "reg_d_506b",
        "condition": lambda e: e.investor_type.value == "accredited",
        "label": "Regulation D / Rule 506(b) — Accredited Investors Only",
        "description": "...",
        "contract_param": "requires_identity_verification = true"
    },
    {
        "id": "reg_d_lockup",
        "condition": lambda e: e.offering_type.value in ["reg_d_506b", "reg_d_506c"],
        "label": "Transfer Restriction — 12-Month Lock-Up",
        "description": "...",
        "contract_param": "lock_up_months = 12"
    },
    # ... additional rules
]
```

These detected compliance rules are stored in the asset record and become direct input parameters to the contract template.

---

## 7. Smart Contract Architecture

### ERC-3643 (T-REX Protocol) Overview

ERC-3643 is the standard for permissioned, regulated security tokens. It enforces:
- Identity registry — only whitelisted, verified investors can hold tokens
- Compliance module — pluggable rules (transfer restrictions, lock-ups, investor caps)
- Token contract — standard ERC-20 with compliance checks on every transfer

### Template System

Three Jinja2 Solidity templates, selected based on extracted `liquidation_participation` and `conversion_ratio` fields:

| Template | Condition |
|---|---|
| `standard_equity.sol.j2` | No liquidation preference, no conversion |
| `preferred_equity.sol.j2` | Has liquidation preference (participating or non-participating) |
| `convertible_equity.sol.j2` | Has conversion terms |

**Template parameter injection example:**

```solidity
// preferred_equity.sol.j2 (excerpt)
contract {{ contract_name }} is ERC3643 {
    string public constant ASSET_NAME = "{{ asset_name }}";
    uint256 public constant PRE_MONEY_VALUATION = {{ pre_money_valuation_cents }};
    uint8  public constant LIQUIDATION_MULTIPLE = {{ liquidation_multiple }};  // e.g. 15 = 1.5x
    bool   public constant IS_PARTICIPATING = {{ is_participating | lower }};
    uint256 public constant LOCK_UP_SECONDS = {{ lock_up_months }} * 30 days;
    // ...
}
```

**Generation flow:**

```
Approved extraction fields
        │
        ▼
Template selector (picks .sol.j2 file)
        │
        ▼
Jinja2 render → raw .sol source
        │
        ▼
Hardhat compile check (syntax validation only, no deploy yet)
        │
        ▼
Store source + ABI + bytecode in generated_contracts table
        │
        ▼
Generate human-readable summary (Claude API, single call)
        │
        ▼
Present to intermediary + reviewer for approval
```

### Deployment (Sepolia Testnet)

```
Dual approval recorded in audit_events
        │
        ▼
deployment_task.py (Celery worker)
        │
        ├── Load bytecode from generated_contracts
        ├── Connect to Sepolia via Infura/Alchemy RPC (env var)
        ├── Sign transaction with Tzero deployer wallet (private key in .env)
        ├── Broadcast transaction → record tx_hash immediately
        ├── Poll for confirmation (up to 10 blocks)
        ├── On confirm → record contract_address, block_number, gas_used
        └── Update asset.status = 'deployed'

Retry logic: exponential backoff, max 3 attempts. After 3 failures → alert via
console log + mark deployment.status = 'failed'.
```

---

## 8. Security Design

### 8.1 Secrets Management

```
.env (local only, never committed)
├── ANTHROPIC_API_KEY=sk-ant-...
├── SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/...
├── DEPLOYER_PRIVATE_KEY=0x...          # Tzero testnet deployer wallet
├── JWT_SECRET=<64-char random>
├── FILE_ENCRYPTION_KEY=<Fernet key>    # For encrypting stored PDFs
└── DATABASE_URL=postgresql://...

.env is in .gitignore. A .env.example with placeholder values is committed.
```

### 8.2 Dependency Scanning — Snyk

Snyk runs as a local pre-commit gate and in the development workflow:

```bash
# Install
npm install -g snyk
pip install snyk

# Per-service scanning
snyk test --file=backend/requirements.txt   # Python deps
snyk test --file=frontend/package.json      # Node deps
snyk test --file=contracts/package.json     # Solidity tooling deps

# Snyk Code (SAST) for application code
snyk code test backend/
snyk code test frontend/

# Add to pre-commit hook (.git/hooks/pre-commit):
snyk test --severity-threshold=high
```

**Snyk integration points:**
- `snyk test` blocks commits with HIGH/CRITICAL CVEs
- `snyk monitor` sends dependency graph to Snyk dashboard (free tier)
- `snyk code test` scans for OWASP Top 10 patterns in application code

### 8.3 Authentication & Authorization

- JWT access tokens (15-minute expiry) + refresh tokens (7-day expiry, rotated on use)
- Passwords hashed with bcrypt (cost factor 12)
- Role-based access enforced at API layer:
  - `intermediary` — can only read/modify their firm's assets
  - `compliance_reviewer` — can read all assets, write compliance decisions
- Row-level check on every asset query: `WHERE firm_id = current_user.firm_id` (for intermediaries)

### 8.4 Input Validation

- **PDF upload:** MIME type checked (must be `application/pdf`), max 20MB, filename sanitized
- **All API inputs:** Pydantic schemas with strict types — no raw dict access in handlers
- **Field overrides:** Values validated against field-specific type constraints (numeric fields must be numeric, etc.)
- **SQL:** SQLAlchemy ORM with parameterized queries everywhere — no raw string SQL
- **Frontend rendering:** All dynamic content rendered through React's JSX — no raw HTML injection

### 8.5 File Storage Security

Uploaded PDFs encrypted at rest using Fernet (AES-128-CBC + HMAC-SHA256):

```python
from cryptography.fernet import Fernet

def store_pdf(content: bytes, asset_id: str) -> str:
    fernet = Fernet(settings.FILE_ENCRYPTION_KEY)
    encrypted = fernet.encrypt(content)
    path = f"uploads/{asset_id}.pdf.enc"
    Path(path).write_bytes(encrypted)
    return path

def read_pdf(path: str) -> bytes:
    fernet = Fernet(settings.FILE_ENCRYPTION_KEY)
    return fernet.decrypt(Path(path).read_bytes())
```

### 8.6 Additional Hardening

| Concern | Mitigation |
|---|---|
| XSS | React JSX escaping by default; no raw HTML injection in UI |
| CSRF | JWT in Authorization header (not cookies), no CSRF surface |
| Path traversal | `asset_id` is UUID — used as filename, no user-controlled path components |
| Smart contract private key | Never logged, never returned in API responses, loaded only in worker process |
| Solidity code injection | Template parameters are whitelisted types (int, string, bool) — no arbitrary code injection possible |
| Audit log tampering | `audit_events` table: no UPDATE/DELETE permissions granted to app DB user |

---

## 9. Performance & Scalability

### Performance Targets (Local)

| Operation | Target | Approach |
|---|---|---|
| Page load (any step) | < 500ms | SSR on Next.js, no client-side data waterfalls |
| PDF upload response | < 200ms | Upload stored immediately, extraction queued async |
| AI extraction (Celery) | < 45s | Single Claude API call with structured output |
| Contract generation | < 10s | Template render + Hardhat compile |
| Status poll | < 50ms | Redis cache for current status, no DB hit on poll |
| Sepolia deployment | 30–120s | Async, user sees live tx hash as soon as broadcast |

### Async Architecture — Why It Matters

The three long operations (AI extraction, contract generation, blockchain deployment) are decoupled from HTTP entirely:

```
User action → HTTP POST (< 200ms response) → Task queued in Redis
                                                      │
                                               Celery worker picks up
                                                      │
                                               Long operation runs
                                                      │
                                               DB status updated
                                                      │
Frontend polls GET /status every 3s ◀─────── Status readable from DB/Redis cache
```

This means the UI is never blocked waiting for AI or blockchain.

### Database Performance

- Indexes defined on all foreign keys and status/timestamp columns used in queries
- `assets` table: composite index on `(firm_id, status)` for dashboard queries
- `audit_events` table: partitioned by month if volume grows (out of scope for MVP, schema supports it)
- Connection pooling: SQLAlchemy pool size 10, max overflow 20

### Scalability Notes (Local → Cloud Path)

The architecture is designed so cloud deployment requires only environment variable changes:

| Local | Cloud equivalent |
|---|---|
| PostgreSQL in Docker | AWS RDS / Supabase |
| Redis in Docker | AWS ElastiCache / Upstash |
| Celery worker process | AWS Lambda (with SQS) or Railway worker |
| Local file storage | AWS S3 (swap `store_pdf` implementation) |
| Next.js on localhost | Vercel / Railway |
| FastAPI on localhost | Railway / Render / AWS Lambda |

---

## 10. Local Development Setup

### Prerequisites

```bash
# Required
docker desktop (for PostgreSQL + Redis)
node 20+
python 3.12+
git

# Install tools
pip install poetry
npm install -g snyk
```

### One-Command Start (Docker Compose)

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: tzero_byoa
      POSTGRES_USER: tzero
      POSTGRES_PASSWORD: localdev
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

volumes:
  pgdata:
```

```bash
# Start DB + Redis
docker-compose up -d

# Backend
cd backend
poetry install
alembic upgrade head          # Run migrations
uvicorn app.main:app --reload  # :8000

# Worker (separate terminal)
cd backend
celery -A app.workers worker --loglevel=info -Q extraction,contract,deployment

# Frontend (separate terminal)
cd frontend
npm install
npm run dev                   # :3000

# Contracts
cd contracts
npm install
npx hardhat compile
```

### Environment Setup

```bash
cp .env.example .env
# Fill in:
# - ANTHROPIC_API_KEY (get from console.anthropic.com)
# - SEPOLIA_RPC_URL (get from infura.io or alchemy.com — free tier)
# - DEPLOYER_PRIVATE_KEY (generate a testnet-only wallet, fund with Sepolia ETH from faucet)
# - JWT_SECRET (generate: python -c "import secrets; print(secrets.token_hex(32))")
# - FILE_ENCRYPTION_KEY (generate: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
```

### Seed Data

```bash
# Creates: 1 firm, 1 intermediary user, 1 compliance reviewer user
cd backend
python scripts/seed.py

# Login credentials (local only):
# intermediary@gunderson.com / localdev123
# reviewer@tzero.com / localdev123
```

---

## 11. Implementation Plan

### Phase 0 — Foundations (Day 1)

**Goal:** Every service starts and talks to each other. No features yet.

| Task | Owner component | Done when |
|---|---|---|
| `docker-compose.yml` with PostgreSQL + Redis | Infra | `docker-compose up` starts both |
| FastAPI app skeleton with health check | Backend | `GET /health` returns `{"status":"ok"}` |
| Alembic migration for all tables in §4 | Backend | `alembic upgrade head` creates all tables |
| Next.js scaffold with design tokens from parchment-tzero | Frontend | `npm run dev` shows Tzero-themed shell |
| Hardhat project with ERC-3643 base contracts | Contracts | `npx hardhat compile` succeeds |
| `.env.example` + Snyk baseline scan | Security | `snyk test` runs clean on empty deps |

---

### Phase 1 — Auth + Firm Shell (Day 1–2)

**Goal:** Users can log in and see the dashboard.

| Task | Component | Done when |
|---|---|---|
| `POST /auth/login` — JWT issue | Backend | Returns access + refresh tokens |
| JWT middleware on all protected routes | Backend | 401 on missing/invalid token |
| Login page UI (Tzero design) | Frontend | Form submits, token stored, redirect to dashboard |
| Dashboard page — asset list (empty state) | Frontend | Shows "No assets yet" with CTA |
| Role guard — intermediary vs reviewer routes | Frontend | Reviewer sees `/admin/queue`, intermediary sees `/dashboard` |
| Snyk scan after dependency install | Security | No HIGH/CRITICAL CVEs in auth deps |

---

### Phase 2 — Asset Submission + PDF Upload (Day 2–3)

**Goal:** Intermediary can submit metadata and upload a PDF. AI extraction runs in background.

| Task | Component | Done when |
|---|---|---|
| `POST /assets` — create submission | Backend | Asset record created, `ref_number` auto-generated |
| Step 1 UI — asset metadata form | Frontend | Form validates + submits, moves to step 2 |
| `POST /assets/{id}/upload` — PDF ingest | Backend | File validated, encrypted, stored; extraction task queued |
| Step 2 UI — file upload with drag-and-drop | Frontend | Upload triggers, spinner shows "AI is processing…" |
| `extraction_task.py` — pdfplumber + Claude API call | Worker | Fields extracted and stored in `extracted_fields` |
| `GET /assets/{id}/status` — poll endpoint | Backend | Returns current status + progress |
| Status poll on Step 3 — waits for extraction | Frontend | Auto-advances to review UI when `awaiting_intermediary_review` |
| Reject image PDFs with clear error | Backend | Returns `400` with user-readable message |

---

### Phase 3 — Extraction Review UI (Day 3–4)

**Goal:** The main designed screen — full field review, overrides, confidence chips. This is the centrepiece of the demo.

| Task | Component | Done when |
|---|---|---|
| `GET /assets/{id}/extraction` | Backend | Returns all fields grouped by section |
| Step 3 UI — side-by-side review screen | Frontend | Matches `design-2-parchment-tzero.html` exactly |
| Field override — `PATCH /extractions/fields/{id}` | Backend | Override logged, `field_overrides` row created |
| Confirm low-confidence field | Backend + Frontend | `requires_review` flipped, field highlighted green |
| Compliance flags section | Frontend | Detected rules shown with "Auto-encoded" tags |
| Progress strip (18 fields, 14 high, 2 needs review) | Frontend | Live counts from API |
| `POST /assets/{id}/submit` — block if unconfirmed LOW fields | Backend | Returns `422` with list of unconfirmed fields |
| Audit log — all overrides written to `audit_events` | Backend | Every PATCH creates audit row |

---

### Phase 4 — Compliance Review (Day 4–5)

**Goal:** Compliance reviewer can approve, request changes, or reject. Intermediary gets notified and can respond.

| Task | Component | Done when |
|---|---|---|
| `GET /compliance/queue` | Backend | Returns pending submissions |
| Reviewer queue UI (`/admin/queue`) | Frontend | List of submissions with status badges |
| Reviewer detail UI (`/admin/review/{id}`) | Frontend | Side-by-side original PDF + extracted fields, diff view for overrides |
| `POST /compliance/{id}/decision` | Backend | Creates `compliance_reviews` row, updates asset status |
| "Changes requested" → intermediary returns to Step 3 | Frontend + Backend | Asset status → `changes_requested`, Step 3 re-enabled with reviewer comments visible |
| Rejection flow — asset closed | Backend | Status → `rejected`, asset locked |

---

### Phase 5 — Contract Generation + Review (Day 5–6)

**Goal:** Contract auto-generates after dual approval. Both parties review Solidity + summary.

| Task | Component | Done when |
|---|---|---|
| `contract_task.py` — template select + Jinja2 render | Worker | Correct `.sol.j2` chosen, parameters injected |
| Hardhat compile check on generated code | Worker | Compilation errors surface as task failure, not silent |
| Claude API call for human-readable summary | Worker | Plain-English summary stored in `generated_contracts` |
| Step 5 UI — contract review screen | Frontend | Solidity viewer (read-only, syntax highlighted) + summary panel |
| Intermediary contract approval | Backend + Frontend | `POST /assets/{id}/contract/approve` |
| Reviewer final sign-off | Backend + Frontend | Second approval via compliance decision endpoint |

---

### Phase 6 — Deployment to Sepolia (Day 6–7)

**Goal:** Smart contract deploys to Sepolia testnet. Real transaction hash and contract address returned.

| Task | Component | Done when |
|---|---|---|
| `deployment_task.py` — sign + broadcast to Sepolia | Worker | Tx hash appears immediately after broadcast |
| Poll for on-chain confirmation | Worker | `confirmed_at` + `contract_address` populated after inclusion |
| Retry logic (max 3 attempts, exponential backoff) | Worker | Third failure logs error + marks `deployment.status = failed` |
| Step 6 UI — deployment screen | Frontend | Shows tx hash (Sepolia Etherscan link), contract address, status |
| Post-deployment confirmation panel | Frontend | Contract address, tx hash, ref number, downloadable summary |
| Fee invoice record (stubbed for MVP) | Backend | `audit_events` row with invoice payload |

---

### Phase 7 — Polish, Security Hardening, Demo Prep (Day 7)

| Task | Notes |
|---|---|
| Snyk full scan — backend + frontend + contracts | Block any HIGH/CRITICAL before demo |
| End-to-end walkthrough with seed data | Full flow: login → upload → AI → review → compliance → contract → deploy |
| Error states UI | PDF rejection, AI failure, network error — all show user-friendly messages |
| Audit trail UI | Timeline of all events visible to intermediary on their submission |
| Empty states + loading states | Every async operation has a spinner or skeleton |
| CLAUDE.md update | Document any implementation decisions made during build |

---

## Appendix — Key Dependency Versions

| Package | Version | Purpose |
|---|---|---|
| `fastapi` | 0.115.x | Backend framework |
| `sqlalchemy` | 2.0.x | ORM |
| `alembic` | 1.13.x | DB migrations |
| `celery` | 5.4.x | Task queue |
| `pdfplumber` | 0.11.x | PDF text extraction |
| `anthropic` | 0.40.x | Claude API client |
| `python-jose` | 3.3.x | JWT |
| `cryptography` | 43.x | Fernet file encryption |
| `next` | 14.x | Frontend framework |
| `ethers` | 6.x | Ethereum interaction |
| `hardhat` | 2.22.x | Contract tooling |
| `@openzeppelin/contracts` | 5.x | ERC standards base |

---

*This document is the authoritative technical reference for the Tzero BYOA hackathon build. Update it as implementation decisions are made.*
