# ShipSeal Ownership

This document describes the review ownership model for the ShipSeal MVP.

## Product Owner

Primary owner: `@Csisz`

## High-Risk Areas

Human review is required for:

- Scanner logic and scanner limits.
- Delivery Pack manifest and export structure.
- Client report HTML/PDF generation.
- GitHub archive proxy behavior.
- Package dependency changes.
- Vercel deployment configuration.
- Security, privacy, and legal disclaimer wording.

## Why This Matters

ShipSeal is used to prepare client handoff material. A small wording or export-structure change can change what a client receives, so ownership is intentionally conservative.
