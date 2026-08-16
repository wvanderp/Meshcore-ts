import { describe, it, expect } from 'vitest';
import BufferWriter from './buffer_writer';

describe('BufferWriter', () => {
    it('starts with an empty buffer', () => {
        const writer = new BufferWriter();
        expect(writer.toBytes()).toEqual(new Uint8Array([]));
    });

    it('writeByte appends a single byte', () => {
        const writer = new BufferWriter();
        writer.writeByte(0x42);
        expect(writer.toBytes()).toEqual(new Uint8Array([0x42]));
    });

    it('writeBytes appends multiple bytes', () => {
        const writer = new BufferWriter();
        writer.writeBytes([0x01, 0x02, 0x03]);
        expect(writer.toBytes()).toEqual(new Uint8Array([0x01, 0x02, 0x03]));
    });

    it('writeBytes appends Uint8Array', () => {
        const writer = new BufferWriter();
        writer.writeBytes(new Uint8Array([0xaa, 0xbb]));
        expect(writer.toBytes()).toEqual(new Uint8Array([0xaa, 0xbb]));
    });

    it('writeUInt16LE writes 16-bit little-endian', () => {
        const writer = new BufferWriter();
        writer.writeUInt16LE(0x0102);
        expect(writer.toBytes()).toEqual(new Uint8Array([0x02, 0x01]));
    });

    it('writeUInt32LE writes 32-bit little-endian', () => {
        const writer = new BufferWriter();
        writer.writeUInt32LE(0x01020304);
        expect(writer.toBytes()).toEqual(new Uint8Array([0x04, 0x03, 0x02, 0x01]));
    });

    it('writeInt32LE writes signed 32-bit little-endian', () => {
        const writer = new BufferWriter();
        writer.writeInt32LE(-1);
        expect(writer.toBytes()).toEqual(new Uint8Array([0xff, 0xff, 0xff, 0xff]));
    });

    it('writeString encodes UTF-8 string', () => {
        const writer = new BufferWriter();
        writer.writeString('AB');
        expect(writer.toBytes()).toEqual(new Uint8Array([0x41, 0x42]));
    });

    it('writeCString writes null-terminated fixed-length string', () => {
        const writer = new BufferWriter();
        writer.writeCString('Hi', 4);
        const bytes = writer.toBytes();
        expect(bytes.length).toBe(4);
        expect(bytes[0]).toBe(0x48); // 'H'
        expect(bytes[1]).toBe(0x69); // 'i'
        expect(bytes[3]).toBe(0);    // null terminator at end
    });

    it('writeCString truncates long strings and null-terminates', () => {
        const writer = new BufferWriter();
        writer.writeCString('Hello, World!', 4);
        const bytes = writer.toBytes();
        expect(bytes.length).toBe(4);
        expect(bytes[3]).toBe(0); // last byte is always null
    });

    it('chains multiple writes', () => {
        const writer = new BufferWriter();
        writer.writeByte(0x01);
        writer.writeUInt16LE(0x0203);
        writer.writeByte(0x04);
        expect(writer.toBytes()).toEqual(new Uint8Array([0x01, 0x03, 0x02, 0x04]));
    });
});
