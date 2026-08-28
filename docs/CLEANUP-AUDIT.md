# Cleanup audit

Code quality and maintainability review of the Flames POS codebase.
Re-run with `/cleanup-audit`; the mechanical half is `node scripts/audit_deadcode.mjs`.

**Last run:** 28 Aug 2026 · 56 code files · 15 stylesheets · ~8,700 lines of JS

**Status:** §1 is done (commit below). The mechanical scan now reports 2 unused
exports instead of 9, and both are the ones deliberately held until §2.1.

---

## How to read this

Findings are ordered by **how safe they are to act on**, not by size. Anything
in "Safe now" can be done today without waiting for anything. Anything in
"Scheduled" is dead code that is *deliberately* still present and has a named
trigger — deleting it early breaks the till.

Every finding states why it is unnecessary, what removing it buys, and what
could go wrong. Where a risk exists, it is written before the plan.

---

## 1. Safe now — ✅ DONE 28 Aug 2026

### 1.1 ✅ `getMenuItemsByCategory` is genuinely unreferenced — removed
`src/lib/supabaseDb.js:68` · 14 lines

**Why unnecessary.** Nothing imports it. The four screens that need menu data
all call `getMenuItems()` and filter client-side. It duplicates a query the app
does not make.

**Impact.** −14 lines, one fewer exported query to keep working against schema
changes. No bundle change (tree-shaken already).

**Risk.** None found. It is not referenced from `src/`, `scripts/`, or
`supabase/scripts/`. Confirm with `grep -rn getMenuItemsByCategory` before
deleting — a future dynamic call would not appear in the import graph.

**Plan.** Delete the function.

### 1.2 ✅ Over-exported internals — six narrowed
`connection.js` (`setOnline`) · `printReceipt.js` (`RECEIPT_WIDTH_MM`) ·
`sanityMenu.js` (`isSanityConfigured`) · `supabaseDb.js` (`recordCustomer`,
`updateOrderStatus`, `getOrderById`, `MENU_IMAGE_BUCKET`, `MAX_IMAGE_BYTES`)

**Why unnecessary.** Each is used only inside its own module. A wider export
surface than the code needs makes every future audit noisier — these eight are
why the mechanical scan returns nine "unused exports" that are mostly not dead.

**Impact.** No behaviour change. The value is signal: after this, a name in the
unused-exports list is far more likely to be genuinely dead.

**Risk.** `updateOrderStatus` and `getOrderById` are still called by the legacy
fallback paths (§2.1). Narrowing them is safe; *deleting* them is not, until
§2.1 lands. Keep `PLACEHOLDER_GUID` exported — `scripts/test_qr.mjs` imports it.

**Plan.** Drop the `export` keyword on the six that have no external consumer
and no pending one. Leave `updateOrderStatus`/`getOrderById` alone until §2.1.

### 1.3 ✅ `dotenv` moved to devDependencies
`package.json` · used solely by `supabase/scripts/check_db.js`

**Why unnecessary.** Next.js loads `.env.local` natively; the app never imports
`dotenv`. It ships to production to support a local diagnostic.

**Impact.** One fewer package in the production install.

**Risk.** Low. Verify `check_db.js` still runs after the move (devDependencies
are installed locally, just not in a production install).

**Plan.** Move `dotenv` to `devDependencies`.

> **Do not remove `@supabase/supabase-js`.** It looks unimported and the naive
> scan flags it, but it is a **required peer dependency of `@supabase/ssr`**,
> which is what every auth call goes through. Removing it breaks sign-in at
> runtime, not at build. The audit script now understands peers so it will not
> suggest this again.

### 1.4 ✅ Empty file — removed
`scripts/menu/replaced_images.json` is 0 bytes. Delete.

---

## 2. Scheduled — dead, but not yet

### 2.1 The legacy fallback layer in `supabaseDb.js`
~230 lines across `addOrderDirect` (line 454) and four `rpcMissing` branches
(lines 306, 433, 615, 695, 769)

**Why it exists.** Every order writer falls back to its old direct-table path
when the P1 RPC is not installed, so the client could be deployed before or
after migrations 15–17 without breaking the till. That window is now closed:
the RPCs are live in production.

**Why it becomes unnecessary.** Once **migration 18** revokes the client's
direct write access to `orders`, the fallbacks cannot succeed anyway — they
would fail on RLS instead of on a missing function. Dead code that also lies
about being a safety net.

**Impact.** −230 lines from the single most safety-critical file in the app,
and `supabaseDb.js` drops from 888 to roughly 650. Each order writer becomes
one `.rpc()` call with no branch, which is a large readability win in the code
that moves money.

**Risk — this is the important one.** Removing these *before* migration 18 is
applied leaves no path at all if an RPC is ever dropped or renamed. The order
is: apply 18 → watch a service → then delete. Not the reverse.

**Plan.**
1. Apply `18_orders_write_lockdown.sql` (waiting on one live service).
2. Run one full service.
3. Delete `addOrderDirect`, the five `rpcMissing` branches, the `rpcMissing`
   helper, and then `updateOrderStatus`, `getOrderById` and `totalsColumns`,
   which have no other callers once the fallbacks are gone.

### 2.2 `billColumns` / `totalsColumns` — the same function, twice
`src/app/pos/page.js:351` and `src/lib/supabaseDb.js:380`

**Why unnecessary.** Both build the same `{subtotal, tax, total, discount?}`
column set, with the same "only include discount when non-zero" quirk — a quirk
the audit already identified as a bug source, because it means a bill re-priced
down to no discount keeps the old value. The P1 RPCs now recompute totals
server-side, so neither is authoritative any more.

**Impact.** Removes a live duplication in money-shaping code and one class of
stale-value bug.

**Risk.** `billColumns` is still passed to `addOrder`, whose RPC path ignores
it in favour of server-side recomputation but whose *fallback* path still uses
it. Same trigger as §2.1.

**Plan.** Delete both with §2.1.

---

## 3. Duplicate logic worth consolidating now

### 3.1 Money is formatted 31 different times with no shared helper
31 call sites across `src/`, including every line of the thermal receipt

**Why unnecessary.** `src/lib/timeFormat.js` exists precisely because "the
format has to be a property of the app rather than of whatever device rendered
it" — and pins every clock to `en-PK`. Money got no such treatment: 31 sites
call bare `Number.prototype.toLocaleString()`, which follows the browser/OS
locale. The same receipt prints `Rs. 1,180` on one till and `Rs. 1.180` on
another with a European locale.

**Impact.** One helper replaces 31 ad-hoc calls, and printed totals stop
depending on device settings. This is a correctness fix, not only tidiness.

**Risk.** Low, but it touches the receipt, so print one before and after.

**Plan.** Add `src/lib/money.js` mirroring `timeFormat.js` (`formatMoney`,
`formatMoneyPlain` for receipts), then replace call sites screen by screen.

### 3.2 The same stale-response race, written twice
`src/app/reports/page.js:45` and `src/app/orders/page.js:156`

**Why unnecessary.** Both fire a fetch on every filter change with no cleanup,
ignore flag or `AbortController`, so a slow earlier response can overwrite a
newer one — the pager shows one page's rows under another page's number, and
Reports paints one period's revenue under another period's label. Two copies of
one missing guard.

**Impact.** Fixes a real defect on both screens and removes the duplication.

**Risk.** None beyond normal testing.

**Plan.** Extract a small `useLatest`-style hook (or an `AbortController` in
each effect's cleanup) and apply to both.

---

## 4. Redundant queries

### 4.1 KDS and Orders fetch the entire menu to build a name→image map
`src/app/kds/page.js:129`, `src/app/orders/page.js:212`

**Why unnecessary.** Both call `getMenuItems()` — `select('*')` over 125 rows
including descriptions, variants, modifiers and prices — then immediately
reduce it to `{name: image}` and discard the rest. The KDS does this on a
screen that runs unattended all service.

**Impact.** Two screens stop pulling the full menu. Small in absolute terms
today, but the KDS is the screen where over-fetching already caused a P0.

**Risk.** `buildImageMap` also feeds a fallback that strips variant suffixes
from names; keep that behaviour when narrowing the query.

**Plan.** Add `getMenuImageMap()` selecting `name, image` only, and point both
screens at it.

### 4.2 Orders runs an exact `COUNT(*)` over the whole table per page load
`src/lib/supabaseDb.js` (`getOrdersPage`)

**Why unnecessary.** The pager needs a total, but an exact count over an
ever-growing table on every load — plus a second full scan when searching — is
the same "gets slower every week" shape as the KDS defect that P0 fixed.

**Impact.** Order history stops degrading as the restaurant trades.

**Risk.** An estimated count reads differently to staff. Prefer Supabase's
`count: 'estimated'` (or `planned`) only above a row threshold, so small
result sets stay exact.

**Plan.** Schedule with the P3 reports-on-SQL work, which touches these queries
anyway.

---

## 5. Complexity worth reducing

| File | Lines | Why it is hard to work in |
|---|---|---|
| `src/app/pos/page.js` | 1,209 | Cart, tabs, rounds, discounts, customer lookup, checkout, receipt and draft persistence in one component |
| `src/lib/supabaseDb.js` | 888 | Menu + orders + customers + storage + Sanity sync in one module |
| `src/app/orders/page.js` | 833 | Includes five components declared inside the render body |

**5.1 Orders declares components inside its render** (`PaymentChips`,
`OrderMeta`, `ItemThumb`, `NextStatusBtn`, `RowActions`, lines 306–384). Each
render gives them fresh identities, so React unmounts and remounts every row's
subtree — including every thumbnail — instead of reconciling it.

**Correction (28 Aug):** an earlier draft of this report called it a low-risk
move. It is not. Only `PaymentChips` and `OrderMeta` are pure moves; the other
three close over component state (`itemImages`, `handleStatusUpdate`, `canVoid`,
`setReceiptOrder`, `setVoidTarget`) and need those threaded through as props.
Moving two of five also buys nothing, because the remaining three still change
identity on every render and remount the subtree anyway.

**Risk.** It is a ~100-line refactor of the screen staff use to void and
reprint. **Plan:** do all five together, with prop threading, once P1's write
path has been exercised in a real service — not stacked on top of an
unverified change.

**5.2 `supabaseDb.js` should split** along the seams it already has:
`menu.js`, `orders.js`, `customers.js`, `storage.js`. **Risk:** a wide import
churn across screens; do it as one mechanical commit with no behaviour change,
and ideally *after* §2.1 removes 230 lines.

**5.3 `pos/page.js`** is the largest and most defect-prone file. **Plan:**
extract `useCart`, `useTabs` and `useCheckout` hooks. **Risk:** highest in the
codebase — this is the till. Do it only with a Playwright pass over the three
order flows, and not while another change is in flight.

---

## 6. Legacy and abandoned

### 6.1 The v3/v4 menu pipeline — `scripts/menu/*` (656 lines)
`apply_menu.mjs`, `apply_images_v4.mjs`, `build_menu.py`, `parse_menu.py`,
`prices.json`

**Why superseded.** These loaded the menu from a Word document and pushed
images into Supabase Storage. The menu's source of truth is now Sanity, and
`sync_menu_from_sanity()` is how it reaches the till. The pipeline cannot run
again meaningfully — it targets a menu shape that Sanity now owns.

**Impact.** −656 lines and one fewer way to load the menu, which matters more
than the line count: two mechanisms for the same job is how a menu gets
overwritten by the wrong one.

**Risk.** `supabase/seed/README.md` documents them as the menu procedure. That
README must be rewritten in the same change, or the repo will describe a
workflow that no longer exists.

**Plan.** Delete `scripts/menu/`, and replace the README's menu section with
the Sanity sync procedure. History keeps them if ever needed.

### 6.2 Pre-v3 rollback data — `supabase/seed/menu_backup_pre_v3.json`, `image_urls_pre_v4.json`

**Why superseded.** These exist to roll back to a menu that referenced
`public/menu-images/`, which was deleted in `2016a1a`. The rollback they enable
can no longer be performed.

**Impact.** Removes files that promise a recovery path that does not work.

**Risk.** Confirm the live menu images are all in Supabase Storage first (they
are: 125 of 125 rows have an `image`).

**Plan.** Delete both; note in the seed README that pre-v3 state lives in git.

### 6.3 `supabase/scripts/check_db.js` and `scripts/test_crc.js`

`check_db.js` is a connectivity diagnostic that predates the app working;
`test_crc.js` (Jan 2026, 18 lines) checks the QR encoder's CRC.

**Why questionable.** Neither is wired to `npm test` — there is no test script
at all — so neither runs unless someone remembers it exists.

**Impact.** Small. The honest options are *delete* or *make them run*.

**Risk.** `test_qr.mjs` is genuinely useful and should be kept: it is the
verification step for the parked Raast QR work, and the QR memo points at it.

**Plan.** Add `"test": "node scripts/test_qr.mjs && node scripts/test_crc.js"`
to `package.json` so they earn their place, or delete `check_db.js` and
`test_crc.js`. Prefer the former.

---

## 7. What was checked and found clean

Stated so a future run knows these were considered, not missed:

- **No orphaned modules.** Every file in `src/` is reachable from a Next.js
  entry point.
- **No unused CSS modules.** All 15 stylesheets are imported.
- **No unreferenced files in `public/`** (after `2016a1a` removed 4.6MB of
  stock photography and the create-next-app SVGs).
- **No unused dependencies**, once peer dependencies are accounted for.
- **No unused UI components.** Every component in `src/components/` is
  rendered by at least one screen.

---

## 8. Suggested order of work

1. ~~§1.1–§1.4~~ — **done**.
2. §3.1 — the money formatter (a correctness fix wearing a tidiness hat).
3. §4.1 — narrow the KDS/Orders menu fetch.
4. §6.1, §6.2 — retire the v3/v4 pipeline **with** its README.
5. **After migration 18 and one live service:** §2.1, §2.2 — the big one,
   and the trigger for §5.1 too.
6. §5.2, then §5.3 — structural, one at a time, nothing else in flight.
7. §4.2 — with P3 reports-on-SQL.

Roughly **900 lines removable** today or on a named trigger, without changing
a single behaviour the restaurant depends on.
