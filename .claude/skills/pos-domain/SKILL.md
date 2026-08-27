---
name: pos-domain
description: >
  Restaurant-POS domain knowledge for Flames POS, distilled from a full
  walkthrough of the live Blink POS benchmark account. Use when designing or
  building any POS feature — orders, tills, shifts/cash, KDS, discounts,
  charges, inventory, reports — so flows, money math, naming, and permission
  verbs match how a proven POS actually works, and to know which reference doc
  answers which question.
---

# POS Domain — Flames POS working knowledge

Benchmark: Blink POS (blinkco.io), explored live on the restaurant's own account.
Deep references in the repo — consult before designing, don't re-derive:

- `docs/ROADMAP.md` — the committed phase plan (P0–P6) and rework traps. **Scope is
  locked; check the phase order before proposing any feature work.**
- `blink-pos-architecture.md` (repo root) — module atlas: every Blink screen/route.
- `docs/blink-walkthrough-flows.md` — screen-level flows: till anatomy, Z-report
  sections, KDS views, permission verbs, Master Settings switches, report catalog,
  and the adoption table mapping each finding to a phase.
- `docs/blink-screens/*.png` — screenshots of the key screens.
- `qa-review.md` — the 57-finding audit behind P0.

## Money math (use these words and this order)

- **Net Sales** = after-discount, excluding tax & charges. **TTV** = Net + Tax +
  Charges. **Gross** = Net + Discounts + Tax + Charges. Report all three.
- Discount is stored as a **rupee amount** (percent is only an input), applied to
  the subtotal; tax on the remainder (`src/lib/orderTotals.js` is canonical).
  Blink also supports tax-before-discount as a setting — never hard-code the
  assumption into new schema.
- Discounts have **kinds** (manual / preset / voucher / bank-BIN / loyalty);
  tag the kind when a discount lands, or shift/Z reporting can't split them.
- A restaurant **day runs on operation hours** (e.g. 6:00 AM–5:59 AM), not
  midnight. Any day/hour bucketing must use the operational day in Asia/Karachi.
- Grand-total **round-off** is a config concern (0/1/2 decimals, round-to-whole).

## Order identity (four ids, four jobs)

internal UUID · human order# · **token number** (short daily counter the counter
staff call out) · tax/FBR invoice number (minted at settle, stored, reprints
identical). Don't overload one column with all four jobs.

## Flow invariants (violating these = P0-class bug)

- Send-to-kitchen and take-money are **separate acts**: "Place Order" fires KOT +
  pre-receipt and leaves the order open; "Complete Order" settles. Never settle
  with unsent lines sitting in the cart.
- Checkout is idempotent via one client id **per basket**, persisted with the
  cart draft, cleared only when stored or abandoned.
- An open tab settled elsewhere must drop away, not linger attached.
- Recompute totals server-side at settle from stored lines; never trust screen.
- Voids/waste/cash-pulls always carry a **reason** (Blink adds a proof photo for
  cash pulls); approval flows need a permission behind them.

## Shift & cash (P2 blueprint)

Shift = open with float → tenders stamp `shift_id` → **Cash Pull** (amount +
reason, against system-computed drawer) → close with counted drawer. Z-report
sections, in order: shift details · order counts+money (Net/Charges/Tax/
discount-kinds/Gross/TTV) · order-type breakdown · cash & credit details ·
channel sales · items-sold summary · drawer: **Starting · System Cash · Pulls ·
Ending · Difference**. Refuse cash tender with no open shift.

## KDS

Two views: **Orders** (tickets, per-line Prep buttons — item-level state) and
**Item-Wise** (same item aggregated across tickets: "3 required, 0/3 prepared,
Mark All Prepared" — batch cooking). Stations are linked item→station, each with
its own screen. Elapsed-time colour coding; kitchen speed gets *measured*
(punch-in→serve vs per-item prep-time target). Narrow the KDS query to active
statuses + displayed columns only (`getKitchenOrders`).

## Permissions (P2 vocabulary)

Use Blink's verb list as the starting jsonb (full list in the walkthrough doc):
punch-order, order-type restrictions, manual-discount, open-order, on-hold,
waste-item, place-order, complete-order, change-payment-type, restrict-printing,
update-status per transition, per-entity CRUD, approval verbs (approve-PO,
receive-PO, pay-supplier), **per-report access**, per-station KDS access.
Staff: name, phone, PIN (server-verified), roles, allowed branches.

## Menu model

Item: price, discount price, **cost price**, **prep time (min)**, search code,
barcode, category, returnable policy, image, show-in-menu. **Variations are
shared objects** (Half/Full) with per-channel prices, linked to items — not
per-item strings. Recipes: ingredient + qty + **per order type**; ingredients
have units (g/ml/piece). Deals explode to component lines so KDS/stock stay true.

## Configured objects, not free-typed numbers

Charges (name, amount, order types, status), discount presets, vouchers
(code, single/multi-use, import), channels (name, order type, payment, credits),
credit accounts (khata) — all admin-CRUD tables the till *selects from*.
Free-typing money at the till is the exception (manual discount) and permission-gated.

## Working on this codebase

- Stack: Next.js App Router (JS, CSS modules) + Supabase; migrations applied by
  hand in the SQL Editor, numbered in `supabase/migrations/` with README table.
- Before item-shaped features: `order_items` must exist first (P1); before
  approval flows: roles must exist (P2). The six rework traps in ROADMAP §10 rule.
- Live-DB discipline: rehearse migrations on a branch DB, additive-only,
  reconcile backfills by COUNT/SUM before promoting; RPC versioning `_v2`.
- To re-explore Blink hands-on: Playwright `launchPersistentContext` with
  `--remote-debugging-port=9222`, let Adnan log in, then attach via
  `connectOverCDP` — navigate by clicking the app's own sidebar links (direct
  URLs bounce), watch for stray Bootstrap modal backdrops, and **stay
  read-only: never Place/Complete/Save/Delete on the live account.**
