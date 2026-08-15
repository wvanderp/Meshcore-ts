/**
 * MeshCore companion protocol constants.
 *
 * Groups all static constant values used throughout the library into
 * named nested objects: serial frame types, BLE service/characteristic
 * UUIDs, command codes, response codes, push codes, data types, and
 * statistics types.
 *
 * @example
 * // Send the AppStart command code
 * writer.writeByte(Constants.CommandCodes.AppStart);
 *
 * // Listen for an incoming push event
 * conn.on(Constants.PushCodes.Advert, (data) => console.log(data));
 */
class Constants {

    static SupportedCompanionProtocolVersion = 3;

    static SerialFrameTypes = {
        Incoming: 0x3e, // ">"
        Outgoing: 0x3c, // "<"
    }

    static Ble = {
        ServiceUuid: "6E400001-B5A3-F393-E0A9-E50E24DCCA9E",
        CharacteristicUuidRx: "6E400002-B5A3-F393-E0A9-E50E24DCCA9E",
        CharacteristicUuidTx: "6E400003-B5A3-F393-E0A9-E50E24DCCA9E",
    }

    static DataTypes = {
        Dev: 0xFFFF, // developer namespace for experimenting with group/channel datagrams and building apps
    }

    static StatsTypes = {
        Core: 0,
        Radio: 1,
        Packets: 2,
    }

    static CommandCodes = {
        AppStart: 1,
        SendTxtMsg: 2,
        SendChannelTxtMsg: 3,
        GetContacts: 4,
        GetDeviceTime: 5,
        SetDeviceTime: 6,
        SendSelfAdvert: 7,
        SetAdvertName: 8,
        AddUpdateContact: 9,
        SyncNextMessage: 10,
        SetRadioParams: 11,
        SetTxPower: 12,
        ResetPath: 13,
        SetAdvertLatLon: 14,
        RemoveContact: 15,
        ShareContact: 16,
        ExportContact: 17,
        ImportContact: 18,
        Reboot: 19,
        GetBatteryVoltage: 20,
        SetTuningParams: 21,
        DeviceQuery: 22,
        ExportPrivateKey: 23,
        ImportPrivateKey: 24,
        SendRawData: 25,
        SendLogin: 26,
        SendStatusReq: 27,
        HasConnection: 28,
        Logout: 29,
        GetContactByKey: 30,
        GetChannel: 31,
        SetChannel: 32,
        SignStart: 33,
        SignData: 34,
        SignFinish: 35,
        SendTracePath: 36,
        SetDevicePin: 37,
        SetOtherParams: 38,
        SendTelemetryReq: 39,
        GetCustomVars: 40,
        SetCustomVar: 41,
        GetAdvertPath: 42,
        GetTuningParams: 43,

        SendBinaryReq: 50,
        FactoryReset: 51,
        SendPathDiscoveryReq: 52,

        SetFloodScope: 54,
        SendControlData: 55,

        GetStats: 56,
        SendAnonReq: 57,
        SetAutoAddConfig: 58,
        GetAutoAddConfig: 59,
        GetAllowedRepeatFreq: 60,
        SetPathHashMode: 61,

        SendChannelData: 62,
        SetDefaultFloodScope: 63,
        GetDefaultFloodScope: 64,
        SendRawPacket: 65,
    }

    static ResponseCodes = {
        Ok: 0, // todo
        Err: 1, // todo
        ContactsStart: 2,
        Contact: 3,
        EndOfContacts: 4,
        SelfInfo: 5,
        Sent: 6,
        ContactMsgRecv: 7,
        ChannelMsgRecv: 8,
        CurrTime: 9,
        NoMoreMessages: 10,
        ExportContact: 11,
        BatteryVoltage: 12,
        DeviceInfo: 13,
        PrivateKey: 14,
        Disabled: 15,
        ContactMsgRecvV3: 16,
        ChannelMsgRecvV3: 17,
        ChannelInfo: 18,
        SignStart: 19,
        Signature: 20,
        CustomVars: 21,
        AdvertPath: 22,
        TuningParams: 23,
        Stats: 24,
        AutoAddConfig: 25,
        AllowedRepeatFreq: 26,
        ChannelDataRecv: 27,
        DefaultFloodScope: 28,
    }

    static PushCodes = {
        Advert: 0x80, // when companion is set to auto add contacts
        PathUpdated: 0x81,
        SendConfirmed: 0x82,
        MsgWaiting: 0x83,
        RawData: 0x84,
        LoginSuccess: 0x85,
        LoginFail: 0x86,
        StatusResponse: 0x87,
        LogRxData: 0x88,
        TraceData: 0x89,
        NewAdvert: 0x8A, // when companion is set to manually add contacts
        TelemetryResponse: 0x8B,
        BinaryResponse: 0x8C,
        PathDiscoveryResponse: 0x8D,
        ControlData: 0x8E,
        ContactDeleted: 0x8F,
        ContactsFull: 0x90,
    }

    static ErrorCodes = {
        UnsupportedCmd: 1,
        NotFound: 2,
        TableFull: 3,
        BadState: 4,
        FileIoError: 5,
        IllegalArg: 6,
    }

    static AdvType = {
        None: 0,
        Chat: 1,
        Repeater: 2,
        Room: 3,
    }

    static SelfAdvertTypes = {
        ZeroHop: 0,
        Flood: 1,
    }

    static TxtTypes = {
        Plain: 0,
        CliData: 1,
        SignedPlain: 2,
    }

    static BinaryRequestTypes = {
        GetTelemetryData: 0x03, // #define REQ_TYPE_GET_TELEMETRY_DATA 0x03
        GetAvgMinMax: 0x04, // #define REQ_TYPE_GET_AVG_MIN_MAX 0x04
        GetAccessList: 0x05, // #define REQ_TYPE_GET_ACCESS_LIST 0x05
        GetNeighbours: 0x06, // #define REQ_TYPE_GET_NEIGHBOURS 0x06
    }

}

export default Constants;
