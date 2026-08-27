# Blink POS — Screen-Level Walkthrough (27 Aug 2026)

Second pass over the live `pos.blinkco.io` account, this time **inside the flows** rather
than mapping the sidebar (that map is `blink-pos-architecture.md` in the repo root).
Logged in by Adnan; explored read-only over the Chrome debug port — no order was placed,
no setting saved, nothing created or deleted. Screenshots in `docs/blink-screens/`.

Blink is mid-redesign: the till offers an Old/New theme choice and the old one is
**discontinued after 31 Aug 2026**. Everything below is the New Theme — this is the UX
Blink itself considers current, so it's the right benchmark.

---

## 1. The till (`/invoiceCreate`) — how an order is actually rung

Three-pane layout: **category rail** (sticky, with item counts per category) →
**item grid** (photo cards, name + price, search by name *or code*) → **cart pane**
(order type, lines, tender, totals, actions). The app sidebar auto-collapses to an icon
rail the moment the cart has items — the screen hands itself over to selling.
`[till-new.png]`

What the cart pane holds, top to bottom:

| Zone | Controls | Notes |
|---|---|---|
| Order type | Dine-In / Takeaway / Delivery segmented buttons | Switching re-shapes the form below, same as ours |
| Channel | `POS` select (top bar) | Channel is *chosen at the till*, feeding channel reporting |
| Lines | qty − / n / +, per-line ✏️ | ✏️ opens **Special Instruction** modal, 50-char limit, per item |
| Tender | Cash / Card toggle | Delivery adds hidden third option **Card on Delivery** |
| Adjustments | Select Charges… (multi), Select Voucher, Manual Voucher Code + Apply | Charges/vouchers are *configured objects*, not free-typed numbers |
| Customer | Phone, Name (Delivery adds Address) | Master Settings can force a prompt on order creation |
| Totals | Sub Total, Discount, Tax Excl. (%), Grand Total | Recomputed live |
| Actions | **On-Hold** · **Place Order (Pre-Receipt)** · **Complete Order (Sale Receipt)** | Dine-in adds **Open Order** (their "open tab") |

Flow semantics worth copying exactly:

- **Place Order vs Complete Order** — *Place* fires the KOT and prints a **pre-receipt**
  (bill presented, order stays open); *Complete* settles and prints the **sale receipt**.
  That's a first-class distinction between "send + bill" and "take money", right on the
  main screen — our `canSettle` guard is the same idea but their naming is clearer.
- **On-Hold** — parks a basket without firing the kitchen. We have a localStorage draft;
  they have it as an explicit, named order state a cashier chooses.
- **Dine-in** requires **Table*** and **Waiter*** (both from configured lists) before
  Open Order is possible.
- Per-line special instructions (their `order_items.notes`) — P3 in our roadmap; here it's
  a tiny pencil on every cart line.
- Items with variations open a variant picker before Add To Cart (`btnSave_qty`,
  "has-option") — Half/Full are *shared variation objects* linked to items, not per-item
  strings, each with per-channel custom prices.

Order types: takeaway keeps the pane minimal; the cashier can ring a takeaway sale in
**4 taps** (item → Complete Order → confirm → done). That's the bar for our pay-now path.

## 2. Orders (`/invoice`) and the order detail

List = status **tab bar with live counts** (All / Pending / In Kitchen 3 / Delivered /
Dispatched / Ready / Rejected / Auto Rejected / Pre Order) over a filterable table
(order#, type, branch, payment method, date range, channel, customer name/number).
Export to Excel with an **export history** log. `[order-detail.png]`

Columns: Order Number · Date · **Punched By** · Channel Name · Order Type · Payment Type ·
Order Status · **Ready At** · Total · Rider · View.

Order detail (modal): customer block, branch, order#, **Token No** (`P-3631-0` — a short
daily counter for calling out orders, separate from order# and invoice#), channel,
status, times (created / ready / delivery), table+waiter, payment type, **Tax ID** (FBR
invoice number — stored per order), rider block with **tracking link**, note, item lines
with per-line After-Discount column, totals. Actions: Reject · Dispatch+Deliver ·
Dispatch · Print.

Three identifiers per order — internal id, human order# (`13ESKI-217`), spoken token
(`P-3631-0`) — plus the tax invoice id. Our single `order_number` is doing all four jobs.

## 3. Shift screen (`/branch_shift`) — the P2 blueprint

Table of shifts: # · Agent · Branch · Shift Start · Shift End · Shift Report. Toolbar:
Datewise Report · Filter User · **Cash Pull** · (End Shift on the open row).

**Cash Pull modal** `[cash-pull.png]`: shows *Available Cash in Drawer* (system-computed,
Rs 2,895.00 on this account), then Amount* + Reason* + **Proof Image*** (JPEG/PNG ≤5MB).
Money leaves the drawer mid-shift only with a reason and a photo. That's the discipline
P2's `cash_movements` should enforce (photo optional for us, reason not).

**Shift Report (Z)** `[shift-report.png]` — the exact section list, worth mirroring:

1. Shift details — id, user, start/end, working hours
2. Order details — total/cancelled(+amount)/completed orders, avg per order,
   **Net Sales, Charges, POS Fee, Tax, Discount, Bank Discount, Additional Discount,
   Promo Discount, Gross Sales, TTV** (Foodpanda orders excluded, stated in the header)
3. Order-type breakdown (orders + TTV per type)
4. Cash order details · Credit order details (per credit account)
5. Channel sales (per channel, cash/card split)
6. **Items sold summary** (toggleable in Master Settings)
7. **Drawer cash details** — Starting Balance · System Cash · Cash Pull · Ending
   Balance · **Difference** (the over/short line)
8. Download PDF · Print

Money vocabulary used consistently everywhere (dashboard repeats it verbatim):
> **Net Sales** = after-discount, excl. tax & charges ·
> **TTV** = Net Sales + Tax + Charges ·
> **Gross Sales** = Net Sales + Discounts Given + Tax + Charges

Discount taxonomy: Item · Voucher/Promo · Bank/BIN · Blink Loyalty · 3rd-party Loyalty ·
Manual — six kinds, reported separately. Our P1 payments/discount columns should at least
tag *which kind* a discount was.

## 4. KDS (`/kitchen`) — two views, item-level state

`[kds.png]` Header: live counts (In Kitchen / Open Orders / Ready), **Show Ready toggle**,
**Orders ⇄ Item-Wise** view switch, **Online** connectivity badge. Filters: All / In
Kitchen / Open Orders / Delivery / Takeaway (with counts).

- Ticket = token + order# + elapsed timer + type badge; **each line has its own Prep
  button** — item-level bump, not only ticket-level. "Prep All Items First" batches.
  Late tickets flush the whole ticket header red.
- **Item-Wise view** `[kds-itemwise.png]`: aggregates identical items *across* tickets —
  "Gulab Jamun · 3 required · 0/3 prepared · #A(1) #B(1) #C(1) · Mark All Prepared".
  Batch-cooking view: the tandoor sees "7 naan now", not 5 tickets.
- **Station Screen** (`/kds_station`): stations (Main, BBQ, Fast Food, …) with items
  *linked per station*, plus per-branch KDS behaviour settings ("Enable Ready Button",
  "auto-prepare all items on click").
- KDS reporting exists (`KDS Report`: punch-in/punch-out/serve times vs target, plus a
  KDS Dashboard) — kitchen speed is measured, not just displayed.

## 5. Roles — the actual permission verbs `[role-perms.png]`

The Add Role form is a checkbox tree over every module. The till-relevant verbs (P2's
permission jsonb should start from this exact list):

- **Punch Order** · Pending Status · **Order Type Restriction** (No Delivery / No DineIn /
  No Takeaway) · **Manual Discount Option** · Open Order · Onhold Order · Waiter ·
  **Temp print receipt** · **Waste Item** · **Place Order** · **Complete Order**
- Orders mgmt: View (per order type) · Update Status (Accept/Reject/Disp+Deliver) ·
  **Restrict Receipt Printing** · Export · **Change Payment Type**
- Menu/inventory/warehouse: per-entity Create/Edit/Delete, plus approval verbs —
  **Approve Purchase Order**, **Received Purchase Order**, Pay Supplier, status updates
- Reports: **each of ~35 reports is its own permission checkbox**
- KDS: per-station access (Main/BBQ/…) as individual checkboxes
- Settings: per-entity CRUD (Branch, User, Role, Charge, Discount, Voucher, Channels…)

Users have: name, phone, **PIN column**, roles, **allowed branches**. PIN is core to the
staff model, as the roadmap assumed.

## 6. Menu & inventory model (live data on this account)

Item form `[item-edit.png]`: Name · Label · Price · Discount Price · **Cost Price** ·
Priority · **Prep Time (minutes)** · Search Code · Barcode · Description · Category ·
**Is Returnable** (Returnable / Not Returnable / Always Ask) · Variations (multi-select
of shared variation objects) · Show in Menu · Show Base Price · Image ·
**Channel Item Status** (per-channel price + on/off per item) · inline Ingredient table
(ingredient, qty, **per order type**).

- Variations: shared objects (Full/Half), each with priority + per-channel custom prices.
- The ingredient master is already populated on this account: **~70 ingredients with
  units** (Gram/Milliliter/Piece) — chicken, spices, dairy, charcoal… — waiting to be
  linked to items. Recipe = ingredient + quantity + order type (a takeaway portion can
  deplete differently from dine-in).
- Food Cost Analysis per item, per branch, on demand.
- Items list: 124 items, per-row Recipe / Food Cost / Ingredients actions, Bulk Edit,
  Item Import (Excel), per-page 10/25/50/100.

## 7. Master Settings — the switch list (fuller than the first pass)

Business: name, phone, language (English/عربي), **operation start/end time** (the
dashboard buckets days 6:00 AM → 5:59 AM — a restaurant "day" survives midnight; our
P0 Karachi-TZ fix should adopt the same day boundary), rider token.

Order config: Manual Discount (**Amount-wise / Percentage-wise** allowed types) ·
Round-off decimals (0/1/2) · **Round Off Grand Total** · Token Number
(Auto/Manual/Disable).

POS behaviour: End shift without conditions (allow/deny with pending orders) ·
**Cash Change Management** (collected-cash entry + change calc at tender) · Customer
details prompt · Special instructions on/off · Show images · Show variation price ·
Show stock qty on cards · **Drawer amount manual entry at shift end** · Payment type
show · **Card ref# required** · Item-sold summary in shift report ·
**Show item name only on customer receipt** · **Reason required for item waste** ·
**Foodpanda orders land as Pending** (else auto-Delivered).

KOT: KOT QR · KOT on takeaway / on delivery · Master KOT complete/open/rejected ·
**Separate variation-item KOT** · Customer receipt on order acceptance.

Tax: **Tax before discount** (they support both orders; we hard-code discount-first) ·
tax on Blink Online · tax on third-party online.

## 8. Dashboard & reports

Dashboard tiles are **click-to-load** (nothing heavy runs until asked): Net Sales &
Orders (Today/Yesterday/30d/MTD/last month) · TTV · TTV split by payment method
(Cash/Card/Foodpanda) · Tax · Discounts (six-kind breakdown) · Charges · Cancelled
orders (count + Rs) · Gross Sales. Branch picker at top. Every tile carries an ⓘ with
its formula.

Report catalog (each an Excel/PDF export, queued with a log): Product Mix · Category
Product Mix · Order Transaction · Items Qty (+ with variations, + channel-wise) ·
Channel Report · Day-wise Orders · Tax Collection · Channel Payment Breakdown ·
Ingredient Inventory · **Yield Report** (5-sheet: loss cost, branch comparison,
production variance, trend, config) · Branch Demand vs Warehouse Dispatch · PO vs
Warehouse Receiving · **KDS Report** (punch/serve times vs target) · Sales by
Branch+Channel · Order Summary · Items-wise Food Cost · Stock Inventory · Credit ·
Rejected / Auto-Rejected · Orders Type · Voucher Usage · BIN · **P&L** · Expense-wise ·
Supplier · Credit Settlement · Payment · **Waiter Report** · Offline Rider ·
**Wasted Item** · Manual · Kitchen Service Time Sheet · Power BI.

## 9. What this changes for our roadmap

Confirmations (no change): P1 keystone (lines/payments/RPCs) is what all of the above
stands on; P2 shift/Z structure matches; P3 charges/vouchers/channels as configured
objects matches; stations + item-level KDS state matches P4.

**Additions worth adopting (by phase):**

| Finding | Phase | Cost |
|---|---|---|
| Operational-day boundary (6am–6am) for all day bucketing | P0/P3 (TZ fix) | tiny — same fix, different midnight |
| Token number (short daily call-out id) minted in `settle`/`create` RPC | P1 | S |
| Discount *kind* tag on the discount (manual/preset/voucher/bank/loyalty) | P1 schema | S |
| Cash Change Management (collected / change math at tender, stored) | P2 tender modal | S |
| Cash Pull = reason (+ optional photo) against system-computed drawer | P2 | already planned, add reason enforcement |
| Z-report section order + Net/TTV/Gross vocabulary | P2 | free — copy the structure |
| Place (pre-receipt) vs Complete (sale receipt) as explicit till actions | P2/P3 | S — naming + print variant |
| Per-line Prep + Item-Wise aggregate view on KDS | P4 | M — the aggregate view is the win |
| Waste capture at till with required reason (+ wasted-item report) | P5 | already planned via stock; add the till surface |
| Prep time per item → KDS target + service-time report | P4/P5 | S schema now (column), report later |
| Item cost price + food-cost view per item | P5 | already planned |
| Per-channel item price/status | P6 (Foodpanda API) | defer |
| Round-off setting (grand total rounding) | P3 charges work | S |
| Is-Returnable flag (drives refund/reversal policy) | P3 | S |

**UI/UX verdict (for the redesign):** Blink's information architecture is excellent and
battle-tested — copy the *shapes*: three-pane till, status tabs with counts, item-level
KDS actions, click-to-load dashboard, section-by-section Z-report. But the surface is
generic admin-template (Bootstrap-era modals-on-modals, chosen.js multiselects, stuck
backdrops — we hit one mid-walkthrough, inconsistent button colours, 11px icon buttons).
Our black/brand-warm theme, real menu photography, and 44px touch discipline already
look better; keeping our visual language while stealing their IA is the play.

*Read-only walkthrough, New Theme, account `admin@flames.com`, Branch 1152, 27 Aug 2026.*
