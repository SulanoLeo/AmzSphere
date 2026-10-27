---
name: Autonomous Operations Console
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#464555'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#777587'
  outline-variant: '#c7c4d8'
  surface-tint: '#4d44e3'
  primary: '#3525cd'
  on-primary: '#ffffff'
  primary-container: '#4f46e5'
  on-primary-container: '#dad7ff'
  inverse-primary: '#c3c0ff'
  secondary: '#006a63'
  on-secondary: '#ffffff'
  secondary-container: '#99efe5'
  on-secondary-container: '#006f67'
  tertiary: '#684000'
  on-tertiary: '#ffffff'
  tertiary-container: '#885500'
  on-tertiary-container: '#ffd4a4'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#0f0069'
  on-primary-fixed-variant: '#3323cc'
  secondary-fixed: '#9cf2e8'
  secondary-fixed-dim: '#80d5cb'
  on-secondary-fixed: '#00201d'
  on-secondary-fixed-variant: '#00504a'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
  sidebar-surface: '#0B0F19'
  sidebar-card: '#111827'
  sidebar-border: '#1F2937'
  sidebar-active: '#4338CA'
  workspace-bg: '#F8FAFC'
  surface-card: '#FFFFFF'
  surface-border: '#E2E8F0'
  status-emerald: '#10B981'
  status-rose: '#F43F5E'
  status-amber: '#F59E0B'
  status-indigo: '#6366F1'
  metric-line: '#0E7490'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.025em
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.05em
  mono-metric-lg:
    fontFamily: JetBrains Mono
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.02em
  mono-metric-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  mono-code-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.25rem
  margin: 1rem
  margin-desktop: 1.75rem
  space-2xs: 0.125rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
  space-2xl: 2rem
---

## Brand & Style

This design system targets high-scale Amazon operators, e-commerce brand aggregators, and mission-critical catalog managers requiring real-time visibility, precise inventory controls, and low-latency operational throughput. The visual ethos combines tactical control-plane utility with executive clarity, replacing sprawling, cluttered enterprise interfaces with an ultra-dense, calibrated workspace.

The design movement blends **Corporate Modern** with subtle **Precision Glassmorphism**. Dark-mode navigational anchors provide deep contrast and focus, framing an ultra-crisp light slate operational workspace. Interfaces prioritize information density, rapid scanning, clear hierarchy, and atomic feedback loops. Subtle micro-interactions, distinct categorical status badges, and strict baseline typography ensure zero cognitive overload during complex catalog updates, margin alerts, and repricer adjustments.

## Colors

The color architecture creates a structural division between navigation/execution controls and primary data exploration:

- **Sidebar & Frame Surface:** Anchored in `#0B0F19` with elevated interactive slots in `#111827` and subtle dividing strokes in `#1F2937`. Active navigation states use vibrant indigo overlays (`#4338CA` / `#6366F1`) to create an immediate sense of position.
- **Operational Workspace:** Rendered in cool, fatigue-reducing `#F8FAFC` slate canvas. Elevated cards, data tables, and modal elements utilize crisp `#FFFFFF` surfaces with `#E2E8F0` structural boundaries.
- **Operational Status Indicators:**
  - **Success / Healthy:** `#10B981` (Emerald) for buy box possession, synced queues, and healthy margins.
  - **Warning / Rate Limits:** `#F59E0B` (Amber) for pending human authorizations, warning thresholds, and throttling states.
  - **Critical / Interrupted:** `#F43F5E` (Rose) for catalog write blocks, margin breaches, or failed synchronization tasks.
  - **Intelligence / Analytics:** `#0F766E` (Deep Teal) and `#6366F1` (Indigo) for velocity charts, mix breakdowns, and autonomous routing triggers.

## Typography

The typographic hierarchy establishes clear structural readability across data-rich views:

- **Headlines (Plus Jakarta Sans):** Brings contemporary warmth and geometric poise to page titles, operational domain headers, and drawer categories without sacrificing vertical space.
- **Body & Controls (Inter):** Systemized for multi-row data tables, inline controls, secondary descriptions, and contextual callouts. Highly legible at 11px to 13px sizes.
- **Numeric & Identity Data (JetBrains Mono):** Applied systematically to ASINs, SKUs, inventory counts, rate limit timeouts, currency figures, and chart axis values. Utilizes uniform tabular figures to prevent horizontal jitter during live telemetry updates.
- **Eyebrow & Category Micro-Labels:** Rendered in `label-sm` or `label-md` with uppercase styling and expanded tracking (+0.04em to +0.05em) for high visual scan speed.

## Layout & Spacing

The system implements an asymmetric, high-efficiency dashboard layout:

- **Desktop Framework:** A dual-plane viewport layout. A fixed, dark-mode navigation rail or expanded drawer (width: 240px locked, collapsible to 68px micro-rail) anchors the left axis. The operational workspace uses a 12-column fluid grid with `1.25rem` gutters and `1.75rem` outer canvas padding.
- **Tablet Reflow (768px – 1024px):** The navigation collapses into an iconified docked rail (`68px`), table columns prioritize primary metrics (SKU, Stock, Velocity), and secondary columns transition behind disclosure drawers.
- **Mobile Handset (< 768px):** Navigation transitions to a top app-bar with an off-canvas drawer overlay. KPI metrics flow into a 2-column or single-column stack, card paddings scale from `space-lg` to `space-md`, and dense tables support horizontal scroll with locked primary identifier columns.
- **Vertical Rhythm:** Strict multiples of 4px and 8px govern internal component padding. Metric cards maintain a compact internal padding (`space-lg`), maximizing data-to-pixel ratio.

## Elevation & Depth

Visual depth combines crisp micro-borders with light ambient shadows rather than dramatic heavy elevation:

- **Level 0 (Workspace Canvas):** `#F8FAFC` flat surface.
- **Level 1 (Data Cards, Grid Containers):** `#FFFFFF` background with a crisp `1px solid #E2E8F0` border and a soft ambient shadow: `0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.03)`.
- **Level 2 (Hover Targets & Interactive Panels):** Slight shadow lift (`0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.05)`) with an active stroke highlight (`#CBD5E1`).
- **Level 3 (Sticky Headers & Fixed Bars):** Translucent backdrop blur (`backdrop-filter: blur(8px)`) over `rgba(255, 255, 255, 0.88)` with a lower border stroke in `#E2E8F0`.
- **Level 4 (Floating Modals, Flyouts & Filter Panels):** `0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.06)` combined with a sharp `#E2E8F0` border enclosure.
- **Dark Navigation Sidebar Elevation:** Pure flat `#0B0F19` backdrop with `#1F2937` borders; interactive active states leverage pure indigo fills (`#4338CA`) without outer glow to maintain functional discipline.

## Shapes

The interface embraces a tailored **Soft** shape geometry (`roundedness: 1`). Enterprise tools require sharp data alignment; excessive curvature wastes valuable pixel area.

- **Base Components:** Standard inputs, buttons, metric cards, and table wrappers utilize `0.375rem` (6px) border radii.
- **Status Badges & Micro-Pills:** Rounded pill geometry (`9999px`) reserved specifically for discrete state tags (e.g., "Buy Box owned", "Rate-Limited", "Optimization").
- **Tables & Section Enclosures:** `0.5rem` (8px) corners with clipped content edges.
- **Control Icons & Radio Buttons:** Consistent circular forms for radio inputs and status ping dots; precise `4px` corner radii for checkboxes.

## Components

### Buttons
- **Primary:** Solid `#4F46E5` background, `#FFFFFF` text, `0.375rem` radius, `0.5rem 0.875rem` padding, font weight 600. Active click scale `0.98`.
- **Secondary / Action Outlines:** `#FFFFFF` background, `1px solid #CBD5E1` border, `#334155` text. Hover: `#F8FAFC` background, `#0F172A` text.
- **Ghost:** Transparent background, `#64748B` text, hover: `#F1F5F9`.

### Badges & Status Chips
- **Success (Green):** Background `rgba(16, 185, 129, 0.1)`, text `#065F46`, border `1px solid rgba(16, 185, 129, 0.3)`. Contains optional `6px` solid emerald status indicator dot.
- **Warning / Alert (Amber):** Background `rgba(245, 158, 11, 0.1)`, text `#92400E`, border `1px solid rgba(245, 158, 11, 0.3)`.
- **Informational / Operational (Indigo/Teal):** Background `rgba(99, 102, 241, 0.1)`, text `#3730A3`, border `1px solid rgba(99, 102, 241, 0.25)`.
- **Geometry:** Height 22px, padding `0 8px`, font size 11px, `rounded-full`.

### Metric Cards & Micro-Charts
- **Structure:** Container `#FFFFFF`, border `1px solid #E2E8F0`, padding `1rem`. Top row displays metric category tag and uppercase subtitle; middle row displays primary data value in `JetBrains Mono` at 24px; bottom row features a sparkline micro-chart (stroke width 2px, no fills or subtle gradient fade) with color-coded baseline indicator.

### Data Tables
- **Header:** Sticky positioning, background `#F8FAFC`, uppercase micro-labels (`JetBrains Mono`, 11px), bottom border `1px solid #E2E8F0`, zero text wrap.
- **Rows:** Alternating subtle row-hover effect (`#F8FAFC`), row height 40px for compact density or 48px for standard views, border-bottom `1px solid #F1F5F9`. Numeric columns right-aligned with tabular numerals.
- **Action Cells:** Right-aligned inline quick-actions (sync, inspect, trigger script) revealing on hover.

### Navigation Drawer
- **Sidebar Canvas:** `#0B0F19` background with right border `1px solid #1F2937`.
- **Items:** Height 36px, `0.375rem` radius, horizontal padding `0.75rem`, text `#94A3B8`, icon `#64748B`.
- **Active State:** Background `#4338CA`, text `#FFFFFF`, icon `#FFFFFF`, left accent bar or distinct solid background color.

### Form Inputs & Search Fields
- **Search & Filter:** Height 34px, background `#FFFFFF`, border `1px solid #CBD5E1`, text font size 13px, placeholder color `#94A3B8`. Focus: `2px solid #6366F1` ring offset with `0px`.