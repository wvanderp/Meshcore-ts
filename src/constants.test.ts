import { describe, it, expect } from 'vitest'
import Constants from './constants'

describe('Constants', () => {
  it('has SupportedCompanionProtocolVersion', () => {
    expect(Constants.SupportedCompanionProtocolVersion).toBe(3)
  })

  it('has SerialFrameTypes', () => {
    expect(Constants.SerialFrameTypes.Incoming).toBe(0x3e)
    expect(Constants.SerialFrameTypes.Outgoing).toBe(0x3c)
  })

  it('has Ble UUIDs', () => {
    expect(Constants.Ble.ServiceUuid).toBeTruthy()
    expect(Constants.Ble.CharacteristicUuidRx).toBeTruthy()
    expect(Constants.Ble.CharacteristicUuidTx).toBeTruthy()
  })

  it('has DataTypes', () => {
    expect(Constants.DataTypes.Dev).toBe(0xffff)
  })

  it('has StatsTypes', () => {
    expect(Constants.StatsTypes.Core).toBe(0)
    expect(Constants.StatsTypes.Radio).toBe(1)
    expect(Constants.StatsTypes.Packets).toBe(2)
  })

  it('has CommandCodes', () => {
    expect(Constants.CommandCodes.AppStart).toBe(1)
    expect(Constants.CommandCodes.GetContacts).toBe(4)
    expect(Constants.CommandCodes.SendTracePath).toBe(36)
    expect(Constants.CommandCodes.GetAdvertPath).toBe(42)
    expect(Constants.CommandCodes.SendBinaryReq).toBe(50)
    expect(Constants.CommandCodes.SetFloodScope).toBe(54)
    expect(Constants.CommandCodes.GetStats).toBe(56)
    expect(Constants.CommandCodes.SendChannelData).toBe(62)
  })

  it('has ResponseCodes', () => {
    expect(Constants.ResponseCodes.Ok).toBe(0)
    expect(Constants.ResponseCodes.Err).toBe(1)
    expect(Constants.ResponseCodes.SelfInfo).toBe(5)
    expect(Constants.ResponseCodes.AdvertPath).toBe(22)
    expect(Constants.ResponseCodes.Stats).toBe(24)
    expect(Constants.ResponseCodes.ChannelDataRecv).toBe(27)
  })

  it('has PushCodes', () => {
    expect(Constants.PushCodes.Advert).toBe(0x80)
    expect(Constants.PushCodes.TraceData).toBe(0x89)
    expect(Constants.PushCodes.BinaryResponse).toBe(0x8c)
  })

  it('has ErrorCodes', () => {
    expect(Constants.ErrorCodes.UnsupportedCmd).toBe(1)
    expect(Constants.ErrorCodes.IllegalArg).toBe(6)
  })

  it('has AdvType', () => {
    expect(Constants.AdvType.None).toBe(0)
    expect(Constants.AdvType.Chat).toBe(1)
    expect(Constants.AdvType.Repeater).toBe(2)
    expect(Constants.AdvType.Room).toBe(3)
  })

  it('has SelfAdvertTypes', () => {
    expect(Constants.SelfAdvertTypes.ZeroHop).toBe(0)
    expect(Constants.SelfAdvertTypes.Flood).toBe(1)
  })

  it('has TxtTypes', () => {
    expect(Constants.TxtTypes.Plain).toBe(0)
    expect(Constants.TxtTypes.CliData).toBe(1)
    expect(Constants.TxtTypes.SignedPlain).toBe(2)
  })

  it('has BinaryRequestTypes', () => {
    expect(Constants.BinaryRequestTypes.GetTelemetryData).toBe(0x03)
    expect(Constants.BinaryRequestTypes.GetNeighbours).toBe(0x06)
  })
})
