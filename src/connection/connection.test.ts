import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import BufferReader from '../buffer_reader'
import BufferWriter from '../buffer_writer'
import Constants from '../constants'
import Packet from '../packet'
import RandomUtils from '../random_utils'
import Connection from './connection'
import ConnectionBase from './connection_base'

type ByteArrayLike = ArrayLike<number>

class TestConnection extends Connection {
  sentFrames: Uint8Array[] = []

  override async close(): Promise<void> {
    return
  }

  override async sendToRadioFrame(data: ByteArrayLike): Promise<void> {
    this.sentFrames.push(Uint8Array.from(data))
  }

  latestFrame(): Uint8Array {
    const frame = this.sentFrames.at(-1)
    expect(frame).toBeDefined()
    return frame!
  }

  dispatch(frame: ByteArrayLike): void {
    this.onFrameReceived(frame)
  }
}

function sequence(length: number, start = 0): Uint8Array {
  return Uint8Array.from(Array.from({ length }, (_value, index) => (start + index) & 0xff))
}

function concatBytes(...parts: ByteArrayLike[]): Uint8Array {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
  const bytes = new Uint8Array(totalLength)
  let offset = 0

  for (const part of parts) {
    bytes.set(Uint8Array.from(part), offset)
    offset += part.length
  }

  return bytes
}

function byte(value: number): Uint8Array {
  return Uint8Array.of(value & 0xff)
}

function uint16LE(value: number): Uint8Array {
  const bytes = new Uint8Array(2)
  const view = new DataView(bytes.buffer)
  view.setUint16(0, value, true)
  return bytes
}

function int16LE(value: number): Uint8Array {
  const bytes = new Uint8Array(2)
  const view = new DataView(bytes.buffer)
  view.setInt16(0, value, true)
  return bytes
}

function uint32LE(value: number): Uint8Array {
  const bytes = new Uint8Array(4)
  const view = new DataView(bytes.buffer)
  view.setUint32(0, value, true)
  return bytes
}

function int32LE(value: number): Uint8Array {
  const bytes = new Uint8Array(4)
  const view = new DataView(bytes.buffer)
  view.setInt32(0, value, true)
  return bytes
}

function cString(value: string, maxLength: number): Uint8Array {
  const writer = new BufferWriter()
  writer.writeCString(value, maxLength)
  return writer.toBytes()
}

function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

function frame(code: number, ...payloadParts: ByteArrayLike[]): Uint8Array {
  return concatBytes(byte(code), ...payloadParts)
}

function makeSelfInfoFrame(name = 'Mesh Node'): Uint8Array {
  return frame(
    Constants.ResponseCodes.SelfInfo,
    byte(Constants.AdvType.Chat),
    byte(20),
    byte(30),
    sequence(32, 0x10),
    int32LE(51_234_500),
    int32LE(-4_234_500),
    Uint8Array.of(1, 2, 3),
    byte(1),
    uint32LE(915_000),
    uint32LE(125_000),
    byte(7),
    byte(5),
    utf8(name),
  )
}

function makeContactFrame(
  code = Constants.ResponseCodes.Contact,
  name = 'Alpha',
  publicKeyStart = 0x30,
): Uint8Array {
  return frame(
    code,
    sequence(32, publicKeyStart),
    byte(Constants.AdvType.Chat),
    byte(5),
    byte(2),
    sequence(64, 0x50),
    cString(name, 32),
    uint32LE(1_234),
    int32LE(5_000_000),
    int32LE(-2_000_000),
    uint32LE(5_678),
  )
}

function makeCurrTimeFrame(epochSecs = 1_234): Uint8Array {
  return frame(Constants.ResponseCodes.CurrTime, uint32LE(epochSecs))
}

function makeBatteryVoltageFrame(milliVolts = 3_300): Uint8Array {
  return frame(Constants.ResponseCodes.BatteryVoltage, uint16LE(milliVolts))
}

function makeDeviceInfoFrame(
  model = 'MeshTrace DevKit',
  buildDate = '19 Feb 2025',
): Uint8Array {
  return frame(
    Constants.ResponseCodes.DeviceInfo,
    byte(2),
    sequence(6, 0x20),
    cString(buildDate, 12),
    utf8(model),
  )
}

function makeChannelInfoFrame(
  channelIdx = 2,
  name = 'mesh',
  secret = sequence(16, 0x70),
): Uint8Array {
  return frame(Constants.ResponseCodes.ChannelInfo, byte(channelIdx), cString(name, 32), secret)
}

function makeChannelDataFrame(): Uint8Array {
  return frame(
    Constants.ResponseCodes.ChannelDataRecv,
    byte(8),
    byte(1),
    byte(2),
    byte(3),
    byte(0xff),
    uint16LE(Constants.DataTypes.Dev),
    byte(3),
    Uint8Array.of(0xaa, 0xbb, 0xcc),
  )
}

function makeContactMessageFrame(text = 'hello'): Uint8Array {
  return frame(
    Constants.ResponseCodes.ContactMsgRecv,
    sequence(6, 0xa0),
    byte(2),
    byte(Constants.TxtTypes.Plain),
    uint32LE(1_111),
    utf8(text),
  )
}

function makeChannelMessageFrame(text = 'broadcast'): Uint8Array {
  return frame(
    Constants.ResponseCodes.ChannelMsgRecv,
    byte(3),
    byte(0xff),
    byte(Constants.TxtTypes.Plain),
    uint32LE(2_222),
    utf8(text),
  )
}

function makeSentFrame(
  expectedAckCrc = 0x11223344,
  estTimeout = 50,
  result = 1,
): Uint8Array {
  return frame(
    Constants.ResponseCodes.Sent,
    byte(result),
    uint32LE(expectedAckCrc),
    uint32LE(estTimeout),
  )
}

function makeStatusData(): Uint8Array {
  return concatBytes(
    uint16LE(3_300),
    uint16LE(4),
    int16LE(-120),
    int16LE(-80),
    uint32LE(100),
    uint32LE(50),
    uint32LE(10),
    uint32LE(20),
    uint32LE(5),
    uint32LE(6),
    uint32LE(7),
    uint32LE(8),
    uint16LE(9),
    int16LE(12),
    uint16LE(13),
    uint16LE(14),
  )
}

function makeStatusResponseFrame(pubKeyPrefix: ByteArrayLike, statusData: ByteArrayLike): Uint8Array {
  return frame(Constants.PushCodes.StatusResponse, byte(0), pubKeyPrefix, statusData)
}

function makeTelemetryResponseFrame(pubKeyPrefix: ByteArrayLike, data: ByteArrayLike): Uint8Array {
  return frame(Constants.PushCodes.TelemetryResponse, byte(0), pubKeyPrefix, data)
}

function makeBinaryResponseFrame(tag: number, data: ByteArrayLike): Uint8Array {
  return frame(Constants.PushCodes.BinaryResponse, byte(0), uint32LE(tag), data)
}

function makeLoginSuccessFrame(pubKeyPrefix: ByteArrayLike): Uint8Array {
  return frame(Constants.PushCodes.LoginSuccess, byte(0), pubKeyPrefix)
}

function makeTraceDataFrame(
  tag: number,
  pathHashes = Uint8Array.of(0xaa, 0xbb),
  pathSnrs = Uint8Array.of(12, 16),
  lastSnrByte = 8,
): Uint8Array {
  return frame(
    Constants.PushCodes.TraceData,
    byte(0),
    byte(pathHashes.length),
    byte(1),
    uint32LE(tag),
    uint32LE(0x55667788),
    pathHashes,
    pathSnrs,
    byte(lastSnrByte),
  )
}

function makeAdvertPathFrame(
  recvTimestamp = 1_234,
  pathLen = 2,
  path = Uint8Array.of(0xaa, 0xbb),
): Uint8Array {
  return frame(Constants.ResponseCodes.AdvertPath, uint32LE(recvTimestamp), byte(pathLen), path)
}

function makeSignStartFrame(maxSignDataLen = 256): Uint8Array {
  return frame(Constants.ResponseCodes.SignStart, byte(0), uint32LE(maxSignDataLen))
}

function makeSignatureFrame(signature = sequence(64, 0x90)): Uint8Array {
  return frame(Constants.ResponseCodes.Signature, signature)
}

function makeStatsFrame(type: number, raw: ByteArrayLike): Uint8Array {
  return frame(Constants.ResponseCodes.Stats, byte(type), raw)
}

function makeCoreStatsFrame(): Uint8Array {
  return makeStatsFrame(
    Constants.StatsTypes.Core,
    concatBytes(uint16LE(3_300), uint32LE(1_000), byte(3)),
  )
}

function makeRadioStatsFrame(): Uint8Array {
  return makeStatsFrame(
    Constants.StatsTypes.Radio,
    concatBytes(int16LE(-120), byte(-80), byte(8), uint32LE(10), uint32LE(20)),
  )
}

function makePacketsStatsFrame(includeErrors = true): Uint8Array {
  const base = concatBytes(
    uint32LE(10),
    uint32LE(20),
    uint32LE(30),
    uint32LE(40),
    uint32LE(50),
    uint32LE(60),
  )

  return makeStatsFrame(
    Constants.StatsTypes.Packets,
    includeErrors ? concatBytes(base, uint32LE(70)) : base,
  )
}

function makeRawCustomPacket(payload: ByteArrayLike): Uint8Array {
  const header = Packet.ROUTE_TYPE_FLOOD | (Packet.PAYLOAD_TYPE_RAW_CUSTOM << Packet.PH_TYPE_SHIFT)
  return concatBytes(byte(header), byte(0), payload)
}

function makeNonCustomPacket(payload: ByteArrayLike): Uint8Array {
  const header = Packet.ROUTE_TYPE_FLOOD | (Packet.PAYLOAD_TYPE_TXT_MSG << Packet.PH_TYPE_SHIFT)
  return concatBytes(byte(header), byte(0), payload)
}

function makeContactRecord(name = 'Alpha', publicKeyStart = 0x30) {
  return {
    publicKey: sequence(32, publicKeyStart),
    type: Constants.AdvType.Chat,
    flags: 5,
    outPathLen: 2,
    outPath: sequence(64, 0x50),
    advName: name,
    lastAdvert: 1_234,
    advLat: 5_000_000,
    advLon: -2_000_000,
    lastMod: 5_678,
  }
}

function makeChannelRecord(name = 'mesh', secretStart = 0x70) {
  return {
    channelIdx: 0,
    name,
    secret: sequence(16, secretStart),
  }
}

function waitForEvent<T>(
  connection: Connection,
  event: number | string,
  action: () => void,
): Promise<T> {
  return new Promise<T>((resolve) => {
    connection.once(event, (payload) => {
      resolve(payload as T)
    })
    action()
  })
}

async function resolveWithOk<T>(connection: TestConnection, start: () => Promise<T>): Promise<T> {
  const promise = start()
  connection.dispatch(frame(Constants.ResponseCodes.Ok))
  return promise
}

async function flushOnceEventTimers(): Promise<void> {
  for (let index = 0; index < 2; index += 1) {
    if (vi.getTimerCount() === 0) {
      break
    }

    await vi.advanceTimersToNextTimerAsync()
  }
}

async function flushOnEventTimer(): Promise<void> {
  if (vi.getTimerCount() > 0) {
    await vi.advanceTimersToNextTimerAsync()
  }
}

describe('Connection', () => {
  let connection: TestConnection

  beforeEach(() => {
    connection = new TestConnection()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('base behavior', () => {
    it('queries the supported protocol version on connect and still emits connected on failure', async () => {
      const deviceQuerySpy = vi
        .spyOn(connection, 'deviceQuery')
        .mockRejectedValueOnce(new Error('unsupported'))
      const onConnected = vi.fn()

      connection.on('connected', onConnected)
      await connection.onConnected()

      expect(deviceQuerySpy).toHaveBeenCalledWith(Constants.SupportedCompanionProtocolVersion)
      await vi.waitFor(() => {
        expect(onConnected).toHaveBeenCalledTimes(1)
      })
    })

    it('emits disconnected and base methods reject when not overridden', async () => {
      const onDisconnected = vi.fn()
      const baseConnection = new Connection()
      const abstractBase = new ConnectionBase()

      connection.on('disconnected', onDisconnected)
      connection.onDisconnected()

      await vi.waitFor(() => {
        expect(onDisconnected).toHaveBeenCalledTimes(1)
      })

      await expect(baseConnection.close()).rejects.toThrow('implemented by the subclass')
      await expect(baseConnection.sendToRadioFrame(Uint8Array.of(1))).rejects.toThrow(
        'implemented by the subclass',
      )
      await expect(abstractBase.deviceQuery(1)).rejects.toThrow('implemented by the subclass')
      await expect(
        baseConnection.createPromise<number>(async (resolve) => {
          resolve(42)
        }),
      ).resolves.toBe(42)
      await expect(
        baseConnection.createPromise(async () => {
          throw new Error('boom')
        }),
      ).rejects.toThrow('boom')
    })
  })

  describe('command serialization', () => {
    it('serializes app start, contact requests, text messages and export contact frames', async () => {
      await connection.sendCommandAppStart()

      let reader = new BufferReader(connection.latestFrame())
      expect(reader.readByte()).toBe(Constants.CommandCodes.AppStart)
      expect(reader.readByte()).toBe(1)
      expect(reader.readBytes(6)).toEqual(new Uint8Array(6))
      expect(reader.readString()).toBe('test')

      await connection.sendCommandSendTxtMsg(2, 3, 0x01020304, sequence(10, 0xa0), 'hello')

      reader = new BufferReader(connection.latestFrame())
      expect(reader.readByte()).toBe(Constants.CommandCodes.SendTxtMsg)
      expect(reader.readByte()).toBe(2)
      expect(reader.readByte()).toBe(3)
      expect(reader.readUInt32LE()).toBe(0x01020304)
      expect(reader.readBytes(6)).toEqual(sequence(6, 0xa0))
      expect(reader.readString()).toBe('hello')

      await connection.sendCommandGetContacts()
      expect(connection.latestFrame()).toEqual(Uint8Array.of(Constants.CommandCodes.GetContacts))

      await connection.sendCommandGetContacts(0x11223344)
      reader = new BufferReader(connection.latestFrame())
      expect(reader.readByte()).toBe(Constants.CommandCodes.GetContacts)
      expect(reader.readUInt32LE()).toBe(0x11223344)

      const publicKey = sequence(32, 0x20)
      await connection.sendCommandExportContact(publicKey)
      reader = new BufferReader(connection.latestFrame())
      expect(reader.readByte()).toBe(Constants.CommandCodes.ExportContact)
      expect(reader.readBytes(32)).toEqual(publicKey)
    })

    it('serializes channel, time, advert and contact update commands', async () => {
      await connection.sendCommandSendChannelTxtMsg(2, 4, 0x01020304, 'broadcast')

      let reader = new BufferReader(connection.latestFrame())
      expect(reader.readByte()).toBe(Constants.CommandCodes.SendChannelTxtMsg)
      expect(reader.readByte()).toBe(2)
      expect(reader.readByte()).toBe(4)
      expect(reader.readUInt32LE()).toBe(0x01020304)
      expect(reader.readString()).toBe('broadcast')

      await connection.sendCommandGetDeviceTime()
      expect(connection.latestFrame()).toEqual(Uint8Array.of(Constants.CommandCodes.GetDeviceTime))

      await connection.sendCommandSetDeviceTime(0x0a0b0c0d)
      reader = new BufferReader(connection.latestFrame())
      expect(reader.readByte()).toBe(Constants.CommandCodes.SetDeviceTime)
      expect(reader.readUInt32LE()).toBe(0x0a0b0c0d)

      await connection.sendCommandSendSelfAdvert(Constants.SelfAdvertTypes.Flood)
      reader = new BufferReader(connection.latestFrame())
      expect(reader.readByte()).toBe(Constants.CommandCodes.SendSelfAdvert)
      expect(reader.readByte()).toBe(Constants.SelfAdvertTypes.Flood)

      await connection.sendCommandSetAdvertName('MeshNode')
      reader = new BufferReader(connection.latestFrame())
      expect(reader.readByte()).toBe(Constants.CommandCodes.SetAdvertName)
      expect(reader.readString()).toBe('MeshNode')

      const publicKey = sequence(32, 0x11)
      const outPath = sequence(64, 0x22)
      await connection.sendCommandAddUpdateContact(publicKey, 1, 2, 3, outPath, 'Relay', 99, 123, -456)

      reader = new BufferReader(connection.latestFrame())
      expect(reader.readByte()).toBe(Constants.CommandCodes.AddUpdateContact)
      expect(reader.readBytes(32)).toEqual(publicKey)
      expect(reader.readByte()).toBe(1)
      expect(reader.readByte()).toBe(2)
      expect(reader.readByte()).toBe(3)
      expect(reader.readBytes(64)).toEqual(outPath)
      expect(reader.readCString(32)).toBe('Relay')
      expect(reader.readUInt32LE()).toBe(99)
      expect(reader.readInt32LE()).toBe(123)
      expect(reader.readInt32LE()).toBe(-456)

      await connection.sendCommandSyncNextMessage()
      expect(connection.latestFrame()).toEqual(Uint8Array.of(Constants.CommandCodes.SyncNextMessage))
    })

    it('serializes radio, contact management and key commands', async () => {
      await connection.sendCommandSetRadioParams(915_000, 125_000, 7, 5)

      let reader = new BufferReader(connection.latestFrame())
      expect(reader.readByte()).toBe(Constants.CommandCodes.SetRadioParams)
      expect(reader.readUInt32LE()).toBe(915_000)
      expect(reader.readUInt32LE()).toBe(125_000)
      expect(reader.readByte()).toBe(7)
      expect(reader.readByte()).toBe(5)

      await connection.sendCommandSetTxPower(17)
      reader = new BufferReader(connection.latestFrame())
      expect(reader.readByte()).toBe(Constants.CommandCodes.SetTxPower)
      expect(reader.readByte()).toBe(17)

      const publicKey = sequence(32, 0x33)
      await connection.sendCommandResetPath(publicKey)
      reader = new BufferReader(connection.latestFrame())
      expect(reader.readByte()).toBe(Constants.CommandCodes.ResetPath)
      expect(reader.readBytes(32)).toEqual(publicKey)

      await connection.sendCommandSetAdvertLatLon(51_000_000, -1_500_000)
      reader = new BufferReader(connection.latestFrame())
      expect(reader.readByte()).toBe(Constants.CommandCodes.SetAdvertLatLon)
      expect(reader.readInt32LE()).toBe(51_000_000)
      expect(reader.readInt32LE()).toBe(-1_500_000)

      await connection.sendCommandRemoveContact(publicKey)
      reader = new BufferReader(connection.latestFrame())
      expect(reader.readByte()).toBe(Constants.CommandCodes.RemoveContact)
      expect(reader.readBytes(32)).toEqual(publicKey)

      await connection.sendCommandShareContact(publicKey)
      reader = new BufferReader(connection.latestFrame())
      expect(reader.readByte()).toBe(Constants.CommandCodes.ShareContact)
      expect(reader.readBytes(32)).toEqual(publicKey)

      await connection.sendCommandExportContact()
      expect(connection.latestFrame()).toEqual(Uint8Array.of(Constants.CommandCodes.ExportContact))

      await connection.sendCommandImportContact(Uint8Array.of(1, 2, 3, 4))
      reader = new BufferReader(connection.latestFrame())
      expect(reader.readByte()).toBe(Constants.CommandCodes.ImportContact)
      expect(reader.readRemainingBytes()).toEqual(Uint8Array.of(1, 2, 3, 4))

      await connection.sendCommandReboot()
      reader = new BufferReader(connection.latestFrame())
      expect(reader.readByte()).toBe(Constants.CommandCodes.Reboot)
      expect(reader.readString()).toBe('reboot')

      await connection.sendCommandGetBatteryVoltage()
      expect(connection.latestFrame()).toEqual(Uint8Array.of(Constants.CommandCodes.GetBatteryVoltage))

      await connection.sendCommandDeviceQuery(7)
      reader = new BufferReader(connection.latestFrame())
      expect(reader.readByte()).toBe(Constants.CommandCodes.DeviceQuery)
      expect(reader.readByte()).toBe(7)

      await connection.sendCommandExportPrivateKey()
      expect(connection.latestFrame()).toEqual(Uint8Array.of(Constants.CommandCodes.ExportPrivateKey))

      const privateKey = sequence(64, 0x44)
      await connection.sendCommandImportPrivateKey(privateKey)
      reader = new BufferReader(connection.latestFrame())
      expect(reader.readByte()).toBe(Constants.CommandCodes.ImportPrivateKey)
      expect(reader.readBytes(64)).toEqual(privateKey)
    })

    it('serializes status, binary, stats and signing commands', async () => {
      const publicKey = sequence(32, 0x55)

      await connection.sendCommandSendLogin(publicKey, 'secret')
      let reader = new BufferReader(connection.latestFrame())
      expect(reader.readByte()).toBe(Constants.CommandCodes.SendLogin)
      expect(reader.readBytes(32)).toEqual(publicKey)
      expect(reader.readString()).toBe('secret')

      await connection.sendCommandSendStatusReq(publicKey)
      reader = new BufferReader(connection.latestFrame())
      expect(reader.readByte()).toBe(Constants.CommandCodes.SendStatusReq)
      expect(reader.readBytes(32)).toEqual(publicKey)

      await connection.sendCommandSendTelemetryReq(publicKey)
      reader = new BufferReader(connection.latestFrame())
      expect(reader.readByte()).toBe(Constants.CommandCodes.SendTelemetryReq)
      expect(reader.readByte()).toBe(0)
      expect(reader.readByte()).toBe(0)
      expect(reader.readByte()).toBe(0)
      expect(reader.readBytes(32)).toEqual(publicKey)

      await connection.sendCommandGetAdvertPath(publicKey)
      reader = new BufferReader(connection.latestFrame())
      expect(reader.readByte()).toBe(Constants.CommandCodes.GetAdvertPath)
      expect(reader.readByte()).toBe(0)
      expect(reader.readBytes(32)).toEqual(publicKey)

      await connection.sendCommandSendBinaryReq(publicKey, Uint8Array.of(0xde, 0xad))
      reader = new BufferReader(connection.latestFrame())
      expect(reader.readByte()).toBe(Constants.CommandCodes.SendBinaryReq)
      expect(reader.readBytes(32)).toEqual(publicKey)
      expect(reader.readRemainingBytes()).toEqual(Uint8Array.of(0xde, 0xad))

      await connection.sendCommandGetStats(Constants.StatsTypes.Radio)
      reader = new BufferReader(connection.latestFrame())
      expect(reader.readByte()).toBe(Constants.CommandCodes.GetStats)
      expect(reader.readByte()).toBe(Constants.StatsTypes.Radio)

      await connection.sendCommandSendChannelData(
        3,
        2,
        Uint8Array.of(0xaa, 0xbb),
        Constants.DataTypes.Dev,
        Uint8Array.of(9, 8, 7),
      )
      reader = new BufferReader(connection.latestFrame())
      expect(reader.readByte()).toBe(Constants.CommandCodes.SendChannelData)
      expect(reader.readByte()).toBe(3)
      expect(reader.readByte()).toBe(2)
      expect(reader.readBytes(2)).toEqual(Uint8Array.of(0xaa, 0xbb))
      expect(reader.readUInt16LE()).toBe(Constants.DataTypes.Dev)
      expect(reader.readRemainingBytes()).toEqual(Uint8Array.of(9, 8, 7))

      await connection.sendCommandGetChannel(9)
      reader = new BufferReader(connection.latestFrame())
      expect(reader.readByte()).toBe(Constants.CommandCodes.GetChannel)
      expect(reader.readByte()).toBe(9)

      await connection.sendCommandSignStart()
      expect(connection.latestFrame()).toEqual(Uint8Array.of(Constants.CommandCodes.SignStart))

      await connection.sendCommandSignData(Uint8Array.of(0xaa, 0xbb, 0xcc))
      reader = new BufferReader(connection.latestFrame())
      expect(reader.readByte()).toBe(Constants.CommandCodes.SignData)
      expect(reader.readRemainingBytes()).toEqual(Uint8Array.of(0xaa, 0xbb, 0xcc))

      await connection.sendCommandSignFinish()
      expect(connection.latestFrame()).toEqual(Uint8Array.of(Constants.CommandCodes.SignFinish))

      await connection.sendCommandSetOtherParams(true)
      reader = new BufferReader(connection.latestFrame())
      expect(reader.readByte()).toBe(Constants.CommandCodes.SetOtherParams)
      expect(reader.readByte()).toBe(1)
    })

    it('serializes raw data, set channel, trace path and flood scope frames', async () => {
      await connection.sendCommandSendRawData(Uint8Array.of(0xaa, 0xbb), Uint8Array.of(1, 2, 3))

      let reader = new BufferReader(connection.latestFrame())
      expect(reader.readByte()).toBe(Constants.CommandCodes.SendRawData)
      expect(reader.readByte()).toBe(2)
      expect(reader.readBytes(2)).toEqual(Uint8Array.of(0xaa, 0xbb))
      expect(reader.readRemainingBytes()).toEqual(Uint8Array.of(1, 2, 3))

      const secret = sequence(16, 0x70)
      await connection.sendCommandSetChannel(3, 'mesh', secret)

      reader = new BufferReader(connection.latestFrame())
      expect(reader.readByte()).toBe(Constants.CommandCodes.SetChannel)
      expect(reader.readByte()).toBe(3)
      expect(reader.readCString(32)).toBe('mesh')
      expect(reader.readBytes(16)).toEqual(secret)

      await connection.sendCommandSendTracePath(0x01020304, 0xaabbccdd, Uint8Array.of(0x11, 0x22))

      reader = new BufferReader(connection.latestFrame())
      expect(reader.readByte()).toBe(Constants.CommandCodes.SendTracePath)
      expect(reader.readUInt32LE()).toBe(0x01020304)
      expect(reader.readUInt32LE()).toBe(0xaabbccdd)
      expect(reader.readByte()).toBe(0)
      expect(reader.readRemainingBytes()).toEqual(Uint8Array.of(0x11, 0x22))

      const floodScope = sequence(16, 0xc0)
      await connection.sendCommandSetFloodScope(floodScope)

      reader = new BufferReader(connection.latestFrame())
      expect(reader.readByte()).toBe(Constants.CommandCodes.SetFloodScope)
      expect(reader.readByte()).toBe(0)
      expect(reader.readBytes(16)).toEqual(floodScope)
    })
  })

  describe('frame parsing', () => {
    it('emits rx and parses self info frames', async () => {
      const onRx = vi.fn()

      connection.on('rx', onRx)
      const selfInfo = await waitForEvent<Record<string, unknown>>(
        connection,
        Constants.ResponseCodes.SelfInfo,
        () => {
          connection.dispatch(makeSelfInfoFrame('Mesh Node'))
        },
      )

      await vi.waitFor(() => {
        expect(onRx).toHaveBeenCalledTimes(1)
      })
      expect(selfInfo).toMatchObject({
        type: Constants.AdvType.Chat,
        txPower: 20,
        maxTxPower: 30,
        advLat: 51_234_500,
        advLon: -4_234_500,
        manualAddContacts: 1,
        radioFreq: 915_000,
        radioBw: 125_000,
        radioSf: 7,
        radioCr: 5,
        name: 'Mesh Node',
      })
      expect(selfInfo.publicKey).toEqual(sequence(32, 0x10))
    })

    it('parses contact, channel, stats and sign-related response frames', async () => {
      const contactsStart = await waitForEvent<Record<string, unknown>>(
        connection,
        Constants.ResponseCodes.ContactsStart,
        () => {
          connection.dispatch(frame(Constants.ResponseCodes.ContactsStart, uint32LE(2)))
        },
      )
      expect(contactsStart).toEqual({ count: 2 })

      const contact = await waitForEvent<Record<string, unknown>>(
        connection,
        Constants.ResponseCodes.Contact,
        () => {
          connection.dispatch(makeContactFrame())
        },
      )
      expect(contact.advName).toBe('Alpha')
      expect(contact.publicKey).toEqual(sequence(32, 0x30))

      const channelInfo = await waitForEvent<Record<string, unknown>>(
        connection,
        Constants.ResponseCodes.ChannelInfo,
        () => {
          connection.dispatch(makeChannelInfoFrame())
        },
      )
      expect(channelInfo).toEqual({
        channelIdx: 2,
        name: 'mesh',
        secret: sequence(16, 0x70),
      })

      const channelData = await waitForEvent<Record<string, unknown>>(
        connection,
        Constants.ResponseCodes.ChannelDataRecv,
        () => {
          connection.dispatch(makeChannelDataFrame())
        },
      )
      expect(channelData).toEqual({
        snr: 2,
        reserved1: 1,
        reserved2: 2,
        channelIdx: 3,
        pathLen: 255,
        dataType: Constants.DataTypes.Dev,
        dataLen: 3,
        data: Uint8Array.of(0xaa, 0xbb, 0xcc),
      })

      const coreStats = await waitForEvent<Record<string, unknown>>(
        connection,
        Constants.ResponseCodes.Stats,
        () => {
          connection.dispatch(makeCoreStatsFrame())
        },
      )
      expect(coreStats).toEqual({
        type: Constants.StatsTypes.Core,
        raw: concatBytes(uint16LE(3_300), uint32LE(1_000), byte(3)),
        data: {
          batteryMilliVolts: 3_300,
          uptimeSecs: 1_000,
          queueLen: 3,
        },
      })

      const radioStats = await waitForEvent<Record<string, unknown>>(
        connection,
        Constants.ResponseCodes.Stats,
        () => {
          connection.dispatch(makeRadioStatsFrame())
        },
      )
      expect(radioStats).toEqual({
        type: Constants.StatsTypes.Radio,
        raw: concatBytes(int16LE(-120), byte(-80), byte(8), uint32LE(10), uint32LE(20)),
        data: {
          noiseFloor: -120,
          lastRssi: -80,
          lastSnr: 2,
          txAirSecs: 10,
          rxAirSecs: 20,
        },
      })

      const packetStats = await waitForEvent<Record<string, unknown>>(
        connection,
        Constants.ResponseCodes.Stats,
        () => {
          connection.dispatch(makePacketsStatsFrame(true))
        },
      )
      expect(packetStats.data).toEqual({
        recv: 10,
        sent: 20,
        nSentFlood: 30,
        nSentDirect: 40,
        nRecvFlood: 50,
        nRecvDirect: 60,
        nRecvErrors: 70,
      })

      const packetStatsWithoutErrors = await waitForEvent<Record<string, unknown>>(
        connection,
        Constants.ResponseCodes.Stats,
        () => {
          connection.dispatch(makePacketsStatsFrame(false))
        },
      )
      expect(packetStatsWithoutErrors.data).toEqual({
        recv: 10,
        sent: 20,
        nSentFlood: 30,
        nSentDirect: 40,
        nRecvFlood: 50,
        nRecvDirect: 60,
        nRecvErrors: null,
      })

      const signStart = await waitForEvent<Record<string, unknown>>(
        connection,
        Constants.ResponseCodes.SignStart,
        () => {
          connection.dispatch(makeSignStartFrame(512))
        },
      )
      expect(signStart).toEqual({ reserved: 0, maxSignDataLen: 512 })

      const signature = await waitForEvent<Record<string, unknown>>(
        connection,
        Constants.ResponseCodes.Signature,
        () => {
          connection.dispatch(makeSignatureFrame())
        },
      )
      expect(signature).toEqual({ signature: sequence(64, 0x90) })

      const advertPath = await waitForEvent<Record<string, unknown>>(
        connection,
        Constants.ResponseCodes.AdvertPath,
        () => {
          connection.dispatch(makeAdvertPathFrame(4_321, 2, Uint8Array.of(0xaa, 0xbb)))
        },
      )
      expect(advertPath).toEqual({
        recvTimestamp: 4_321,
        pathLen: 2,
        pathHashSize: 1,
        pathHashCount: 2,
        path: Uint8Array.of(0xaa, 0xbb),
      })
    })

    it('parses push frames for topology, acks, raw data and manual adverts', async () => {
      const advert = await waitForEvent<Record<string, unknown>>(
        connection,
        Constants.PushCodes.Advert,
        () => {
          connection.dispatch(frame(Constants.PushCodes.Advert, sequence(32, 0x11)))
        },
      )
      expect(advert).toEqual({ publicKey: sequence(32, 0x11) })

      const pathUpdated = await waitForEvent<Record<string, unknown>>(
        connection,
        Constants.PushCodes.PathUpdated,
        () => {
          connection.dispatch(frame(Constants.PushCodes.PathUpdated, sequence(32, 0x22)))
        },
      )
      expect(pathUpdated).toEqual({ publicKey: sequence(32, 0x22) })

      const sendConfirmed = await waitForEvent<Record<string, unknown>>(
        connection,
        Constants.PushCodes.SendConfirmed,
        () => {
          connection.dispatch(
            frame(Constants.PushCodes.SendConfirmed, uint32LE(0x01020304), uint32LE(88)),
          )
        },
      )
      expect(sendConfirmed).toEqual({ ackCode: 0x01020304, roundTrip: 88 })

      const msgWaiting = await waitForEvent<Record<string, unknown>>(
        connection,
        Constants.PushCodes.MsgWaiting,
        () => {
          connection.dispatch(frame(Constants.PushCodes.MsgWaiting))
        },
      )
      expect(msgWaiting).toEqual({})

      const rawData = await waitForEvent<Record<string, unknown>>(
        connection,
        Constants.PushCodes.RawData,
        () => {
          connection.dispatch(
            frame(Constants.PushCodes.RawData, byte(12), byte(-80), byte(0x7f), Uint8Array.of(1, 2, 3)),
          )
        },
      )
      expect(rawData).toEqual({
        lastSnr: 3,
        lastRssi: -80,
        reserved: 0x7f,
        payload: Uint8Array.of(1, 2, 3),
      })

      const newAdvert = await waitForEvent<Record<string, unknown>>(
        connection,
        Constants.PushCodes.NewAdvert,
        () => {
          connection.dispatch(makeContactFrame(Constants.PushCodes.NewAdvert, 'Manual', 0x44))
        },
      )
      expect(newAdvert.advName).toBe('Manual')
      expect(newAdvert.publicKey).toEqual(sequence(32, 0x44))
    })

    it('logs unexpected channel info lengths and unhandled frame codes', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      connection.dispatch(frame(Constants.ResponseCodes.ChannelInfo, byte(2), cString('bad', 32), Uint8Array.of(0xaa)))
      connection.dispatch(Uint8Array.of(0xfe, 0x01))

      expect(logSpy).toHaveBeenNthCalledWith(1, 'ChannelInfo has unexpected key length: 1')
      expect(logSpy).toHaveBeenNthCalledWith(2, 'unhandled frame: code=254', Uint8Array.of(0xfe, 0x01))
    })

    it('parses empty contact names, err frames without codes and unknown stats payloads', async () => {
      const emptyNameContact = await waitForEvent<Record<string, unknown>>(
        connection,
        Constants.ResponseCodes.Contact,
        () => {
          connection.dispatch(
            frame(
              Constants.ResponseCodes.Contact,
              sequence(32, 0x10),
              byte(Constants.AdvType.Chat),
              byte(0),
              byte(0),
              sequence(64, 0x40),
              utf8('X'.repeat(32)),
              uint32LE(10),
              int32LE(1),
              int32LE(2),
              uint32LE(3),
            ),
          )
        },
      )
      expect(emptyNameContact.advName).toBe('')

      const errWithoutCode = await waitForEvent<Record<string, unknown>>(
        connection,
        Constants.ResponseCodes.Err,
        () => {
          connection.dispatch(frame(Constants.ResponseCodes.Err))
        },
      )
      expect(errWithoutCode).toEqual({ errCode: null })

      const unknownStats = await waitForEvent<Record<string, unknown>>(
        connection,
        Constants.ResponseCodes.Stats,
        () => {
          connection.dispatch(makeStatsFrame(99, Uint8Array.of(1, 2, 3)))
        },
      )
      expect(unknownStats).toEqual({
        type: 99,
        raw: Uint8Array.of(1, 2, 3),
        data: {},
      })
    })
  })

  describe('request helpers', () => {
    it('only schedules deferred handlers once even if invoked repeatedly', async () => {
      vi.useFakeTimers()

      const deferred = vi.fn()
      const wrapped = (connection as unknown as {
        onDeferredOnce: (event: number | string, handler: (...data: unknown[]) => void) => (...data: unknown[]) => void
      }).onDeferredOnce('custom', deferred)

      wrapped('first')
      wrapped('second')

      await vi.advanceTimersByTimeAsync(0)

      expect(deferred).toHaveBeenCalledTimes(1)
      expect(deferred).toHaveBeenCalledWith('first')
    })

    it('getSelfInfo resolves from a self-info frame and times out when nothing arrives', async () => {
      const sendAppStartSpy = vi.spyOn(connection, 'sendCommandAppStart').mockResolvedValue(undefined)

      const selfInfoPromise = connection.getSelfInfo()
      expect(sendAppStartSpy).toHaveBeenCalledTimes(1)
      connection.dispatch(makeSelfInfoFrame('Awaited Node'))

      const selfInfo = await selfInfoPromise
      expect(selfInfo.name).toBe('Awaited Node')

      vi.useFakeTimers()
      const timeoutConnection = new TestConnection()
      vi.spyOn(timeoutConnection, 'sendCommandAppStart').mockResolvedValue(undefined)

      const timeoutPromise = timeoutConnection.getSelfInfo(25)
      const timeoutExpectation = expect(timeoutPromise).rejects.toBeUndefined()
      await vi.advanceTimersByTimeAsync(25)

      await timeoutExpectation
    })

    it('rejects when command senders fail before a response arrives', async () => {
      const selfInfoError = new Error('self-info failed')
      vi.spyOn(connection, 'sendCommandAppStart').mockRejectedValueOnce(selfInfoError)
      await expect(connection.getSelfInfo()).rejects.toBe(selfInfoError)

      const contactsError = new Error('contacts failed')
      vi.spyOn(connection, 'sendCommandGetContacts').mockRejectedValueOnce(contactsError)
      await expect(connection.getContacts()).rejects.toBe(contactsError)

      const syncError = new Error('sync failed')
      vi.spyOn(connection, 'sendCommandSyncNextMessage').mockRejectedValueOnce(syncError)
      await expect(connection.syncNextMessage()).rejects.toBe(syncError)

      const loginError = new Error('login send failed')
      vi.spyOn(connection, 'sendCommandSendLogin').mockRejectedValueOnce(loginError)
      await expect(connection.login(sequence(32, 0x60), 'secret', 20)).rejects.toBe(loginError)

      const rebootError = new Error('reboot failed')
      vi.spyOn(connection, 'sendCommandReboot').mockRejectedValueOnce(rebootError)
      await expect(connection.reboot()).rejects.toBe(rebootError)

      const signError = new Error('sign start failed')
      vi.spyOn(connection, 'sendCommandSignStart').mockRejectedValueOnce(signError)
      await expect(connection.sign(Uint8Array.of(1, 2, 3))).rejects.toBe(signError)

      const pingError = new Error('ping send failed')
      vi.spyOn(connection, 'sendCommandSendRawData').mockRejectedValueOnce(pingError)
      await expect(connection.pingRepeaterZeroHop(sequence(32, 0xa0), 10)).rejects.toBe(pingError)
    })

    it('sendAdvert resolves on ok, rejects on err, and wrapper methods delegate correctly', async () => {
      const sendSelfAdvertSpy = vi
        .spyOn(connection, 'sendCommandSendSelfAdvert')
        .mockResolvedValue(undefined)

      const successPromise = connection.sendAdvert(Constants.SelfAdvertTypes.Flood)
      expect(sendSelfAdvertSpy).toHaveBeenCalledWith(Constants.SelfAdvertTypes.Flood)
      connection.dispatch(frame(Constants.ResponseCodes.Ok))
      await successPromise

      const failurePromise = connection.sendAdvert(Constants.SelfAdvertTypes.ZeroHop)
      connection.dispatch(frame(Constants.ResponseCodes.Err, byte(Constants.ErrorCodes.IllegalArg)))
      await expect(failurePromise).rejects.toBeUndefined()

      const sendAdvertSpy = vi.spyOn(connection, 'sendAdvert').mockResolvedValue(undefined)
      await connection.sendFloodAdvert()
      await connection.sendZeroHopAdvert()
      expect(sendAdvertSpy).toHaveBeenNthCalledWith(1, Constants.SelfAdvertTypes.Flood)
      expect(sendAdvertSpy).toHaveBeenNthCalledWith(2, Constants.SelfAdvertTypes.ZeroHop)
    })

    it('configuration helpers delegate to command senders and resolve on ok frames', async () => {
      const advertNameSpy = vi.spyOn(connection, 'sendCommandSetAdvertName').mockResolvedValue(undefined)
      const advertLatLonSpy = vi
        .spyOn(connection, 'sendCommandSetAdvertLatLon')
        .mockResolvedValue(undefined)
      const txPowerSpy = vi.spyOn(connection, 'sendCommandSetTxPower').mockResolvedValue(undefined)
      const radioParamsSpy = vi
        .spyOn(connection, 'sendCommandSetRadioParams')
        .mockResolvedValue(undefined)
      const deviceTimeSpy = vi.spyOn(connection, 'sendCommandSetDeviceTime').mockResolvedValue(undefined)
      const floodScopeSpy = vi
        .spyOn(connection, 'sendCommandSetFloodScope')
        .mockResolvedValue(undefined)
      const otherParamsSpy = vi
        .spyOn(connection, 'sendCommandSetOtherParams')
        .mockResolvedValue(undefined)

      await resolveWithOk(connection, () => connection.setAdvertName('MeshNode'))
      expect(advertNameSpy).toHaveBeenCalledWith('MeshNode')

      await resolveWithOk(connection, () => connection.setAdvertLatLong(12, 34))
      expect(advertLatLonSpy).toHaveBeenCalledWith(12, 34)

      await resolveWithOk(connection, () => connection.setTxPower(17))
      expect(txPowerSpy).toHaveBeenCalledWith(17)

      await resolveWithOk(connection, () => connection.setRadioParams(915_000, 125_000, 7, 5))
      expect(radioParamsSpy).toHaveBeenCalledWith(915_000, 125_000, 7, 5)

      await resolveWithOk(connection, () => connection.setDeviceTime(1_234))
      expect(deviceTimeSpy).toHaveBeenCalledWith(1_234)

      const scope = sequence(16, 0xc0)
      await resolveWithOk(connection, () => connection.setFloodScope(scope))
      expect(floodScopeSpy).toHaveBeenCalledWith(scope)

      await resolveWithOk(connection, () => connection.setOtherParams(true))
      expect(otherParamsSpy).toHaveBeenCalledWith(true)
    })

    it('contact and channel update helpers delegate correctly and setContactPath updates the contact', async () => {
      const importContactSpy = vi.spyOn(connection, 'sendCommandImportContact').mockResolvedValue(undefined)
      const shareContactSpy = vi.spyOn(connection, 'sendCommandShareContact').mockResolvedValue(undefined)
      const removeContactSpy = vi.spyOn(connection, 'sendCommandRemoveContact').mockResolvedValue(undefined)
      const addUpdateSpy = vi
        .spyOn(connection, 'sendCommandAddUpdateContact')
        .mockResolvedValue(undefined)
      const resetPathSpy = vi.spyOn(connection, 'sendCommandResetPath').mockResolvedValue(undefined)
      const channelDataSpy = vi
        .spyOn(connection, 'sendCommandSendChannelData')
        .mockResolvedValue(undefined)
      const setChannelSpy = vi.spyOn(connection, 'sendCommandSetChannel').mockResolvedValue(undefined)

      const publicKey = sequence(32, 0x20)
      const outPath = sequence(64, 0x50)
      const advertPacketBytes = Uint8Array.of(1, 2, 3, 4)

      await resolveWithOk(connection, () => connection.importContact(advertPacketBytes))
      expect(importContactSpy).toHaveBeenCalledWith(advertPacketBytes)

      await resolveWithOk(connection, () => connection.shareContact(publicKey))
      expect(shareContactSpy).toHaveBeenCalledWith(publicKey)

      await resolveWithOk(connection, () => connection.removeContact(publicKey))
      expect(removeContactSpy).toHaveBeenCalledWith(publicKey)

      await resolveWithOk(connection, () =>
        connection.addOrUpdateContact(publicKey, 1, 2, 3, outPath, 'Alpha', 99, 100, 200),
      )
      expect(addUpdateSpy).toHaveBeenCalledWith(publicKey, 1, 2, 3, outPath, 'Alpha', 99, 100, 200)

      await resolveWithOk(connection, () => connection.resetPath(publicKey))
      expect(resetPathSpy).toHaveBeenCalledWith(publicKey)

      await resolveWithOk(connection, () =>
        connection.sendChannelData(2, 1, Uint8Array.of(0xaa), Constants.DataTypes.Dev, Uint8Array.of(9, 8, 7)),
      )
      expect(channelDataSpy).toHaveBeenCalledWith(
        2,
        1,
        Uint8Array.of(0xaa),
        Constants.DataTypes.Dev,
        Uint8Array.of(9, 8, 7),
      )

      await resolveWithOk(connection, () => connection.setChannel(2, 'mesh', sequence(16, 0x70)))
      expect(setChannelSpy).toHaveBeenCalledWith(2, 'mesh', sequence(16, 0x70))

      const contact = makeContactRecord('Route target', 0x41)
      const setContactPathSpy = vi.spyOn(connection, 'addOrUpdateContact').mockResolvedValue(undefined)
      await connection.setContactPath(contact, Uint8Array.of(0x01, 0x02, 0x03))

      expect(contact.outPathLen).toBe(3)
      expect(contact.outPath.slice(0, 3)).toEqual(Uint8Array.of(0x01, 0x02, 0x03))
      expect(setContactPathSpy).toHaveBeenCalledWith(
        contact.publicKey,
        contact.type,
        contact.flags,
        3,
        contact.outPath,
        contact.advName,
        contact.lastAdvert,
        contact.advLat,
        contact.advLon,
      )
    })

    it('rejects setContactPath when the contact update fails', async () => {
      const contact = makeContactRecord('Broken route', 0x52)
      const updateError = new Error('update failed')
      vi.spyOn(connection, 'addOrUpdateContact').mockRejectedValueOnce(updateError)

      await expect(connection.setContactPath(contact, Uint8Array.of(0x01, 0x02))).rejects.toBe(updateError)
    })

    it('collects contacts and resolves contact finder helpers', async () => {
      const getContactsSpy = vi.spyOn(connection, 'sendCommandGetContacts').mockResolvedValue(undefined)
      const contactsPromise = connection.getContacts()

      expect(getContactsSpy).toHaveBeenCalledTimes(1)
      connection.dispatch(makeContactFrame(Constants.ResponseCodes.Contact, 'Alpha', 0x10))
      connection.dispatch(makeContactFrame(Constants.ResponseCodes.Contact, 'Beta', 0x20))
      connection.dispatch(frame(Constants.ResponseCodes.EndOfContacts, uint32LE(999)))

      const contacts = await contactsPromise
      expect(contacts).toHaveLength(2)
      expect(contacts.map((contact) => contact.advName)).toEqual(['Alpha', 'Beta'])

      const alpha = makeContactRecord('Alpha', 0x10)
      const beta = makeContactRecord('Beta', 0x20)
      vi.spyOn(connection, 'getContacts').mockResolvedValue([alpha, beta])

      await expect(connection.findContactByName('Beta')).resolves.toBe(beta)
      await expect(connection.findContactByPublicKeyPrefix(beta.publicKey.subarray(0, 6))).resolves.toBe(beta)
    })

    it('sends text messages, channel messages, parses synced messages and drains waiting messages', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-01T00:00:05Z'))

      const sendTextSpy = vi.spyOn(connection, 'sendCommandSendTxtMsg').mockResolvedValue(undefined)
      const sendChannelSpy = vi
        .spyOn(connection, 'sendCommandSendChannelTxtMsg')
        .mockResolvedValue(undefined)
      const syncSpy = vi.spyOn(connection, 'sendCommandSyncNextMessage').mockResolvedValue(undefined)

      const contactPublicKey = sequence(32, 0x80)
      const senderTimestamp = Math.floor(Date.now() / 1_000)
      const sendTextPromise = connection.sendTextMessage(contactPublicKey, 'hello')
      expect(sendTextSpy).toHaveBeenCalledWith(
        Constants.TxtTypes.Plain,
        0,
        senderTimestamp,
        contactPublicKey,
        'hello',
      )
      connection.dispatch(makeSentFrame(0xabcdef01, 75))
      await flushOnceEventTimers()
      await expect(sendTextPromise).resolves.toEqual({
        result: 1,
        expectedAckCrc: 0xabcdef01,
        estTimeout: 75,
      })

      const sendChannelPromise = connection.sendChannelTextMessage(2, 'broadcast')
      expect(sendChannelSpy).toHaveBeenCalledWith(
        Constants.TxtTypes.Plain,
        2,
        senderTimestamp,
        'broadcast',
      )
      connection.dispatch(frame(Constants.ResponseCodes.Ok))
      await flushOnceEventTimers()
      await sendChannelPromise

      const contactMessagePromise = connection.syncNextMessage()
      expect(syncSpy).toHaveBeenCalledTimes(1)
      connection.dispatch(makeContactMessageFrame('hello'))
      await flushOnceEventTimers()
      await expect(contactMessagePromise).resolves.toEqual({
        contactMessage: {
          pubKeyPrefix: sequence(6, 0xa0),
          pathLen: 2,
          txtType: Constants.TxtTypes.Plain,
          senderTimestamp: 1_111,
          text: 'hello',
        },
      })

      const channelMessagePromise = connection.syncNextMessage()
      connection.dispatch(makeChannelMessageFrame('broadcast'))
      await flushOnceEventTimers()
      await expect(channelMessagePromise).resolves.toEqual({
        channelMessage: {
          channelIdx: 3,
          pathLen: 255,
          txtType: Constants.TxtTypes.Plain,
          senderTimestamp: 2_222,
          text: 'broadcast',
        },
      })

      const channelDataPromise = connection.syncNextMessage()
      connection.dispatch(makeChannelDataFrame())
      await flushOnceEventTimers()
      await expect(channelDataPromise).resolves.toEqual({
        channelData: {
          snr: 2,
          reserved1: 1,
          reserved2: 2,
          channelIdx: 3,
          pathLen: 255,
          dataType: Constants.DataTypes.Dev,
          dataLen: 3,
          data: Uint8Array.of(0xaa, 0xbb, 0xcc),
        },
      })

      const noMessagePromise = connection.syncNextMessage()
      connection.dispatch(frame(Constants.ResponseCodes.NoMoreMessages))
  await flushOnceEventTimers()
      await expect(noMessagePromise).resolves.toBeNull()

      vi.spyOn(connection, 'syncNextMessage')
        .mockResolvedValueOnce({ contactMessage: { text: 'first' } } as never)
        .mockResolvedValueOnce({ channelMessage: { text: 'second' } } as never)
        .mockResolvedValueOnce(null)
      await expect(connection.getWaitingMessages()).resolves.toEqual([
        { contactMessage: { text: 'first' } },
        { channelMessage: { text: 'second' } },
      ])
    })

    it('rejects sent-then-push requests on early err responses and still works with default extra timeout', async () => {
      vi.useFakeTimers()

      const publicKey = sequence(32, 0x61)
      vi.spyOn(connection, 'sendCommandSendLogin').mockResolvedValue(undefined)

      const rejectedLogin = connection.login(publicKey, 'secret', 20)
      const rejectedLoginExpectation = rejectedLogin.then(
        () => {
          throw new Error('expected login rejection')
        },
        (reason) => {
          expect(reason).toBeUndefined()
        },
      )
      connection.dispatch(frame(Constants.ResponseCodes.Err))
      await flushOnceEventTimers()
      await rejectedLoginExpectation

      const successfulLogin = connection.login(publicKey, 'secret')
      connection.dispatch(makeSentFrame(0, 40))
      await flushOnceEventTimers()
      connection.dispatch(makeLoginSuccessFrame(publicKey.subarray(0, 6)))
      await flushOnEventTimer()

      await expect(successfulLogin).resolves.toEqual({
        reserved: 0,
        pubKeyPrefix: publicKey.subarray(0, 6),
      })
    })

    it('reboots after a delay and resolves device query style helpers from parsed frames', async () => {
      vi.useFakeTimers()

      const rebootSpy = vi.spyOn(connection, 'sendCommandReboot').mockResolvedValue(undefined)
      const rebootPromise = connection.reboot()
      expect(rebootSpy).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1_000)
      await expect(rebootPromise).resolves.toBeUndefined()

      vi.useRealTimers()

      const getTimeSpy = vi.spyOn(connection, 'sendCommandGetDeviceTime').mockResolvedValue(undefined)
      const getBatterySpy = vi
        .spyOn(connection, 'sendCommandGetBatteryVoltage')
        .mockResolvedValue(undefined)
      const exportContactSpy = vi
        .spyOn(connection, 'sendCommandExportContact')
        .mockResolvedValue(undefined)
      const getAdvertPathSpy = vi
        .spyOn(connection, 'sendCommandGetAdvertPath')
        .mockResolvedValue(undefined)
      const deviceQuerySpy = vi.spyOn(connection, 'sendCommandDeviceQuery').mockResolvedValue(undefined)
      const exportPrivateKeySpy = vi
        .spyOn(connection, 'sendCommandExportPrivateKey')
        .mockResolvedValue(undefined)

      const currTimePromise = connection.getDeviceTime()
      expect(getTimeSpy).toHaveBeenCalledTimes(1)
      connection.dispatch(makeCurrTimeFrame(4_321))
      await expect(currTimePromise).resolves.toEqual({ epochSecs: 4_321 })

      const batteryPromise = connection.getBatteryVoltage()
      expect(getBatterySpy).toHaveBeenCalledTimes(1)
      connection.dispatch(makeBatteryVoltageFrame(3_450))
      await expect(batteryPromise).resolves.toEqual({ batteryMilliVolts: 3_450 })

      const publicKey = sequence(32, 0x21)
      const exportPromise = connection.exportContact(publicKey)
      expect(exportContactSpy).toHaveBeenCalledWith(publicKey)
      connection.dispatch(frame(Constants.ResponseCodes.ExportContact, Uint8Array.of(9, 8, 7)))
      await expect(exportPromise).resolves.toEqual({ advertPacketBytes: Uint8Array.of(9, 8, 7) })

      const advertPathPromise = connection.getAdvertPath(publicKey, 50)
      expect(getAdvertPathSpy).toHaveBeenCalledWith(publicKey)
      connection.dispatch(makeAdvertPathFrame(9_876, 2, Uint8Array.of(0xaa, 0xbb)))
      await expect(advertPathPromise).resolves.toEqual({
        recvTimestamp: 9_876,
        pathLen: 2,
        pathHashSize: 1,
        pathHashCount: 2,
        path: Uint8Array.of(0xaa, 0xbb),
      })

      const deviceInfoPromise = connection.deviceQuery(7)
      expect(deviceQuerySpy).toHaveBeenCalledWith(7)
      connection.dispatch(makeDeviceInfoFrame())
      await expect(deviceInfoPromise).resolves.toEqual({
        firmwareVer: 2,
        reserved: sequence(6, 0x20),
        firmware_build_date: '19 Feb 2025',
        manufacturerModel: 'MeshTrace DevKit',
      })

      const privateKeyPromise = connection.exportPrivateKey()
      expect(exportPrivateKeySpy).toHaveBeenCalledTimes(1)
      connection.dispatch(frame(Constants.ResponseCodes.PrivateKey, sequence(64, 0x44)))
      await expect(privateKeyPromise).resolves.toEqual({ privateKey: sequence(64, 0x44) })
    })

    it('rejects reboot when the device answers with err before the delay elapses', async () => {
      vi.useFakeTimers()
      vi.spyOn(connection, 'sendCommandReboot').mockResolvedValue(undefined)

      const rebootPromise = connection.reboot()
      const rebootExpectation = expect(rebootPromise).rejects.toBeUndefined()
      connection.dispatch(frame(Constants.ResponseCodes.Err))
      await vi.advanceTimersByTimeAsync(0)

      await rebootExpectation
    })

    it('rejects key import and export when the device responds with disabled', async () => {
      const exportPrivateKeySpy = vi
        .spyOn(connection, 'sendCommandExportPrivateKey')
        .mockResolvedValue(undefined)
      const importPrivateKeySpy = vi
        .spyOn(connection, 'sendCommandImportPrivateKey')
        .mockResolvedValue(undefined)

      const exportPromise = connection.exportPrivateKey()
      expect(exportPrivateKeySpy).toHaveBeenCalledTimes(1)
      connection.dispatch(frame(Constants.ResponseCodes.Disabled))
      await expect(exportPromise).rejects.toBe('disabled')

      const privateKey = sequence(64, 0x55)
      const importPromise = connection.importPrivateKey(privateKey)
      expect(importPrivateKeySpy).toHaveBeenCalledWith(privateKey)
      connection.dispatch(frame(Constants.ResponseCodes.Disabled))
      await expect(importPromise).rejects.toBe('disabled')
    })

    it('ignores mismatched login responses and rejects on timeout', async () => {
      vi.useFakeTimers()

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const publicKey = sequence(32, 0x60)
      const expectedPrefix = publicKey.subarray(0, 6)
      const sendLoginSpy = vi.spyOn(connection, 'sendCommandSendLogin').mockResolvedValue(undefined)

      const loginPromise = connection.login(publicKey, 'secret', 20)
      expect(sendLoginSpy).toHaveBeenCalledWith(publicKey, 'secret')
      connection.dispatch(makeSentFrame(0, 40))
      await flushOnceEventTimers()
      connection.dispatch(makeLoginSuccessFrame(sequence(6, 0x01)))
      await flushOnEventTimer()
      connection.dispatch(makeLoginSuccessFrame(expectedPrefix))
      await flushOnEventTimer()

      const login = await loginPromise
      expect(login.pubKeyPrefix).toEqual(expectedPrefix)
      expect(logSpy).toHaveBeenCalledWith('onLoginSuccess is not for this login request, ignoring...')

      const timeoutConnection = new TestConnection()
      vi.spyOn(timeoutConnection, 'sendCommandSendLogin').mockResolvedValue(undefined)

      const timeoutPromise = timeoutConnection.login(publicKey, 'secret', 10)
      const timeoutExpectation = expect(timeoutPromise).rejects.toBe('timeout')
      timeoutConnection.dispatch(makeSentFrame(0, 30))
      await flushOnceEventTimers()
      await vi.advanceTimersByTimeAsync(40)
      await timeoutExpectation
    })

    it('ignores mismatched status responses and parses repeater stats', async () => {
      vi.useFakeTimers()

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const publicKey = sequence(32, 0x70)
      const expectedPrefix = publicKey.subarray(0, 6)
      const sendStatusSpy = vi.spyOn(connection, 'sendCommandSendStatusReq').mockResolvedValue(undefined)

      const statusPromise = connection.getStatus(publicKey, 20)
      expect(sendStatusSpy).toHaveBeenCalledWith(publicKey)
      connection.dispatch(makeSentFrame(0, 40))
      await vi.advanceTimersByTimeAsync(0)
      connection.dispatch(makeStatusResponseFrame(sequence(6, 0x01), makeStatusData()))
      await vi.advanceTimersByTimeAsync(0)
      connection.dispatch(makeStatusResponseFrame(expectedPrefix, makeStatusData()))
      await vi.advanceTimersByTimeAsync(0)

      await expect(statusPromise).resolves.toEqual({
        batt_milli_volts: 3_300,
        curr_tx_queue_len: 4,
        noise_floor: -120,
        last_rssi: -80,
        n_packets_recv: 100,
        n_packets_sent: 50,
        total_air_time_secs: 10,
        total_up_time_secs: 20,
        n_sent_flood: 5,
        n_sent_direct: 6,
        n_recv_flood: 7,
        n_recv_direct: 8,
        err_events: 9,
        last_snr: 12,
        n_direct_dups: 13,
        n_flood_dups: 14,
      })
      expect(logSpy).toHaveBeenCalledWith('onStatusResponsePush is not for this status request, ignoring...')
    })

    it('ignores mismatched telemetry responses and resolves the matching payload', async () => {
      vi.useFakeTimers()

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const publicKey = sequence(32, 0x80)
      const expectedPrefix = publicKey.subarray(0, 6)
      const telemetryData = Uint8Array.of(9, 8, 7)
      const sendTelemetrySpy = vi
        .spyOn(connection, 'sendCommandSendTelemetryReq')
        .mockResolvedValue(undefined)

      const telemetryPromise = connection.getTelemetry(publicKey, 20)
      expect(sendTelemetrySpy).toHaveBeenCalledWith(publicKey)
      connection.dispatch(makeSentFrame(0, 40))
      await vi.advanceTimersByTimeAsync(0)
      connection.dispatch(makeTelemetryResponseFrame(sequence(6, 0x01), Uint8Array.of(1)))
      await vi.advanceTimersByTimeAsync(0)
      connection.dispatch(makeTelemetryResponseFrame(expectedPrefix, telemetryData))
      await vi.advanceTimersByTimeAsync(0)

      const telemetry = await telemetryPromise
      expect(telemetry.pubKeyPrefix).toEqual(expectedPrefix)
      expect(telemetry.lppSensorData).toEqual(telemetryData)
      expect(logSpy).toHaveBeenCalledWith(
        'onTelemetryResponsePush is not for this telemetry request, ignoring...',
      )
    })

    it('ignores mismatched binary responses and only resolves the matching tag', async () => {
      vi.useFakeTimers()

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const publicKey = sequence(32, 0x90)
      const requestBytes = Uint8Array.of(0xde, 0xad)
      const responseBytes = Uint8Array.of(0xaa, 0xbb)
      const sendBinarySpy = vi
        .spyOn(connection, 'sendCommandSendBinaryReq')
        .mockResolvedValue(undefined)

      const binaryPromise = connection.sendBinaryRequest(publicKey, requestBytes, 20)
      expect(sendBinarySpy).toHaveBeenCalledWith(publicKey, requestBytes)
      connection.dispatch(makeSentFrame(0x12345678, 40))
      await flushOnceEventTimers()
      connection.dispatch(makeBinaryResponseFrame(0x87654321, Uint8Array.of(1)))
      await flushOnEventTimer()
      connection.dispatch(makeBinaryResponseFrame(0x12345678, responseBytes))
      await flushOnEventTimer()

      await expect(binaryPromise).resolves.toEqual(responseBytes)
      expect(logSpy).toHaveBeenCalledWith('onBinaryResponse is not for this request tag, ignoring...')
    })

    it('ignores binary pushes before sent assigns a tag and resolves once a matching response arrives', async () => {
      vi.useFakeTimers()

      const publicKey = sequence(32, 0x91)
      const requestBytes = Uint8Array.of(0xbe, 0xef)
      vi.spyOn(connection, 'sendCommandSendBinaryReq').mockResolvedValue(undefined)

      const binaryPromise = connection.sendBinaryRequest(publicKey, requestBytes, 20)
      connection.dispatch(makeBinaryResponseFrame(0x01020304, Uint8Array.of(1)))
      await flushOnEventTimer()
      connection.dispatch(makeSentFrame(0xabcdef01, 40))
      await flushOnceEventTimers()
      connection.dispatch(makeBinaryResponseFrame(0xabcdef01, Uint8Array.of(9, 8, 7)))
      await flushOnEventTimer()

      await expect(binaryPromise).resolves.toEqual(Uint8Array.of(9, 8, 7))
    })

    it('ignores other stats types and wrapper methods delegate to getStats', async () => {
      const sendStatsSpy = vi.spyOn(connection, 'sendCommandGetStats').mockResolvedValue(undefined)

      const statsPromise = connection.getStats(Constants.StatsTypes.Radio)
      expect(sendStatsSpy).toHaveBeenCalledWith(Constants.StatsTypes.Radio)
      connection.dispatch(makeCoreStatsFrame())
      connection.dispatch(makeRadioStatsFrame())

      await expect(statsPromise).resolves.toEqual({
        type: Constants.StatsTypes.Radio,
        raw: concatBytes(int16LE(-120), byte(-80), byte(8), uint32LE(10), uint32LE(20)),
        data: {
          noiseFloor: -120,
          lastRssi: -80,
          lastSnr: 2,
          txAirSecs: 10,
          rxAirSecs: 20,
        },
      })

      const wrapperConnection = new TestConnection()
      const getStatsSpy = vi.spyOn(wrapperConnection, 'getStats').mockResolvedValue({} as never)

      await wrapperConnection.getStatsCore()
      await wrapperConnection.getStatsRadio()
      await wrapperConnection.getStatsPackets()

      expect(getStatsSpy).toHaveBeenNthCalledWith(1, Constants.StatsTypes.Core)
      expect(getStatsSpy).toHaveBeenNthCalledWith(2, Constants.StatsTypes.Radio)
      expect(getStatsSpy).toHaveBeenNthCalledWith(3, Constants.StatsTypes.Packets)
    })

    it('uses the first public-key byte for zero-hop ping paths and resolves matching raw custom packets', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))

      const publicKey = sequence(32, 0xa0)
      const sendRawDataSpy = vi.spyOn(connection, 'sendCommandSendRawData').mockResolvedValue(undefined)

      const pingPromise = connection.pingRepeaterZeroHop(publicKey, 500)
      expect(sendRawDataSpy).toHaveBeenCalledTimes(1)

      const [path, rawBytes] = sendRawDataSpy.mock.calls[0] as [Uint8Array, Uint8Array]
      expect(path).toEqual(publicKey.subarray(0, 1))

      await vi.advanceTimersByTimeAsync(75)
      connection.dispatch(
        frame(Constants.PushCodes.LogRxData, byte(10), byte(-70), makeRawCustomPacket(rawBytes)),
      )
      await vi.advanceTimersByTimeAsync(0)

      await expect(pingPromise).resolves.toEqual({ rtt: 75, snr: 2.5, rssi: -70 })
    })

    it('ignores unrelated raw packets, rejects on err and times out when no matching ping arrives', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))

      const publicKey = sequence(32, 0xa1)
      const sendRawDataSpy = vi.spyOn(connection, 'sendCommandSendRawData').mockResolvedValue(undefined)

      const pingPromise = connection.pingRepeaterZeroHop(publicKey, 50)
      const [, rawBytes] = sendRawDataSpy.mock.calls[0] as [Uint8Array, Uint8Array]

      connection.dispatch(
        frame(
          Constants.PushCodes.LogRxData,
          byte(10),
          byte(-70),
          makeNonCustomPacket(Uint8Array.of(0x01, 0x02, 0x03)),
        ),
      )
      connection.dispatch(
        frame(
          Constants.PushCodes.LogRxData,
          byte(10),
          byte(-70),
          makeRawCustomPacket(Uint8Array.from(rawBytes, (value) => value ^ 0xff)),
        ),
      )
      const pingExpectation = pingPromise.then(
        () => {
          throw new Error('expected ping rejection')
        },
        (reason) => {
          expect(reason).toBeUndefined()
        },
      )
      connection.dispatch(frame(Constants.ResponseCodes.Err))
      await vi.advanceTimersByTimeAsync(0)
      await pingExpectation

      const timeoutPromise = connection.pingRepeaterZeroHop(publicKey, 25)
      const timeoutExpectation = expect(timeoutPromise).rejects.toBe('timeout')
      await vi.advanceTimersByTimeAsync(25)
      await timeoutExpectation
    })

    it('resolves ping requests without a timeout when the matching custom packet arrives', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))

      const publicKey = sequence(32, 0xa2)
      const sendRawDataSpy = vi.spyOn(connection, 'sendCommandSendRawData').mockResolvedValue(undefined)

      const pingPromise = connection.pingRepeaterZeroHop(publicKey)
      const [, rawBytes] = sendRawDataSpy.mock.calls[0] as [Uint8Array, Uint8Array]

      await vi.advanceTimersByTimeAsync(30)
      connection.dispatch(
        frame(Constants.PushCodes.LogRxData, byte(8), byte(-65), makeRawCustomPacket(rawBytes)),
      )
      await vi.advanceTimersByTimeAsync(0)

      await expect(pingPromise).resolves.toEqual({ rtt: 30, snr: 2, rssi: -65 })
    })

    it('gets channels, iterates channel lists and resolves channel finder helpers', async () => {
      const getChannelCommandSpy = vi
        .spyOn(connection, 'sendCommandGetChannel')
        .mockResolvedValue(undefined)

      const channelPromise = connection.getChannel(2)
      expect(getChannelCommandSpy).toHaveBeenCalledWith(2)
      connection.dispatch(makeChannelInfoFrame(2, 'mesh', sequence(16, 0x70)))
      await expect(channelPromise).resolves.toEqual({
        channelIdx: 2,
        name: 'mesh',
        secret: sequence(16, 0x70),
      })

      vi.spyOn(connection, 'getChannel')
        .mockResolvedValueOnce(makeChannelRecord('alpha', 0x10) as never)
        .mockResolvedValueOnce(makeChannelRecord('beta', 0x20) as never)
        .mockRejectedValueOnce(new Error('done'))

      await expect(connection.getChannels()).resolves.toEqual([
        makeChannelRecord('alpha', 0x10),
        makeChannelRecord('beta', 0x20),
      ])

      const alpha = makeChannelRecord('alpha', 0x10)
      const beta = makeChannelRecord('beta', 0x20)
      vi.spyOn(connection, 'getChannels').mockResolvedValue([alpha, beta])

      await expect(connection.findChannelByName('beta')).resolves.toBe(beta)
      await expect(connection.findChannelBySecret(beta.secret)).resolves.toBe(beta)
    })

    it('delegates convenience wrappers for syncing time, clearing scope, deleting channels and contact mode', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-01-01T00:01:40Z'))

      const setDeviceTimeSpy = vi.spyOn(connection, 'setDeviceTime').mockResolvedValue({})
      const setFloodScopeSpy = vi.spyOn(connection, 'setFloodScope').mockResolvedValue({})
      const setChannelSpy = vi.spyOn(connection, 'setChannel').mockResolvedValue(undefined)
      const setOtherParamsSpy = vi.spyOn(connection, 'setOtherParams').mockResolvedValue(undefined)

      await connection.syncDeviceTime()
      await connection.clearFloodScope()
      await connection.deleteChannel(7)
      await connection.setAutoAddContacts()
      await connection.setManualAddContacts()

      expect(setDeviceTimeSpy).toHaveBeenCalledWith(Math.floor(Date.now() / 1_000))
      expect(setFloodScopeSpy).toHaveBeenCalledWith([])
      expect(setChannelSpy).toHaveBeenCalledWith(7, '', new Uint8Array(16))
      expect(setOtherParamsSpy).toHaveBeenNthCalledWith(1, false)
      expect(setOtherParamsSpy).toHaveBeenNthCalledWith(2, true)
    })

    it('streams sign requests in chunks, finishes signing, and rejects oversized input', async () => {
      const signStartSpy = vi.spyOn(connection, 'sendCommandSignStart').mockResolvedValue(undefined)
      const signDataSpy = vi.spyOn(connection, 'sendCommandSignData').mockResolvedValue(undefined)
      const signFinishSpy = vi.spyOn(connection, 'sendCommandSignFinish').mockResolvedValue(undefined)
      const data = sequence(200, 1)
      const signature = sequence(64, 0x90)

      const signPromise = connection.sign(data)
      expect(signStartSpy).toHaveBeenCalledTimes(1)

      connection.dispatch(makeSignStartFrame(256))
      await vi.waitFor(() => {
        expect(signDataSpy).toHaveBeenNthCalledWith(1, data.subarray(0, 128))
      })

      connection.dispatch(frame(Constants.ResponseCodes.Ok))
      await vi.waitFor(() => {
        expect(signDataSpy).toHaveBeenNthCalledWith(2, data.subarray(128))
      })

      connection.dispatch(frame(Constants.ResponseCodes.Ok))
      await vi.waitFor(() => {
        expect(signFinishSpy).toHaveBeenCalledTimes(1)
      })

      connection.dispatch(makeSignatureFrame(signature))
      await expect(signPromise).resolves.toEqual(signature)

      const tooLongConnection = new TestConnection()
      vi.spyOn(tooLongConnection, 'sendCommandSignStart').mockResolvedValue(undefined)
      const tooLongPromise = tooLongConnection.sign(sequence(10, 1))
      tooLongConnection.dispatch(makeSignStartFrame(5))
      await expect(tooLongPromise).rejects.toBe('data_too_long')
    })

    it('rejects signing when the device emits err responses during signing', async () => {
      vi.useFakeTimers()

      vi.spyOn(connection, 'sendCommandSignStart').mockResolvedValue(undefined)
      const signDataSpy = vi.spyOn(connection, 'sendCommandSignData').mockResolvedValue(undefined)

      const signPromise = connection.sign(Uint8Array.of(1, 2, 3))
      const signExpectation = signPromise.then(
        () => {
          throw new Error('expected signing rejection')
        },
        (reason) => {
          expect(reason).toEqual({ errCode: Constants.ErrorCodes.IllegalArg })
        },
      )
      connection.dispatch(makeSignStartFrame(32))
      await vi.advanceTimersByTimeAsync(0)
      expect(signDataSpy).toHaveBeenCalledTimes(1)
      connection.dispatch(frame(Constants.ResponseCodes.Err, byte(Constants.ErrorCodes.IllegalArg)))
      await vi.advanceTimersByTimeAsync(0)

      await signExpectation
    })

    it('ignores trace data for other tags and rejects trace requests on timeout', async () => {
      vi.useFakeTimers()

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      vi.spyOn(RandomUtils, 'getRandomInt').mockReturnValue(0x10203040)
      const path = Uint8Array.of(0xaa, 0xbb)
      const sendTraceSpy = vi.spyOn(connection, 'sendCommandSendTracePath').mockResolvedValue(undefined)

      const tracePromise = connection.tracePath(path, 20)
      expect(sendTraceSpy).toHaveBeenCalledWith(0x10203040, 0, path)
      connection.dispatch(makeSentFrame(0, 40))
      await flushOnceEventTimers()
      connection.dispatch(makeTraceDataFrame(0x40302010))
      await flushOnEventTimer()
      connection.dispatch(makeTraceDataFrame(0x10203040))
      await flushOnEventTimer()

      await expect(tracePromise).resolves.toEqual({
        reserved: 0,
        pathLen: 2,
        flags: 1,
        tag: 0x10203040,
        authCode: 0x55667788,
        pathHashes: Uint8Array.of(0xaa, 0xbb),
        pathSnrs: Uint8Array.of(12, 16),
        lastSnr: 2,
      })
      expect(logSpy).toHaveBeenCalledWith('ignoring trace data for a different trace request')

      const timeoutConnection = new TestConnection()
      vi.spyOn(RandomUtils, 'getRandomInt').mockReturnValue(0x55667788)
      vi.spyOn(timeoutConnection, 'sendCommandSendTracePath').mockResolvedValue(undefined)

      const timeoutPromise = timeoutConnection.tracePath(Uint8Array.of(0xaa), 10)
      const timeoutExpectation = expect(timeoutPromise).rejects.toBe('timeout')
      timeoutConnection.dispatch(makeSentFrame(0, 30))
      await flushOnceEventTimers()
      await vi.advanceTimersByTimeAsync(40)
      await timeoutExpectation
    })

    it('builds neighbour requests and parses the binary neighbour response payload', async () => {
      vi.spyOn(RandomUtils, 'getRandomInt').mockReturnValue(0x11223344)
      const sendBinaryRequestSpy = vi.spyOn(connection, 'sendBinaryRequest').mockResolvedValue(
        concatBytes(
          uint16LE(5),
          uint16LE(2),
          Uint8Array.of(0xaa, 0xbb, 0xcc, 0xdd),
          uint32LE(12),
          byte(8),
          Uint8Array.of(0x11, 0x22, 0x33, 0x44),
          uint32LE(34),
          byte(-4),
        ),
      )
      const publicKey = sequence(32, 0xc0)

      const result = await connection.getNeighbours(publicKey, 2, 5, 3, 4)

      expect(sendBinaryRequestSpy).toHaveBeenCalledTimes(1)
      expect(sendBinaryRequestSpy.mock.calls[0][0]).toEqual(publicKey)

      const requestReader = new BufferReader(sendBinaryRequestSpy.mock.calls[0][1] as Uint8Array)
      expect(requestReader.readByte()).toBe(Constants.BinaryRequestTypes.GetNeighbours)
      expect(requestReader.readByte()).toBe(0)
      expect(requestReader.readByte()).toBe(2)
      expect(requestReader.readUInt16LE()).toBe(5)
      expect(requestReader.readByte()).toBe(3)
      expect(requestReader.readByte()).toBe(4)
      expect(requestReader.readUInt32LE()).toBe(0x11223344)

      expect(result).toEqual({
        totalNeighboursCount: 5,
        neighbours: [
          {
            publicKeyPrefix: Uint8Array.of(0xaa, 0xbb, 0xcc, 0xdd),
            heardSecondsAgo: 12,
            snr: 2,
          },
          {
            publicKeyPrefix: Uint8Array.of(0x11, 0x22, 0x33, 0x44),
            heardSecondsAgo: 34,
            snr: -1,
          },
        ],
      })
    })
  })
})
