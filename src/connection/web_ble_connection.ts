import Constants from '../constants';
import Connection from './connection';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Minimal inline types for the Web Bluetooth API (not in standard TS DOM lib)
type BluetoothDevice = {
    gatt: { connect(): Promise<BluetoothRemoteGATTServer> };
    addEventListener(type: 'gattserverdisconnected', listener: () => void): void;
};

type BluetoothRemoteGATTServer = {
    getPrimaryService(uuid: string): Promise<BluetoothRemoteGATTService>;
    disconnect(): void;
};

type BluetoothRemoteGATTService = {
    getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>;
};

type BluetoothRemoteGATTCharacteristic = {
    uuid: string;
    startNotifications(): Promise<void>;
    addEventListener(type: 'characteristicvaluechanged', listener: (event: any) => void): void;
    writeValue(value: Uint8Array): Promise<void>;
};

/**
 * MeshCore companion transport over Web Bluetooth (GATT).
 *
 * Connects to the NUS-compatible BLE service exposed by a MeshCore
 * companion device, subscribes to the TX notify characteristic for
 * inbound frames, and writes outbound frames to the RX write
 * characteristic.  Call the static {@link open} method to show the
 * browser's device-picker and receive a connected instance.
 *
 * @example
 * const conn = await WebBleConnection.open();
 * if (conn) {
 *     const info = await conn.getSelfInfo();
 *     console.log(info.name);
 * }
 */
class WebBleConnection extends Connection {

    bleDevice: BluetoothDevice;
    gattServer: BluetoothRemoteGATTServer | undefined;
    rxCharacteristic: BluetoothRemoteGATTCharacteristic | undefined;
    txCharacteristic: BluetoothRemoteGATTCharacteristic | undefined;

    constructor(bleDevice: BluetoothDevice) {
        super();
        this.bleDevice = bleDevice;
        this.gattServer = undefined;
        this.rxCharacteristic = undefined;
        this.txCharacteristic = undefined;
        this.init();
    }

    static async open() {

        const bluetooth = (navigator as any).bluetooth as {
            requestDevice(options: unknown): Promise<BluetoothDevice | null>;
        } | undefined;

        // ensure browser supports web bluetooth
        if (!bluetooth){
            alert('Web Bluetooth is not supported in this browser');
            return;
        }

        // ask user to select device
        const device = await bluetooth.requestDevice({
            filters: [
                {
                    services: [
                        Constants.Ble.ServiceUuid.toLowerCase(),
                    ],
                },
            ],
        });

        // make sure user selected a device
        if (!device){
            return null;
        }

        return new WebBleConnection(device);

    }

    async init() {

        // listen for ble disconnect
        this.bleDevice.addEventListener('gattserverdisconnected', () => {
            this.onDisconnected();
        });

        // connect to gatt server
        this.gattServer = await this.bleDevice.gatt.connect();

        // find service
        const service = await this.gattServer.getPrimaryService(Constants.Ble.ServiceUuid.toLowerCase());
        const characteristics = await service.getCharacteristics();

        // find rx characteristic (we write to this one, it's where the radio reads from)
        this.rxCharacteristic = characteristics.find((characteristic) => {
            return characteristic.uuid.toLowerCase() === Constants.Ble.CharacteristicUuidRx.toLowerCase();
        });

        // find tx characteristic (we read this one, it's where the radio writes to)
        this.txCharacteristic = characteristics.find((characteristic) => {
            return characteristic.uuid.toLowerCase() === Constants.Ble.CharacteristicUuidTx.toLowerCase();
        });

        // listen for frames from transmitted to us from the ble device
        await this.txCharacteristic!.startNotifications();
        this.txCharacteristic!.addEventListener('characteristicvaluechanged', (event: any) => {
            const value = event.target.value as DataView;
            const frame = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
            this.onFrameReceived(frame);
        });

        // fire connected event
        await this.onConnected();

    }

    async close() {
        try {
            this.gattServer?.disconnect();
            this.gattServer = undefined;
        } catch {
            // ignore error when disconnecting
        }
    }

    async write(bytes: Uint8Array) {
        try {
            // fixme: NetworkError: GATT operation already in progress.
            // todo: implement mutex to prevent multiple writes when another write is in progress
            // we write to the rx characteristic, as that's where the radio reads from
            await this.rxCharacteristic!.writeValue(bytes);
        } catch (e) {
            console.log('failed to write to ble device', e);
        }
    }

    async sendToRadioFrame(frame: Uint8Array) {
        this.emit('tx', frame);
        await this.write(frame);
    }

}

export default WebBleConnection;
