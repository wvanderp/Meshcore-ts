import BufferWriter from '../buffer_writer';
import BufferReader from '../buffer_reader';
import Constants from '../constants';
import Connection from './connection';

// Firmware frames are bounded by MAX_FRAME_SIZE. Rejecting larger advertised
// lengths lets a stream recover instead of waiting forever on a corrupt header.
const MAX_COMPANION_FRAME_LENGTH = 172;

/**
 * Abstract serial transport for the MeshCore companion protocol.
 *
 * Implements the 3-byte frame-framing layer (type byte + 2-byte LE
 * length prefix) on top of a raw byte stream.  Subclasses must
 * implement {@link write} to deliver bytes to the underlying serial
 * port.  Not instantiable directly — use {@link WebSerialConnection}.
 *
 * @example
 * // SerialConnection is abstract; extend it to provide a write() implementation.
 * class MySerial extends SerialConnection {
 *     async write(bytes: Uint8Array) {
 *         await myPort.send(bytes);
 *     }
 * }
 */
class SerialConnection extends Connection {

    readBuffer: number[];

    constructor() {
        super();
        this.readBuffer = [];
        if (this.constructor === SerialConnection){
            throw new Error("SerialConnection is an abstract class and can't be instantiated.");
        }
    }

    async write(bytes) {
        void bytes;
        throw new Error('Not Implemented: write must be implemented by SerialConnection sub class.');
    }

    async writeFrame(frameType, frameData) {

        // create frame
        const frame = new BufferWriter();

        // add frame header
        frame.writeByte(frameType);
        frame.writeUInt16LE(frameData.length);

        // add frame data
        frame.writeBytes(frameData);

        // write frame to device
        await this.write(frame.toBytes());

    }

    async sendToRadioFrame(data) {
        // write "app to radio" frame 0x3c "<"
        this.emit('tx', data);
        await this.writeFrame(0x3c, data);
    }

    async onDataReceived(value) {

        // append received bytes to read buffer
        this.readBuffer = [
            ...this.readBuffer,
            ...value,
        ];

        // process read buffer while there is enough bytes for a frame header
        // 3 bytes frame header = (1 byte frame type) + (2 bytes frame length as unsigned 16-bit little endian)
        const frameHeaderLength = 3;
        while (this.readBuffer.length >= frameHeaderLength){
            try {

                // extract frame header
                const frameHeader = new BufferReader(this.readBuffer.slice(0, frameHeaderLength));

                // ensure frame type supported
                const frameType = frameHeader.readByte();
                if (frameType !== Constants.SerialFrameTypes.Incoming && frameType !== Constants.SerialFrameTypes.Outgoing){
                    // unexpected byte, lets skip it and try again
                    this.readBuffer = this.readBuffer.slice(1);
                    continue;
                }

                // ensure frame length valid
                const frameLength = frameHeader.readUInt16LE();
                if (!frameLength || frameLength > MAX_COMPANION_FRAME_LENGTH){
                    // unexpected byte, lets skip it and try again
                    this.readBuffer = this.readBuffer.slice(1);
                    continue;
                }

                // check if we have received enough bytes for this frame, otherwise wait until more bytes received
                const requiredLength = frameHeaderLength + frameLength;
                if (this.readBuffer.length < requiredLength){
                    break;
                }

                // get frame data, and remove it and its frame header from the read buffer
                const frameData = this.readBuffer.slice(frameHeaderLength, requiredLength);
                this.readBuffer = this.readBuffer.slice(requiredLength);

                // handle received frame
                this.onFrameReceived(frameData);

            } catch (e) {
                console.error('Failed to process frame', e);
                // The complete failing frame has already been removed. Continue
                // so one malformed payload cannot hold up later valid frames.
                continue;
            }
        }

    }

}

export default SerialConnection;
