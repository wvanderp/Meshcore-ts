/**
 * An incremental binary data builder.
 *
 * Appends typed values (bytes, little-endian integers, strings, C-strings)
 * to an internal buffer and returns the accumulated result as a
 * `Uint8Array` via {@link toBytes}.
 *
 * @example
 * const writer = new BufferWriter();
 * writer.writeByte(0x01);
 * writer.writeUInt32LE(42);
 * writer.writeString("hello");
 * const bytes = writer.toBytes(); // Uint8Array([0x01, 0x2a, 0x00, 0x00, 0x00, ...])
 */
class BufferWriter {

    buffer: number[];

    constructor() {
        this.buffer = [];
    }

    toBytes() {
        return new Uint8Array(this.buffer);
    }

    writeBytes(bytes) {
        this.buffer = [
            ...this.buffer,
            ...bytes,
        ];
    }

    writeByte(byte) {
        this.writeBytes([
            byte,
        ]);
    }

    writeUInt16LE(num) {
        const bytes = new Uint8Array(2);
        const view = new DataView(bytes.buffer);
        view.setUint16(0, num, true);
        this.writeBytes(bytes);
    }

    writeUInt32LE(num) {
        const bytes = new Uint8Array(4);
        const view = new DataView(bytes.buffer);
        view.setUint32(0, num, true);
        this.writeBytes(bytes);
    }

    writeInt32LE(num) {
        const bytes = new Uint8Array(4);
        const view = new DataView(bytes.buffer);
        view.setInt32(0, num, true);
        this.writeBytes(bytes);
    }

    writeString(string) {
        this.writeBytes(new TextEncoder().encode(string));
    }

    writeCString(string, maxLength) {

        // create buffer of max length
        const bytes = new Uint8Array(new ArrayBuffer(maxLength));

        // encode string to bytes
        const encodedString = new TextEncoder().encode(string);

        // copy in string until we hit the max length, or we run out of string bytes
        for (let i = 0; i < maxLength && i < encodedString.length; i++){
            bytes[i] = encodedString[i];
        }

        // ensure the last byte is always a null terminator
        bytes[bytes.length - 1] = 0;

        // write to buffer
        this.writeBytes(bytes);

    }

}

export default BufferWriter;
