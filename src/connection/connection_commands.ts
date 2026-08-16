import BufferWriter from '../buffer_writer';
import Constants from '../constants';

import ConnectionBase from './connection_base';
import type { ByteArrayLike } from './connection_types';

/**
 * Provides high-level command methods for the MeshCore companion protocol.
 *
 * Each `sendCommand*` method serialises a protocol command into the
 * binary wire format (command-code byte followed by command-specific
 * fields) and dispatches it via {@link sendToRadioFrame}.  Inherits
 * transport and lifecycle handling from {@link ConnectionBase}.
 *
 * @example
 * // Commands are normally invoked through the Connection class
 * const conn = new WebSerialConnection(port);
 * await conn.sendCommandSetAdvertName("MyNode");
 * await conn.sendCommandSendSelfAdvert(Constants.SelfAdvertTypes.Flood);
 */
class ConnectionCommands extends ConnectionBase {

    async sendCommandAppStart(): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.AppStart);
        data.writeByte(1);
        data.writeBytes(new Uint8Array(6));
        data.writeString('test');
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandSendTxtMsg(txtType: number, attempt: number, senderTimestamp: number, pubKeyPrefix: ByteArrayLike, text: string): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.SendTxtMsg);
        data.writeByte(txtType);
        data.writeByte(attempt);
        data.writeUInt32LE(senderTimestamp);
        data.writeBytes(Array.from(pubKeyPrefix).slice(0, 6));
        data.writeString(text);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandSendChannelTxtMsg(txtType: number, channelIdx: number, senderTimestamp: number, text: string): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.SendChannelTxtMsg);
        data.writeByte(txtType);
        data.writeByte(channelIdx);
        data.writeUInt32LE(senderTimestamp);
        data.writeString(text);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandGetContacts(since?: number): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.GetContacts);
        if (since){
            data.writeUInt32LE(since);
        }
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandGetDeviceTime(): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.GetDeviceTime);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandSetDeviceTime(epochSecs: number): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.SetDeviceTime);
        data.writeUInt32LE(epochSecs);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandSendSelfAdvert(type: number): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.SendSelfAdvert);
        data.writeByte(type);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandSetAdvertName(name: string): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.SetAdvertName);
        data.writeString(name);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandAddUpdateContact(publicKey: ByteArrayLike, type: number, flags: number, outPathLen: number, outPath: ByteArrayLike, advName: string, lastAdvert: number, advLat: number, advLon: number): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.AddUpdateContact);
        data.writeBytes(publicKey);
        data.writeByte(type);
        data.writeByte(flags);
        data.writeByte(outPathLen);
        data.writeBytes(outPath);
        data.writeCString(advName, 32);
        data.writeUInt32LE(lastAdvert);
        data.writeInt32LE(advLat);
        data.writeInt32LE(advLon);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandSyncNextMessage(): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.SyncNextMessage);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandSetRadioParams(radioFreq: number, radioBw: number, radioSf: number, radioCr: number): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.SetRadioParams);
        data.writeUInt32LE(radioFreq);
        data.writeUInt32LE(radioBw);
        data.writeByte(radioSf);
        data.writeByte(radioCr);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandSetTxPower(txPower: number): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.SetTxPower);
        data.writeByte(txPower);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandSetTuningParams(rxDelayBase: number, airtimeFactor: number): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.SetTuningParams);
        data.writeUInt32LE(rxDelayBase);
        data.writeUInt32LE(airtimeFactor);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandResetPath(pubKey: ByteArrayLike): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.ResetPath);
        data.writeBytes(pubKey);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandSetAdvertLatLon(lat: number, lon: number): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.SetAdvertLatLon);
        data.writeInt32LE(lat);
        data.writeInt32LE(lon);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandRemoveContact(pubKey: ByteArrayLike): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.RemoveContact);
        data.writeBytes(pubKey);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandShareContact(pubKey: ByteArrayLike): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.ShareContact);
        data.writeBytes(pubKey);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandExportContact(pubKey: ByteArrayLike | null = null): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.ExportContact);
        if (pubKey){
            data.writeBytes(pubKey);
        }
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandImportContact(advertPacketBytes: ByteArrayLike): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.ImportContact);
        data.writeBytes(advertPacketBytes);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandReboot(): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.Reboot);
        data.writeString('reboot');
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandGetBatteryVoltage(): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.GetBatteryVoltage);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandDeviceQuery(appTargetVer: number): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.DeviceQuery);
        data.writeByte(appTargetVer);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandExportPrivateKey(): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.ExportPrivateKey);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandImportPrivateKey(privateKey: ByteArrayLike): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.ImportPrivateKey);
        data.writeBytes(privateKey);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandSendRawData(path: ByteArrayLike, rawData: ByteArrayLike): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.SendRawData);
        data.writeByte(path.length);
        data.writeBytes(path);
        data.writeBytes(rawData);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandSendLogin(publicKey: ByteArrayLike, password: string): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.SendLogin);
        data.writeBytes(publicKey);
        data.writeString(password);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandSendStatusReq(publicKey: ByteArrayLike): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.SendStatusReq);
        data.writeBytes(publicKey);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandHasConnection(publicKey: ByteArrayLike): Promise<void> {
        await this.sendCodeAndBytes(Constants.CommandCodes.HasConnection, publicKey);
    }

    async sendCommandLogout(publicKey: ByteArrayLike): Promise<void> {
        await this.sendCodeAndBytes(Constants.CommandCodes.Logout, publicKey);
    }

    async sendCommandGetContactByKey(publicKey: ByteArrayLike): Promise<void> {
        await this.sendCodeAndBytes(Constants.CommandCodes.GetContactByKey, publicKey);
    }

    async sendCommandSendTelemetryReq(publicKey: ByteArrayLike): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.SendTelemetryReq);
        data.writeByte(0);
        data.writeByte(0);
        data.writeByte(0);
        data.writeBytes(publicKey);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandGetAdvertPath(publicKey: ByteArrayLike): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.GetAdvertPath);
        data.writeByte(0);
        data.writeBytes(publicKey);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandSetDevicePin(pin: number): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.SetDevicePin);
        data.writeUInt32LE(pin);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandGetCustomVars(): Promise<void> {
        await this.sendCodeAndBytes(Constants.CommandCodes.GetCustomVars);
    }

    async sendCommandSetCustomVar(name: string, value: string): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.SetCustomVar);
        data.writeString(`${name}:${value}`);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandGetTuningParams(): Promise<void> {
        await this.sendCodeAndBytes(Constants.CommandCodes.GetTuningParams);
    }

    async sendCommandSendBinaryReq(publicKey: ByteArrayLike, requestCodeAndParams: ByteArrayLike): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.SendBinaryReq);
        data.writeBytes(publicKey);
        data.writeBytes(requestCodeAndParams);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandFactoryReset(): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.FactoryReset);
        data.writeString('reset');
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandSendPathDiscoveryReq(publicKey: ByteArrayLike): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.SendPathDiscoveryReq);
        data.writeByte(0);
        data.writeBytes(publicKey);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandSendControlData(payload: ByteArrayLike): Promise<void> {
        await this.sendCodeAndBytes(Constants.CommandCodes.SendControlData, payload);
    }

    async sendCommandSetFloodScope(transportKey: ByteArrayLike): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.SetFloodScope);
        data.writeByte(0);
        data.writeBytes(transportKey);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandGetStats(statsType: number): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.GetStats);
        data.writeByte(statsType);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandSendAnonReq(publicKey: ByteArrayLike, requestData: ByteArrayLike): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.SendAnonReq);
        data.writeBytes(publicKey);
        data.writeBytes(requestData);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandSetAutoAddConfig(config: number, maxHops?: number): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.SetAutoAddConfig);
        data.writeByte(config);
        if (maxHops != null){
            data.writeByte(maxHops);
        }
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandGetAutoAddConfig(): Promise<void> {
        await this.sendCodeAndBytes(Constants.CommandCodes.GetAutoAddConfig);
    }

    async sendCommandGetAllowedRepeatFreq(): Promise<void> {
        await this.sendCodeAndBytes(Constants.CommandCodes.GetAllowedRepeatFreq);
    }

    async sendCommandSetPathHashMode(mode: number): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.SetPathHashMode);
        data.writeByte(0);
        data.writeByte(mode);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandSendChannelData(channelIdx: number, pathLen: number, path: ByteArrayLike, dataType: number, payload: ByteArrayLike): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.SendChannelData);
        data.writeByte(channelIdx);
        data.writeByte(pathLen);
        data.writeBytes(path);
        data.writeUInt16LE(dataType);
        data.writeBytes(payload);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandGetChannel(channelIdx: number): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.GetChannel);
        data.writeByte(channelIdx);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandSetChannel(channelIdx: number, name: string, secret: ByteArrayLike): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.SetChannel);
        data.writeByte(channelIdx);
        data.writeCString(name, 32);
        data.writeBytes(secret);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandSignStart(): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.SignStart);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandSignData(dataToSign: ByteArrayLike): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.SignData);
        data.writeBytes(dataToSign);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandSignFinish(): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.SignFinish);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandSendTracePath(tag: number, auth: number, path: ByteArrayLike): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.SendTracePath);
        data.writeUInt32LE(tag);
        data.writeUInt32LE(auth);
        data.writeByte(0);
        data.writeBytes(path);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandSetOtherParams(manualAddContacts: number | boolean): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.SetOtherParams);
        data.writeByte(manualAddContacts);
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandSetDefaultFloodScope(name: string | null, key?: ByteArrayLike): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.SetDefaultFloodScope);
        if (name != null && key != null){
            data.writeCString(name, 31);
            data.writeBytes(key);
        }
        await this.sendToRadioFrame(data.toBytes());
    }

    async sendCommandGetDefaultFloodScope(): Promise<void> {
        await this.sendCodeAndBytes(Constants.CommandCodes.GetDefaultFloodScope);
    }

    async sendCommandSendRawPacket(priority: number, packet: ByteArrayLike): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(Constants.CommandCodes.SendRawPacket);
        data.writeByte(priority);
        data.writeBytes(packet);
        await this.sendToRadioFrame(data.toBytes());
    }

    private async sendCodeAndBytes(code: number, bytes?: ByteArrayLike): Promise<void> {
        const data = new BufferWriter();
        data.writeByte(code);
        if (bytes != null){
            data.writeBytes(bytes);
        }
        await this.sendToRadioFrame(data.toBytes());
    }

}

export default ConnectionCommands;
