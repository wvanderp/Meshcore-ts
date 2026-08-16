import SerialConnection from './serial_connection';

interface WebSerialPortFilter {
    usbVendorId?: number;
    usbProductId?: number;
    bluetoothServiceClassId?: string;
}

interface WebSerialPortRequestOptions {
    filters?: WebSerialPortFilter[];
}

interface WebSerialPort extends EventTarget {
    readable: ReadableStream<Uint8Array> | null;
    writable: WritableStream<Uint8Array> | null;
    open(options: { baudRate: number }): Promise<void>;
    close(): Promise<void>;
}

interface WebSerialApi {
    requestPort(options?: WebSerialPortRequestOptions): Promise<WebSerialPort>;
}

type WebSerialNavigator = Navigator & {
    serial?: WebSerialApi;
};

const serialPortOptions = {
    baudRate: 115200,
};

function getSerialApi(): WebSerialApi | null {
    return (navigator as WebSerialNavigator).serial ?? null;
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message){
        return error.message;
    }

    if (typeof error === 'string'){
        return error;
    }

    return 'Unknown serial error.';
}

function getErrorName(error: unknown): string {
    return error instanceof Error ? error.name : '';
}

function isCancellationError(error: unknown): boolean {
    const message = getErrorMessage(error).toLowerCase();
    const name = getErrorName(error);
    return name === 'AbortError' || name === 'NotFoundError' || message.includes('no port selected') || message.includes('cancel') || message.includes('user aborted');
}

function shouldRetryOpen(error: unknown): boolean {
    const message = getErrorMessage(error).toLowerCase();
    const name = getErrorName(error);
    return name === 'InvalidStateError' || message.includes('already open') || message.includes('failed to open serial port');
}

function isPortOpen(serialPort: WebSerialPort): boolean {
    return serialPort.readable !== null || serialPort.writable !== null;
}

async function closePortQuietly(serialPort: WebSerialPort): Promise<void> {
    try {
        await serialPort.close();
    } catch {
        // ignore cleanup errors while recovering the port state
    }
}

function toOpenError(error: unknown): Error {
    if (isCancellationError(error)){
        return error instanceof Error ? error : new Error('No port selected by the user.');
    }

    const message = getErrorMessage(error).toLowerCase();
    const name = getErrorName(error);

    if (name === 'InvalidStateError' || message.includes('already open')){
        return new Error('The selected serial port is already open. Close other MeshTrace tabs or any serial tools using the device, then try again.');
    }

    if (name === 'NetworkError' || message.includes('failed to open serial port') || message.includes('access denied') || message.includes('permission')){
        return new Error('MeshTrace could not open the selected serial port. Close other apps that may be using the device, unplug and reconnect it if needed, then try again.');
    }

    return error instanceof Error ? error : new Error('Failed to open the selected serial port.');
}

/**
 * MeshCore companion transport over the Web Serial API.
 *
 * Opens a serial port at 115200 baud using the browser's
 * `navigator.serial` API, handles readable stream reading in a
 * dedicated loop, and reconnects automatically on non-fatal errors.
 * Call the static {@link open} method to prompt the user for a port
 * and receive a connected instance.
 *
 * @example
 * const conn = await WebSerialConnection.open();
 * conn.on("connected", async () => {
 *     const info = await conn.getSelfInfo();
 *     console.log(info.name);
 * });
 */
class WebSerialConnection extends SerialConnection {

    serialPort: WebSerialPort;
    reader: ReadableStreamDefaultReader<Uint8Array>;
    writable: WritableStream<Uint8Array>;
    disconnectHandler: () => void;
    isClosing: boolean;

    constructor(serialPort: WebSerialPort) {

        super();

        if (!serialPort.readable || !serialPort.writable){
            throw new Error('Selected serial port is not open.');
        }

        this.serialPort = serialPort;
        this.reader = serialPort.readable.getReader();
        this.writable = serialPort.writable;
        this.disconnectHandler = () => {
            this.onDisconnected();
        };
        this.isClosing = false;
        void this.readLoop();

        // listen for disconnect
        this.serialPort.addEventListener('disconnect', this.disconnectHandler);

        // fire connected callback after constructor has returned
        setTimeout(async () => {
            await this.onConnected();
        }, 0);

    }

    static async open() {

        const serialApi = getSerialApi();

        // ensure browser supports web serial
        if (!serialApi){
            throw new Error('Web Serial is not supported in this browser.');
        }

        // ask user to select device
        const serialPort = await serialApi.requestPort({
            filters: [],
        });

        if (isPortOpen(serialPort)){
            try {
                return new WebSerialConnection(serialPort);
            } catch {
                await closePortQuietly(serialPort);
            }
        }

        // open port
        try {
            await serialPort.open(serialPortOptions);
        } catch (error) {
            if (shouldRetryOpen(error) || isPortOpen(serialPort)){
                await closePortQuietly(serialPort);

                try {
                    await serialPort.open(serialPortOptions);
                } catch (retryError) {
                    throw toOpenError(retryError);
                }
            } else {
                throw toOpenError(error);
            }
        }

        return new WebSerialConnection(serialPort);

    }

    async close() {

        if (this.isClosing){
            return;
        }

        this.isClosing = true;
        this.serialPort.removeEventListener('disconnect', this.disconnectHandler);

        try {
            await this.reader.cancel();
        } catch {
            // ignore cancellation failures while closing
        }

        // release reader lock
        try {
            this.reader.releaseLock();
        } catch {
            // console.log("failed to release lock on serial port readable, ignoring...", e);
        }

        // close serial port
        try {
            await this.serialPort.close();
        } catch {
            // console.log("failed to close serial port, ignoring...", e);
        }

    }

    /* override */ async write(bytes: ArrayLike<number>) {
        const writer = this.writable.getWriter();
        try {
            await writer.write(new Uint8Array(bytes));
        } finally {
            writer.releaseLock();
        }
    }

    async readLoop() {
        try {
            while (true){

                // read bytes until reader indicates it's done
                const { value, done } = await this.reader.read();
                if (done){
                    break;
                }

                // pass to super class handler
                await this.onDataReceived(value);

            }
        } catch (error) {

            // ignore error if reader was released
            if (this.isClosing){
                return;
            }

            if (error instanceof DOMException && error.name === 'AbortError'){
                return;
            }

            if (error instanceof TypeError){
                return;
            }

            console.error('Error reading from serial port: ', error);

        } finally {
            try {
                this.reader.releaseLock();
            } catch {
                // ignore double-release during shutdown
            }
        }
    }

}

export default WebSerialConnection;
