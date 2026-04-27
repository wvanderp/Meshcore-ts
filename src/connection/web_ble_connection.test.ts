import { afterEach, describe, expect, it, vi } from 'vitest'

import Constants from '../constants'
import WebBleConnection from './web_ble_connection'

type ValueChangedHandler = (event: { target: { value: { buffer: ArrayBuffer } } }) => void
type DisconnectHandler = () => void

function setNavigator(value: unknown): void {
  Object.defineProperty(globalThis, 'navigator', {
    value,
    configurable: true,
  })
}

function setAlert(value: unknown): void {
  Object.defineProperty(globalThis, 'alert', {
    value,
    configurable: true,
  })
}

function createBleFixture() {
  let disconnectHandler: DisconnectHandler | undefined
  let valueChangedHandler: ValueChangedHandler | undefined

  const rxCharacteristic = {
    uuid: Constants.Ble.CharacteristicUuidRx.toLowerCase(),
    writeValue: vi.fn().mockResolvedValue(undefined),
  }
  const txCharacteristic = {
    uuid: Constants.Ble.CharacteristicUuidTx.toLowerCase(),
    startNotifications: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn((event: string, handler: ValueChangedHandler) => {
      if (event === 'characteristicvaluechanged') {
        valueChangedHandler = handler
      }
    }),
  }
  const service = {
    getCharacteristics: vi.fn().mockResolvedValue([rxCharacteristic, txCharacteristic]),
  }
  const gattServer = {
    getPrimaryService: vi.fn().mockResolvedValue(service),
    disconnect: vi.fn(),
  }
  const bleDevice = {
    gatt: {
      connect: vi.fn().mockResolvedValue(gattServer),
    },
    addEventListener: vi.fn((event: string, handler: DisconnectHandler) => {
      if (event === 'gattserverdisconnected') {
        disconnectHandler = handler
      }
    }),
  }

  return {
    bleDevice,
    disconnect: () => disconnectHandler?.(),
    emitValueChanged: (frame: Uint8Array) => {
      valueChangedHandler?.({
        target: {
          value: {
            buffer: frame.buffer.slice(frame.byteOffset, frame.byteOffset + frame.byteLength),
          },
        },
      })
    },
    gattServer,
    rxCharacteristic,
    service,
    txCharacteristic,
  }
}

describe('WebBleConnection', () => {
  const originalNavigator = globalThis.navigator
  const originalAlert = globalThis.alert

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    setNavigator(originalNavigator)
    setAlert(originalAlert)
  })

  it('alerts and returns undefined when Web Bluetooth is unavailable', async () => {
    const alertSpy = vi.fn()

    setNavigator({})
    setAlert(alertSpy)

    await expect(WebBleConnection.open()).resolves.toBeUndefined()
    expect(alertSpy).toHaveBeenCalledWith('Web Bluetooth is not supported in this browser')
  })

  it('returns null when the browser device picker yields no device', async () => {
    const requestDevice = vi.fn().mockResolvedValue(null)

    setNavigator({
      bluetooth: {
        requestDevice,
      },
    })

    await expect(WebBleConnection.open()).resolves.toBeNull()
    expect(requestDevice).toHaveBeenCalledWith({
      filters: [
        {
          services: [Constants.Ble.ServiceUuid.toLowerCase()],
        },
      ],
    })
  })

  it('opens a device, wires notifications, and emits disconnect events', async () => {
    const fixture = createBleFixture()
    const requestDevice = vi.fn().mockResolvedValue(fixture.bleDevice)
    const deviceQuerySpy = vi.spyOn(WebBleConnection.prototype, 'deviceQuery').mockResolvedValue({} as never)

    setNavigator({
      bluetooth: {
        requestDevice,
      },
    })

    const connection = await WebBleConnection.open()
    expect(connection).toBeInstanceOf(WebBleConnection)
    expect(deviceQuerySpy).not.toHaveBeenCalled()

    const connected = vi.fn()
    const disconnected = vi.fn()
    const frameSpy = vi.spyOn(connection!, 'onFrameReceived')

    connection!.on('connected', connected)
    connection!.on('disconnected', disconnected)

    await vi.waitFor(() => {
      expect(fixture.bleDevice.gatt.connect).toHaveBeenCalledTimes(1)
      expect(fixture.gattServer.getPrimaryService).toHaveBeenCalledWith(
        Constants.Ble.ServiceUuid.toLowerCase(),
      )
      expect(fixture.txCharacteristic.startNotifications).toHaveBeenCalledTimes(1)
      expect(connected).toHaveBeenCalledTimes(1)
      expect(deviceQuerySpy).toHaveBeenCalledWith(Constants.SupportedCompanionProtocolVersion)
    })

    fixture.emitValueChanged(Uint8Array.of(0xaa, 0xbb))
    expect(frameSpy).toHaveBeenCalledWith(Uint8Array.of(0xaa, 0xbb))

    fixture.disconnect()
    await vi.waitFor(() => {
      expect(disconnected).toHaveBeenCalledTimes(1)
    })
  })

  it('writes frames, emits tx, and ignores write or disconnect failures during cleanup', async () => {
    vi.useFakeTimers()

    const initSpy = vi.spyOn(WebBleConnection.prototype, 'init').mockResolvedValue(undefined)
    const writeError = new Error('write failed')
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const writeValue = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(writeError)

    const connection = new WebBleConnection({
      addEventListener: vi.fn(),
    } as never)
    const onTx = vi.fn()

    expect(initSpy).toHaveBeenCalledTimes(1)

    connection.rxCharacteristic = {
      writeValue,
    }
    connection.gattServer = {
      disconnect: vi.fn(() => {
        throw new Error('disconnect failed')
      }),
    }
    connection.on('tx', onTx)

    await connection.write(Uint8Array.of(1, 2, 3))
    expect(writeValue).toHaveBeenNthCalledWith(1, Uint8Array.of(1, 2, 3))

    await expect(connection.sendToRadioFrame(Uint8Array.of(0xaa))).resolves.toBeUndefined()
  await vi.advanceTimersByTimeAsync(0)
    expect(onTx).toHaveBeenCalledWith(Uint8Array.of(0xaa))
    expect(logSpy).toHaveBeenCalledWith('failed to write to ble device', writeError)

    await expect(connection.close()).resolves.toBeUndefined()
    expect(connection.gattServer?.disconnect).toHaveBeenCalledTimes(1)

    connection.gattServer = {
      disconnect: vi.fn(),
    }

    await expect(connection.close()).resolves.toBeUndefined()
    expect(connection.gattServer).toBeUndefined()
  })
})