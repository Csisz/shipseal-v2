# Contributing To ShipSeal

ShipSeal is a local-first MVP for generating AI Project Delivery Packs. Contributions should improve reliability, clarity, and demo readiness without expanding scope into full SaaS infrastructure.

## Local Setup

```bash
npm install
npm run dev
```

## Required Verification

Before submitting a change, run:

```bash
npm run test
npm run build
```

Use `vercel dev` when validating hosted public GitHub import through `/api/github-archive`.

## Scope Rules

Do not add these without explicit product approval:

- Authentication.
- Payment or Stripe.
- Private GitHub import.
- GitHub App or OAuth.
- Database or persistent storage.
- Server-side AI calls.
- Server-side PDF rendering.
- AI2AI integrations.

## Manual Smoke Checks

- Upload a small repository ZIP.
- Import `https://github.com/Csisz/shipseal` in Vercel dev and confirm `/api/github-archive` is first.
- Download the ShipSeal Delivery Pack.
- Open the HTML client report.
- Download the PDF client report.
- Confirm disclaimers are present and do not claim legal compliance.

## Copy And Claims

ShipSeal can say it provides a preliminary readiness checklist. It must not claim:

- Legal advice.
- AI Act compliance certification.
- Formal legal opinion.
- Full production security audit.
