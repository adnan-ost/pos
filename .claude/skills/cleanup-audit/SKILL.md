---
name: cleanup-audit
description: Review the Flames POS codebase for dead code, duplicate logic, unused components and dependencies, over-complex implementations, legacy leftovers, redundant queries and abandoned files — then update docs/CLEANUP-AUDIT.md. Use when asked to audit code quality, find dead code, reduce technical debt, or clean up the codebase, and on a periodic sweep.
---

# Cleanup audit

Produces the findings in `docs/CLEANUP-AUDIT.md`. Two halves: a script finds
what imports and exports can prove, and you judge everything else. Never skip
the second half — the script cannot see duplicate logic, over-complexity, or a
file that is technically reachable but no longer means anything.

## 1. Run the mechanical scan

```
node scripts/audit_deadcode.mjs
```

Reports orphaned modules, unused exports, unused dependencies, runtime deps
only scripts use, unused CSS modules, and unreferenced `public/` files.

**Its output is candidates, not verdicts.** It already encodes two traps it
previously fell into — standalone scripts count as consumers of `src/` exports,
and peer dependencies count as used — so if you find a third, teach the script
rather than only writing it in the report.

## 2. Verify every candidate before recommending deletion

- `grep -rn '\bNAME\b' src scripts supabase/scripts` — the import graph misses
  dynamic references and string-keyed use.
- For a dependency, check `node_modules/<pkg>/package.json` for
  `peerDependencies` **before** suggesting removal. `@supabase/supabase-js`
  looks unimported and is required by `@supabase/ssr`; dropping it breaks
  sign-in at runtime, not at build.
- An export used only inside its own module is not dead — it is over-exported.
  Recommend narrowing, not deleting.

## 3. Judge what the script cannot see

Read the code for these, and check whether the previous report's findings still
hold or have been fixed:

- **Duplicate logic** — the same function under two names in two files, or one
  bug written twice. Past examples: `billColumns` ≡ `totalsColumns`; the same
  missing stale-response guard on Reports and Orders.
- **Redundant queries** — a screen fetching `select('*')` and discarding most
  of it; counts over a growing table on every load. The KDS has form here.
- **Over-complexity** — check file sizes (`wc -l`) against the table in the
  report; components declared inside a render body; a module doing five jobs.
- **Legacy** — code superseded by something newer that still works well enough
  to look alive. Ask what owns this job *now*.
- **Money and time formatting** — bare `toLocaleString()` is a defect in this
  codebase, not a style choice; the receipt must not vary by device locale.

## 4. Respect the scheduled deletions

Some dead code is deliberate and has a trigger. Do not recommend removing it
early, and do not drop it from the report — restate the trigger.

The standing one: the legacy fallback paths in `src/lib/supabaseDb.js` come out
only **after** `18_orders_write_lockdown.sql` is applied and one live service
has run. Check with:

```sql
select count(*) from pg_policies
where tablename='orders' and policyname='Authenticated manage orders';
-- 1 = still open, fallbacks must stay; 0 = migration 18 applied
```

## 5. Rewrite the report

Update `docs/CLEANUP-AUDIT.md` in place, keeping its shape:

- Ordered by **how safe to act on**, not by size.
- Every finding gives why it is unnecessary, the impact of removing it, the
  risks **before** the plan, and the plan.
- Keep the "checked and found clean" section current, so the next run knows
  what was considered rather than missed.
- Update the date and the file/line counts in the header.

Then say what changed since the last run — fixed, still open, newly found.

## Cautions specific to this codebase

- `src/app/pos/page.js` is the till. Structural changes there need a Playwright
  pass over pay-now, open-tab-and-round, and settle before they ship.
- Deleting a `menu_items` row is never cleanup: `order_items.menu_item_id`
  points at it and the order history goes with it.
- `scripts/test_qr.mjs` stays — it is the verification step for the parked
  Raast QR work.
