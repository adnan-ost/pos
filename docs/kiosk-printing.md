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

## 2. The shortcut

Create a desktop shortcut with this as the target:

```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing --user-data-dir="C:\pos-profile" --app=https://flamespos.vercel.app/pos
```

What each part is for:

| Flag | Why |
|---|---|
| `--kiosk-printing` | Prints straight to the default printer, no preview, no dialog |
| `--user-data-dir="C:\pos-profile"` | **Forces a separate Chrome process.** This is what makes the flag take effect at all — see below |
| `--app=<url>` | Chromeless window — no address bar or tabs for staff to wander out of |

Add `--start-fullscreen` if you want it edge to edge. Use `--kiosk` for true
locked-down kiosk mode, but note that also removes the window controls, so have
a way back out (Alt+F4) before you set it on a machine you're not sitting at.

## 3. Start it with Windows

Press `Win+R`, run `shell:startup`, and drop a copy of the shortcut in the folder
that opens. The till then comes up ready after a power cut.

## 4. Confirm it before a service

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

## "The receipt got cut in half"

The app measures each receipt and asks for a page exactly that tall, but **the
printer driver has the final say**. If the driver's paper is a fixed length
(often 80 × 297mm, sometimes shorter), anything longer is split across pages —
which is what a receipt torn off after the payment QR looks like.

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
