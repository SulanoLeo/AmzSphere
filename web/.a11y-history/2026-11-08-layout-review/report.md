# Web Accessibility Audit

An audit of web content, run on 2026-11-08. Read the executive summary for the verdict, the priorities section for what to do first, and the findings tables for detail.

## Metadata

What was audited, with what, and under which settings.

| Field | Value |
|---|---|
| Date | 2026-11-08 |
| Scope | 7 items |
| Skills run | keyboard-navigator |
| Tooling | node v22.23.3, a11y-mcp-server 7.1.0 |
| Scan configuration | defaults, no config file found |
| Checks counted | 10 |

Audited:

- `web/app/catalog/page.tsx`
- `web/app/globals.css`
- `web/app/inventory/page.tsx`
- `web/app/layout.tsx`
- `web/app/page.tsx`
- `web/app/ppc/page.tsx`
- `web/components/Sidebar.tsx`

## Executive summary

Pass. No critical or serious findings.

The headline numbers for this run.

| Measure | Value |
|---|---|
| Score | 96 out of 100 |
| Grade | A |
| Findings | 1 |
| Blocking (critical plus serious) | 0 |
| Verdict | Pass |

## Severity breakdown

Counts by severity, highest impact first.

| Severity | Count | What it means |
|---|---:|---|
| critical | 0 | Blocks a person from completing the task |
| serious | 0 | Major barrier with a difficult workaround |
| moderate | 1 | Real friction, workaround exists |
| minor | 0 | Noticeable but rarely blocking |

## Findings

1 findings, ordered by severity then by rule.

### Moderate (1)

Each row names the rule, the criterion it fails, where it is, and what to change.

| Rule | WCAG | Location | Problem | Fix |
|---|---|---|---|---|
| `KEYBOARD-ORDER-001` | 2.4.3 A | web/app/catalog/page.tsx:667 | At narrow viewports, the catalog editor reverses the action buttons visually while keyboard focus follows their DOM order. | Remove flex-col-reverse so the stacked visual order matches the DOM order, or change the DOM order to match the intended visual order at narrow widths. |

## Remediation priorities

The remaining 1 moderate and minor findings can follow in normal work.

## What passed

3 checks ran and found nothing.

- No positive tabindex values or other CSS order utilities were found in the scoped pages.
- The shared content-width and grid rules do not reorder elements or change DOM-based tab order.
- The shared sidebar and page shell retain source order across their responsive layouts.

## Needs a human

Items a skill could not decide, or could not check automatically.

- **keyboard-navigator**: Static source review only; focus visibility was not runtime-tested at different viewport sizes.
- **keyboard-navigator**: The catalog editor button-order finding predates and is unrelated to the width changes.

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
    "web/app/catalog/page.tsx",
    "web/app/globals.css",
    "web/app/inventory/page.tsx",
    "web/app/layout.tsx",
    "web/app/page.tsx",
    "web/app/ppc/page.tsx",
    "web/components/Sidebar.tsx"
  ],
  "findings": [
    {
      "rule": "KEYBOARD-ORDER-001",
      "wcag": "2.4.3 A",
      "severity": "moderate",
      "confidence": "high",
      "location": "web/app/catalog/page.tsx:667",
      "summary": "At narrow viewports, the catalog editor reverses the action buttons visually while keyboard focus follows their DOM order.",
      "fix": "Remove flex-col-reverse so the stacked visual order matches the DOM order, or change the DOM order to match the intended visual order at narrow widths.",
      "foundBy": [
        "keyboard-navigator"
      ]
    }
  ],
  "passed": [
    "No positive tabindex values or other CSS order utilities were found in the scoped pages.",
    "The shared content-width and grid rules do not reorder elements or change DOM-based tab order.",
    "The shared sidebar and page shell retain source order across their responsive layouts."
  ],
  "notes": [
    {
      "skill": "keyboard-navigator",
      "note": "Static source review only; focus visibility was not runtime-tested at different viewport sizes."
    },
    {
      "skill": "keyboard-navigator",
      "note": "The catalog editor button-order finding predates and is unrelated to the width changes."
    }
  ],
  "counts": {
    "critical": 0,
    "serious": 0,
    "moderate": 1,
    "minor": 0
  },
  "components": [],
  "score": 96,
  "grade": "A",
  "penalty": 2,
  "checks": 10,
  "generated": "2026-11-08",
  "template": "web"
}
```
