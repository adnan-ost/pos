
import { crc16ccitt } from 'crc';

/*
 * EMVCo length prefixes are exactly two digits. The previous implementation
 * emitted three for anything under 100 ("002" for a length of 2), which made
 * every single field in the payload malformed — the string opened "0000201"
 * where a reader expects "000201", so no parser could get past the first tag.
 * The QR scanned as text and no bank app recognised it as a payment code.
 */
function formatTLV(tag, value) {
    const stringValue = String(value);

    if (stringValue.length > 99) {
        // Two digits cannot express it, and a truncated identifier would encode
        // somebody else's account. Refuse rather than emit a plausible payload.
        throw new Error(`EMVCo field ${tag} is ${stringValue.length} chars; max is 99`);
    }

    return tag + String(stringValue.length).padStart(2, '0') + stringValue;
}

/*
 * Two values here decide whether a bank app treats this as a payment code or as
 * meaningless text, and neither can be guessed — both are issued by the
 * acquiring bank or PSP when a merchant is onboarded:
 *
 *   merchantAccountGuid  the scheme identifier a wallet matches to know which
 *                        rail the account id belongs to. The '000000' default
 *                        below matches no scheme, so payloads built with it are
 *                        structurally valid and still unpayable.
 *   merchantCategoryCode ISO 18245 trade code ('5812' is restaurants). '0000'
 *                        means unspecified and some acquirers reject it.
 *
 * Until the bank supplies them, this produces a well-formed QR that no app will
 * act on. That is a provisioning gap, not something the code can close.
 */
export const PLACEHOLDER_GUID = '000000';

export function generateEMVCoPayload({
    raastId,
    amount,
    currency = '586', // PKR
    country = 'PK',
    merchantName,
    merchantCity,
    invoiceNo,
    merchantAccountGuid = PLACEHOLDER_GUID,
    merchantCategoryCode = '0000'
}) {
    let payload = '';

    // 00: Payload Format Indicator
    payload += formatTLV('00', '01');

    // 01: Point of Initiation Method (12 = Dynamic)
    payload += formatTLV('01', '12');

    // 26: Merchant Account Information — a nested template holding the scheme
    // identifier (00) and the account id it applies to (01). Tags 26-51 are the
    // slots reserved for payment schemes; which one to use is part of the spec
    // the acquirer hands over.
    if (raastId) {
        const raastPayload = formatTLV('00', merchantAccountGuid) + formatTLV('01', raastId);
        payload += formatTLV('26', raastPayload);
    }

    // Merchant Category Code (52)
    payload += formatTLV('52', merchantCategoryCode);

    // Transaction Currency (53) - PKR = 586
    payload += formatTLV('53', currency);

    // Transaction Amount (54)
    if (amount) {
        payload += formatTLV('54', parseFloat(amount).toFixed(2));
    }

    // Country Code (58)
    payload += formatTLV('58', country);

    // Merchant Name (59)
    const name = merchantName || 'Merchant';
    payload += formatTLV('59', name.substring(0, 25));

    // Merchant City (60)
    payload += formatTLV('60', merchantCity || 'Islamabad');

    // Additional Data Field (62) - Reference Label / Invoice
    if (invoiceNo) {
        const additionalData = formatTLV('01', invoiceNo);
        payload += formatTLV('62', additionalData);
    }

    // CRC16 (63)
    // The checksum is calculated over the entire string including "6304"
    payload += '6304';

    const crcValue = crc16ccitt(payload).toString(16).toUpperCase().padStart(4, '0');
    return payload + crcValue;
}
