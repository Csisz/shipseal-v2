# Sample Delivery Pack Review

Use this review guide to dogfood the ShipSeal MVP sample output before showing it to a client, AI freelancer, or agency partner.

## Sample App

The sample project is `Customer Support RAG Assistant`.

It simulates a realistic AI app that:

- Answers support questions using a curated knowledge base.
- Drafts customer-facing AI responses.
- Supports customer support agents and end users.
- Is used in the EU.
- May handle personal data in customer support context.
- Has a human approval or escalation path for uncertain and sensitive cases.
- Uses an example AI provider/model value only; ShipSeal does not call an AI API.

## What The Sample Should Demonstrate

The sample output should show that ShipSeal generates a readiness package, not just a list of files. A good demo output should help a delivery team explain:

- What is ready for handoff.
- What risks need client attention.
- What legal/privacy/compliance review may be needed.
- What tests should be run before relying on the AI workflow.
- What next steps should happen in the first 30/60/90 days.

## Files To Review In The ZIP

Open the generated Delivery Pack ZIP and review these files first:

- `score.json`
- `04-testing/EVAL_TEST_CASES.md`
- `04-testing/RED_TEAM_PROMPTS.md`
- `04-testing/TESTING_STRATEGY.md`
- `05-ai-act-readiness/AI_ACT_READINESS_CHECKLIST.md`
- `05-ai-act-readiness/TRANSPARENCY_NOTICE_DRAFT.md`
- `05-ai-act-readiness/LEGAL_REVIEW_QUESTIONS.md`
- `06-client-handoff/CLIENT_HANDOFF_REPORT.md`
- `06-client-handoff/CLIENT_HANDOFF_REPORT.html`
- `06-client-handoff/EXECUTIVE_SUMMARY.md`
- `06-client-handoff/NEXT_STEPS_ROADMAP.md`
- `02-skills/code-review/SKILL.md`
- `02-skills/test-generation/SKILL.md`
- `02-skills/ai-act-readiness/SKILL.md`
- `02-skills/release-check/SKILL.md`
- `02-skills/client-handoff/SKILL.md`

## Client Handoff Report Quality Bar

`CLIENT_HANDOFF_REPORT.md` is demo-ready when it:

- Uses the sample project name and client/agency context.
- Explains the ShipSeal score in plain delivery language.
- Includes a visible go/no-go or readiness recommendation.
- Separates strengths from risks.
- Mentions testing status and the need to run eval/red-team checks.
- Includes AI Act readiness and MCP readiness summaries.
- Includes a 30/60/90 day roadmap.
- Includes the disclaimer that it is not legal advice and not a production security audit.
- Avoids claiming legal compliance, security certification, or production approval.

`CLIENT_HANDOFF_REPORT.html` is the print-ready version. Open it in a browser and use Print / Save as PDF when a client-ready PDF is needed. Do not use full dashboard printing as a substitute for this report.

## Expected Red Flags

The sample is intentionally not perfect. The output should surface these concerns:

- Red-team documentation is incomplete.
- Transparency notice review is needed because the app is EU-used and generates user-facing AI output.
- Personal data handling means privacy/GDPR review may be required.
- MCP is only a future option and should stay disabled until governance is agreed.
- Legal review is recommended before production use.

## Demo-Ready Pass Criteria

The sample output is demo-capable when:

- The Delivery Pack contains every required manifest path.
- `EVAL_TEST_CASES.md` contains at least 30 numbered eval cases.
- `RED_TEAM_PROMPTS.md` contains at least 10 safe validation prompts.
- At least 5 `SKILL.md` files are present.
- The transparency notice draft is non-empty and readable.
- The client handoff report reads like a client-facing handoff aid, not an internal developer checklist.
- The output clearly states `This is not legal advice`.
- The sample can be generated without backend services or external AI API calls.

## Manual UI Demo

1. Start the app with `npm run dev`.
2. Upload a small repository ZIP or open the sample report.
3. In Project Intake, click `Load demo project`.
4. Confirm the intake fields populate with `Customer Support RAG Assistant`.
5. Review the Delivery Pack preview.
6. Click `Download PDF report` and confirm the PDF downloads; then click `Open HTML report` and confirm the standalone fallback opens.
7. Use browser Print / Save as PDF if a PDF is needed.
8. Click `Download ShipSeal Delivery Pack`.
9. Review the files listed above.

## Automated Validation

Run:

```bash
npm run test
npm run build
```

The sample-specific assertions live in `src/test/sampleDeliveryPack.test.ts`.
