
const { crc16ccitt } = require('crc');

function pad(number) {
    return number < 10 ? '00' + number : number < 100 ? '0' + number : number;
}

function formatTLV(tag, value) {
    const stringValue = String(value);
    const length = pad(stringValue.length);
    return tag + length + stringValue;
}

function generatePayLoad() {
    const raastId = '03475369008';
    const amount = '1500.00';
    const merchantName = 'Flames by the Indus';
    const merchantCity = 'Islamabad';

    let payload = '';
    payload += formatTLV('00', '01');
    payload += formatTLV('01', '12'); // Dynamic

    // ID 26: Merchant Account Information
    // Common ID for Raast/Banks in PK often uses a GUID.
    // If we treat it as a proprietary schema:
    // GUID "pk.com.emoney" might need to be specific for the bank.
    // Let's try to see what the generated string looks like.
    const raastPayload = formatTLV('00', 'pk.com.emoney') + formatTLV('01', raastId);
    payload += formatTLV('26', raastPayload);

    payload += formatTLV('52', '0000'); // MCC
    payload += formatTLV('53', '586');  // PKR
    payload += formatTLV('54', amount);
    payload += formatTLV('58', 'PK');
    payload += formatTLV('59', merchantName);
    payload += formatTLV('60', merchantCity);

    payload += '6304';

    const crcValue = crc16ccitt(payload).toString(16).toUpperCase().padStart(4, '0');

    console.log('Final Payload:', payload + crcValue);
}

generatePayLoad();
