import BufferReader from "./buffer_reader";
import HexUtil from "./hex_util";
import Packet from "./packet";

/**
 * Represents a decoded MeshCore routing path.
 *
 * Reconstructs the sequence of intermediate node hashes from the
 * variable-length path field of a mesh packet.  Each hop is stored as
 * a `Uint8Array` slice whose size is determined by the path-length
 * encoding byte in the packet header.
 *
 * @example
 * const path = MeshCorePath.fromPathAndLength(packet.path, packet.pathLen);
 * if (path) {
 *     console.log(path.toHexPathString()); // e.g. "a1b2,c3d4,e5f6"
 *     console.log(path.pathHashCount);     // number of hops
 * }
 */
class MeshCorePath {

    pathHashSize: number;
    pathHashCount: number;
    pathItems: Uint8Array[];

    constructor(pathHashSize, pathHashCount, pathItems) {
        this.pathHashSize = pathHashSize;
        this.pathHashCount = pathHashCount;
        this.pathItems = pathItems;
    }

    static fromPathAndLength(path, pathLen) {

        // make sure path is valid
        if(pathLen === 0xFF){
            return null;
        }

        const pathHashSize = Packet.extractPathHashSize(pathLen);
        const pathHashCount = Packet.extractPathHashCount(pathLen);
        const pathByteLength = pathHashCount * pathHashSize;
        const pathBytes = path.subarray(0, pathByteLength);
        if(pathBytes.length < pathByteLength){
            return null;
        }

        // convert path to comma delimited hex string
        const pathItems: Uint8Array[] = [];
        const pathBuffer = new BufferReader(pathBytes);
        for(let i = 0; i < pathHashCount; i++){
            pathItems.push(pathBuffer.readBytes(pathHashSize));
        }

        return new MeshCorePath(pathHashSize, pathHashCount, pathItems);

    }

    toHexPathString() {
        return this.pathItems.map((pathItem) => {
            return HexUtil.bytesToHex(pathItem);
        }).join(",");
    }

}

export default MeshCorePath;
