# ShipSeal Controlled Early Access Runbook

This is the practical guide for ShipSeal's founder-operated, non-charging Controlled Early Access / Soft Launch. It does not replace legal review, authorize live charging, or change product configuration.

**Strategy history:** the original approved Wave 0 model limited admission to 2–3 named, individually invited testers. Because a pre-arranged cohort was not available, the product owner deliberately broadened discovery to controlled non-charging Early Access through the normal product flow. The ownership, retention, Stripe, incident, and rollback decisions made for Wave 0 remain in force unless this document says otherwise.

## Status summary

| Item | Status |
|---|---|
| Product | **TECHNICALLY READY** |
| Release | **READY FOR CONTROLLED EARLY ACCESS UNDER APPROVED SCOPE** |
| Open product P0 | **0** |
| Open product P1 | **0** |
| External QA prerequisites | **2 — WAIVED FOR WAVE 0 / EARLY ACCESS** |
| Live Stripe | **NOT APPROVED / TEST MODE ONLY** |
| Public launch | **NOT APPROVED** |
| First-user admission | **APPROVED FOR CONTROLLED EARLY ACCESS** |

This does not mean product QA failed. Product health, billing integrity, GitHub mutation safety, Trust/Admin/Support, and release gates passed. The approved scope is a controlled, non-charging, pre-commercial beta without a large public marketing campaign.

## Release reference

- Canonical production: <https://www.getshipseal.com>
- Health endpoint: <https://www.getshipseal.com/api/health>
- Branch: `main`
- Approved release commit: `6971e838d361be51076ca90dff598c445bc6e054`
- Support reference format: `RI-...`

## Early Access admission gate

Named tester identities are no longer a prerequisite. First-user admission is **APPROVED FOR CONTROLLED EARLY ACCESS** while all of these conditions remain true:

- [ ] Production health is green.
- [ ] No SEV-1 incident is open.
- [ ] Admin **Needs attention** has been reviewed.
- [ ] Non-charging/test mode remains in effect; live Stripe is not enabled.
- [ ] The founder/operator is available for support and incident response.
- [ ] First-party feedback collection is operational.

Users may discover ShipSeal and create or use accounts through the normal product flow. Do not run a large public marketing campaign or automatically expand promotional activity based on this admission approval.

## Human decisions

These approved Wave 0 decisions remain the operating controls for Early Access, not product defects. The founder/operator may hold all four roles during this first controlled beta.

| Decision | Responsibility or required answer | Value |
|---|---|---|
| Support owner | Incoming beta issues, RI investigation, first response | **Founder/operator** |
| Monitoring owner | Health, Admin, provider capacity, held operations, Stripe and GitHub failures | **Founder/operator** |
| Incident owner | Pause beta or paid AI; coordinate provider, billing, or safety incidents | **Founder/operator** |
| Rollback owner | Start Vercel rollback, confirm recovery, coordinate forward fix | **Founder/operator** |
| Operational-event retention | Operational events: 30 days; AI operation diagnostics: 30 days; application-level billing event records: 90 days; backups: 30 days | **APPROVED FOR INTERNAL WAVE 0** |
| Launch model | Originally 2–3 named invitees. Broadened by owner approval to controlled product discovery through the normal flow, with no large public marketing campaign; direct founder/operator support and daily Admin review. | **APPROVED EARLY ACCESS MODEL** |
| Stripe mode | Non-charging/test mode. Live Stripe charging is not approved for Wave 0. | **APPROVED** |
| Legal/compliance scope | Controlled, non-charging, pre-commercial Early Access beta. This is not a final public/commercial launch and is not final legal/compliance approval. Existing Privacy, Terms, and Security surfaces remain applicable. Human review remains required before paid external customers, public commercial launch, finalized public retention promises, or finalized vendor/data-processing representations. | **APPROVED EARLY ACCESS SCOPE** |

The retention periods above are internal Wave 0 operating decisions, not legal conclusions. They must be reviewed before paid external beta or public launch and do not override statutory, contractual, vendor, accounting, or backup obligations. No entry in this document constitutes final legal/compliance approval.

## External QA prerequisites

Allowed status values remain `OPEN`, `WAIVED FOR WAVE 0 / EARLY ACCESS`, and `CLOSED`. Both items are waived only for the approved Early Access scope; neither is closed.

| Prerequisite | Current status | Reason and accepted supporting evidence | Decision record |
|---|---|---|---|
| Genuine second Free production identity | **WAIVED FOR WAVE 0 / EARLY ACCESS** | Controlled fixture coverage is accepted for Early Access. Genuine production Free-user acceptance remains required before broader beta or public launch. This is not a product defect. | Approved by product owner; **not closed** |
| Authenticated 390px production PR-preview acceptance | **WAIVED FOR WAVE 0 / EARLY ACCESS** | Responsive containment, local authenticated exact-preview tests, reviewed diff behavior, frozen review identity, and real GitHub mutation-safety acceptance are sufficient for Early Access. The authenticated production mobile retest remains required before broader beta or public launch. This is not a product defect. | Approved by product owner; **not closed** |

## Approved Early Access operating model

The product owner approved this configuration. It supersedes named-tester-only admission while preserving the original Wave 0 risk controls:

- Keep production accessible through the normal account and anonymous-compatible flows.
- Allow real users to discover and try ShipSeal without a pre-arranged cohort.
- Do not run a large public marketing or signup campaign.
- Use non-charging/test billing; live Stripe charging is not approved.
- Use direct founder/operator contact for support.
- Use founder-operated support and monitoring.
- Review Admin manually every day.
- Keep structured product feedback operational and review it in Admin.
- Do not broaden marketing until several complete scan, Future, delivery, and support journeys have been observed.

### Feedback loop

- A persistent **Send feedback** action and calm, dismissible outcome prompts collect use case, usefulness, reuse intent, optional comments, and value-gated pricing intent.
- Admin **Early Access feedback** is the founder's review surface. Prioritize repeated partial/no outcomes and recurring comments.
- Feedback never starts provider AI, reserves a Deep Analysis unit, opens Stripe, mutates GitHub, or rescans a repository.
- Repository source is not automatically attached. Use safe internal account/project/scan IDs only when available.

## Day-1 operating checklist

- [ ] Verify <https://www.getshipseal.com> loads.
- [ ] Verify `/api/health` returns healthy.
- [ ] Confirm the production deployment identity.
- [ ] Check Admin → **Needs attention**.
- [ ] Check provider calls and daily capacity.
- [ ] Check AI held/stale reservations.
- [ ] Check Stripe failures and webhook state.
- [ ] Check GitHub authentication/integration failures.
- [ ] Perform one safe `RI-...` support-reference lookup.
- [ ] Confirm the support and incident owners are reachable.
- [ ] Confirm there is no unexpected provider-call spike.
- [ ] Confirm there is no unexpected reservation accumulation.

Do not require routine SQL or direct database access for these checks.

## Daily Early Access routine

### Morning — 5 to 10 minutes

1. Open production and `/api/health`.
2. Review Admin **Needs attention** and recent safe operational events.
3. Check provider calls, remaining daily capacity, and repeated provider failures.
4. Check held or stale AI operations and unexpected reservation growth.
5. Check Stripe failures/webhook state and GitHub authentication/integration failures.
6. Review new support reports and confirm every unresolved issue has an owner.

### End of day — 5 to 10 minutes

1. Review unresolved incidents and their next action.
2. Review Early Access feedback, record repeated themes, and identify any usability blocker.
3. Check Deep Analysis usage/cost trend and provider-call trend.
4. Confirm no reservation remains unexpectedly held.
5. Record production deployments or configuration changes made that day.

## Support flow

Normal support must not require customer DevTools.

1. Receive the problem report and ask for the `RI-...` reference when available.
2. Search the reference in Admin.
3. Review the readable diagnosis, durable-result state, consumption state, and safe timeline.
4. Classify the outcome:
   - **Resolved** — explain the result and close the report.
   - **Retryable** — give the user a safe retry instruction and monitor the next operation.
   - **Operator action** — assign an owner and state the next update time.
   - **Provider incident** — apply paid-AI pause criteria.
   - **Billing incident** — use the billing checklist below.
   - **GitHub incident** — use the GitHub checklist below.
5. Preserve the RI reference and relevant timestamps; do not copy secrets, raw source, or unnecessary customer data into support notes.

## Incident severity

| Severity | Examples | Immediate action |
|---|---|---|
| **SEV-1** | Incorrect paid-unit consumption; cross-user repository exposure; unsafe GitHub write; production unavailable; secret exposure | Pause the affected feature or beta admission immediately. Notify the incident owner, preserve evidence, and consider rollback or an approved configuration stop. |
| **SEV-2** | Provider outage; repeated failed Deep Analysis; Stripe webhook delays; GitHub integration unavailable; major workflow unusable | Assign an owner promptly, limit the affected workflow, communicate with impacted testers, and escalate if scope or billing risk grows. |
| **SEV-3** | Cosmetic defect; minor responsive issue; confusing copy; recoverable isolated error | Record, prioritize, and resolve through the normal beta feedback process. |

## Paid AI pause criteria

Pause admission of new Deep Analysis work when any item is true:

- [ ] Billing integrity is uncertain.
- [ ] Consumed units increase without durable successful results.
- [ ] Held reservations accumulate unexpectedly.
- [ ] Provider capacity is repeatedly exhausted.
- [ ] Provider responses repeatedly fail schema or content-integrity validation.
- [ ] A deployment introduces unknown paid-AI behavior.

Preferred response order:

1. Stop admitting new paid work through an approved feature/configuration control, if available.
2. Pause affected beta admission and notify the incident owner.
3. Preserve RI references, operation identifiers, and safe diagnostic evidence.
4. Roll back if the behavior was deployment-introduced.
5. Investigate and forward-fix before resuming.

Do not make destructive database changes or manually edit usage. Resume only after billing integrity and durable-result behavior are confirmed.

## Billing incident checklist

For a suspected billing issue, verify in order:

1. Operation ID and `RI-...` reference.
2. Reservation state.
3. Durable result state.
4. Consumed state.
5. Released/refunded state.
6. Stripe subscription state, when relevant.
7. Duplicate operation, request, webhook, or callback evidence.

**Invariant:** no durable successful result → no consumed Deep Analysis unit.

Do not manually edit usage unless an existing audited reconciliation mechanism explicitly supports the required correction. Escalate uncertainty to the incident owner and pause new paid work if consumption correctness cannot be established.

## GitHub incident checklist

Verify and record:

- [ ] Target repository and source identity.
- [ ] GitHub App authorization/installation state.
- [ ] Preview/read-only state.
- [ ] Reviewed base SHA.
- [ ] Generated branch.
- [ ] Exact reviewed files and unified diff.
- [ ] Explicit confirmation state.
- [ ] PR URL, only if a PR was actually created.

**Invariant:** no repository mutation before explicit reviewed confirmation. If reviewed content and written content may differ, treat it as SEV-1 and stop the write path.

## Rollback procedure

The founder/operator is the rollback owner and trigger authority during Wave 0. Do not execute rollback without that explicit decision.

1. Identify the current bad Vercel deployment and the observed failure.
2. Confirm the emergency known-working fallback deployment recorded below.
3. Use Vercel production rollback, or promote that verified fallback deployment.
4. Verify the canonical production domain loads.
5. Verify `/api/health` is healthy.
6. Verify an account session.
7. Open one saved project without rescanning or paid AI.
8. Verify Admin loads and review **Needs attention**.
9. Keep `main` unchanged during containment; investigate and forward-fix through normal review.

| Rollback control | Value |
|---|---|
| Rollback owner | **Founder/operator** |
| Emergency known-working fallback deployment ID | `dpl_AWqgWR5UpiVwWiGw2FSDD4XHHZs5` |
| Rollback trigger authority | **Founder/operator during Wave 0** |

The fallback predates the responsive remediation and may reintroduce the previous SS-140, SS-141, and SS-142 responsive defects. It is not functionally equivalent to the current accepted release. Use it only as an emergency rollback candidate until a newer known-good post-remediation rollback point exists.

### Database boundary

A frontend/server rollback is not automatically a database rollback. Database recovery requires a verified compatible backup, a known migration state, and a deliberate authorized operator decision. Do not assume automatic database rollback capability and do not run destructive migration/reset commands during incident containment.

## Deployment record

| Field | Value |
|---|---|
| Approved release commit | `6971e838d361be51076ca90dff598c445bc6e054` |
| Production deployment ID | `dpl_B3mSiYP8CwKQSbkMX5n9zT935sJB` |
| Deployment date | Created `2026-10-03T06:10:30.561Z`; READY `2026-10-03T06:12:08.381Z` |
| Production health | HTTP 200; `{"status":"ok"}` |
| Emergency known-working fallback | `dpl_AWqgWR5UpiVwWiGw2FSDD4XHHZs5` — commit `3ddc65c4b945fff48f345adc18d8a2619fcf3e73`; READY `2026-09-22T09:38:52.712Z` |
| Approved by | Founder/operator |
| Notes | On 2026-10-06, the canonical production alias resolved to the READY production deployment above and Vercel metadata matched the approved release commit exactly. The fallback is the immediately preceding READY production deployment. It predates the responsive remediation, may reintroduce SS-140/SS-141/SS-142 responsive defects, and is not functionally equivalent to the current release. |

## Early Access user admission check

First-user admission is **APPROVED FOR CONTROLLED EARLY ACCESS**. Named cohort membership is not required. Before continuing admission, verify:

- [ ] Founder/operator support contact is available.
- [ ] Known limitations disclosed where needed.
- [ ] Non-charging/test mode is still active and understood.
- [ ] User knows how to report an `RI-...` reference.
- [ ] Current production health is green.
- [ ] No SEV-1 incident is open.
- [ ] Admin **Needs attention** reviewed.
- [ ] Provider capacity is sufficient.
- [ ] Feedback collection is operational.

## Early Access expansion criteria

Do not expand automatically. The human owner should review evidence that:

- multiple deterministic scans completed successfully;
- several Future workflows completed end to end;
- no incorrect unit consumption occurred;
- no unsafe GitHub mutation occurred;
- support issues were diagnosable through RI references;
- no SEV-1 incident remains unresolved;
- the daily operator routine is sustainable; and
- user feedback shows no fundamental usability blocker.

No revenue or arbitrary user-count threshold is required for this decision.

## External alerting

**Current status:** Admin dashboard and logging exist. No proactive external alerting system has been identified.

**Early Access requirement:** **NOT REQUIRED TO START EARLY ACCESS**

**Classification:** **RECOMMENDED DURING EARLY ACCESS**

- [ ] Add alerting for `/api/health` failure.
- [ ] Add alerting for provider-capacity exhaustion.
- [ ] Add alerting for stale held reservations.
- [ ] Add alerting for Stripe failures.
- [ ] Add alerting for GitHub integration failures.

Until proactive alerting exists, the founder/operator performs the daily Admin and health review. Select an alerting service only through a separate human decision; this runbook does not prescribe or configure one.

## Public commercial launch — not Early Access

**Status: NOT APPROVED.** Keep these separate from immediate Controlled Early Access operation:

- Complete human legal/compliance approval.
- Approve and publish retention durations.
- Approve live Stripe production charging.
- Complete broader genuine Free-user production validation.
- Complete the authenticated production 390px PR-preview retest.
- Add proactive alerting and escalation coverage.
- Establish wider support coverage.
- Complete vendor and data-processing review where required.
