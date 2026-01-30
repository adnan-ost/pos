
const { crc16ccitt } = require('crc');

// EMVCo requires CRC-16 CCITT (0xFFFF initial value, 0x1021 polynomial, no final XOR).
// Test vector: '123456789' should be 0x29B1

const input = '123456789';
const result = crc16ccitt(input).toString(16).toUpperCase().padStart(4, '0');

console.log(`Input: ${input}`);
console.log(`Computed: ${result}`);
console.log(`Expected: 29B1`);

if (result === '29B1') {
    console.log('SUCCESS: Library uses correct EMVCo parameters.');
} else {
    console.log('FAILURE: Library uses non-standard parameters.');
}
