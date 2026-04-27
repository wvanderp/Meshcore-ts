import BufferReader from "../buffer_reader";
import Constants from "../constants";

import ConnectionCommands from "./connection_commands";
import type { AdvertPathResponse, ByteArrayLike, MeshContactRecord } from "./connection_types";

/**
 * Deserialises and dispatches incoming companion protocol frames.
 *
 * Reads the response/push code byte from each received frame and calls
 * the corresponding typed handler method, which parses the remaining
 * fields and emits the appropriate event.  Inherits all command
 * methods from {@link ConnectionCommands}.
 *
 * @example
 * // Frame handling is triggered automatically by the transport layer.
 * // Listen to typed events emitted after each frame is decoded:
 * conn.on(Constants.ResponseCodes.SelfInfo, (info) => {
 *     console.log(info.name, info.publicKey);
 * });
 * conn.on(Constants.PushCodes.Advert, (data) => {
 *     console.log("New advert from", data.publicKey);
 * });
 */
class ConnectionFrameHandlers extends ConnectionCommands {

    onFrameReceived(frame: ByteArrayLike): void {

        this.emit("rx", frame);

        const bufferReader = new BufferReader(frame);
        const responseCode = bufferReader.readByte();

        if(responseCode === Constants.ResponseCodes.Ok){
            this.onOkResponse(bufferReader);
        } else if(responseCode === Constants.ResponseCodes.Err){
            this.onErrResponse(bufferReader);
        } else if(responseCode === Constants.ResponseCodes.SelfInfo){
            this.onSelfInfoResponse(bufferReader);
        } else if(responseCode === Constants.ResponseCodes.CurrTime){
            this.onCurrTimeResponse(bufferReader);
        } else if(responseCode === Constants.ResponseCodes.NoMoreMessages){
            this.onNoMoreMessagesResponse(bufferReader);
        } else if(responseCode === Constants.ResponseCodes.ContactMsgRecv){
            this.onContactMsgRecvResponse(bufferReader);
        } else if(responseCode === Constants.ResponseCodes.ChannelMsgRecv){
            this.onChannelMsgRecvResponse(bufferReader);
        } else if(responseCode === Constants.ResponseCodes.ContactsStart){
            this.onContactsStartResponse(bufferReader);
        } else if(responseCode === Constants.ResponseCodes.Contact){
            this.onContactResponse(bufferReader);
        } else if(responseCode === Constants.ResponseCodes.EndOfContacts){
            this.onEndOfContactsResponse(bufferReader);
        } else if(responseCode === Constants.ResponseCodes.Sent){
            this.onSentResponse(bufferReader);
        } else if(responseCode === Constants.ResponseCodes.ExportContact){
            this.onExportContactResponse(bufferReader);
        } else if(responseCode === Constants.ResponseCodes.BatteryVoltage){
            this.onBatteryVoltageResponse(bufferReader);
        } else if(responseCode === Constants.ResponseCodes.DeviceInfo){
            this.onDeviceInfoResponse(bufferReader);
        } else if(responseCode === Constants.ResponseCodes.PrivateKey){
            this.onPrivateKeyResponse(bufferReader);
        } else if(responseCode === Constants.ResponseCodes.Disabled){
            this.onDisabledResponse(bufferReader);
        } else if(responseCode === Constants.ResponseCodes.ChannelInfo){
            this.onChannelInfoResponse(bufferReader);
        } else if(responseCode === Constants.ResponseCodes.SignStart){
            this.onSignStartResponse(bufferReader);
        } else if(responseCode === Constants.ResponseCodes.Signature){
            this.onSignatureResponse(bufferReader);
        } else if(responseCode === Constants.ResponseCodes.AdvertPath){
            this.onAdvertPathResponse(bufferReader);
        } else if(responseCode === Constants.ResponseCodes.Stats){
            this.onStatsResponse(bufferReader);
        } else if(responseCode === Constants.ResponseCodes.ChannelDataRecv){
            this.onChannelDataRecvResponse(bufferReader);
        } else if(responseCode === Constants.PushCodes.Advert){
            this.onAdvertPush(bufferReader);
        } else if(responseCode === Constants.PushCodes.PathUpdated){
            this.onPathUpdatedPush(bufferReader);
        } else if(responseCode === Constants.PushCodes.SendConfirmed){
            this.onSendConfirmedPush(bufferReader);
        } else if(responseCode === Constants.PushCodes.MsgWaiting){
            this.onMsgWaitingPush(bufferReader);
        } else if(responseCode === Constants.PushCodes.RawData){
            this.onRawDataPush(bufferReader);
        } else if(responseCode === Constants.PushCodes.LoginSuccess){
            this.onLoginSuccessPush(bufferReader);
        } else if(responseCode === Constants.PushCodes.StatusResponse){
            this.onStatusResponsePush(bufferReader);
        } else if(responseCode === Constants.PushCodes.LogRxData){
            this.onLogRxDataPush(bufferReader);
        } else if(responseCode === Constants.PushCodes.TelemetryResponse){
            this.onTelemetryResponsePush(bufferReader);
        } else if(responseCode === Constants.PushCodes.TraceData){
            this.onTraceDataPush(bufferReader);
        } else if(responseCode === Constants.PushCodes.NewAdvert){
            this.onNewAdvertPush(bufferReader);
        } else if(responseCode === Constants.PushCodes.BinaryResponse){
            this.onBinaryResponsePush(bufferReader);
        } else {
            console.log(`unhandled frame: code=${responseCode}`, frame);
        }

    }

    readContactRecord(bufferReader: BufferReader): MeshContactRecord {
        return {
            publicKey: bufferReader.readBytes(32),
            type: bufferReader.readByte(),
            flags: bufferReader.readByte(),
            outPathLen: bufferReader.readInt8(),
            outPath: bufferReader.readBytes(64),
            advName: bufferReader.readCString(32) ?? "",
            lastAdvert: bufferReader.readUInt32LE(),
            advLat: bufferReader.readInt32LE(),
            advLon: bufferReader.readInt32LE(),
            lastMod: bufferReader.readUInt32LE(),
        };
    }

    readPathEncoding(pathLen: number) {
        const pathHashSize = (pathLen >> 6) + 1;
        const pathHashCount = pathLen & 63;
        const pathByteLength = pathHashSize * pathHashCount;

        return {
            pathHashSize: pathHashSize,
            pathHashCount: pathHashCount,
            pathByteLength: pathByteLength,
        };
    }

    onAdvertPush(bufferReader: BufferReader) {
        this.emit(Constants.PushCodes.Advert, {
            publicKey: bufferReader.readBytes(32),
        });
    }

    onPathUpdatedPush(bufferReader: BufferReader) {
        this.emit(Constants.PushCodes.PathUpdated, {
            publicKey: bufferReader.readBytes(32),
        });
    }

    onSendConfirmedPush(bufferReader: BufferReader) {
        this.emit(Constants.PushCodes.SendConfirmed, {
            ackCode: bufferReader.readUInt32LE(),
            roundTrip: bufferReader.readUInt32LE(),
        });
    }

    onMsgWaitingPush(bufferReader: BufferReader) {
        void bufferReader;
        this.emit(Constants.PushCodes.MsgWaiting, {});
    }

    onRawDataPush(bufferReader: BufferReader) {
        this.emit(Constants.PushCodes.RawData, {
            lastSnr: bufferReader.readInt8() / 4,
            lastRssi: bufferReader.readInt8(),
            reserved: bufferReader.readByte(),
            payload: bufferReader.readRemainingBytes(),
        });
    }

    onLoginSuccessPush(bufferReader: BufferReader) {
        this.emit(Constants.PushCodes.LoginSuccess, {
            reserved: bufferReader.readByte(),
            pubKeyPrefix: bufferReader.readBytes(6),
        });
    }

    onStatusResponsePush(bufferReader: BufferReader) {
        this.emit(Constants.PushCodes.StatusResponse, {
            reserved: bufferReader.readByte(),
            pubKeyPrefix: bufferReader.readBytes(6),
            statusData: bufferReader.readRemainingBytes(),
        });
    }

    onLogRxDataPush(bufferReader: BufferReader) {
        this.emit(Constants.PushCodes.LogRxData, {
            lastSnr: bufferReader.readInt8() / 4,
            lastRssi: bufferReader.readInt8(),
            raw: bufferReader.readRemainingBytes(),
        });
    }

    onTelemetryResponsePush(bufferReader: BufferReader) {
        this.emit(Constants.PushCodes.TelemetryResponse, {
            reserved: bufferReader.readByte(),
            pubKeyPrefix: bufferReader.readBytes(6),
            lppSensorData: bufferReader.readRemainingBytes(),
        });
    }

    onBinaryResponsePush(bufferReader: BufferReader) {
        this.emit(Constants.PushCodes.BinaryResponse, {
            reserved: bufferReader.readByte(),
            tag: bufferReader.readUInt32LE(),
            responseData: bufferReader.readRemainingBytes(),
        });
    }

    onTraceDataPush(bufferReader: BufferReader) {
        const reserved = bufferReader.readByte();
        const pathLen = bufferReader.readUInt8();
        this.emit(Constants.PushCodes.TraceData, {
            reserved: reserved,
            pathLen: pathLen,
            flags: bufferReader.readUInt8(),
            tag: bufferReader.readUInt32LE(),
            authCode: bufferReader.readUInt32LE(),
            pathHashes: bufferReader.readBytes(pathLen),
            pathSnrs: bufferReader.readBytes(pathLen),
            lastSnr: bufferReader.readInt8() / 4,
        });
    }

    onNewAdvertPush(bufferReader: BufferReader) {
        this.emit(Constants.PushCodes.NewAdvert, this.readContactRecord(bufferReader));
    }

    onOkResponse(bufferReader: BufferReader) {
        void bufferReader;
        this.emit(Constants.ResponseCodes.Ok, {});
    }

    onErrResponse(bufferReader: BufferReader) {
        const errCode = bufferReader.getRemainingBytesCount() > 0 ? bufferReader.readByte() : null;
        this.emit(Constants.ResponseCodes.Err, {
            errCode: errCode,
        });
    }

    onContactsStartResponse(bufferReader: BufferReader) {
        this.emit(Constants.ResponseCodes.ContactsStart, {
            count: bufferReader.readUInt32LE(),
        });
    }

    onContactResponse(bufferReader: BufferReader) {
        this.emit(Constants.ResponseCodes.Contact, this.readContactRecord(bufferReader));
    }

    onEndOfContactsResponse(bufferReader: BufferReader) {
        this.emit(Constants.ResponseCodes.EndOfContacts, {
            mostRecentLastmod: bufferReader.readUInt32LE(),
        });
    }

    onSentResponse(bufferReader: BufferReader) {
        this.emit(Constants.ResponseCodes.Sent, {
            result: bufferReader.readInt8(),
            expectedAckCrc: bufferReader.readUInt32LE(),
            estTimeout: bufferReader.readUInt32LE(),
        });
    }

    onExportContactResponse(bufferReader: BufferReader) {
        this.emit(Constants.ResponseCodes.ExportContact, {
            advertPacketBytes: bufferReader.readRemainingBytes(),
        });
    }

    onBatteryVoltageResponse(bufferReader: BufferReader) {
        this.emit(Constants.ResponseCodes.BatteryVoltage, {
            batteryMilliVolts: bufferReader.readUInt16LE(),
        });
    }

    onDeviceInfoResponse(bufferReader: BufferReader) {
        this.emit(Constants.ResponseCodes.DeviceInfo, {
            firmwareVer: bufferReader.readInt8(),
            reserved: bufferReader.readBytes(6),
            firmware_build_date: bufferReader.readCString(12),
            manufacturerModel: bufferReader.readString(),
        });
    }

    onPrivateKeyResponse(bufferReader: BufferReader) {
        this.emit(Constants.ResponseCodes.PrivateKey, {
            privateKey: bufferReader.readBytes(64),
        });
    }

    onDisabledResponse(bufferReader: BufferReader) {
        void bufferReader;
        this.emit(Constants.ResponseCodes.Disabled, {});
    }

    onChannelInfoResponse(bufferReader: BufferReader) {

        const idx = bufferReader.readUInt8();
        const name = bufferReader.readCString(32);
        const remainingBytesLength = bufferReader.getRemainingBytesCount();

        if(remainingBytesLength === 16){
            this.emit(Constants.ResponseCodes.ChannelInfo, {
                channelIdx: idx,
                name: name,
                secret: bufferReader.readBytes(remainingBytesLength),
            });
        } else {
            console.log(`ChannelInfo has unexpected key length: ${remainingBytesLength}`);
        }

    }

    onSignStartResponse(bufferReader: BufferReader) {
        this.emit(Constants.ResponseCodes.SignStart, {
            reserved: bufferReader.readByte(),
            maxSignDataLen: bufferReader.readUInt32LE(),
        });
    }

    onSignatureResponse(bufferReader: BufferReader) {
        this.emit(Constants.ResponseCodes.Signature, {
            signature: bufferReader.readBytes(64),
        });
    }

    onAdvertPathResponse(bufferReader: BufferReader) {
        const recvTimestamp = bufferReader.readUInt32LE();
        const pathLen = bufferReader.readUInt8();
        const pathEncoding = this.readPathEncoding(pathLen);
        const response: AdvertPathResponse = {
            recvTimestamp: recvTimestamp,
            pathLen: pathLen,
            pathHashSize: pathEncoding.pathHashSize,
            pathHashCount: pathEncoding.pathHashCount,
            path: bufferReader.readBytes(pathEncoding.pathByteLength),
        };

        this.emit(Constants.ResponseCodes.AdvertPath, response);
    }

    onStatsResponse(bufferReader: BufferReader) {

        const type = bufferReader.readUInt8();
        const raw = bufferReader.readRemainingBytes();
        const rawBufferReader = new BufferReader(raw);

        let data = {};
        if(type === Constants.StatsTypes.Core){
            data = {
                batteryMilliVolts: rawBufferReader.readUInt16LE(),
                uptimeSecs: rawBufferReader.readUInt32LE(),
                queueLen: rawBufferReader.readUInt8(),
            };
        } else if(type === Constants.StatsTypes.Radio){
            data = {
                noiseFloor: rawBufferReader.readInt16LE(),
                lastRssi: rawBufferReader.readInt8(),
                lastSnr: rawBufferReader.readInt8() / 4,
                txAirSecs: rawBufferReader.readUInt32LE(),
                rxAirSecs: rawBufferReader.readUInt32LE(),
            };
        } else if(type === Constants.StatsTypes.Packets){
            data = {
                recv: rawBufferReader.readUInt32LE(),
                sent: rawBufferReader.readUInt32LE(),
                nSentFlood: rawBufferReader.readUInt32LE(),
                nSentDirect: rawBufferReader.readUInt32LE(),
                nRecvFlood: rawBufferReader.readUInt32LE(),
                nRecvDirect: rawBufferReader.readUInt32LE(),
                nRecvErrors: rawBufferReader.getRemainingBytesCount() >= 4 ? rawBufferReader.readUInt32LE() : null,
            };
        }

        this.emit(Constants.ResponseCodes.Stats, {
            type: type,
            raw: raw,
            data: data,
        });

    }

    onChannelDataRecvResponse(bufferReader: BufferReader) {
        const snr = bufferReader.readInt8() / 4;
        const reserved1 = bufferReader.readByte();
        const reserved2 = bufferReader.readByte();
        const channelIdx = bufferReader.readInt8();
        const pathLen = bufferReader.readByte();
        const dataType = bufferReader.readUInt16LE();
        const dataLen = bufferReader.readUInt8();
        const data = bufferReader.readBytes(dataLen);
        this.emit(Constants.ResponseCodes.ChannelDataRecv, {
            snr: snr,
            reserved1: reserved1,
            reserved2: reserved2,
            channelIdx: channelIdx,
            pathLen: pathLen,
            dataType: dataType,
            dataLen: dataLen,
            data: data,
        });
    }

    onSelfInfoResponse(bufferReader: BufferReader) {
        this.emit(Constants.ResponseCodes.SelfInfo, {
            type: bufferReader.readByte(),
            txPower: bufferReader.readByte(),
            maxTxPower: bufferReader.readByte(),
            publicKey: bufferReader.readBytes(32),
            advLat: bufferReader.readInt32LE(),
            advLon: bufferReader.readInt32LE(),
            reserved: bufferReader.readBytes(3),
            manualAddContacts: bufferReader.readByte(),
            radioFreq: bufferReader.readUInt32LE(),
            radioBw: bufferReader.readUInt32LE(),
            radioSf: bufferReader.readByte(),
            radioCr: bufferReader.readByte(),
            name: bufferReader.readString(),
        });
    }

    onCurrTimeResponse(bufferReader: BufferReader) {
        this.emit(Constants.ResponseCodes.CurrTime, {
            epochSecs: bufferReader.readUInt32LE(),
        });
    }

    onNoMoreMessagesResponse(bufferReader: BufferReader) {
        void bufferReader;
        this.emit(Constants.ResponseCodes.NoMoreMessages, {});
    }

    onContactMsgRecvResponse(bufferReader: BufferReader) {
        this.emit(Constants.ResponseCodes.ContactMsgRecv, {
            pubKeyPrefix: bufferReader.readBytes(6),
            pathLen: bufferReader.readByte(),
            txtType: bufferReader.readByte(),
            senderTimestamp: bufferReader.readUInt32LE(),
            text: bufferReader.readString(),
        });
    }

    onChannelMsgRecvResponse(bufferReader: BufferReader) {
        this.emit(Constants.ResponseCodes.ChannelMsgRecv, {
            channelIdx: bufferReader.readInt8(),
            pathLen: bufferReader.readByte(),
            txtType: bufferReader.readByte(),
            senderTimestamp: bufferReader.readUInt32LE(),
            text: bufferReader.readString(),
        });
    }

}

export default ConnectionFrameHandlers;