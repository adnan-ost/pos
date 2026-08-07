# Silent receipt printing (Windows + Chrome)

The app prints the receipt as part of saving a sale. To make that happen with no
dialog and no clicks, Chrome has to be launched with `--kiosk-printing`.

Without that flag everything still works — you just get Chrome's normal print
preview on every sale. That preview appearing is the signal this setup hasn't
been done on a terminal.

## 1. The printer

`--kiosk-printing` always prints to the **Windows default printer**. It cannot
choose one, so:

1. Settings → Bluetooth & devices → Printers & scanners → your thermal printer
   → **Set as default**.
2. Turn off "Let Windows manage my default printer", or Windows will silently
   reassign it to whatever was used last.
3. In the printer's own properties, set the paper/roll to **80mm**. The driver
   has the final say on the physical roll and on any scaling.

The app measures each receipt and asks for a page exactly that tall, so a receipt
prints as one continuous strip with no page break and no metre of blank roll.
(Worth knowing if you ever touch the print CSS: `@page { size: 80mm auto }` — the
idiom you'll find in most blog posts — does **not** work. Chrome treats mixing a
length with `auto` as invalid, drops the rule, and silently prints US Letter.)

## 2. Prime the profile — do this before the shortcut

**This step is what most silent-printing setups get wrong.**

Kiosk printing has no print preview, so it cannot ask you anything. It reuses the
print settings **already saved in that Chrome profile**. A brand-new
`--user-data-dir` has none, so Chrome falls back to defaults — which include
**headers and footers** (the URL and date printed on your receipt) and default
margins. Those also add height, which can push a receipt onto an extra page and
give you an extra cut.

So teach the profile once, with the preview still available:

1. Launch Chrome with the profile but **without** `--kiosk-printing`:

   ```
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir="C:\pos-profile" https://flamespos.vercel.app/pos
   ```

2. Sign in, open any order in **Orders** and press the 🖨 button to get a receipt.
3. In the print dialog set, in this order:
   - **Destination** — the thermal printer
   - **Margins** — None
   - **Scale** — Default (or 100%, never "Fit to page")
   - **Options** — untick **Headers and footers**
4. Press **Print**. That's what saves the settings into the profile.
5. Close Chrome completely.

Now the kiosk shortcut will print silently using exactly those settings.

## 3. The shortcut

Create a desktop shortcut with this as the target:

```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --kiosk-printing --user-data-dir="C:\pos-profile" --app=https://flamespos.vercel.app/pos
```

What each part is for:

| Flag | Why |
|---|---|
| `--kiosk-printing` | Prints straight to the default printer, no preview, no dialog |
| `--kiosk` | Reported to be needed alongside it on some Chrome builds for the silent print to take. Harmless if it wasn't |
| `--user-data-dir="C:\pos-profile"` | **Forces a separate Chrome process.** This is what makes the flag take effect at all — see below |
| `--app=<url>` | Chromeless window — no address bar or tabs for staff to wander out of |

`--kiosk` removes the window controls, so know your way back out before setting
this on a machine you aren't sitting at: **Alt+F4** closes it. Drop `--kiosk` if
you'd rather keep a normal window while you're still setting things up — silent
printing does not depend on it in most builds.

## 4. Start it with Windows

Press `Win+R`, run `shell:startup`, and drop a copy of the shortcut in the folder
that opens. The till then comes up ready after a power cut.

## 5. Confirm it before a service

1. Launch the shortcut. Sign in.
2. Ring up **one item** and take payment.
3. Paper should emerge with no dialog.

Check on that first receipt:

- **Nothing is cut off** — the total and "Thank you for dining with us!" are both
  on the paper. If the bottom is missing, the driver is scaling; set it to 100% /
  "Actual size".
- **Nothing but the receipt** — no sidebar, no buttons, no dark background.
- **Both QR codes are solid and scannable**, not faint or striped.

Ring up a large order (15+ lines) once as well. A long receipt is where clipping
shows up, and it's better to find that now than mid-service.

## "I still get the print dialog"

Almost always one of these, in order of likelihood.

### Chrome was already running

This is the big one. **Chrome only reads command-line flags when it starts a new
process.** If any Chrome window is already open, launching the shortcut just asks
that existing process to open a tab, and every flag is silently discarded — no
error, it simply behaves normally.

`--user-data-dir` is what avoids this, because a different profile directory
forces a genuinely separate process. If you tried the flag without it, that's the
explanation.

To be certain: close **every** Chrome window, check Task Manager for leftover
`chrome.exe` processes and end them, then launch the shortcut.

### Confirm the flags actually arrived

In the kiosk window, open a new tab and go to:

```
chrome://version
```

Look at the **Command Line** row. `--kiosk-printing` must be listed there. If it
isn't, Chrome never received it and the problem is the shortcut, not the printer.

### The shortcut is malformed

Flags go *after* the closing quote of the executable path, separated by spaces:

```
"C:\...\chrome.exe" --kiosk-printing --user-data-dir="C:\pos-profile" --app=https://...
```

A flag inside the quotes becomes part of the path and Windows ignores it.

### You typed the URL into an ordinary window

The kiosk window is the only one that prints silently. A normal Chrome window
pointed at the same URL will always show the dialog — that's expected.

## "One bill came out with several cuts"

Each cut is a **page boundary**. Three cuts means Chrome split the receipt into
three pages and the printer cut at the end of each. Two things cause that, and
both are in the driver rather than the app:

**The cut mode.** Most thermal drivers offer a choice like *Cut per page* vs
*Cut at end of document / end of job*. On *per page* you get one cut per page, so
a receipt that paginates gets chopped into pieces. Set it to **end of
document/job** so there is exactly one cut per receipt no matter how it paginated.

**The page length.** The app asks for a page exactly as tall as the receipt, but
that is only a request — the driver's paper size decides. A fixed 80 × 297mm page
splits anything longer.

Also check step 2 above: if **Headers and footers** is still on, Chrome is adding
a URL and date line plus margins to every page, which makes pagination more likely
in the first place.

Fix it in the driver, not the app:

1. Control Panel → Devices and Printers → right-click the printer → **Printing
   preferences**.
2. Set the paper size to the roll or a **continuous / receipt** option if the
   driver offers one. If it only offers fixed sizes, create a custom size 80mm
   wide and as long as it allows (e.g. 80 × 1000mm).
3. Set scaling to **100% / Actual size**. Any "fit to page" setting will shrink
   the text and can also force a break.

Then reprint a long order from the Orders screen (🖨 on the row) to check,
rather than ringing up another sale.

## Turning it off

Settings → **Print receipt automatically on payment**. Use it when the printer is
jammed or out of roll — sales continue as normal, and any order can be reprinted
later from the Orders screen (the 🖨 button on each row).

## Notes and limits

- **Reprints** go through the same path, so they need no extra setup.
- **A receipt is one continuous strip.** There's no paper cut command — the app
  prints an image of a page, so cutting is whatever the printer does on its own.
- **Android tablets can't do this.** Chrome on Android has no `--kiosk-printing`.
  A tablet till needs either a print service that accepts silent jobs, or a
  Windows/Linux box driving the printer.
- **This is browser printing, not ESC/POS.** It renders the receipt as graphics,
  which is slower and uses more roll than sending text commands, but it needs no
  driver work and prints exactly what's on screen. Direct ESC/POS would be a
  separate piece of work.
