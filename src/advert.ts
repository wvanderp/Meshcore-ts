import BufferReader from './buffer_reader';
import BufferWriter from './buffer_writer';

type AdvertTypeString = 'NONE' | 'CHAT' | 'REPEATER' | 'ROOM' | 'SENSOR';
type ByteArrayLike = ArrayLike<number>;

type ParsedAdvertData = {
    type: AdvertTypeString | null;
    lat: number | null;
    lon: number | null;
    name: string | null;
    feat1: number | null;
    feat2: number | null;
};

/**
 * Represents a MeshCore advertisement broadcast by a mesh node.
 *
 * Parses the binary advertisement payload (public key, timestamp, ed25519
 * signature, and variable-length app-data) and exposes the decoded fields
 * such as node type, name, and GPS coordinates.  The {@link isVerified}
 * method performs full ed25519 signature validation via @noble/curves.
 *
 * @example
 * const bytes = new Uint8Array([...]);
 * const advert = Advert.fromBytes(bytes);
 * console.log(advert.parsed.name);    // e.g. "Node-01"
 * console.log(advert.parsed.type);    // e.g. "CHAT"
 * const valid = await advert.isVerified();
 */
class Advert {

    publicKey: Uint8Array;
    timestamp: number;
    signature: Uint8Array;
    appData: Uint8Array;
    parsed: ParsedAdvertData;

    static ADV_TYPE_NONE = 0;
    static ADV_TYPE_CHAT = 1;
    static ADV_TYPE_REPEATER = 2;
    static ADV_TYPE_ROOM = 3;
    static ADV_TYPE_SENSOR = 4;

    static ADV_LATLON_MASK = 0x10;
    static ADV_FEAT1_MASK = 0x20;
    static ADV_FEAT2_MASK = 0x40;
    static ADV_NAME_MASK = 0x80;

    constructor(publicKey: Uint8Array, timestamp: number, signature: Uint8Array, appData: Uint8Array) {
        this.publicKey = publicKey;
        this.timestamp = timestamp;
        this.signature = signature;
        this.appData = appData;
        this.parsed = this.parseAppData();
    }

    static fromBytes(bytes: ByteArrayLike): Advert {

        // read bytes
        const bufferReader = new BufferReader(bytes);
        const publicKey = bufferReader.readBytes(32);
        const timestamp = bufferReader.readUInt32LE();
        const signature = bufferReader.readBytes(64);
        const appData = bufferReader.readRemainingBytes();

        return new Advert(publicKey, timestamp, signature, appData);

    }

    getFlags(): number {
        return this.appData[0];
    }

    getType(): number {
        const flags = this.getFlags();
        return flags & 0x0F;
    }

    getTypeString(): AdvertTypeString | null {
        const type = this.getType();
        if (type === Advert.ADV_TYPE_NONE) return 'NONE';
        if (type === Advert.ADV_TYPE_CHAT) return 'CHAT';
        if (type === Advert.ADV_TYPE_REPEATER) return 'REPEATER';
        if (type === Advert.ADV_TYPE_ROOM) return 'ROOM';
        if (type === Advert.ADV_TYPE_SENSOR) return 'SENSOR';

        return null;
    }

    async isVerified(): Promise<boolean> {

        const { ed25519 } = await import('@noble/curves/ed25519.js');

        // build signed data
        const bufferWriter = new BufferWriter();
        bufferWriter.writeBytes(this.publicKey);
        bufferWriter.writeUInt32LE(this.timestamp);
        bufferWriter.writeBytes(this.appData);

        // verify signature
        return ed25519.verify(this.signature, bufferWriter.toBytes(), this.publicKey);

    }

    parseAppData(): ParsedAdvertData {

        // read app data
        const bufferReader = new BufferReader(this.appData);
        const flags = bufferReader.readByte();

        // parse lat lon
        let lat: number | null = null;
        let lon: number | null = null;
        if (flags & Advert.ADV_LATLON_MASK){
            lat = bufferReader.readInt32LE();
            lon = bufferReader.readInt32LE();
        }

        // parse feat1
        let feat1: number | null = null;
        if (flags & Advert.ADV_FEAT1_MASK){
            feat1 = bufferReader.readUInt16LE();
        }

        // parse feat2
        let feat2: number | null = null;
        if (flags & Advert.ADV_FEAT2_MASK){
            feat2 = bufferReader.readUInt16LE();
        }

        // parse name (remainder of app data)
        let name: string | null = null;
        if (flags & Advert.ADV_NAME_MASK){
            name = bufferReader.readString();
        }

        return {
            type: this.getTypeString(),
            lat: lat,
            lon: lon,
            name: name,
            feat1: feat1,
            feat2: feat2,
        };

    }

}

export default Advert;
