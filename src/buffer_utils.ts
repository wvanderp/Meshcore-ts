/**
 * Static utility methods for binary buffer operations.
 *
 * Provides conversions between `Uint8Array`, hex strings, and Base64
 * strings, as well as constant-time buffer equality comparison.
 *
 * @example
 * const hex   = BufferUtils.bytesToHex(new Uint8Array([0xDE, 0xAD]));  // "dead"
 * const bytes = BufferUtils.hexToBytes("dead");                        // Uint8Array([0xde, 0xad])
 * const equal = BufferUtils.areBuffersEqual(bytes, new Uint8Array([0xde, 0xad])); // true
 */
class BufferUtils {

    static bytesToHex(uint8Array: ArrayLike<number>) {
        return Array.from(uint8Array).map(byte => {
            return byte.toString(16).padStart(2, '0');
        }).join('');
    }

    static hexToBytes(hex) {
        return Uint8Array.from(hex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
    }

    static base64ToBytes(base64) {
        return Uint8Array.from(atob(base64), (c) => {
            return c.charCodeAt(0);
        });
    }

    static areBuffersEqual(byteArray1, byteArray2) {

        // ensure length is the same
        if (byteArray1.length !== byteArray2.length){
            return false;
        }

        // ensure each item is the same
        for (let i = 0; i < byteArray1.length; i++){
            if (byteArray1[i] !== byteArray2[i]){
                return false;
            }
        }

        // arrays are the same
        return true;

    }

}

export default BufferUtils;
