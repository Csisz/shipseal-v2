# ShipSeal Wave 0 Closed Beta Runbook

This is the practical operating guide for ShipSeal's founder-operated Wave 0. It covers the first controlled users only. It does not replace legal review, authorize live charging, or change product configuration.

## Status summary

| Item | Status |
|---|---|
| Product | **TECHNICALLY READY** |
| Release classification | **READY FOR CONTROLLED WAVE 0 UNDER APPROVED SCOPE** |
| Open product P0 | **0** |
| Open product P1 | **0** |
| External QA prerequisites | **2 — WAIVED FOR WAVE 0** |
| Human/business prerequisites | **MOSTLY RESOLVED — cohort identities and deployment/rollback record remain** |
| First-user admission | **PENDING FINAL OPERATOR ENTRIES** |

Product QA has passed with zero open P0/P1 product defects. The approved Wave 0 operating scope below resolves the main launch decisions. First-user admission remains pending only until the named 2–3 testers and current/rollback deployment identifiers are recorded and the Day-1 gate is checked.

## Release reference

- Canonical production: <https://www.getshipseal.com>
- Health endpoint: <https://www.getshipseal.com/api/health>
- Branch: `main`
- Approved release commit: `6971e838d361be51076ca90dff598c445bc6e054`
- Support reference format: `RI-...`

## First-user gate

Do not admit the first Wave 0 user until all of the following are true:

- [ ] All required human decisions below have an owner and recorded answer.
- [ ] The cohort and invite method are approved.
- [ ] The selected billing mode is understood and unchanged from the approved decision.
- [ ] Support, monitoring, incident, and rollback owners are reachable.
- [ ] Current production health is green and Admin **Needs attention** has been reviewed.
- [ ] There is no open SEV-1 incident.
- [ ] Each external QA prerequisite is explicitly `OPEN`, `WAIVED FOR WAVE 0`, or `CLOSED`, with the admission scope consistent with that status.
- [ ] The active production deployment and known-good rollback target are recorded.

## Human decisions

These are launch decisions, not product defects. Only an authorized human owner may complete this table.

| Decision | Responsibility or required answer | Value |
|---|---|---|
| Support owner | Incoming beta issues, RI investigation, first response | **Founder/operator** |
| Monitoring owner | Health, Admin, provider capacity, held operations, Stripe and GitHub failures | **Founder/operator** |
| Incident owner | Pause beta or paid AI; coordinate provider, billing, or safety incidents | **Founder/operator** |
| Rollback owner | Start Vercel rollback, confirm recovery, coordinate forward fix | **Founder/operator** |
| Operational-event retention | Approved policy for operational events, AI diagnostics, billing events, and retained backups | **Wave 0 internal policy:** operational events 30 days; AI operation diagnostics 30 days; application-level billing event records 90 days; backups 30 days. Subject to legal/privacy review before paid external beta or public launch. |
| Closed-beta cohort | Approximately 2–3 users, named accounts, invite method, support channel | **Approved model:** 2–3 known testers, invited individually. **Named users: TODO — OPERATOR ENTRY.** Support channel: direct email / direct known-tester contact. |
| Stripe mode | A: Wave 0 non-charging/test-mode; or B: approved live Stripe charging | **NON-CHARGING / TEST MODE for Wave 0. Live charging is not approved.** |
| Legal/compliance scope | Unpaid/internal/known testers versus paid external users; required human review for that scope | **Approved Wave 0 scope:** controlled, invitation-only, non-charging beta for 2–3 known testers. Not public launch. Human legal/compliance review is required before paid external beta or public launch. |

No entry in this document constitutes legal approval.

### Approved Wave 0 support channel

Wave 0 support uses direct email or direct known-tester contact. No helpdesk system is required for the first 2–3 testers. When available, testers should include the `RI-...` support reference so the founder/operator can diagnose the exact operation in Admin.

### Wave 0 retention note

The retention values above are an internal operating policy for the controlled non-charging beta. They are not a legal conclusion and do not override statutory, accounting, vendor, backup, or contractual obligations. They must be reviewed before paid external beta or public launch.


## External QA prerequisites

Allowed status values are `OPEN`, `WAIVED FOR WAVE 0`, and `CLOSED`. Do not use `CLOSED` without recorded evidence. A waiver must name its approver and state how Wave 0 is scoped around the gap.

| Prerequisite | Current status | Reason and accepted supporting evidence | Decision record |
|---|---|---|---|
| Genuine second Free production identity | **WAIVED FOR WAVE 0** | Free entitlement, upgrade, and checkout behavior passed controlled fixtures, but not with a separate genuine Free production account. This is not a product defect. | **Wave 0 waiver approved.** Scope is limited to known invited testers; broader production Free-account acceptance remains required before wider beta/public launch. |
| Authenticated 390px production PR-preview acceptance | **WAIVED FOR WAVE 0** | GitHub interactive authentication blocked the final exact production retest. Accepted evidence covers local authenticated exact preview, responsive and diff containment, frozen reviewed snapshots, and live sandbox PR mutation safety. This is not a product defect. | **Wave 0 waiver approved.** Existing responsive and mutation-safety evidence is accepted for Wave 0; the final authenticated production mobile retest remains required before wider beta/public launch. |

## Approved Wave 0 starting configuration

**Approved for Wave 0.**

- Start with 2–3 known testers invited individually.
- Do not run a public signup campaign.
- Use non-charging/test billing for initial Wave 0.
- Use founder-operated support and operations; the founder/operator is the primary owner for support, monitoring, incidents, and rollback during Wave 0.
- Review Admin manually every day. External proactive alerting is recommended during closed beta but is not required to start Wave 0.
- Do not expand the cohort until several complete scan, Future, delivery, and support journeys have been observed and the founder/operator has explicitly reviewed the evidence.

## Wave 0 admission scope

Wave 0 may admit only the approved closed-beta cohort model:

- 2–3 known testers;
- individual invitations;
- non-charging/test billing;
- founder-operated support and monitoring;
- no public signup campaign.

The two external QA gaps are explicitly waived only for this scope. They are not closed and must be revisited before broader beta or public launch.

First-user admission becomes **APPROVED** only after:
1. the actual 2–3 tester identities/accounts are recorded;
2. the current production deployment ID is recorded;
3. a verified known-good rollback deployment is recorded; and
4. the Day-1 gate is checked with production healthy and no open SEV-1.

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

## Daily beta routine

### Morning — 5 to 10 minutes

1. Open production and `/api/health`.
2. Review Admin **Needs attention** and recent safe operational events.
3. Check provider calls, remaining daily capacity, and repeated provider failures.
4. Check held or stale AI operations and unexpected reservation growth.
5. Check Stripe failures/webhook state and GitHub authentication/integration failures.
6. Review new support reports and confirm every unresolved issue has an owner.

### End of day — 5 to 10 minutes

1. Review unresolved incidents and their next action.
2. Record significant user feedback and any usability blocker.
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

Do not execute rollback without the authorized rollback owner or trigger authority.

1. Identify the current bad Vercel deployment and the observed failure.
2. Identify the previously accepted known-good deployment.
3. Use Vercel production rollback, or promote the approved known-good deployment.
4. Verify the canonical production domain loads.
5. Verify `/api/health` is healthy.
6. Verify an account session.
7. Open one saved project without rescanning or paid AI.
8. Verify Admin loads and review **Needs attention**.
9. Keep `main` unchanged during containment; investigate and forward-fix through normal review.

| Rollback control | Value |
|---|---|
| Rollback owner | **Founder/operator** |
| Approved known-good deployment ID | **TODO — VERIFY DEPLOYMENT ID** |
| Rollback trigger authority | **Founder/operator during Wave 0** |

### Database boundary

A frontend/server rollback is not automatically a database rollback. Database recovery requires a verified compatible backup, a known migration state, and a deliberate authorized operator decision. Do not assume automatic database rollback capability and do not run destructive migration/reset commands during incident containment.

## Deployment record

| Field | Value |
|---|---|
| Approved release commit | `6971e838d361be51076ca90dff598c445bc6e054` |
| Production deployment ID | **TODO — OPERATOR ENTRY** |
| Deployment date | **TODO — OPERATOR ENTRY** |
| Known-good rollback deployment | **TODO — OPERATOR ENTRY** |
| Approved by | **Founder/operator** |
| Notes | **TODO — OPERATOR ENTRY** |

## Beta user admission check

Complete this for each Wave 0 user:

- [ ] Cohort membership approved.
- [ ] Support channel provided.
- [ ] Known limitations disclosed where needed.
- [ ] Billing mode understood.
- [ ] User knows how to report an `RI-...` reference.
- [ ] Current production health is green.
- [ ] No SEV-1 incident is open.
- [ ] Admin **Needs attention** reviewed.
- [ ] Provider capacity is sufficient.

## Wave 0 exit or expansion criteria

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

**Classification:** **NOT REQUIRED TO START WAVE 0 — RECOMMENDED DURING CLOSED BETA**

- [ ] TODO: alert on `/api/health` failure.
- [ ] TODO: alert on provider-capacity exhaustion.
- [ ] TODO: alert on stale held reservations.
- [ ] TODO: alert on Stripe failures.
- [ ] TODO: alert on GitHub integration failures.

Select an alerting service only through a separate human decision; this runbook does not prescribe or configure one.


## Remaining Wave 0 operator entries

The strategic/human Wave 0 decisions are now approved. The remaining entries are operational facts that must be filled before the first tester is admitted:

- **Named Wave 0 testers/accounts:** TODO — OPERATOR ENTRY
- **Production deployment ID:** TODO — OPERATOR ENTRY
- **Deployment date:** TODO — OPERATOR ENTRY
- **Known-good rollback deployment ID:** TODO — VERIFY DEPLOYMENT ID
- **Deployment notes:** TODO — OPERATOR ENTRY

These entries do not represent product defects. Until they are recorded, `First-user admission` remains **PENDING FINAL OPERATOR ENTRIES**.

## Public launch — not Wave 0

Keep these separate from immediate closed-beta operation:

- Complete human legal/compliance approval.
- Re-review and approve retention durations for the public/paid scope.
- Explicitly approve live Stripe production charging.
- Complete broader genuine Free-user production validation.
- Add proactive alerting and escalation coverage.
- Establish wider support coverage.
- Complete vendor and data-processing review where required.

