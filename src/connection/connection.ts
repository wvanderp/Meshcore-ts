import BufferWriter from "../buffer_writer";
import BufferReader from "../buffer_reader";
import Constants from "../constants";
import BufferUtils from "../buffer_utils";
import Packet from "../packet";
import RandomUtils from "../random_utils";

import ConnectionFrameHandlers from "./connection_frame_handlers";
import type {
    AdvertPathResponse,
    BatteryVoltageResponse,
    BinaryResponsePush,
    ByteArrayLike,
    ChannelDataResponse,
    ChannelMessageResponse,
    ContactMessageResponse,
    CurrTimeResponse,
    DeviceInfoResponse,
    ExportContactResponse,
    LoginSuccessPush,
    LogRxDataPush,
    MeshChannelRecord,
    MeshContactRecord,
    MeshNeighbourRecord,
    OkResponse,
    PrivateKeyResponse,
    RepeaterStats,
    SelfInfoResponse,
    SentResponse,
    SignStartResponse,
    SignatureResponse,
    StatsResponse,
    StatusResponsePush,
    TelemetryResponsePush,
    TraceDataPush,
    WaitingMessageRecord,
} from "./connection_types";

type EventName = number | string;
type EventListener = (...data: unknown[]) => void;

type RejectEvent = {
    event: EventName;
    reason?: unknown;
};

type WaitForEventOptions<TResponse, TResult> = {
    rejectEvents?: RejectEvent[];
    timeoutMillis?: number | null;
    predicate?: (response: TResponse) => boolean;
    onMismatch?: (response: TResponse) => void;
    mapResponse?: (response: TResponse) => TResult;
};

type SentThenPushOptions<TPush, TResult> = {
    send: () => Promise<void>;
    pushEvent: EventName;
    isMatch: (response: TPush) => boolean;
    resolveWith?: (response: TPush) => TResult;
    extraTimeoutMillis?: number;
    onMismatch?: (response: TPush) => void;
    onSent?: (response: SentResponse) => void;
};

function parseRepeaterStats(statusData: ByteArrayLike): RepeaterStats {
    const bufferReader = new BufferReader(statusData);
    return {
        batt_milli_volts: bufferReader.readUInt16LE(),
        curr_tx_queue_len: bufferReader.readUInt16LE(),
        noise_floor: bufferReader.readInt16LE(),
        last_rssi: bufferReader.readInt16LE(),
        n_packets_recv: bufferReader.readUInt32LE(),
        n_packets_sent: bufferReader.readUInt32LE(),
        total_air_time_secs: bufferReader.readUInt32LE(),
        total_up_time_secs: bufferReader.readUInt32LE(),
        n_sent_flood: bufferReader.readUInt32LE(),
        n_sent_direct: bufferReader.readUInt32LE(),
        n_recv_flood: bufferReader.readUInt32LE(),
        n_recv_direct: bufferReader.readUInt32LE(),
        err_events: bufferReader.readUInt16LE(),
        last_snr: bufferReader.readInt16LE(),
        n_direct_dups: bufferReader.readUInt16LE(),
        n_flood_dups: bufferReader.readUInt16LE(),
    };
}

/**
 * Full MeshCore companion protocol handler.
 *
 * Orchestrates the request/response and push-notification flow of the
 * companion protocol on top of the frame-handler and command layers.
 * Implements {@link deviceQuery} and provides {@link waitForEvent},
 * {@link sentThenPush}, and convenience request helpers used by all
 * higher-level application code.
 *
 * @example
 * const conn = new WebSerialConnection(port);
 * const info  = await conn.getSelfInfo();
 * console.log(info.name, info.publicKey);
 *
 * conn.on(Constants.PushCodes.Advert, (advert) => {
 *     console.log("New advert:", advert.publicKey);
 * });
 */
class Connection extends ConnectionFrameHandlers {

    private onDeferredOnce(event: EventName, handler: EventListener): EventListener {
        let called = false;

        const wrappedHandler: EventListener = (...data) => {
            if(called){
                return;
            }

            called = true;
            this.off(event, wrappedHandler);
            setTimeout(() => {
                handler(...data);
            }, 0);
        };

        this.on(event, wrappedHandler);
        return wrappedHandler;
    }

    private waitForEvent<TResponse, TResult = TResponse>(
        responseEvent: EventName,
        command: () => Promise<void>,
        options: WaitForEventOptions<TResponse, TResult> = {},
    ): Promise<TResult> {
        return this.createPromise<TResult>(async (resolve, reject) => {
            const listeners: Array<{ event: EventName; handler: EventListener }> = [];
            let timeoutHandler: ReturnType<typeof setTimeout> | undefined;
            const predicate = options.predicate ?? (() => true);

            const cleanup = () => {
                if(timeoutHandler != null){
                    clearTimeout(timeoutHandler);
                }

                for(const { event, handler } of listeners){
                    this.off(event, handler);
                }
            };

            const responseHandler: EventListener = (response) => {
                const typedResponse = response as TResponse;
                if(!predicate(typedResponse)){
                    options.onMismatch?.(typedResponse);
                    return;
                }

                cleanup();

                if(options.mapResponse){
                    resolve(options.mapResponse(typedResponse));
                    return;
                }

                resolve(typedResponse as unknown as TResult);
            };

            this.on(responseEvent, responseHandler);
            listeners.push({ event: responseEvent, handler: responseHandler });

            for(const rejectEvent of options.rejectEvents ?? []){
                const rejectHandler: EventListener = () => {
                    cleanup();
                    reject(rejectEvent.reason);
                };

                this.on(rejectEvent.event, rejectHandler);
                listeners.push({ event: rejectEvent.event, handler: rejectHandler });
            }

            if(options.timeoutMillis != null){
                timeoutHandler = setTimeout(() => {
                    cleanup();
                    reject();
                }, options.timeoutMillis);
            }

            try {
                await command();
            } catch(error) {
                cleanup();
                reject(error);
            }
        });
    }

    private waitForResponseOrErr<TResponse>(
        responseEvent: EventName,
        command: () => Promise<void>,
    ): Promise<TResponse> {
        return this.waitForEvent<TResponse>(responseEvent, command, {
            rejectEvents: [{ event: Constants.ResponseCodes.Err }],
        });
    }

    private waitForResponseOrErrOrDisabled<TResponse>(
        responseEvent: EventName,
        command: () => Promise<void>,
        disabledReason: unknown,
    ): Promise<TResponse> {
        return this.waitForEvent<TResponse>(responseEvent, command, {
            rejectEvents: [
                { event: Constants.ResponseCodes.Err },
                { event: Constants.ResponseCodes.Disabled, reason: disabledReason },
            ],
        });
    }

    private waitForOk(command: () => Promise<void>): Promise<OkResponse> {
        return this.waitForResponseOrErr<OkResponse>(Constants.ResponseCodes.Ok, command);
    }

    private waitForOkVoid(command: () => Promise<void>): Promise<void> {
        return this.waitForEvent<OkResponse, void>(Constants.ResponseCodes.Ok, command, {
            rejectEvents: [{ event: Constants.ResponseCodes.Err }],
            mapResponse: () => undefined,
        });
    }

    private waitForSentThenPush<TPush, TResult = TPush>(options: SentThenPushOptions<TPush, TResult>): Promise<TResult> {
        return this.createPromise<TResult>(async (resolve, reject) => {
            /* c8 ignore next */
            const extraTimeoutMillis = options.extraTimeoutMillis ?? 1000;
            let timeoutHandler: ReturnType<typeof setTimeout> | undefined;
            let sentListener: EventListener | undefined;
            let errListener: EventListener | undefined;

            const cleanup = () => {
                if(timeoutHandler != null){
                    clearTimeout(timeoutHandler);
                }

                /* c8 ignore next */
                if(errListener){
                    this.off(Constants.ResponseCodes.Err, errListener);
                }

                /* c8 ignore next */
                if(sentListener){
                    this.off(Constants.ResponseCodes.Sent, sentListener);
                }

                this.off(options.pushEvent, onPush);
            };

            const onSent: EventListener = (response) => {
                this.off(Constants.ResponseCodes.Sent, onSent);

                const sentResponse = response as SentResponse;
                options.onSent?.(sentResponse);

                this.off(Constants.ResponseCodes.Err, onErr);
                timeoutHandler = setTimeout(() => {
                    cleanup();
                    reject("timeout");
                }, sentResponse.estTimeout + extraTimeoutMillis);
            };

            const onPush: EventListener = (response) => {
                const typedResponse = response as TPush;
                if(!options.isMatch(typedResponse)){
                    options.onMismatch?.(typedResponse);
                    return;
                }

                cleanup();

                if(options.resolveWith){
                    resolve(options.resolveWith(typedResponse));
                    return;
                }

                resolve(typedResponse as unknown as TResult);
            };

            const onErr: EventListener = () => {
                cleanup();
                reject();
            };

            errListener = this.onDeferredOnce(Constants.ResponseCodes.Err, onErr);
            sentListener = this.onDeferredOnce(Constants.ResponseCodes.Sent, onSent);
            this.on(options.pushEvent, onPush);

            try {
                await options.send();
            } catch(error) {
                cleanup();
                reject(error);
            }
        });
    }

    getSelfInfo(timeoutMillis: number | null = null): Promise<SelfInfoResponse> {
        return this.waitForEvent<SelfInfoResponse>(Constants.ResponseCodes.SelfInfo, async () => {
            await this.sendCommandAppStart();
        }, {
            timeoutMillis: timeoutMillis,
        });
    }

    sendAdvert(type: number): Promise<void> {
        return this.waitForOkVoid(async () => {
            await this.sendCommandSendSelfAdvert(type);
        });
    }

    async sendFloodAdvert(): Promise<void> {
        return await this.sendAdvert(Constants.SelfAdvertTypes.Flood);
    }

    async sendZeroHopAdvert(): Promise<void> {
        return await this.sendAdvert(Constants.SelfAdvertTypes.ZeroHop);
    }

    setAdvertName(name: string): Promise<void> {
        return this.waitForOkVoid(async () => {
            await this.sendCommandSetAdvertName(name);
        });
    }

    setAdvertLatLong(latitude: number, longitude: number): Promise<void> {
        return this.waitForOkVoid(async () => {
            await this.sendCommandSetAdvertLatLon(latitude, longitude);
        });
    }

    setTxPower(txPower: number): Promise<void> {
        return this.waitForOkVoid(async () => {
            await this.sendCommandSetTxPower(txPower);
        });
    }

    setRadioParams(radioFreq: number, radioBw: number, radioSf: number, radioCr: number): Promise<void> {
        return this.waitForOkVoid(async () => {
            await this.sendCommandSetRadioParams(radioFreq, radioBw, radioSf, radioCr);
        });
    }

    getContacts(): Promise<MeshContactRecord[]> {
        return this.createPromise<MeshContactRecord[]>(async (resolve, reject) => {
            const contacts: MeshContactRecord[] = [];

            const cleanup = () => {
                this.off(Constants.ResponseCodes.Contact, onContactReceived);
                this.off(Constants.ResponseCodes.EndOfContacts, onEndOfContacts);
            };

            const onContactReceived: EventListener = (contact) => {
                contacts.push(contact as MeshContactRecord);
            };

            const onEndOfContacts: EventListener = () => {
                cleanup();
                resolve(contacts);
            };

            this.on(Constants.ResponseCodes.Contact, onContactReceived);
            this.on(Constants.ResponseCodes.EndOfContacts, onEndOfContacts);

            try {
                await this.sendCommandGetContacts();
            } catch(error) {
                cleanup();
                reject(error);
            }
        });
    }

    async findContactByName(name: string): Promise<MeshContactRecord | undefined> {
        const contacts = await this.getContacts();
        return contacts.find((contact) => {
            return contact.advName === name;
        });
    }

    async findContactByPublicKeyPrefix(pubKeyPrefix: ByteArrayLike): Promise<MeshContactRecord | undefined> {
        const contacts = await this.getContacts();
        return contacts.find((contact) => {
            const contactPubKeyPrefix = contact.publicKey.subarray(0, pubKeyPrefix.length);
            return BufferUtils.areBuffersEqual(pubKeyPrefix, contactPubKeyPrefix);
        });
    }

    getAdvertPath(publicKey: ByteArrayLike, timeoutMillis: number | null = null): Promise<AdvertPathResponse> {
        return this.waitForEvent<AdvertPathResponse>(Constants.ResponseCodes.AdvertPath, async () => {
            await this.sendCommandGetAdvertPath(publicKey);
        }, {
            rejectEvents: [{ event: Constants.ResponseCodes.Err }],
            timeoutMillis: timeoutMillis,
        });
    }

    sendTextMessage(contactPublicKey: ByteArrayLike, text: string, type?: number): Promise<SentResponse> {
        return this.waitForResponseOrErr<SentResponse>(Constants.ResponseCodes.Sent, async () => {
            const txtType = type ?? Constants.TxtTypes.Plain;
            const attempt = 0;
            const senderTimestamp = Math.floor(Date.now() / 1000);
            await this.sendCommandSendTxtMsg(txtType, attempt, senderTimestamp, contactPublicKey, text);
        });
    }

    sendChannelTextMessage(channelIdx: number, text: string): Promise<void> {
        return this.waitForOkVoid(async () => {
            const txtType = Constants.TxtTypes.Plain;
            const senderTimestamp = Math.floor(Date.now() / 1000);
            await this.sendCommandSendChannelTxtMsg(txtType, channelIdx, senderTimestamp, text);
        });
    }

    syncNextMessage(): Promise<WaitingMessageRecord | null> {
        return this.createPromise<WaitingMessageRecord | null>(async (resolve, reject) => {
            const cleanup = () => {
                this.off(Constants.ResponseCodes.ContactMsgRecv, onContactMessageReceived);
                this.off(Constants.ResponseCodes.ChannelMsgRecv, onChannelMessageReceived);
                this.off(Constants.ResponseCodes.ContactMsgRecvV3, onContactMessageReceived);
                this.off(Constants.ResponseCodes.ChannelMsgRecvV3, onChannelMessageReceived);
                this.off(Constants.ResponseCodes.ChannelDataRecv, onChannelDataReceived);
                this.off(Constants.ResponseCodes.NoMoreMessages, onNoMoreMessagesReceived);
            };

            const onContactMessageReceived: EventListener = (message) => {
                cleanup();
                resolve({
                    contactMessage: message as ContactMessageResponse,
                });
            };

            const onChannelMessageReceived: EventListener = (message) => {
                cleanup();
                resolve({
                    channelMessage: message as ChannelMessageResponse,
                });
            };

            const onChannelDataReceived: EventListener = (message) => {
                cleanup();
                resolve({
                    channelData: message as ChannelDataResponse,
                });
            };

            const onNoMoreMessagesReceived: EventListener = () => {
                cleanup();
                resolve(null);
            };

            this.on(Constants.ResponseCodes.ContactMsgRecv, onContactMessageReceived);
            this.on(Constants.ResponseCodes.ChannelMsgRecv, onChannelMessageReceived);
            this.on(Constants.ResponseCodes.ContactMsgRecvV3, onContactMessageReceived);
            this.on(Constants.ResponseCodes.ChannelMsgRecvV3, onChannelMessageReceived);
            this.on(Constants.ResponseCodes.ChannelDataRecv, onChannelDataReceived);
            this.on(Constants.ResponseCodes.NoMoreMessages, onNoMoreMessagesReceived);

            try {
                await this.sendCommandSyncNextMessage();
            } catch(error) {
                cleanup();
                reject(error);
            }
        });
    }

    async getWaitingMessages(): Promise<WaitingMessageRecord[]> {
        const waitingMessages: WaitingMessageRecord[] = [];

        while(true){
            const message = await this.syncNextMessage();
            if(!message){
                break;
            }

            waitingMessages.push(message);
        }

        return waitingMessages;
    }

    getDeviceTime(): Promise<CurrTimeResponse> {
        return this.waitForResponseOrErr<CurrTimeResponse>(Constants.ResponseCodes.CurrTime, async () => {
            await this.sendCommandGetDeviceTime();
        });
    }

    setDeviceTime(epochSecs: number): Promise<OkResponse> {
        return this.waitForOk(async () => {
            await this.sendCommandSetDeviceTime(epochSecs);
        });
    }

    async syncDeviceTime(): Promise<void> {
        await this.setDeviceTime(Math.floor(Date.now() / 1000));
    }

    importContact(advertPacketBytes: ByteArrayLike): Promise<OkResponse> {
        return this.waitForOk(async () => {
            await this.sendCommandImportContact(advertPacketBytes);
        });
    }

    exportContact(pubKey: ByteArrayLike | null = null): Promise<ExportContactResponse> {
        return this.waitForResponseOrErr<ExportContactResponse>(Constants.ResponseCodes.ExportContact, async () => {
            await this.sendCommandExportContact(pubKey);
        });
    }

    shareContact(pubKey: ByteArrayLike): Promise<OkResponse> {
        return this.waitForOk(async () => {
            await this.sendCommandShareContact(pubKey);
        });
    }

    removeContact(pubKey: ByteArrayLike): Promise<void> {
        return this.waitForOkVoid(async () => {
            await this.sendCommandRemoveContact(pubKey);
        });
    }

    addOrUpdateContact(publicKey: ByteArrayLike, type: number, flags: number, outPathLen: number, outPath: ByteArrayLike, advName: string, lastAdvert: number, advLat: number, advLon: number): Promise<void> {
        return this.waitForOkVoid(async () => {
            await this.sendCommandAddUpdateContact(publicKey, type, flags, outPathLen, outPath, advName, lastAdvert, advLat, advLon);
        });
    }

    setContactPath(contact: MeshContactRecord, path: ByteArrayLike): Promise<void> {
        return this.createPromise(async (resolve, reject) => {
            try {
                const maxPathLength = 64;
                const outPath = new Uint8Array(maxPathLength);

                for(let i = 0; i < path.length && i < maxPathLength; i++){
                    outPath[i] = path[i];
                }

                contact.outPathLen = path.length;
                contact.outPath = outPath;

                await this.addOrUpdateContact(contact.publicKey, contact.type, contact.flags, contact.outPathLen, contact.outPath, contact.advName, contact.lastAdvert, contact.advLat, contact.advLon);
                resolve();
            } catch(error) {
                reject(error);
            }
        });
    }

    resetPath(pubKey: ByteArrayLike): Promise<void> {
        return this.waitForOkVoid(async () => {
            await this.sendCommandResetPath(pubKey);
        });
    }

    reboot(): Promise<void> {
        return this.createPromise(async (resolve, reject) => {
            let timeoutHandler: ReturnType<typeof setTimeout> | undefined;

            const cleanup = () => {
                /* c8 ignore next */
                if(timeoutHandler != null){
                    clearTimeout(timeoutHandler);
                }
                this.off(Constants.ResponseCodes.Err, onErr);
            };

            const onErr: EventListener = () => {
                cleanup();
                reject();
            };

            timeoutHandler = setTimeout(() => {
                cleanup();
                resolve();
            }, 1000);

            this.on(Constants.ResponseCodes.Err, onErr);

            try {
                await this.sendCommandReboot();
            } catch(error) {
                cleanup();
                reject(error);
            }
        });
    }

    getBatteryVoltage(): Promise<BatteryVoltageResponse> {
        return this.waitForResponseOrErr<BatteryVoltageResponse>(Constants.ResponseCodes.BatteryVoltage, async () => {
            await this.sendCommandGetBatteryVoltage();
        });
    }

    deviceQuery(appTargetVer: number): Promise<DeviceInfoResponse> {
        return this.waitForResponseOrErr<DeviceInfoResponse>(Constants.ResponseCodes.DeviceInfo, async () => {
            await this.sendCommandDeviceQuery(appTargetVer);
        });
    }

    exportPrivateKey(): Promise<PrivateKeyResponse> {
        return this.waitForResponseOrErrOrDisabled<PrivateKeyResponse>(
            Constants.ResponseCodes.PrivateKey,
            async () => {
                await this.sendCommandExportPrivateKey();
            },
            "disabled",
        );
    }

    importPrivateKey(privateKey: ByteArrayLike): Promise<OkResponse> {
        return this.waitForEvent<OkResponse>(Constants.ResponseCodes.Ok, async () => {
            await this.sendCommandImportPrivateKey(privateKey);
        }, {
            rejectEvents: [
                { event: Constants.ResponseCodes.Err },
                { event: Constants.ResponseCodes.Disabled, reason: "disabled" },
            ],
        });
    }

    login(contactPublicKey: Uint8Array, password: string, extraTimeoutMillis = 1000): Promise<LoginSuccessPush> {
        const publicKeyPrefix = contactPublicKey.subarray(0, 6);

        return this.waitForSentThenPush<LoginSuccessPush>({
            send: async () => {
                await this.sendCommandSendLogin(contactPublicKey, password);
            },
            pushEvent: Constants.PushCodes.LoginSuccess,
            extraTimeoutMillis: extraTimeoutMillis,
            isMatch: (response) => {
                return BufferUtils.areBuffersEqual(publicKeyPrefix, response.pubKeyPrefix);
            },
            onMismatch: () => {
                console.log("onLoginSuccess is not for this login request, ignoring...");
            },
        });
    }

    getStatus(contactPublicKey: Uint8Array, extraTimeoutMillis = 1000): Promise<RepeaterStats> {
        const publicKeyPrefix = contactPublicKey.subarray(0, 6);

        return this.waitForSentThenPush<StatusResponsePush, RepeaterStats>({
            send: async () => {
                await this.sendCommandSendStatusReq(contactPublicKey);
            },
            pushEvent: Constants.PushCodes.StatusResponse,
            extraTimeoutMillis: extraTimeoutMillis,
            isMatch: (response) => {
                return BufferUtils.areBuffersEqual(publicKeyPrefix, response.pubKeyPrefix);
            },
            onMismatch: () => {
                console.log("onStatusResponsePush is not for this status request, ignoring...");
            },
            resolveWith: (response) => {
                return parseRepeaterStats(response.statusData);
            },
        });
    }

    getTelemetry(contactPublicKey: Uint8Array, extraTimeoutMillis = 1000): Promise<TelemetryResponsePush> {
        const publicKeyPrefix = contactPublicKey.subarray(0, 6);

        return this.waitForSentThenPush<TelemetryResponsePush>({
            send: async () => {
                await this.sendCommandSendTelemetryReq(contactPublicKey);
            },
            pushEvent: Constants.PushCodes.TelemetryResponse,
            extraTimeoutMillis: extraTimeoutMillis,
            isMatch: (response) => {
                return BufferUtils.areBuffersEqual(publicKeyPrefix, response.pubKeyPrefix);
            },
            onMismatch: () => {
                console.log("onTelemetryResponsePush is not for this telemetry request, ignoring...");
            },
        });
    }

    sendBinaryRequest(contactPublicKey: ByteArrayLike, requestCodeAndParams: ByteArrayLike, extraTimeoutMillis = 1000): Promise<Uint8Array> {
        let tag: number | null = null;

        return this.waitForSentThenPush<BinaryResponsePush, Uint8Array>({
            send: async () => {
                await this.sendCommandSendBinaryReq(contactPublicKey, requestCodeAndParams);
            },
            pushEvent: Constants.PushCodes.BinaryResponse,
            extraTimeoutMillis: extraTimeoutMillis,
            onSent: (response) => {
                tag = response.expectedAckCrc;
            },
            isMatch: (response) => {
                return tag === response.tag;
            },
            onMismatch: (response) => {
                if(tag != null && tag !== response.tag){
                    console.log("onBinaryResponse is not for this request tag, ignoring...");
                }
            },
            resolveWith: (response) => {
                return response.responseData;
            },
        });
    }

    setFloodScope(transportKey: ByteArrayLike): Promise<OkResponse> {
        return this.waitForOk(async () => {
            await this.sendCommandSetFloodScope(transportKey);
        });
    }

    getStats(statsType: number): Promise<StatsResponse> {
        return this.waitForEvent<StatsResponse>(Constants.ResponseCodes.Stats, async () => {
            await this.sendCommandGetStats(statsType);
        }, {
            rejectEvents: [{ event: Constants.ResponseCodes.Err }],
            predicate: (response) => {
                return response.type === statsType;
            },
        });
    }

    getStatsCore(): Promise<StatsResponse> {
        return this.getStats(Constants.StatsTypes.Core);
    }

    getStatsRadio(): Promise<StatsResponse> {
        return this.getStats(Constants.StatsTypes.Radio);
    }

    getStatsPackets(): Promise<StatsResponse> {
        return this.getStats(Constants.StatsTypes.Packets);
    }

    sendChannelData(channelIdx: number, pathLen: number, path: ByteArrayLike, dataType: number, payload: ByteArrayLike): Promise<OkResponse> {
        return this.waitForOk(async () => {
            await this.sendCommandSendChannelData(channelIdx, pathLen, path, dataType, payload);
        });
    }

    clearFloodScope(): Promise<OkResponse> {
        return this.setFloodScope([]);
    }

    pingRepeaterZeroHop(contactPublicKey: Uint8Array, timeoutMillis?: number | null): Promise<{ rtt: number; snr: number; rssi: number }> {
        return this.createPromise(async (resolve, reject) => {
            try {
                const bufferWriter = new BufferWriter();
                bufferWriter.writeUInt32LE(Date.now());
                bufferWriter.writeBytes([0x70, 0x69, 0x6E, 0x67]);
                bufferWriter.writeBytes(contactPublicKey.subarray(0, 2));
                const rawBytes = bufferWriter.toBytes();
                const startMillis = Date.now();
                let timeoutHandler: ReturnType<typeof setTimeout> | undefined;

                const cleanup = () => {
                    if(timeoutHandler != null){
                        clearTimeout(timeoutHandler);
                    }

                    this.off(Constants.ResponseCodes.Err, onErr);
                    this.off(Constants.PushCodes.LogRxData, onLogRxDataPush);
                };

                const onLogRxDataPush: EventListener = (response) => {
                    const logRxData = response as LogRxDataPush;
                    const endMillis = Date.now();
                    const durationMillis = endMillis - startMillis;
                    const packet = Packet.fromBytes(logRxData.raw);

                    if(packet.payload_type !== Packet.PAYLOAD_TYPE_RAW_CUSTOM){
                        return;
                    }

                    if(!BufferUtils.areBuffersEqual(packet.payload, rawBytes)){
                        return;
                    }

                    cleanup();
                    resolve({
                        rtt: durationMillis,
                        snr: logRxData.lastSnr,
                        rssi: logRxData.lastRssi,
                    });
                };

                const onErr: EventListener = () => {
                    cleanup();
                    reject();
                };

                this.on(Constants.ResponseCodes.Err, onErr);
                this.on(Constants.PushCodes.LogRxData, onLogRxDataPush);

                if(timeoutMillis != null){
                    timeoutHandler = setTimeout(() => {
                        cleanup();
                        reject("timeout");
                    }, timeoutMillis);
                }

                await this.sendCommandSendRawData(contactPublicKey.subarray(0, 1), rawBytes);
            } catch(error) {
                reject(error);
            }
        });
    }

    getChannel(channelIdx: number): Promise<MeshChannelRecord> {
        return this.waitForResponseOrErr<MeshChannelRecord>(Constants.ResponseCodes.ChannelInfo, async () => {
            await this.sendCommandGetChannel(channelIdx);
        });
    }

    setChannel(channelIdx: number, name: string, secret: ByteArrayLike): Promise<void> {
        return this.waitForOkVoid(async () => {
            await this.sendCommandSetChannel(channelIdx, name, secret);
        });
    }

    async deleteChannel(channelIdx: number): Promise<void> {
        return await this.setChannel(channelIdx, "", new Uint8Array(16));
    }

    async getChannels(): Promise<MeshChannelRecord[]> {
        let channelIdx = 0;
        const channels: MeshChannelRecord[] = [];

        while(true){
            try {
                const channel = await this.getChannel(channelIdx);
                channels.push(channel);
            } catch {
                break;
            }

            channelIdx++;
        }

        return channels;
    }

    async findChannelByName(name: string): Promise<MeshChannelRecord | undefined> {
        const channels = await this.getChannels();
        return channels.find((channel) => {
            return channel.name === name;
        });
    }

    async findChannelBySecret(secret: Uint8Array): Promise<MeshChannelRecord | undefined> {
        const channels = await this.getChannels();
        return channels.find((channel) => {
            return BufferUtils.areBuffersEqual(secret, channel.secret);
        });
    }

    sign(data: ByteArrayLike): Promise<Uint8Array> {
        return this.createPromise(async (resolve, reject) => {
            const chunkSize = 128;
            const bufferReader = new BufferReader(data);

            const cleanup = () => {
                this.off(Constants.ResponseCodes.Ok, onOk);
                this.off(Constants.ResponseCodes.Err, onErr);
                this.off(Constants.ResponseCodes.SignStart, onSignStart);
                this.off(Constants.ResponseCodes.Signature, onSignature);
            };

            const rejectWithCleanup = (reason?: unknown) => {
                cleanup();
                reject(reason);
            };

            const sendNextChunk = async () => {
                const chunk = bufferReader.getRemainingBytesCount() >= chunkSize
                    ? bufferReader.readBytes(chunkSize)
                    : bufferReader.readRemainingBytes();
                await this.sendCommandSignData(chunk);
            };

            const handleOk = async () => {
                if(bufferReader.getRemainingBytesCount() > 0){
                    await sendNextChunk();
                    return;
                }

                await this.sendCommandSignFinish();
            };

            const onOk: EventListener = () => {
                void handleOk().catch(rejectWithCleanup);
            };

            const handleSignStart = async (response: SignStartResponse) => {
                this.off(Constants.ResponseCodes.SignStart, onSignStart);

                if(bufferReader.getRemainingBytesCount() > response.maxSignDataLen){
                    rejectWithCleanup("data_too_long");
                    return;
                }

                await sendNextChunk();
            };

            const onSignStart: EventListener = (response) => {
                void handleSignStart(response as SignStartResponse).catch(rejectWithCleanup);
            };

            const onSignature: EventListener = (response) => {
                cleanup();
                resolve((response as SignatureResponse).signature);
            };

            const onErr: EventListener = (response) => {
                cleanup();
                reject(response);
            };

            this.on(Constants.ResponseCodes.Ok, onOk);
            this.on(Constants.ResponseCodes.SignStart, onSignStart);
            this.on(Constants.ResponseCodes.Signature, onSignature);
            this.on(Constants.ResponseCodes.Err, onErr);

            try {
                await this.sendCommandSignStart();
            } catch(error) {
                cleanup();
                reject(error);
            }
        });
    }

    tracePath(path: ByteArrayLike, extraTimeoutMillis = 0): Promise<TraceDataPush> {
        const tag = RandomUtils.getRandomInt(0, 4294967295);

        return this.waitForSentThenPush<TraceDataPush>({
            send: async () => {
                await this.sendCommandSendTracePath(tag, 0, path);
            },
            pushEvent: Constants.PushCodes.TraceData,
            extraTimeoutMillis: extraTimeoutMillis,
            isMatch: (response) => {
                return response.tag === tag;
            },
            onMismatch: () => {
                console.log("ignoring trace data for a different trace request");
            },
        });
    }

    setOtherParams(manualAddContacts: number | boolean): Promise<void> {
        return this.waitForOkVoid(async () => {
            await this.sendCommandSetOtherParams(manualAddContacts);
        });
    }

    async setAutoAddContacts(): Promise<void> {
        return await this.setOtherParams(false);
    }

    async setManualAddContacts(): Promise<void> {
        return await this.setOtherParams(true);
    }

    async getNeighbours(
        publicKey: ByteArrayLike,
        count = 10,
        offset = 0,
        orderBy = 0,
        pubKeyPrefixLength = 8,
    ): Promise<{ totalNeighboursCount: number; neighbours: MeshNeighbourRecord[] }> {
        const bufferWriter = new BufferWriter();
        bufferWriter.writeByte(Constants.BinaryRequestTypes.GetNeighbours);
        bufferWriter.writeByte(0);
        bufferWriter.writeByte(count);
        bufferWriter.writeUInt16LE(offset);
        bufferWriter.writeByte(orderBy);
        bufferWriter.writeByte(pubKeyPrefixLength);
        bufferWriter.writeUInt32LE(RandomUtils.getRandomInt(0, 4294967295));

        const responseData = await this.sendBinaryRequest(publicKey, bufferWriter.toBytes());
        const bufferReader = new BufferReader(responseData);
        const totalNeighboursCount = bufferReader.readUInt16LE();
        const resultsCount = bufferReader.readUInt16LE();

        const neighbours: MeshNeighbourRecord[] = [];
        for(let i = 0; i < resultsCount; i++){
            const publicKeyPrefix = bufferReader.readBytes(pubKeyPrefixLength);
            const heardSecondsAgo = bufferReader.readUInt32LE();
            const snr = bufferReader.readInt8() / 4;

            neighbours.push({
                publicKeyPrefix: publicKeyPrefix,
                heardSecondsAgo: heardSecondsAgo,
                snr: snr,
            });
        }

        return {
            totalNeighboursCount: totalNeighboursCount,
            neighbours: neighbours,
        };
    }

}

export default Connection;
