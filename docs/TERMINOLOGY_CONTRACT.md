# ShipSeal Terminology Contract

- **Current**: observed in the present scan.
- **Proposed**: generated or recommended by ShipSeal, but not yet written to the repository.
- **Applied**: written or included through an export or repository mutation, but not yet confirmed by a later scan.
- **Verified**: confirmed by rescan evidence or another explicitly implemented verification mechanism. Applied never automatically means Verified.
- **Ready**: eligible for the named next action; it does not itself mean Applied or Verified.
- **Limited**: the scan or comparison has an explicit evidence or coverage boundary.
- **Evidence-backed**: supported by concrete repository evidence.
- **Heuristic**: an inference with bounded confidence, not direct evidence.

The serialized readiness union still accepts the legacy value `AgentReady Certified` for persisted reports and historical compatibility. User-facing copy maps it to `AI Coding Ready`; it must not be displayed as a certification claim.

The truthful local scan phases are **Reading repository**, **Building repository intelligence**, and **Preparing workspace**. GitHub scans additionally show the real connection and archive-download operations.
