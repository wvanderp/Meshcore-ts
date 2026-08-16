import { describe, it, expect } from 'vitest';
import HexUtil from './hex_util';

describe('HexUtil', () => {
    it('converts bytes to hex string', () => {
        expect(HexUtil.bytesToHex([0x0a, 0xff, 0x00])).toBe('0aff00');
    });

    it('handles empty array', () => {
        expect(HexUtil.bytesToHex([])).toBe('');
    });

    it('pads single-digit hex values', () => {
        expect(HexUtil.bytesToHex([0x01])).toBe('01');
    });
});
