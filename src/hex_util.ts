/**
 * Hex encoding utility.
 *
 * Provides a single static helper to convert a byte array into a
 * lowercase hex string.
 *
 * @example
 * const hex = HexUtil.bytesToHex(new Uint8Array([0xCA, 0xFE, 0xBA, 0xBE]));
 * console.log(hex); // "cafebabe"
 */
class HexUtil {

    static bytesToHex(bytes: ArrayLike<number>) {
        return Array.from(bytes).map((byte) => {
            return byte.toString(16).padStart(2, "0");
        }).join("");
    }

}

export default HexUtil;
