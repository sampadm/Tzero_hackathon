# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Tzero BYOA** — Bring Your Own Asset. An AI-driven onboarding workflow that tokenizes real-world equity assets onto Ethereum via ERC-3643 smart contracts. Full requirements in `PRD.md`.

## UI Design

**Chosen design: `design-2-parchment-tzero.html`**

This is the canonical reference for all UI work. Key characteristics:
- Dark theme: void/deep/surface blacks (`#000`, `#080808`, `#0f0f0f`)
- Primary accent: Tzero neon emerald `#20f554`
- Warning: amber `#f59e0b` · Danger: `#f87171`
- Typography: system-ui stack (no custom fonts)
- Logo: `tZero` with lowercase `t` in emerald
- Layout: sticky top nav → breadcrumb → left step-nav (280px) + main content grid

All new screens/components must match the token system defined in `:root` of that file.

## Tech Stack (planned per PRD)

- Frontend: React / Next.js
- Backend: Node.js (FastAPI alt) on serverless (Railway / Render / Lambda)
- AI: Claude API — PDF extraction + parameter parsing
- PDF parsing: pdfplumber + LLM
- Database: PostgreSQL (Supabase or AWS RDS)
- File storage: AWS S3 (encrypted)
- Smart contracts: ERC-3643 (T-REX), Hardhat for compile/deploy
- Ethereum RPC: Infura or Alchemy
