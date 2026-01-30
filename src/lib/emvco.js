
import { crc16ccitt } from 'crc';

function pad(number) {
    return number < 10 ? '00' + number : number < 100 ? '0' + number : number;
}

function formatTLV(tag, value) {
    const stringValue = String(value);
    const length = pad(stringValue.length);
    return tag + length + stringValue;
}

export function generateEMVCoPayload({
    raastId,
    jazzCashId,
    amount,
    currency = '586', // PKR
    country = 'PK',
    merchantName,
    merchantCity,
    invoiceNo
}) {
    let payload = '';

    // 00: Payload Format Indicator
    payload += formatTLV('00', '01');

    // 01: Point of Initiation Method (12 = Dynamic)
    payload += formatTLV('01', '12');

    // Merchant Account Information
    // Allocation for Pakistan (Raast is typically under 26-51 reserved range or specific ID)
    // For simplicity, we'll use a common ID slot or designated one if known.
    // Standard Raast integration often uses '00' within the slot for GUID and '01' for the ID.
    // However, without specific bank spec, we will treat Raast as a generic merchant ID for now suitable for widely used apps.
    // Let's use ID '26' for Raast/Generic.

    // 26: Merchant Account Information
    // Using '000000' as a generic placeholder often works better for interoperability 
    // when a specific bank GUID isn't strictly enforced or known.
    if (raastId) {
        // Tag 00: Globally Unique Identifier (GUID)
        // Tag 01: Merchant Account ID
        const raastPayload = formatTLV('00', '000000') + formatTLV('01', raastId);
        payload += formatTLV('26', raastPayload);
    }

    // Merchant Category Code (52) - 0000 = Unspecified
    payload += formatTLV('52', '0000');

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
