/*
 * Structural check on the real payload generator. Run from the repo root:
 *
 *   node scripts/test_qr.mjs
 *
 * This imports src/lib/emvco.js rather than restating it. The version this
 * replaced kept its own copy of the encoder, which meant it happily printed a
 * payload while production emitted three-digit length prefixes — a copy can
 * only ever verify itself.
 */
import { generateEMVCoPayload, PLACEHOLDER_GUID } from '../src/lib/emvco.js';
import { crc16ccitt } from 'crc';

const payload = generateEMVCoPayload({
    raastId: 'PK72SADA0000003156929008',
    amount: 1500,
    merchantName: 'Flames by the Indus',
    merchantCity: 'Islamabad',
    invoiceNo: 'FBR-123456',
});

console.log('Payload:', payload, '\n');

// Walk the TLV structure. Anything malformed shows up as a length that runs off
// the end of the string or a tag that isn't two digits.
const failures = [];

const walk = (s, indent, path) => {
    let i = 0;
    while (i < s.length) {
        const tag = s.slice(i, i + 2);
        const rawLen = s.slice(i + 2, i + 4);
        const len = parseInt(rawLen, 10);

        if (!/^\d{2}$/.test(tag)) failures.push(`${path}${tag}: tag is not two digits`);
        if (!/^\d{2}$/.test(rawLen)) failures.push(`${path}${tag}: length "${rawLen}" is not two digits`);
        if (Number.isNaN(len) || i + 4 + len > s.length) {
            failures.push(`${path}${tag}: length ${rawLen} overruns the remaining string`);
            return;
        }

        const value = s.slice(i + 4, i + 4 + len);
        console.log(`${indent}${tag} (${len}) = ${JSON.stringify(value)}`);
        if (tag === '26' || tag === '62') walk(value, indent + '      ', `${path}${tag}.`);
        i += 4 + len;
    }
};

walk(payload, '  ', '');

const given = payload.slice(-4);
const recomputed = crc16ccitt(payload.slice(0, -4)).toString(16).toUpperCase().padStart(4, '0');
if (given !== recomputed) failures.push(`CRC is ${given}, expected ${recomputed}`);

console.log();
if (failures.length) {
    failures.forEach(f => console.error(`FAIL  ${f}`));
    process.exit(1);
}

console.log('PASS  structure parses, CRC valid');

// Structural validity is not payability, and the difference is easy to forget.
if (payload.includes(`0006${PLACEHOLDER_GUID}`)) {
    console.warn(
        '\nWARN  merchant account GUID is still the placeholder. No bank app will\n' +
        '      recognise this as a payment code until the acquirer\'s scheme\n' +
        '      identifier and merchant id replace it.'
    );
}
