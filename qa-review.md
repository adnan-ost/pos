# Flames POS — QA Review List

57 issues from a ten-lens adversarially-verified code audit, August 2026.
Ranked worst-first. Nothing has been changed — this is for triage.

Tick items you want fixed, then hand this back.


## CRITICAL  (3)

- [ ] **The kitchen board gets slower every week and will eventually stop keeping up.**
      `page.js:90` · 6 passes agreed · I read the code · small fix
      The KDS calls select('*') on the whole orders table — no status filter, no limit — every 15 seconds and again on every realtime event. Today that is a few hundred rows. At six months of trading it is tens of thousands, downloaded twenty times a minute onto a screen that only ever shows active tickets.

- [ ] **A customer is charged for food they did not order.**
      `page.js:415` · 4 passes agreed · I read the code · small fix
      If anything is sitting unsent in the cart and you settle a tab from the Open Tabs drawer, the receipt lists only the tab's items but the total includes the cart too. The printed lines and the printed total disagree, and the higher number is the one charged. The in-panel Settle button blocks this; the drawer button does not.

- [ ] **A round can be cooked and billed twice.**
      `supabaseDb.js:556` · 2 passes agreed · medium fix
      Sending a round to a tab is a plain read-modify-write with no duplicate protection. If the request times out or errors, the cart is left intact and the button re-enabled — so the natural retry appends the same food a second time. Checkout got this protection in migration 12; rounds never did, and rounds are the path staff use most during a sitting.


## HIGH  (13)

- [ ] **Late-night takings land on the wrong day.**
      `actions.js:70` · 3 passes agreed · medium fix
      Dates and hour-of-day are bucketed in the server's timezone, which is UTC on Vercel. Pakistan is UTC+5, so everything after 7pm local is booked to the previous day, and the busiest-hours chart is shifted five hours.

- [ ] **A reprinted receipt shows today's date on last week's order.**
      `ReceiptPreview.jsx:22` · 3 passes agreed · small fix
      The receipt stamps the current date and time when it renders, so reprinting an old order from the Orders page produces paper carrying the original invoice number next to the wrong date.

- [ ] **A timed-out sale can be rung up twice.**
      `page.js:435` · 3 passes agreed · small fix
      The duplicate-protection key is minted fresh every time the receipt opens, and lives only in React state. Retrying inside the open receipt is safe. Backing out and trying again — or a page refresh — mints a new key, and migration 12's protection no longer applies.

- [ ] **A discount you agreed with a customer quietly disappears at settle.**
      `page.js:534` · 2 passes agreed · small fix
      Picking up a tab restores its table, waiter, tax setting and customer details, but not its discount. The settle then passes a discount of zero, so the customer is billed the full amount — while the tabs drawer had been showing the discounted total all along.

- [ ] **Your revenue figures include money you have not collected.**
      `actions.js:144` · 2 passes agreed · I read the code · small fix
      The reports query excludes cancelled orders but not unpaid ones, so every open tab is summed into Total Revenue, Tax Collected, the sales chart and the per-waiter figures — booked on the day the tab opened rather than the day it was paid.

- [ ] **Changing a PIN can lock the whole role out of the till.**
      `actions.js:17` · 2 passes agreed · small fix
      The change form accepts any password of 6 or more characters, but the login screen only accepts exactly six digits. Set a seven-digit PIN or one with a letter and it saves successfully — and nobody can sign in with that account again.

- [ ] **The Reports Export PDF button produces a blank page.**
      `globals.css:236` · 2 passes agreed · small fix
      The global print rules hide everything except the receipt subtree, on every route. Reports has no receipt, so printing it emits an empty 80mm document.

- [ ] **Any signed-in staff member can edit or delete any order directly.**
      `07_rls_lockdown.sql:55` · I read the code · medium fix
      The orders table has a single policy granting all authenticated users full read and write. The admin-only gate on voiding is enforced in the browser only. Anyone holding the shared staff PIN can bypass it via the API. Migration 08's comment suggests this was deliberate, so it may be a decision rather than an oversight.

- [ ] **Signing out on one terminal signs out every terminal.**
      `actions.js:9` · small fix
      Logout defaults to global scope, revoking every token for that account. Because admin and staff are shared accounts, one person logging off the back office drops the till and the kitchen display too.

- [ ] **Orders list unmounts and rebuilds every card and thumbnail on every render**
      `page.js:306` · small fix
      PaymentChips, OrderMeta, ItemThumb, NextStatusBtn and RowActions are all declared inside the OrdersPage function body, so each render gives them fresh function identities. React treats a changed element type as a different component and unmounts/remounts the whole subtree instead of reconciling it.

- [ ] **The Orders page gets slower as history grows.**
      `supabaseDb.js:188` · medium fix
      Every page load runs an exact COUNT over the entire orders table, and searching adds a second full scan.

- [ ] **Reports has no stale-response guard, so a slow request can paint the wrong period's revenue under the right label**
      `page.js:45` · small fix
      The dashboard effect fires getDashboardStats on every range change with no cleanup, no ignore flag and no AbortController. Two in-flight requests resolve in arbitrary order and the last one to land wins, while the period label is driven by state that has already moved on.

- [ ] **Dashboard pulls every full order row for two whole periods and aggregates in JavaScript, with no limit**
      `actions.js:139` · small fix
      getDashboardStats issues two `select('*')` queries over date ranges with no .limit(), no .range() and no pagination, then reduces the rows in JS. Nothing caps the row count, and if PostgREST's max-rows is set the result is silently truncated rather than erroring.


## MEDIUM  (20)

- [ ] **The receipt can print a tax percentage that does not match the tax charged.**
      `supabaseDb.js:313` · 5 passes agreed · medium fix
      The tax rate is cached in the browser and never invalidated, and a tab holds the rate it opened with. Change the rate in Settings and the receipt states the new percentage beside an amount calculated at the old one.

- [ ] **Every reprint of a settled bill carries a different invoice number.**
      `page.js:1065` · 4 passes agreed · small fix
      The invoice number is generated at print time and never written to the order, so each reprint mints a new one.

- [ ] **Two terminals can settle the same tab and take payment twice.**
      `supabaseDb.js:637` · 2 passes agreed · medium fix
      The paid check and the write are separate operations with no atomic guard between them, so two tills settling the same tab within the same moment both succeed.

- [ ] **A failed orders query renders as "No orders yet." with no indication of failure**
      `supabaseDb.js:240` · 2 passes agreed · small fix
      `getOrdersPage` swallows any Postgres/network error and returns `{rows: [], total: 0}`. The Orders page's own catch also only logs. The result is indistinguishable from a genuinely empty result set, so staff looking for an order are told none exist rather than that the query failed.

- [ ] **The discount column can never be written back to zero, leaving stale discounts on settled orders**
      `supabaseDb.js:341` · small fix
      totalsColumns (and its POS twin billColumns) only include the `discount` key when the computed discount is greater than zero. Every write that recomputes a bill down to no discount therefore updates subtotal/tax/total but leaves the old discount value in the row, so the stored numbers no longer add up.

- [ ] **Discount amount and reason survive across orders, applying a comp to the next customer's bill**
      `page.js:423` · small fix
      discountValue, discountMode and discountReason are only reset by clearOrderFields, which runs after a completed pay-now or settle. detachTab and handleOpenTab both leave the order behind without clearing them, so the discount stays live in state and is applied to whatever is rung up next.

- [ ] **No throttle on PIN attempts, and every sign-in failure is reported as "Incorrect PIN"**
      `actions.js:37` · small fix
      The 6-digit PIN is the Supabase password (10^6 keyspace, two accounts, admin grants full access to money and settings) and there is no attempt counter, backoff, lockout or CAPTCHA anywhere in the app. Because sign-in runs in a Server Action, every attempt reaches GoTrue from the Vercel function's IP, so Supabase's per-IP protection cannot separate an attacker from the restaurant's own tills — and the handler collapses every error, including rate-limit errors, into "Incorrect PIN".

- [ ] **Clearing a menu item's description, image, variants or modifiers does not persist**
      `MenuItemForm.jsx:182` · small fix
      `handleSubmit` converts empty optional fields to `undefined`. `JSON.stringify` drops undefined keys, so the PATCH body omits them entirely and Postgres keeps the previous value. Emptying a field in the form is a silent no-op on save.

- [ ] **Customer menu category filter bar is hidden behind the sticky header once scrolled**
      `customer.module.css:112` · small fix
      The customer menu stacks two sticky bars whose offsets are smaller than the header's actual rendered height. `.header` sticks at `top: 0` with `z-index: 100`; `.categoriesWrapper` sticks at `top: 80px` (desktop) / `top: 120px` (≤768px) with `z-index: 90`. The header is ~128px tall on desktop and ~180px on a phone, so the category strip stops underneath it and is both invisible and untappable while the page is scrolled.

- [ ] **POS cart quantity and remove buttons are 24x24px touch targets**
      `pos.module.css:681` · small fix
      The +/- quantity buttons in the POS cart are exactly 24x24 CSS pixels with 8px between them, and the line-remove button is also ~24x24 (0.25rem padding around a 16px icon). These are the controls that decide how much a customer is charged, on a touchscreen till, and they are roughly half the 44px minimum every touch guideline (Apple HIG 44pt, Material 48dp) specifies.

- [ ] **White text on the brand orange is 3.16:1 — every primary CTA and active state fails WCAG AA**
      `globals.css:15` · small fix
      `--primary: #F26513` is paired with `--primary-foreground: #ffffff` (or literal `white`) in ~25 rules across the CSS modules. White on #F26513 measures 3.16:1. WCAG 2.1 SC 1.4.3 requires 4.5:1 for text below 18.66px bold / 24px regular — every one of these usages is 0.85rem–1rem, so all of them fail. The `--muted`/`--border` tokens right above were deliberately tuned for AA; this pair was not.

- [ ] **Cart draft drops the attached tab, so returning to /pos turns a tab round into a second check**
      `page.js:131` · small fix
      The draft persists the cart plus the tab's table number, waiter and customer details, but deliberately omits `activeTabId`. Because POSPage unmounts on any client-side navigation, a routine sidebar tap silently detaches the basket from the open tab while leaving every visual cue that it is still on that tab.

- [ ] **Reports page has no error path — a failed server action leaves a permanent full-screen spinner**
      `page.js:54` · small fix
      Both getDashboardStats calls use a bare `.then()` with no `.catch()`, and `setLoading(false)` lives only inside the fulfilled handler. Any rejection of the server action leaves `loading` true forever, rendering a full-screen spinner with no message and no way out but a manual reload. The same pattern appears on four other screens.

- [ ] **Any signed-in user can overwrite any file in the public menu-images bucket**
      `09_menu_images_storage.sql:33` · small fix
      Menu content is admin-only everywhere else — the /menu route is gated in middleware and menu_items writes require is_admin() — but the storage policies behind those photos are granted to `authenticated` with no path scope and no owner check, so the staff account can replace the bytes of any image already in the bucket.

- [ ] **Orders page has the same stale-response race, so the pager can show one page's rows under another page's number**
      `page.js:156` · small fix
      load() has no cancellation or sequence guard, and it is invoked from three places at once — the filter effect, the realtime subscription, and handleStatusUpdate. Whichever response lands last wins, regardless of which query the operator is currently looking at.

- [ ] **Public customer menu is fully client-rendered and uncached, and serves full-size originals**
      `page.js:39` · small fix
      The guest-facing menu is a client component that fetches categories, all 125 menu items and all modifiers from the browser on every visit. Nothing is server-rendered, cached or revalidated, and the photos are raw Supabase Storage originals with no responsive sizing.

- [ ] **Menu items are fetched with no ORDER BY, so the till grid reshuffles whenever a row is updated**
      `supabaseDb.js:56` · small fix
      getCategories orders by `sort_order`, but getMenuItems and getMenuItemsByCategory issue a bare `select('*')` with no ordering, and none of the three consumers (POS, Menu Management, public Customer menu) sorts client-side. Postgres returns heap order, which changes when a row is updated, so a 125-item touch menu silently rearranges itself.

- [ ] **Currency is formatted with bare toLocaleString(), so the printed receipt varies by device locale**
      `ReceiptPreview.jsx:144` · small fix
      src/lib/timeFormat.js exists specifically because "the format has to be a property of the app rather than of whatever device rendered it", and pins every clock time to en-PK. Money got no such treatment: roughly thirty call sites, including every line on the thermal receipt, call `Number.prototype.toLocaleString()` with no locale argument, which follows the browser/OS locale.

- [ ] **Sales chart sorts by a date string that loses the year, reversing December and January**
      `actions.js:173` · small fix
      salesByDate is keyed by `format(..., 'MMM dd')`, which discards the year, and the chart is then ordered by parsing that label back with `new Date()`. V8 defaults a missing year to 2001, so every point collapses onto the same year and any range spanning New Year's Eve sorts backwards.

- [ ] **Two different invoice-number generators, neither unique, with no database constraint**
      `page.js:311` · small fix
      The FBR invoice number is minted by `Date.now().toString().slice(-6)` in the POS and by a 6-digit `Math.random()` in ReceiptPreview's fallback. The first repeats every 1,000,000 ms — 16 minutes 40 seconds — and `orders.invoice_number` has no unique index, so a collision is stored silently.


## LOW  (21)

- [ ] **Order numbers and FBR invoice numbers are the last 6 digits of Date.now(), which collide within a single day**
      `supabaseDb.js:348` · small fix
      Both identifiers are Date.now().toString().slice(-6), which is the millisecond clock modulo 1,000,000 — it wraps every 16 minutes 40 seconds. There is no unique constraint on orders.order_number (migration 11 line 40 creates a plain, non-unique index), so duplicates are accepted silently.

- [ ] **Sales Trend chart sorts by a year-less date string, so a range crossing New Year plots out of order**
      `actions.js:174` · small fix
      chartData keys are formatted as 'MMM dd' with no year, then sorted by feeding those strings back to new Date(). V8 resolves a bare "Dec 28" to the year 2001, so every bucket lands in the same synthetic year and January sorts before December.

- [ ] **order_number and invoice numbers derived from Date.now() collide roughly every 1,000 orders**
      `supabaseDb.js:348` · small fix
      order_number is the last 6 digits of the epoch milliseconds, i.e. Date.now() mod 1,000,000 — a value space that wraps every 16 min 40 s. orders.order_number carries no unique constraint anywhere in the 13 migrations, so duplicates insert silently. newInvoiceNumber() uses the identical derivation for the FBR invoice number.

- [ ] **KDS bump writes status unconditionally, so a round fired mid-bump is parked in Ready and never cooked**
      `page.js:149` · small fix
      handleBump derives the next status from the lane the ticket happened to be rendered in and calls updateOrderStatus, which does a bare `.update({ status })` with no check on the current value. appendRoundToOrder resets status to 'new' to re-fire a ticket, and a bump landing in that window overwrites the re-fire.

- [ ] **Unauthenticated reset requests can permanently invalidate the admin's recovery link**
      `actions.js:67` · small fix
      requestPinReset is callable by anyone with no session and no throttle of its own. GoTrue stores one recovery token per user, so each call kills the token in any previously sent email — a fact this codebase documents in two places. Email reset is the only recovery path once a PIN is lost, so repeated triggering denies recovery rather than merely sending a stray email.

- [ ] **Employee names and staff codes are readable by anyone with the public anon key**
      `04_waiters.sql:39` · small fix
      `waiters` carries a public SELECT policy, but no public page reads it — the customer menu only fetches categories, menu_items and modifiers. The anon key is embedded in the browser bundle, so the full staff roster is retrievable by any visitor.

- [ ] **Delete-category dialog promises to delete the items, but the FK orphans them and they stay on sale**
      `page.js:370` · small fix
      The confirmation modal states "This will also delete all items in this category", but `menu_items.category_id` is `ON DELETE SET NULL`. The items survive with a null category, remain visible and orderable in the POS "All" tab, and remain listed on the public /customer menu under an "Other" badge.

- [ ] **Realtime refetch can unmount the receipt before printReceipt runs, ejecting a blank 297mm strip**
      `page.js:538` · small fix
      `handleSettle` prints after awaiting `settleOrder`. That same UPDATE broadcasts a realtime event to this client, whose handler refetches open tabs and drops the settled tab from `openTabs`; the render guard then unmounts ReceiptPreview. If that round trip completes before the PATCH response, `printReceipt` finds no `#receipt-print-root` and the print CSS leaves the entire page hidden.

- [ ] **Orders list can render one page of rows under another page's pager**
      `page.js:163` · small fix
      `load` is re-created on every query change and also invoked by the realtime subscription, `handleStatusUpdate` and `submitVoid`, with no guard against an older response resolving after a newer one. Because it sets rows, total and unpaid count unconditionally, a slow earlier request overwrites a newer one's results while the pager state stays on the new page.

- [ ] **ModifierModal has no Escape key, no focus trap, and no dialog semantics**
      `ModifierModal.jsx:84` · small fix
      The item-modifier modal renders a plain `<div>` overlay with no `role="dialog"`, no `aria-modal`, no `aria-labelledby`, no Escape handler (there is no `keydown` listener anywhere in src/app/pos/page.js), no focus move into the dialog on open, and no click-outside close. Focus stays wherever it was on the page behind, and Tab walks straight through the menu grid underneath the 70%-opaque overlay.

- [ ] **Sidebar clips its own navigation on short viewports with no way to scroll to it**
      `Sidebar.module.css:12` · small fix
      `.sidebar` is `height: 100vh; overflow: hidden` and `.nav` is `flex: 1` with no `overflow-y`. Flex items default to `min-height: auto`, so the nav cannot shrink below its content height — when the content is taller than the viewport it simply overflows and is clipped away, with no scrollbar and no keyboard path to the hidden items.

- [ ] **The authenticated app has no responsive layout: a fixed 280px sidebar leaves ~110px of content on a phone**
      `AppLayout.jsx:65` · small fix
      AppLayout gives `main` `marginLeft: var(--sidebar-width)` and `width: calc(100% - var(--sidebar-width))` against a `position: fixed`, 280px sidebar, and there is not a single width media query in Sidebar.module.css, pos.module.css, orders.module.css, menu.module.css, or the Tailwind-styled settings page. /customer, /kds and /login opt out of the sidebar (AppLayout.jsx:53), so the whole staff-facing app is desktop-only by construction — not by choice.

- [ ] **POS item search field removes its focus outline with nothing replacing it**
      `pos.module.css:39` · small fix
      `.searchInput` on the POS sets `outline: none` and `border: none`, and unlike the equivalent fields on /menu, /orders and /customer there is no `.searchBar:focus-within` rule in pos.module.css to substitute a visible indicator. Focusing the till's item search produces no visible change at all, breaking WCAG 2.4.7 Focus Visible.

- [ ] **Customer menu search field has no programmatic label**
      `page.js:122` · small fix
      The public menu's search input has no `<label>`, no `id`, and no `aria-label` — only a `placeholder`. Its accessible name therefore depends on the placeholder fallback, which disappears the moment the guest types, and the magnifier icon beside it (page.js:121) is an unlabelled decorative SVG. The same file explicitly aria-labels the grid/list toggle buttons two blocks down, so the omission here is an inconsistency rather than a house style.

- [ ] **Customer menu has no prefers-reduced-motion guard for its spinner and card animations**
      `customer.module.css:26` · small fix
      customer.module.css is the only stylesheet with animation that carries no `@media (prefers-reduced-motion: reduce)` block. It runs an infinite 1s rotation on the load spinner, a 0.4s transform lift on every card hover, and a 0.5s image transform transition. globals.css, orders.module.css, ConnectionStatus, CookingLoader, CategorySelect and MenuItemForm all guard theirs — the public page, the one page reached by the widest and least-controlled audience, does not.

- [ ] **Order/waiter meta line cannot wrap or shrink and runs off the 80mm paper**
      `ReceiptPreview.module.css:123` · small fix
      `.meta span { white-space: nowrap }` gives each of the two flex items a min-content size equal to its full text width, so flex-shrink cannot reduce them and the row overflows instead of wrapping. In print `#receipt-print-root` is `overflow: visible` inside an exactly-80mm page box, so the overflow is clipped at the paper edge.

- [ ] **Service worker caches navigation responses with no status check, into a cache version that never changes**
      `sw.js:85` · small fix
      The navigation branch writes every response it receives into SHELL_CACHE, unlike the asset branch two blocks above which correctly gates on `response.ok`. VERSION is the literal 'v1' and nothing else evicts these entries, so a bad response is stored under the page's URL permanently and is what the offline fallback serves.

- [ ] **Sales chart is sorted by a bare "MMM dd" string, misordering ranges that cross a year boundary**
      `page.js:174` · small fix
      `chartData` keys points by `format(..., 'MMM dd')` and then sorts with `new Date('Jan 02') - new Date('Dec 30')`. A month-and-day string with no year parses to year 2001 in V8, so January points sort before the preceding December's across a new-year boundary, and "Feb 29" parses as "Mar 01".

- [ ] **Orders and KDS fetch the entire 125-item menu with all columns to build a name-to-image map**
      `page.js:212` · small fix
      Both screens call getMenuItems(), a `select('*')` over all menu items, and immediately reduce it to a `{name: image}` lookup, discarding description, price, variants, modifiers and everything else.

- [ ] **NEXT_PUBLIC_SITE_URL is read by the PIN-reset flow but is never set or documented**
      `actions.js:64` · small fix
      requestPinReset builds the password-recovery redirect from `process.env.NEXT_PUBLIC_SITE_URL`, falling back to the request's Host header. The variable appears nowhere else in the repository — not in .env.local, not in README.md's list of required variables — so the fallback is always what runs, and the reset link points at whatever hostname the browser happened to use.

- [ ] **4.6 MB of unreferenced stock photography and create-next-app boilerplate ships on every deploy**
      `page.module.css:1` · small fix
      Several files are committed, deployed and never loaded: 37 stock JPEGs in public/menu-images (4.6 MB), the create-next-app SVGs, a 141-line CSS module for a page that only redirects, a compatibility export nobody imports, and an unused ref.


---

## Method

Ten audit passes ran in parallel, one lens each: money and totals, order
lifecycle, auth and RLS, React state, realtime and offline, printing, error
handling, accessibility, performance, configuration. Each pass's findings went
to a separate reviewer whose job was to REFUTE them, defaulting to refuted when
uncertain.

87 raw findings -> 2 refuted -> duplicates merged -> 57 here.
Where two or more passes converged independently, the item says so. That is the
strongest signal in this list.

CAVEAT: two of the ten verification passes did not finish, so 19 findings carry
no adversarial check — mostly performance and printing. They are the ones with
no 'passes agreed' note.

Excluded deliberately, because you have already decided them: placeholder menu
prices, the placeholder FBR tax block, the disabled payment QR, and the eight
known <img> lint warnings.
