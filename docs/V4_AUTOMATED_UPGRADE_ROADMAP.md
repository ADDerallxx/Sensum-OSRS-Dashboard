# Sensum V4 automated upgrade roadmap

This roadmap is the durable handoff for unattended V4 work. The machine-readable
state is in `platform/automation/v4-upgrade-plan.json`.

## Operating rules

- Complete one bounded checkpoint per run.
- Read the latest reports and Git state before changing code.
- Use revision-pinned OSRS Wiki facts and official game formulas where available.
- Treat missing, conflicting, stale, or variant-mixed evidence as a blocker.
- Never promote regex output or AI-generated facts directly to verified data.
- Run the relevant regression suite before committing.
- Commit and push only a clean, independently useful checkpoint.
- Preserve the current live V3 Apps Script dashboard. Do not run `deploy.ps1`,
  `clasp push`, or create a live deployment without explicit user approval.
- Do not automatically approve golden vectors. Generate review packets and wait
  for a source-backed review decision.
- Stop and report when credentials, billing, destructive migration, external
  service creation, or a product choice requires the user.

## Roadmap order

1. Expand composite Agility pages into exact variants.
2. Close every level-34 Agility eligibility and mechanical-model gap.
3. Review and approve exact Agility vectors; issue a reproducible certificate.
4. Generalize the method engine across every trainable skill family.
5. Complete item, recipe, equipment, effect, monster, location, and price coverage.
6. Add adversarial optimizer evaluations, revision-drift checks, and confidence calibration.
7. Implement the Cloud SQL/API/job architecture behind a compatibility boundary.
8. Build the new client progressively without removing the stable live dashboard.
9. Perform architecture, terminology, accessibility, responsive-layout, and UI cohesion reviews.
10. Prepare a reversible migration rehearsal and request approval before production cutover.

The plan is complete only when the accuracy gates pass, the replacement has been
rehearsed, and the user explicitly approves production deployment.
