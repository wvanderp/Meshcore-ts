/**
 * Random number generation helper.
 *
 * Provides a single static method for generating cryptographically
 * insecure but uniformly distributed integers within an inclusive range.
 * For non-security-sensitive use cases such as generating nonces for
 * protocol retry logic.
 *
 * @example
 * const delay = RandomUtils.getRandomInt(500, 2000); // random ms between 500 and 2000
 * const nonce = RandomUtils.getRandomInt(0, 0xFFFF); // random 16-bit integer
 */
class RandomUtils {

    static getRandomInt(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

}

export default RandomUtils;
