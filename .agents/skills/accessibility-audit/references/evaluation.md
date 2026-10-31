# Evaluation Strategy

Use this file to maintain the skill over time.

## Quality Goals

- The skill should help an agent scope audits correctly.
- The scripts should produce a stable, validated JSON contract.
- The report should remain readable and actionable.
- The workflow should not overclaim conformance.

## Suggested Evaluation Tasks

1. Run the crawler against a small public site and verify that it returns same-origin representative routes instead of a hard-coded list.
2. Run `audit.js` on a known page and confirm that the output validates with `validate-results.js`.
3. Run the browser-backed flow with a synthetic session config and verify that storage state is written and screenshots can be captured.
4. Validate a session config that uses named library actions, secrets, and route profiles.
5. Add a manual finding to the sample JSON and verify the report still renders correctly.
6. Aggregate two or more runs and confirm that baseline deltas and page-level changes are computed correctly.
7. Ask a fresh agent to use this skill for:
   - a single-page audit
   - a representative sample audit
   - a legal-framing request such as Section 508 or EN 301 549
8. Check whether the agent:
   - clarifies scope
   - keeps automated and manual findings separate
   - avoids claiming certification
   - produces the documented outputs

## Regression Signals

- The crawler returns placeholder routes.
- The audit output stops matching the output contract.
- Reports omit severity or remediation.
- The skill stops mentioning limitations or untested areas.
- Browser-backed runs fail to persist session state or lose screenshot links.
