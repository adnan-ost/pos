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
| `--user-data-dir="C:\pos-profile"` | A profile of its own, so print settings and the login session can't be disturbed by ordinary browsing on the same machine |
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
