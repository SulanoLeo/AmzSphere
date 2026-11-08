# Web Accessibility Audit

An audit of web content, run on 2026-11-08. Read the executive summary for the verdict, the priorities section for what to do first, and the findings tables for detail.

## Metadata

What was audited, with what, and under which settings.

| Field | Value |
|---|---|
| Date | 2026-11-08 |
| Scope | 1 item |
| Skills run | keyboard-navigator |
| Tooling | node v22.23.3, a11y-mcp-server 7.1.0 |
| Scan configuration | defaults, no config file found |
| Checks counted | 10 |

Audited:

- `web/app/catalog/page.tsx`

## Executive summary

Pass. No critical or serious findings.

The headline numbers for this run.

| Measure | Value |
|---|---|
| Score | 100 out of 100 |
| Grade | A |
| Findings | 0 |
| Blocking (critical plus serious) | 0 |
| Verdict | Pass |

## Severity breakdown

Counts by severity, highest impact first.

| Severity | Count | What it means |
|---|---:|---|
| critical | 0 | Blocks a person from completing the task |
| serious | 0 | Major barrier with a difficult workaround |
| moderate | 0 | Real friction, workaround exists |
| minor | 0 | Noticeable but rarely blocking |

## Findings

No findings. Every check listed under "What passed" ran and came back clean.

## Remediation priorities

Nothing to remediate.

## What passed

3 checks ran and found nothing.

- The responsive content grid remains two columns at large breakpoints. Its right column contains static content, so widening does not introduce a new focus-order mismatch.
- The width change adds w-full to the main and header; it does not change DOM order, tabindex values, or CSS ordering, so it does not alter keyboard tab order.
- The width change does not modify focus styles or add clipping/positioning that would obscure focus indicators.

## Needs a human

Items a skill could not decide, or could not check automatically.

- **keyboard-navigator**: Skip-link behavior cannot be verified within the scoped file because the skip link is outside it. The page main at line 219 has no id or tabindex; confirm the shared skip link targets an appropriate focusable destination.
- **keyboard-navigator**: The grid at line 276 remains lg:grid-cols-[1fr_380px]; the reviewed width change does not convert it to full-width panels.

## Next steps

1. Keep the current checks in continuous integration so this does not regress.
2. Re-audit when the interface changes materially, or quarterly.
3. Confirm the automated result with a manual screen reader and keyboard pass.

Automated checks find a minority of accessibility barriers. A passing score is a floor, not a guarantee.

## Findings data

The merged findings, embedded so the next run can compute a delta without parsing this document.

```json a11y-findings
{
  "skills": [
    "keyboard-navigator"
  ],
  "scope": [
    "web/app/catalog/page.tsx"
  ],
  "findings": [],
  "passed": [
    "The responsive content grid remains two columns at large breakpoints. Its right column contains static content, so widening does not introduce a new focus-order mismatch.",
    "The width change adds w-full to the main and header; it does not change DOM order, tabindex values, or CSS ordering, so it does not alter keyboard tab order.",
    "The width change does not modify focus styles or add clipping/positioning that would obscure focus indicators."
  ],
  "notes": [
    {
      "skill": "keyboard-navigator",
      "note": "Skip-link behavior cannot be verified within the scoped file because the skip link is outside it. The page main at line 219 has no id or tabindex; confirm the shared skip link targets an appropriate focusable destination."
    },
    {
      "skill": "keyboard-navigator",
      "note": "The grid at line 276 remains lg:grid-cols-[1fr_380px]; the reviewed width change does not convert it to full-width panels."
    }
  ],
  "counts": {
    "critical": 0,
    "serious": 0,
    "moderate": 0,
    "minor": 0
  },
  "components": [],
  "score": 100,
  "grade": "A",
  "penalty": 0,
  "checks": 10,
  "generated": "2026-11-08",
  "template": "web"
}
```
