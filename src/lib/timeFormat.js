/*
 * Every clock time in the app goes through here.
 *
 * Left to the browser, `toLocaleTimeString` follows the device locale: the same
 * till reads "18:42" on a machine set to en-GB and "6:42 PM" on one set to
 * en-US. Receipts and screens get compared side by side, so the format has to
 * be a property of the app rather than of whatever device rendered it.
 *
 * Locale is pinned to en-PK for day-before-month dates, which is how they're
 * read here. The meridiem is uppercased because en-PK emits "pm" and receipts
 * conventionally carry "PM"; Intl has no option for its case.
 */
const LOCALE = 'en-PK';

const upperMeridiem = (formatted) => formatted.replace(/\b(am|pm)\b/gi, (m) => m.toUpperCase());

// "6:42 PM", or "6:42:07 PM" with seconds
export const formatClockTime = (date, { withSeconds = false } = {}) =>
    upperMeridiem(date.toLocaleTimeString(LOCALE, {
        hour: 'numeric',
        minute: '2-digit',
        ...(withSeconds && { second: '2-digit' }),
        hour12: true,
    }));

// "5 Aug"
export const formatDayMonth = (date) =>
    date.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });

// "Wed, 5 Aug"
export const formatWeekdayDate = (date) =>
    date.toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' });

// "05-Aug-2026, 6:42 PM" — for receipt and report headers that need both
export const formatDateTime = (date) =>
    upperMeridiem(date.toLocaleString(LOCALE, {
        dateStyle: 'medium',
        timeStyle: 'short',
        hour12: true,
    }));
