# Flames POS — Product & Technical Roadmap
*Blink POS-inspired evolution plan · drafted 20 Aug 2026 · sources: `blink-pos-architecture.md`, blinkco.io, full codebase inventory, 57-finding QA audit (qa-review.md)*

**Scope decisions locked with owner:** QR dine-in ordering **in roadmap** · inventory goes **all the way to procurement** (suppliers/POs/GRN) · aggregator **channel tracking now, Foodpanda API later**.

---

## 1. Executive Summary

Flames POS today is a competent **single-branch till**: POS with tabs/rounds, a genuinely good KDS, order history, basic analytics, menu management, receipt printing, and a public menu. Blink is a **restaurant operating system**: the same core plus shift/cash discipline, per-user staff, recipe-level inventory, procurement, channels, expenses, and a settings switchboard — organised into 9 module groups.

The gap is not UI polish; it is **four missing architectural foundations**:

1. **Order line items live in a JSONB blob** — blocks per-item analytics, inventory deduction, station routing, and split-by-item billing.
2. **No payments ledger** — one `payment_mode` column blocks split bills, multi-tender, shift reconciliation, and channel settlement.
3. **Two shared PIN accounts** — blocks per-action attribution, permissions, shift ownership, and an honest audit trail.
4. **No branch dimension** — every new table built without it becomes retrofit work if a second branch ever opens.

The plan: **stabilise the money path first** (the QA audit found 3 critical + 13 high defects, several of which touch money), **lay the four foundations second**, then build features in dependency order. Rushing features onto the current schema is the one path that guarantees rework.

---

## 2. Current Flames POS Assessment

**Stack:** Next.js 16 App Router + Supabase (Postgres/RLS/Realtime/Storage) on Vercel. ~8k lines. Clients write to Postgres directly through anon key + RLS; server actions only for login/settings/reports.

| Module | State |
|---|---|
| `/pos` | Strong. Cart, variants/modifiers, dine-in/takeaway/delivery, waiter, table #, customer capture by phone, discount (Rs/%), tabs + rounds, idempotent checkout (partial), cart-draft recovery, silent thermal printing |
| `/kds` | Strong. 3 lanes, FIFO, round badges, per-ticket timers (5m/10m), chime, realtime + poll |
| `/orders` | Strong. Server-side paging/filter/search/sort, reprint, void (unpaid-only, reason required) |
| `/reports` | Basic. Revenue/orders/AOV + trend, payment mix, busiest hours, top items, per-waiter |
| `/menu` | Good. Item + category CRUD, image upload, 86 toggle. **Modifiers have no UI** (SQL-only) |
| `/settings` | 7 fields total (merchant, Raast ID, QR toggle, tax rate/label, auto-print) |
| `/customer` | Public read-only menu, grid/list |
| Auth | 2 shared accounts (admin/staff), 6-digit PIN, role from `profiles`, middleware-gated routes |

**Data model:** `orders` (line items as JSONB; a "tab" = unpaid order; rounds append into the same row), `menu_items` (variants JSONB + modifier keys), `categories`, `modifiers` (2 seed rows, read-only), `customers` (written as side-effect, **no UI**), `waiters` (lookup only, no UI), `store_settings` (singleton), `profiles`.

**Debt that must precede feature work** (from the 57-finding audit): settle-from-drawer overcharge; round-append not idempotent and racy; checkout idempotency key not persisted; tab discount dropped at settle; unpaid tabs counted as revenue; UTC day-bucketing (restaurant is UTC+5); Date.now() invoice numbers, sometimes never stored; orders RLS grants staff full UPDATE/DELETE (void gate is client-side only); global logout kills all terminals; KDS full-table polling.

**Strengths to preserve:** the tabs/rounds model (Blink-equivalent "running orders" — genuinely good), KDS UX, receipt pipeline (hard-won: measured @page sizing, kiosk printing), server-side orders pagination, the black brand theme, RLS-first posture on menu data.

---

## 3. Blink POS Feature Analysis

From the logged-in walkthrough (`blink-pos-architecture.md`): Laravel/Blade, server-rendered, session pinned to one branch, 9 sidebar groups. What matters is not Blink's tech (older than ours) but its **operational model**:

**Core** (every restaurant needs): Order Management (till, order list, reversal, dine-in tables/waiters, KDS + station screens, **shift schedule**), Menu (categories/items/variations/**deals**), payments with **charges/discounts/vouchers/credit**, Dashboard (net sales, cancelled orders, **expected cash, active shifts**, category/channel splits).

**Advanced** (scale features): Inventory (sub-recipes → ingredient counts → stock counts), Warehouse (ingredient master, suppliers, POs, transfers, supplier balances), Sales Channels (marketplace, Foodpanda, own riders), Expenses/Income, Food-Cost + BI + branch-wise reporting, multi-branch + per-branch item toggles.

**The unifying pattern — Blink's order lifecycle A→Z:** menu defined → **shift opened with float** → order created (any channel) → KOT fires per station rules → payment settles with charges/discounts/vouchers → **stock auto-depletes via recipes** → low stock triggers PO/transfer → everything rolls into one reporting trail. Flames today implements steps 1, 3, 4 (screen only), 5 (partially), 8 (thinly) — and nothing of 2, 6, 7.

**Master Settings is a lesson in itself:** one switchboard for KOT rules, customer-prompting, per-item instructions, drawer rules, tax pre/post discount, card-ref requirements, sounds, waste reasons. Flames' equivalent is 7 fields; the roadmap grows it deliberately with each phase.

**Blink features judged NOT relevant for Flames:** Blink Marketplace (their own aggregation product), Blink Loyalty branding (build our own light version much later), branch-wise stats & per-branch menu toggles (until a second branch is real), Air Inventory (semantics unclear even in their UI), Help & Support module, multi-language admin.

---

## 4. Feature Gap Analysis

Classification: ✅ Have · 🔧 Have, needs improvement · ➕ Missing, recommended · ✖ Not relevant now.

| Area | Capability | Status | Notes |
|---|---|---|---|
| Ordering | Till / cart / order types | 🔧 | Solid; fix audit defects; add per-item notes (column exists, no UI), open-price guard |
| Ordering | Tabs / running orders / rounds | 🔧 | Good model; make round-append + settle atomic & idempotent (P0) |
| Ordering | Order history & filters | ✅ | Add channel filter when channels land |
| Ordering | Void / reversal | 🔧 | Unpaid-only today; add manager-PIN approval + paid-order refund flow |
| Ordering | Split bill / multi-tender | ➕ | Needs payments ledger (P1) |
| Ordering | Order channel (walk-in/Foodpanda/phone) | ➕ | Column + till picker + reports split; API integration later |
| Floor | Table map / statuses / transfer-merge | ➕ | Today table # is free text |
| Floor | Waiter assignment | 🔧 | Exists; fold waiters into staff model (P1) |
| Kitchen | KDS lanes/timers/rounds | ✅ | Fix full-table polling (P0) |
| Kitchen | Station screens + KOT routing | ➕ | Per-category/item station; print or screen per station |
| Kitchen | KOT printing rules | ➕ | Blink Master-Settings-style: on open/complete, per variation, QR on KOT |
| Kitchen | KDS/prep-time metrics | ➕ | Data already captured (`last_round_at`, bump times) — just never aggregated |
| Cash | Shift open/close, float, X/Z, over-short | ➕ | Biggest single operational gap vs Blink |
| Cash | Cash movements (paid-in/out, drops) | ➕ | With shifts |
| Cash | Expenses / income | ➕ | Light ledger, category + receipt photo |
| Staff | Per-user accounts, fast PIN switch | ➕ | Foundation; replaces shared admin/staff PINs |
| Staff | Granular permissions (void/discount/refund/cash) | ➕ | Beyond binary admin/staff |
| Staff | Audit log | ➕ | Trigger-based on money + menu + settings tables |
| Menu | Items / categories / variants | ✅ | Add sort order, cost price (inventory), station tag |
| Menu | Modifier management UI | ➕ | Table exists; CRUD screen missing |
| Menu | Deals / combos | ➕ | Bundle price + component items (feeds KDS + inventory correctly) |
| Menu | Per-branch toggles | ✖ | Single branch |
| Pricing | Discount presets + approval + limits | 🔧 | Ad-hoc discount exists; add presets, manager gate, max % |
| Pricing | Vouchers / promo codes | ➕ | Medium priority |
| Pricing | Service charge / delivery fee ("Charges") | ➕ | Configurable lines between subtotal and tax |
| Pricing | Credit customers (khata) + balance sheet | ➕ | Common for corporate clients in PK; after payments ledger |
| Inventory | Ingredients, recipes/sub-recipes | ➕ | Owner chose full depth |
| Inventory | Auto-deduction on sale, stock counts, variance | ➕ | Needs order line items (P1) |
| Inventory | Waste log with reasons, auto-86, low-stock alerts | ➕ | |
| Procurement | Suppliers, POs, GRN, supplier balances | ➕ | Owner chose to include |
| Procurement | Inter-branch transfers | ✖ | Until branch 2 |
| Reporting | Dashboard KPIs | 🔧 | Fix unpaid-in-revenue + UTC bucketing; add expected cash, active shift, cancelled KPI, category & channel splits |
| Reporting | Food-cost dashboard | ➕ | After inventory |
| Reporting | Day-end (Z) report + export | ➕ | With shifts |
| Customers | Profiles, history, search | 🔧 | Table exists + auto-capture; **no screen** |
| Customers | Loyalty | ✖ | Long-term vision |
| Ordering (guest) | QR dine-in ordering → KDS | ➕ | Owner-selected; reuses `/customer` menu + KDS |
| Ordering (guest) | Full online ordering + payment | ✖ | Vision (blocked on merchant account anyway) |
| Channels | Foodpanda API integration | ✖ | Later; tracking field now |
| Delivery | Rider assignment/tracking | ➕ | Light: rider on delivery orders + status; fleet mgmt is vision |
| Settings | Master-settings switchboard | 🔧 | Grows with each phase |
| Settings | Devices/printer registry | ➕ | With KOT routing |
| Platform | Multi-branch readiness | ➕ | Schema readiness only (see §7) |
| Platform | Notifications (sound/status) | 🔧 | KDS chime exists; add order-ready + low-stock + shift alerts |

## 5. Recommended Features — the ten that matter most

Ranked by operational value to Flames, each pointing at its phase:

1. **Atomic order pipeline (RPCs) + order line items** — P1. Unlocks everything below; kills the double-bill/race defects.
2. **Payments ledger** — P1. Split bills, multi-tender, shift math, channel settlement all hang off it.
3. **Per-user staff with PIN switching + permissions** — P2. Attribution, approvals, audit trail; ends the shared-PIN era.
4. **Shift & cash management (float, X/Z, over/short)** — P2. The single biggest Blink capability Flames lacks; expected-cash discipline pays for itself in the first month.
5. **Inventory: recipes → auto-deduction → waste → food cost** — P5. Owner-selected full depth; turns the menu into a costed product.
6. **Procurement: suppliers, POs, GRN, balances** — P5. Closes the loop from stock to purchasing.
7. **KOT printing + station routing** — P4. Kitchen paper trail per station; the KDS becomes stations, not one board.
8. **Charges, discount presets with approval, vouchers** — P3. Money rules move from ad-hoc till behaviour to configured policy.
9. **Channel tracking + customers screen** — P3. Foodpanda/phone orders keyed at the till and reported honestly; the customer data already captured becomes visible.
10. **QR dine-in ordering** — P6. Guests order from the table into the existing KDS; settle stays at the till (no payment gateway needed).

---

## 6. Phase-by-Phase Implementation Plan

Complexity: S ≈ ≤1 day · M ≈ 2–5 days · L ≈ 1–3 weeks. Priorities: C/H/M/L.

### Phase 0 — Stabilise now (no schema changes; ship this week)
Immediate fixes from the QA audit that do **not** overlap the Phase-1 RPC work (patching settle/round client-side first would be the same code written twice — those two defects die in P1 instead).

| Fix | Where | Pri | Size |
|---|---|---|---|
| Block settle-from-drawer when unsent items are in the cart | `pos/page.js attachTab` | C | S |
| KDS: narrow select + active-status filter + partial index | `supabaseDb.js`, `kds/page.js` | C | S |
| Persist checkout idempotency key with the cart draft; mint per basket not per modal | `pos/page.js` | H | S |
| Restore a tab's discount when attaching for settle | `pos/page.js attachTab` | H | S |
| Reports: stop counting unpaid tabs as revenue (separate "open tabs" tile) | `reports/actions.js` | H | S |
| Pin Asia/Karachi for day/hour bucketing (interim JS fix; permanent SQL fix in P3) | `reports/actions.js` | H | S |
| PIN change: enforce exactly 6 digits | `profile/actions.js` | H | S |
| Logout: `scope:'local'` so one terminal signing out doesn't kill the rest | `logout/actions.js` | H | S |
| Reprint: stamp the original order's date, watermark "REPRINT" | `ReceiptPreview.jsx` | H | S |
| Scope receipt print CSS so Reports "Export PDF" stops printing blank | `globals.css` | H | S |
| Reset discount state between orders | `pos/page.js` | M | S |
| Contrast (near-black text on brand orange) + 44px touch targets on cart controls | `globals.css`, `pos.module.css` | M | S |

Remaining audit mediums/lows: schedule opportunistically inside later phases (each phase touches their files anyway).

### Phase 1 — Transactional core (the keystone)
Everything later stacks on this. One migration wave + one RPC layer; client pages barely change.

| Feature | What / why | DB | UI | Depends | Pri | Size |
|---|---|---|---|---|---|---|
| Branch dimension (readiness only) | Avoid the retrofit trap; single row, invisible to users | `branches` (1 row), `branch_id` on `orders` + every new table, defaulted | none | — | H | S |
| Order line items | Per-item analytics, inventory, stations, split-by-item all need line identity | `order_rounds`, `order_items` (+ backfill from JSONB); JSONB demoted to receipt snapshot maintained by RPCs | none (readers migrate later) | — | C | L |
| Payments ledger | Split/multi-tender, shift math, refunds | `payments` (+ backfill), `payment_status='partial'` | none yet | — | C | M |
| Atomic order RPCs | `create_order`, `append_round`, `settle_order`, `void_order`: `FOR UPDATE`, idempotency keys, totals recomputed server-side, expected-total check | SECURITY DEFINER functions; `REVOKE INSERT/UPDATE` on money tables from clients | `supabaseDb.js` becomes thin `.rpc()` wrappers | line items, payments | C | L |
| Real invoice numbers | Sequential per day, always stored | `invoice_counters` table, assigned inside `settle_order` | receipt reads stored number | RPCs | H | S |
| Audit log | Append-only trail written by the RPCs | `audit_log` (staff_id nullable until P2) + price/availability trigger on `menu_items` | admin viewer (simple list) | RPCs | H | M |

**Defects retired as side-effects:** round double-fire and two-terminal races, non-atomic settle, phantom/duplicate invoice numbers, the discount recompute class, server-trusted totals.

### Phase 2 — People & cash custody

| Feature | What / why | DB | UI | Depends | Pri | Size |
|---|---|---|---|---|---|---|
| Staff accounts + PIN switching | Terminal stays signed in; humans switch in 2s with a 4-digit PIN; Supabase auth users become *device* accounts | `roles` (permissions jsonb), `staff` (pin_hash, server-verified), `staff_sessions`; `staff_login` RPC + rate limiting | Lock/switch screen at till; header chip showing active cashier | P1 RPCs | C | M |
| Permission enforcement | `can_void`, `can_discount`, `cash_manager`, manager-PIN override inline at the till | checks inside existing RPCs | approval modal | staff | H | M |
| Waiters → staff merge | One people table; keep order attribution | migrate `waiters` rows into `staff` (role waiter, `can_login=false`), repoint FK, drop table | waiter picker reads staff | staff | M | S |
| Shifts & drawer | Open with float, X mid-shift, Z at close, over/short recorded, frozen Z snapshot | `shifts`, `cash_movements`; `open_shift`/`close_shift` RPCs; `payments.shift_id` stamped at tender; refuse cash tender with no open shift | Shift screen, X/Z report, close-shift count flow | payments | C | L |
| Expenses (light) | Petty cash from the drawer shows up in both drawer math and P&L | `expenses` linked to `cash_movements(kind='expense')` | simple expense entry + list | shifts | M | S |
| Staff mgmt UI | Add/deactivate staff, assign roles, reset PINs (admin) | — | staff admin screen | staff | H | S |

### Phase 3 — Selling surface

| Feature | What / why | DB | UI | Depends | Pri | Size |
|---|---|---|---|---|---|---|
| Reports on SQL | Aggregation moves from JS-over-full-rows to SQL over `order_items`/`payments`; permanent Karachi TZ fix; adds category split, channel split, expected-cash tile, cancelled KPI | views/RPCs | dashboard additions | P1 | H | M |
| Charges | Service charge / delivery fee as configured lines between subtotal and tax | `charges` config + `order_charges`; totals engine in RPCs | Settings + till line display | P1 | H | M |
| Discount presets + policy | Named presets, max %, manager approval on override | `discount_presets`; checks in RPCs | till picker + approval modal | P2 perms | H | M |
| Vouchers | Code-based redemption, single/multi-use, expiry | `vouchers`, `voucher_redemptions` | till redeem + admin CRUD | discounts | M | M |
| Split bill | By amount free with payments ledger; by item adds allocations | `payment_allocations` | split-tender modal | P1 | M | M |
| Channels | Walk-in / Foodpanda / phone-in keyed at till; reports split by channel | `channels` + `orders.channel_id` | till picker + orders filter | P1 | H | S |
| Riders (light) | Assign a rider to delivery orders, mark dispatched/delivered | rider = staff role; `orders.rider_id`, delivery status | assign control on delivery orders | P2 staff | M | S |
| Deals / combos | Bundle price exploding to component lines (KDS + inventory stay correct) | `deals`, `deal_items`; explosion in `create_order` | menu mgmt + till tiles | P1 | M | L |
| Credit customers (khata) | Corporate/regular credit with balance sheet | `payments.method='credit'`; `credit_accounts`, statement view | customer credit screen | payments, customers | M | M |
| Customers screen | The data already captured becomes visible: list, search, history, export | none (table exists) | `/customers` route | — | H | M |
| Per-item notes | "No onions" per line; `orders.notes` UI (column exists, unwritten) | `order_items.notes` | till note field + KDS render | P1 | M | S |

### Phase 4 — Floor & kitchen

| Feature | What / why | DB | UI | Depends | Pri | Size |
|---|---|---|---|---|---|---|
| Table map | Real tables with states (free/seated/billed), transfer & merge | `floor_tables` + `orders.table_id` (free-text kept as fallback) | floor screen at till | P1 | H | M |
| Stations | Route items to grill/tandoor/fry/dessert | `stations`, `menu_items.station_id`, snapshot on `order_items` | station filter chips on KDS | P1 lines | H | M |
| KOT printing | Paper ticket per station per round, per Master-Settings-style rules; reprint log | `kot_prints` log; printer registry (`devices`) | print templates + settings | stations | H | L |
| KDS on realtime lines | Subscribe to rounds/lines instead of whole orders; per-line bump | uses P1 tables | KDS refinement | P1 | M | M |
| Prep-time metrics | Fired→bumped times already captured; aggregate into a KDS dashboard | view over rounds | small dashboard | P1 | M | S |

### Phase 5 — Inventory → procurement (owner-selected full depth)

| Feature | What / why | DB | UI | Depends | Pri | Size |
|---|---|---|---|---|---|---|
| Ingredients | Master list, units, categories, cost | `ingredients`, `ingredient_categories` | admin CRUD | — | H | M |
| Recipes | Per item/variant ingredient quantities; sub-recipes | `recipes`, `recipe_lines` (sub-recipe self-ref) | recipe editor on menu item | ingredients | H | M |
| Stock ledger + auto-deduction | Sale deducts via recipe; ledger not mutable counters | `stock_moves` (purchase/deduction/waste/count_adjust); hook in `create_order`/`append_round` | stock level view | P1 RPCs, recipes | H | M |
| Counts, variance, waste | Daily/periodic counts vs theoretical; waste with reasons (Blink Master-Settings rule) | count sessions → `count_adjust` moves | count screen, waste capture at till/kitchen | ledger | H | M |
| Low-stock alerts + auto-86 | Ingredient runs out → dish 86s itself; reorder prompts | thresholds on ingredients | alerts + toggle wiring | ledger | M | S |
| Food-cost dashboard | Theoretical vs actual cost %, waste cost, margin per dish | views joining stock_moves × order_items × payments | dashboard | ledger | H | M |
| Suppliers & POs | Suppliers, purchase orders, goods-received (GRN → purchase moves), supplier balances | `suppliers`, `purchase_orders`, `po_lines`, `grn` | procurement screens | ledger | H | L |

### Phase 6 — Growth

| Feature | What / why | DB | UI | Depends | Pri | Size |
|---|---|---|---|---|---|---|
| QR dine-in ordering | Table QR → `/customer` gains a cart → order lands unpaid on the KDS tied to the table; settle at till | guest session tokens; reuses `create_order` | customer cart + confirm flow; table QR generator | P1, P4 tables | H | L |
| Notifications | Order-ready chime/screen, low-stock, shift-not-closed, day-end summary | `notifications` or push via service worker | settings toggles | phases vary | M | M |
| Loyalty (lite) | Visit counts/points display, manual reward redemption | `loyalty_ledger` | customer screen + till badge | customers | L | M |
| Foodpanda API | Orders auto-land as Pending; menu sync | webhook server actions + channel mapping | channel inbox | channels; **external partner access** | M | L |
| Branch #2 activation | Insert a branches row, per-branch settings, admin branch switcher | per-branch `store_settings` row | branch picker (admin) | P1 readiness | L | M |

---

## 7. Database & Architecture Recommendations

Decisions (each argued in full in the design pass; condensed here):

1. **`order_items` becomes canonical; JSONB demotes to snapshot.** New tables `order_rounds` (round_no, `client_request_id` UNIQUE, fired_by) and `order_items` (menu_item_id FK + name/price **snapshots**, variant/modifiers as JSONB snapshots inside the row, qty, line_total, station_id, per-line void fields). Backfill history with `jsonb_array_elements(...) WITH ORDINALITY`. RPCs write rows then regenerate `orders.items` JSONB in the same transaction so every existing read surface keeps working; readers migrate reports → KDS → receipt, then the snapshot is dropped or kept for reprint fidelity. *Never* project rows from JSONB — rows are the source.
2. **`payments` table**; `orders.payment_mode` demoted to derived display; `payment_status` gains `'partial'`; history backfilled (one row per paid order, `'unrecorded'` where mode was NULL). Methods: cash/card/raast/channel_online/credit/unrecorded, with `tendered` for change math and `taken_by`/`shift_id` attribution.
3. **All money mutations become SECURITY DEFINER Postgres RPCs** — `create_order`, `append_round`, `settle_order`, `void_order`, `open_shift`, `close_shift`, `record_cash_movement`, `staff_login` — with `SELECT … FOR UPDATE`, idempotency via unique request ids, totals recomputed server-side and checked against the client's expected total. Enforced with **privileges, not just policies**: `REVOKE INSERT, UPDATE` on orders/order_items/payments/shifts from `authenticated` (SELECT grants untouched so reads keep working). `supabaseDb.js` becomes a thin `.rpc()` wrapper layer. Server actions stay for secrets/orchestration (login, settings, reports, future webhooks). Rule: **invariants in the database; orchestration in server actions; nothing money-shaped in client JS.**
4. **Staff = app-level identity, not Supabase users.** The two auth accounts become *device tiers* (terminal, admin) — existing `profiles`/`is_admin()` machinery survives reinterpreted. People live in `staff` (hashed 4-digit PIN, column privilege revoked), verified by a `staff_login` RPC with rate limiting; `staff_sessions` id passes into every money RPC for per-person permission checks (`can_void`, `can_discount`, `cash_manager`) and audit attribution. Two-second switching, no re-auth, Realtime untouched. Waiters merge into staff (same UUIDs, `can_login=false`).
5. **Multi-branch readiness = two rules, nothing more.** A one-row `branches` table; `branch_id NOT NULL DEFAULT <the-uuid>` on every **new** table plus retrofits on exactly `orders` and `store_settings`; every new **unique index includes branch_id** (e.g. `invoice_counters (branch_id, day)`). No branch UI, no per-branch RLS, no tenancy schema until branch 2 is real.
6. **Shifts stamp, never derive.** `payments.shift_id` is stamped at tender time by `settle_order` (the drawer-truth moment); time-window attribution is rejected outright — tabs opened in shift 1 and settled in shift 3 are *correctly* shift-3 cash. `close_shift` computes expected cash in SQL and freezes a `totals_snapshot` so Z-reports render identically forever. One open shift per (branch, register) via partial unique index.
7. **Invoice numbers from `invoice_counters`** (per-branch, per-day, `ON CONFLICT … RETURNING`) assigned inside `settle_order` — sequential, unique, always stored. Retires Date.now() numbering.
8. **Audit log is written by the RPCs**, not by generic row-diff triggers — triggers can only see the shared device account, never the person, and drown signal in KDS noise. One append-only `audit_log` (action, entity, staff_id, session, device, details jsonb; RLS: insert-only, admin-read, no update/delete policies). Single exception: a small trigger on `menu_items` for price/availability changes, which legitimately bypass RPCs.

---

## 8. UI/UX & Workflow Recommendations

- **Sidebar grows into module groups** (Blink's real lesson): *Service* (POS, Tables, Open Tabs), *Kitchen* (KDS, Stations, KOT log), *Money* (Shifts, Expenses, Orders), *Menu* (Items, Deals, Modifiers — finally with a UI), *Inventory* (Stock, Counts, Waste), *Procurement* (Suppliers, POs), *Insights* (Dashboard, Food Cost, Customers), *Admin* (Staff, Settings, Audit). Groups appear as their phase lands; terminal accounts see only what their tier allows.
- **Settings becomes a Master-Settings switchboard**, sectioned like Blink's: Business · POS behaviour (prompt for customer, per-item notes, discount policy) · KOT & printing · Shift & cash (require shift for cash, blind count) · Tax & payments (pre/post-discount tax, card-ref required) · Alerts. Each phase adds its section rather than scattering toggles.
- **Till workflow**: active-cashier chip + lock button in the header (tap → PIN pad → switched); active-shift indicator; channel picker beside order type; charges and split-tender live in the settle modal; manager-approval modal pattern reused for void/discount/refund.
- **Keep** the black theme, brand orange, tabs/rounds flow, KDS sounds. **Fix in P0**: white-on-orange contrast (near-black text on orange passes 5.7:1), 26px cart buttons → 44px, modal Escape/focus semantics, reduced-motion guards.
- **Receipts**: REPRINT watermark, stored invoice number always, per-payment lines when split, QR footer unchanged.

## 9. Priority Matrix

| | Now (P0) | Foundations (P1–P2) | Build-out (P3–P5) | Growth (P6) |
|---|---|---|---|---|
| **Critical** | drawer-settle guard, KDS query | order_items, payments, RPCs, staff+PIN, shifts | — | — |
| **High** | idempotency persistence, tab discount, revenue/TZ fixes, PIN regex, logout scope, reprint date, export PDF | invoice counters, audit log, permissions, staff UI | reports-on-SQL, charges, presets, channels, customers screen, tables, stations, KOT, inventory core, food cost, procurement | QR ordering |
| **Medium** | discount reset, contrast/touch | waiters merge, expenses | vouchers, split-by-item, riders, deals, credit, notes, KDS realtime, prep metrics, low-stock/auto-86 | notifications, Foodpanda API |
| **Low** | — | — | — | loyalty, branch #2 |

## 10. Dependencies & Risks

**Rework traps (build order is the point):** anything touching items built against JSONB (inventory, KOT, split-by-item, SQL analytics) is guaranteed rework — `order_items` first. Patching settle/append client-side then converting to RPCs = same function twice — convert once in P1. Shifts before payments forces drawer math onto a column that can't express split tender. Per-employee auth.users would be ripped out the first week the floor needs 2-second switching. Any new table/unique index without `branch_id` recreates the retrofit. Approval flows before roles exist have no approver.

**Delivery risks:** live-database migrations (mitigate: Supabase branch DB rehearsal, backfill reconciliation counts, additive-only migrations, RPC versioning `_v2` instead of mutating signatures); PL/pgSQL is harder to test than TS (keep functions small; pgTAP or SQL test scripts per RPC); Realtime payloads stay fat until the JSONB snapshot drops (acceptable at one branch); KOT needs printer hardware per station (procurement lead time); Foodpanda API needs partner access (external, unbounded); shifts/waste discipline is an **operational** change — staff training decides whether the data is real; single-developer bandwidth — every phase is sized to ship standalone value so the roadmap survives interruption.

## 11. Recommended MVP — commit to P0 + P1, then P2

- **This week (P0):** the twelve stabilisation fixes. Visible result: no more double-bill risk paths at the drawer, honest revenue numbers, correct dates, no more all-terminal logouts.
- **Next (P1):** the transactional core. Visible result: little UI change, but every order/settle/round becomes atomic, idempotent, line-item-based, with real invoice numbers and an audit trail — and every later phase stops being blocked.
- **Then (P2):** staff PINs + shifts. Visible result: the first Blink-class capability — named cashiers, a float, X/Z reports, over/short. This is the moment the product visibly levels up, and the right point to reassess pace before P3–P5.

## 12. Long-Term Product Vision

Flames POS as a **restaurant operating system for Pakistani single-brand operators**: full online ordering with payment (unblocks when the merchant account lands — Raast rails already half-built), Foodpanda orders auto-landing as Pending with menu sync, a second branch activated by inserting a row, rider dispatch with live status, loyalty tied to the customer ledger, WhatsApp order-ready and day-end summaries, offline-first till with write queueing, and a BI layer reading the same `order_items`/`payments`/`stock_moves` spine — the same trail Blink's A-to-Z lifecycle taught: *menu → shift → order → KOT → payment → stock → purchase → report*, every step one system.

---

## Verification & rollout discipline (applies to every phase)

- Rehearse every migration on a Supabase **branch database**; backfills must reconcile (`COUNT(*)` and `SUM(total)` between JSONB and `order_items`, orders-paid vs payments rows) before promoting.
- RPC tests as SQL scripts: idempotency replay (same `client_request_id` twice → one round), two-terminal race (`pg_sleep` + concurrent settle → one wins, one raises), expected-total mismatch rejection.
- Two-browser live test on staging for each till flow (the QA harness from the audit — Playwright against the deployed site — is already built and reusable).
- Parallel-run each report after the SQL migration: JS numbers vs SQL numbers for the same period must match before the JS path is deleted.
- Nightly reconciliation query during P1–P2: orders.total vs Σ order_items.line_total vs Σ payments — alert on drift.
- Each phase ends deployed to production and used in service for at least a week before the next begins.
