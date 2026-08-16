import { describe, it, expect } from 'vitest';
import CayenneLpp from './cayenne_lpp';
import BufferWriter from './buffer_writer';

function buildLppPayload(entries: Array<{ channel: number; type: number; write: (w: BufferWriter) => void }>): Uint8Array {
    const w = new BufferWriter();
    for (const entry of entries) {
        w.writeByte(entry.channel);
        w.writeByte(entry.type);
        entry.write(w);
    }
    return w.toBytes();
}

describe('CayenneLpp', () => {
    it('has all LPP type constants', () => {
        expect(CayenneLpp.LPP_DIGITAL_INPUT).toBe(0);
        expect(CayenneLpp.LPP_DIGITAL_OUTPUT).toBe(1);
        expect(CayenneLpp.LPP_ANALOG_INPUT).toBe(2);
        expect(CayenneLpp.LPP_ANALOG_OUTPUT).toBe(3);
        expect(CayenneLpp.LPP_GENERIC_SENSOR).toBe(100);
        expect(CayenneLpp.LPP_LUMINOSITY).toBe(101);
        expect(CayenneLpp.LPP_PRESENCE).toBe(102);
        expect(CayenneLpp.LPP_TEMPERATURE).toBe(103);
        expect(CayenneLpp.LPP_RELATIVE_HUMIDITY).toBe(104);
        expect(CayenneLpp.LPP_ACCELEROMETER).toBe(113);
        expect(CayenneLpp.LPP_BAROMETRIC_PRESSURE).toBe(115);
        expect(CayenneLpp.LPP_VOLTAGE).toBe(116);
        expect(CayenneLpp.LPP_CURRENT).toBe(117);
        expect(CayenneLpp.LPP_FREQUENCY).toBe(118);
        expect(CayenneLpp.LPP_PERCENTAGE).toBe(120);
        expect(CayenneLpp.LPP_ALTITUDE).toBe(121);
        expect(CayenneLpp.LPP_CONCENTRATION).toBe(125);
        expect(CayenneLpp.LPP_POWER).toBe(128);
        expect(CayenneLpp.LPP_DISTANCE).toBe(130);
        expect(CayenneLpp.LPP_ENERGY).toBe(131);
        expect(CayenneLpp.LPP_DIRECTION).toBe(132);
        expect(CayenneLpp.LPP_UNIXTIME).toBe(133);
        expect(CayenneLpp.LPP_GYROMETER).toBe(134);
        expect(CayenneLpp.LPP_COLOUR).toBe(135);
        expect(CayenneLpp.LPP_GPS).toBe(136);
        expect(CayenneLpp.LPP_SWITCH).toBe(142);
        expect(CayenneLpp.LPP_POLYLINE).toBe(240);
    });

    it('parses empty buffer', () => {
        expect(CayenneLpp.parse(new Uint8Array([]))).toEqual([]);
    });

    it('stops when channel and type are both zero', () => {
        const result = CayenneLpp.parse(new Uint8Array([0x00, 0x00]));
        expect(result).toEqual([]);
    });

    it('parses LPP_GENERIC_SENSOR', () => {
        const bytes = buildLppPayload([{
            channel: 1, type: CayenneLpp.LPP_GENERIC_SENSOR,
            write: (w) => {
                // UInt32BE = 0x00000064 = 100
                w.writeBytes([0x00, 0x00, 0x00, 0x64]);
            },
        }]);
        const result = CayenneLpp.parse(bytes);
        expect(result).toEqual([{ channel: 1, type: 100, value: 100 }]);
    });

    it('parses LPP_LUMINOSITY', () => {
        const bytes = buildLppPayload([{
            channel: 2, type: CayenneLpp.LPP_LUMINOSITY,
            write: (w) => {
                // Int16BE = 500
                w.writeBytes([0x01, 0xf4]);
            },
        }]);
        const result = CayenneLpp.parse(bytes);
        expect(result).toEqual([{ channel: 2, type: 101, value: 500 }]);
    });

    it('parses LPP_PRESENCE', () => {
        const bytes = buildLppPayload([{
            channel: 3, type: CayenneLpp.LPP_PRESENCE,
            write: (w) => w.writeByte(1),
        }]);
        const result = CayenneLpp.parse(bytes);
        expect(result).toEqual([{ channel: 3, type: 102, value: 1 }]);
    });

    it('parses LPP_TEMPERATURE', () => {
        const bytes = buildLppPayload([{
            channel: 4, type: CayenneLpp.LPP_TEMPERATURE,
            write: (w) => {
                // Int16BE = 235 → 23.5°C
                w.writeBytes([0x00, 0xeb]);
            },
        }]);
        const result = CayenneLpp.parse(bytes);
        expect(result[0].value).toBeCloseTo(23.5);
    });

    it('parses LPP_RELATIVE_HUMIDITY', () => {
        const bytes = buildLppPayload([{
            channel: 5, type: CayenneLpp.LPP_RELATIVE_HUMIDITY,
            write: (w) => w.writeByte(100), // 100/2 = 50%
        }]);
        const result = CayenneLpp.parse(bytes);
        expect(result[0].value).toBe(50);
    });

    it('parses LPP_BAROMETRIC_PRESSURE', () => {
        const bytes = buildLppPayload([{
            channel: 6, type: CayenneLpp.LPP_BAROMETRIC_PRESSURE,
            write: (w) => {
                // UInt16BE = 10132 → 1013.2 hPa
                w.writeBytes([0x27, 0x94]);
            },
        }]);
        const result = CayenneLpp.parse(bytes);
        expect(result[0].value).toBeCloseTo(1013.2);
    });

    it('parses LPP_VOLTAGE', () => {
        const bytes = buildLppPayload([{
            channel: 7, type: CayenneLpp.LPP_VOLTAGE,
            write: (w) => {
                // Int16BE = 330 → 3.30V
                w.writeBytes([0x01, 0x4a]);
            },
        }]);
        const result = CayenneLpp.parse(bytes);
        expect(result[0].value).toBeCloseTo(3.30);
    });

    it('parses LPP_CURRENT', () => {
        const bytes = buildLppPayload([{
            channel: 8, type: CayenneLpp.LPP_CURRENT,
            write: (w) => {
                // Int16BE = 1500 → 1.5A
                w.writeBytes([0x05, 0xdc]);
            },
        }]);
        const result = CayenneLpp.parse(bytes);
        expect(result[0].value).toBeCloseTo(1.5);
    });

    it('parses LPP_PERCENTAGE', () => {
        const bytes = buildLppPayload([{
            channel: 9, type: CayenneLpp.LPP_PERCENTAGE,
            write: (w) => w.writeByte(75),
        }]);
        const result = CayenneLpp.parse(bytes);
        expect(result[0].value).toBe(75);
    });

    it('parses LPP_CONCENTRATION', () => {
        const bytes = buildLppPayload([{
            channel: 10, type: CayenneLpp.LPP_CONCENTRATION,
            write: (w) => w.writeBytes([0x01, 0xf4]), // UInt16BE = 500
        }]);
        const result = CayenneLpp.parse(bytes);
        expect(result[0].value).toBe(500);
    });

    it('parses LPP_POWER', () => {
        const bytes = buildLppPayload([{
            channel: 11, type: CayenneLpp.LPP_POWER,
            write: (w) => w.writeBytes([0x00, 0x64]), // UInt16BE = 100
        }]);
        const result = CayenneLpp.parse(bytes);
        expect(result[0].value).toBe(100);
    });

    it('parses LPP_GPS', () => {
        const bytes = buildLppPayload([{
            channel: 12, type: CayenneLpp.LPP_GPS,
            write: (w) => {
                // lat: Int24BE = 512345 → 51.2345
                w.writeBytes([0x07, 0xd1, 0x59]);
                // lon: Int24BE = 42345 → 4.2345
                w.writeBytes([0x00, 0xa5, 0x69]);
                // alt: Int24BE = 10000 → 100.00m
                w.writeBytes([0x00, 0x27, 0x10]);
            },
        }]);
        const result = CayenneLpp.parse(bytes);
        expect(result[0].value).toEqual({
            latitude: expect.closeTo(51.2345, 3),
            longitude: expect.closeTo(4.2345, 3),
            altitude: expect.closeTo(100.0, 1),
        });
    });

    it('stops on unsupported type and returns already parsed', () => {
        const w = new BufferWriter();
        // First: valid temperature
        w.writeByte(1); // channel
        w.writeByte(CayenneLpp.LPP_TEMPERATURE);
        w.writeBytes([0x00, 0xeb]); // 23.5°C
        // Second: unsupported type (0x50 = 80)
        w.writeByte(2);
        w.writeByte(0x50);

        const result = CayenneLpp.parse(w.toBytes());
        expect(result.length).toBe(1);
        expect(result[0].value).toBeCloseTo(23.5);
    });

    it('parses multiple entries', () => {
        const bytes = buildLppPayload([
            {
                channel: 1, type: CayenneLpp.LPP_TEMPERATURE,
                write: (w) => w.writeBytes([0x00, 0xeb]),
            },
            {
                channel: 2, type: CayenneLpp.LPP_PRESENCE,
                write: (w) => w.writeByte(1),
            },
        ]);
        const result = CayenneLpp.parse(bytes);
        expect(result.length).toBe(2);
    });

    it('returns empty if only 1 byte available', () => {
        expect(CayenneLpp.parse(new Uint8Array([0x01]))).toEqual([]);
    });
});
