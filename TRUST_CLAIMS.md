# ShipSeal Public Trust Claim Registry

This registry prevents product and marketing copy from drifting beyond the implementation. Any claim marked for human review must be re-approved when the relevant vendor or deployment configuration changes.

| Claim | Where shown | Implementation evidence | Confidence | Human/legal review? | Owner / follow-up |
| --- | --- | --- | --- | --- | --- |
| “ShipSeal analyzes repository files statically. Imported repository code is not executed.” | Landing, scan entry, Privacy, Security, Trust | Scanner/ingestion paths parse data only; no imported-code shell/eval/build/install path in `src/` or `api/` | High | Review wording, not technical fact | Engineering + legal |
| Normal GitHub scans read selected commit-bound blobs, not a repository archive | Privacy, GitHub permissions | `api/repository-evidence.ts`, `src/lib/github/githubImport.ts` | High | No | Engineering |
| Large repositories may use bounded evidence; not observed is not confirmed missing | Privacy, scan entry | Evidence coverage/selection policy and scanner coverage model | High | Review customer wording | Product |
| Local ZIP deterministic scanning stays in the browser | Privacy, Trust | ZIP Blob/random-access scanner and browser scan engine | High | Must remain qualified for later AI transmission/autosave | Engineering |
| Deep Analysis sends selected bounded evidence to the configured provider | Privacy, Trust, Future CTA | Server context preparation, redaction, and provider request construction | High | Provider contract/subprocessor review required | Engineering + legal/vendor |
| Best-effort redaction is not a secret scanner | Privacy, Security | `repositoryDeepIntelligenceSafety.ts` and context preparation | High | No guarantee language | Security |
| Signed-in completed scans autosave private derived snapshots | Privacy, My Projects | `SaveProjectControl`, persistence schema/build snapshot, owner-scoped API | High | Retention/legal basis review | Product + legal |
| ShipSeal does not persist repository archives or the original text-content map in project snapshots | Privacy | Persisted `ReadinessReport` schema excludes `RepoScanInput.textContents` and archive bytes | High | Re-audit on schema changes | Engineering |
| Repository changes require confirmation and ShipSeal does not merge or push directly to main | Landing, Security, GitHub permissions | PR dialogs, branch validation, GitHub write APIs | High | Live App permission review | Engineering |
| Stripe processes card details; ShipSeal stores no card number | Privacy, Security, Pricing | Stripe-hosted Checkout/Portal and billing schema | High | Stripe contract/DPA review | Billing + legal |
| A Deep Analysis unit is consumed only after durable complete Future finalization | Terms, Future CTA | AI usage finalization and canonical complete-result contract | High | Commercial wording approved separately | Product + billing |
| No analytics or marketing tracker is implemented | Privacy | Dependency and source audit; no analytics SDK/call | High | Re-audit before adding telemetry | Engineering |
| ShipSeal provides informational technical assessment, not legal advice or certification | Landing, Privacy, Security, Terms, exports | Report and Delivery Pack disclaimers | High | Final legal wording required | Legal |
| Account deletion does not cancel Stripe or remove GitHub-side data | Privacy, My Projects | Account delete route blocks active subscription and performs no GitHub/Stripe deletion call | High | Review rights/retention wording | Engineering + legal |
| Account deletion removes owner-scoped ShipSeal projects and AI records and anonymizes the user row | Privacy, My Projects | `accountPersistence.deleteAccount`, billing-profile deletion, FK cascades | High | Backup/log/event retention review | Engineering + legal |

## Prohibited unsupported claims

Do not publish these without a future implementation and evidence review:

- “We never send repository data to AI.”
- “ShipSeal stores no repository data.”
- “End-to-end encrypted.”
- “Zero knowledge.”
- “SOC 2 compliant.”
- “ISO certified.”
- “Penetration-tested.”
- “The AI provider never trains on or retains data.”
