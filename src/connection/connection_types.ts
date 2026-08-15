export type ByteArrayLike = ArrayLike<number>;

export type MeshContactRecord = {
    publicKey: Uint8Array;
    type: number;
    flags: number;
    outPathLen: number;
    outPath: Uint8Array;
    advName: string;
    lastAdvert: number;
    advLat: number;
    advLon: number;
    lastMod?: number;
};

export type OkResponse = Record<string, never>;

export type ErrResponse = {
    errCode: number | null;
};

export type ContactsStartResponse = {
    count: number;
};

export type EndOfContactsResponse = {
    mostRecentLastmod: number;
};

export type SentResponse = {
    result: number;
    expectedAckCrc: number;
    estTimeout: number;
};

export type ExportContactResponse = {
    advertPacketBytes: Uint8Array;
};

export type AdvertPathResponse = {
    recvTimestamp: number;
    pathLen: number;
    pathHashSize: number;
    pathHashCount: number;
    path: Uint8Array;
};

export type BatteryVoltageResponse = {
    batteryMilliVolts: number;
    storageUsedKb?: number;
    storageTotalKb?: number;
};

export type DeviceInfoResponse = {
    firmwareVer: number;
    reserved: Uint8Array;
    maxContacts?: number;
    maxChannels?: number;
    blePin?: number;
    firmware_build_date: string | undefined;
    manufacturerModel: string;
    semanticVersion?: string;
    clientRepeat?: boolean;
    pathHashMode?: number;
};

export type PrivateKeyResponse = {
    privateKey: Uint8Array;
};

export type MeshChannelRecord = {
    channelIdx: number;
    name: string | undefined;
    secret: Uint8Array;
};

export type SignStartResponse = {
    reserved: number;
    maxSignDataLen: number;
};

export type SignatureResponse = {
    signature: Uint8Array;
};

export type CoreStats = {
    batteryMilliVolts: number;
    uptimeSecs: number;
    queueLen: number;
};

export type RadioStats = {
    noiseFloor: number;
    lastRssi: number;
    lastSnr: number;
    txAirSecs: number;
    rxAirSecs: number;
};

export type PacketStats = {
    recv: number;
    sent: number;
    nSentFlood: number;
    nSentDirect: number;
    nRecvFlood: number;
    nRecvDirect: number;
    nRecvErrors: number | null;
};

export type StatsPayload = CoreStats | RadioStats | PacketStats | Record<string, never>;

export type StatsResponse = {
    type: number;
    raw: Uint8Array;
    data: StatsPayload;
};

export type ChannelDataResponse = {
    snr: number;
    reserved1: number;
    reserved2: number;
    channelIdx: number;
    pathLen: number;
    dataType: number;
    dataLen: number;
    data: Uint8Array;
};

export type SelfInfoResponse = {
    type: number;
    txPower: number;
    maxTxPower: number;
    publicKey: Uint8Array;
    advLat: number;
    advLon: number;
    reserved: Uint8Array;
    manualAddContacts: number;
    radioFreq: number;
    radioBw: number;
    radioSf: number;
    radioCr: number;
    name: string;
};

export type CurrTimeResponse = {
    epochSecs: number;
};

export type ContactMessageResponse = {
    pubKeyPrefix: Uint8Array;
    pathLen: number;
    txtType: number;
    senderTimestamp: number;
    text: string;
};

export type ContactMessageV3Response = ContactMessageResponse & {
    snr: number;
    reserved: Uint8Array;
};

export type ChannelMessageResponse = {
    channelIdx: number;
    pathLen: number;
    txtType: number;
    senderTimestamp: number;
    text: string;
};

export type ChannelMessageV3Response = ChannelMessageResponse & {
    snr: number;
    reserved: Uint8Array;
};

export type CustomVarsResponse = {
    value: string;
};

export type TuningParamsResponse = {
    rxDelayBase: number;
    airtimeFactor: number;
    rxDelayBaseRaw: number;
    airtimeFactorRaw: number;
};

export type AutoAddConfigResponse = {
    config: number;
    maxHops: number;
};

export type AllowedRepeatFrequencyRange = {
    lowerFreq: number;
    upperFreq: number;
};

export type AllowedRepeatFreqResponse = {
    ranges: AllowedRepeatFrequencyRange[];
};

export type DefaultFloodScopeResponse = {
    name: string | null;
    key: Uint8Array | null;
};

export type WaitingMessageRecord = {
    contactMessage?: ContactMessageResponse | ContactMessageV3Response;
    channelMessage?: ChannelMessageResponse | ChannelMessageV3Response;
    channelData?: ChannelDataResponse;
};

export type AdvertPush = {
    publicKey: Uint8Array;
};

export type PathUpdatedPush = {
    publicKey: Uint8Array;
};

export type SendConfirmedPush = {
    ackCode: number;
    roundTrip: number;
};

export type RawDataPush = {
    lastSnr: number;
    lastRssi: number;
    reserved: number;
    payload: Uint8Array;
};

export type ControlDataPush = {
    lastSnr: number;
    lastRssi: number;
    pathLen: number;
    path: Uint8Array;
    payload: Uint8Array;
};

export type ContactsFullPush = Record<string, never>;

export type LoginSuccessPush = {
    reserved: number;
    pubKeyPrefix: Uint8Array;
    tag?: number;
    permissions?: number;
    firmwareVer?: number;
};

export type LoginFailPush = {
    reserved: number;
    pubKeyPrefix: Uint8Array;
};

export type PathDiscoveryResponsePush = {
    reserved: number;
    pubKeyPrefix: Uint8Array;
    outPathLen: number;
    outPath: Uint8Array;
    inPathLen: number;
    inPath: Uint8Array;
};

export type ContactDeletedPush = {
    publicKey: Uint8Array;
};

export type StatusResponsePush = {
    reserved: number;
    pubKeyPrefix: Uint8Array;
    statusData: Uint8Array;
};

export type LogRxDataPush = {
    lastSnr: number;
    lastRssi: number;
    raw: Uint8Array;
};

export type TelemetryResponsePush = {
    reserved: number;
    pubKeyPrefix: Uint8Array;
    lppSensorData: Uint8Array;
};

export type BinaryResponsePush = {
    reserved: number;
    tag: number;
    responseData: Uint8Array;
};

export type TraceDataPush = {
    reserved: number;
    pathLen: number;
    flags: number;
    tag: number;
    authCode: number;
    pathHashes: Uint8Array;
    pathSnrs: Uint8Array;
    lastSnr: number;
};

export type RepeaterStats = {
    batt_milli_volts: number;
    curr_tx_queue_len: number;
    noise_floor: number;
    last_rssi: number;
    n_packets_recv: number;
    n_packets_sent: number;
    total_air_time_secs: number;
    total_up_time_secs: number;
    n_sent_flood: number;
    n_sent_direct: number;
    n_recv_flood: number;
    n_recv_direct: number;
    err_events: number;
    last_snr: number;
    n_direct_dups: number;
    n_flood_dups: number;
};

export type MeshNeighbourRecord = {
    publicKeyPrefix: Uint8Array;
    heardSecondsAgo: number;
    snr: number;
};
