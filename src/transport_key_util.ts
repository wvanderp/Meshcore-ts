/**
 * SHA-256 transport key generator for public hashtag regions.
 *
 * Derives a 32-byte transport key from a region name string by
 * prepending a `#` sigil (if absent) and computing the SHA-256 digest
 * via the Web Crypto API.  Used to derive the shared symmetric key for
 * hashtag-addressed channel messages.
 *
 * @example
 * const key = await TransportKeyUtil.getHashtagRegionKey("global");
 * // key is a 32-byte Uint8Array (SHA-256 of "#global")
 * await conn.sendCommandSetFloodScope(key);
 */
class TransportKeyUtil {

    static async getHashtagRegionKey(regionName) {

        // public hashtag regions must start with #
        if(!regionName.startsWith("#")){
            regionName = `#${regionName}`;
        }

        // Hash the message using SHA-256
        const bytes = new TextEncoder().encode(regionName);
        const hash = await crypto.subtle.digest("SHA-256", bytes);
        return new Uint8Array(hash);

    }

}

export default TransportKeyUtil;
