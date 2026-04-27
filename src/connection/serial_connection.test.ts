import { afterEach, describe, expect, it, vi } from 'vitest'

import Constants from '../constants'
import SerialConnection from './serial_connection'

class TestSerialConnection extends SerialConnection {
  writtenFrames: Uint8Array[] = []
  receivedFrames: Uint8Array[] = []

  override async close(): Promise<void> {
    return
  }

  override async write(bytes: ArrayLike<number>): Promise<void> {
    this.writtenFrames.push(Uint8Array.from(bytes))
  }

  override onFrameReceived(frame: ArrayLike<number>): void {
    this.receivedFrames.push(Uint8Array.from(frame))
  }
}

class MissingWriteConnection extends SerialConnection {
  override async close(): Promise<void> {
    return
  }
}

class ThrowingSerialConnection extends TestSerialConnection {
  override onFrameReceived(): void {
    throw new Error('bad frame')
  }
}

describe('SerialConnection', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('cannot be instantiated directly', () => {
    expect(() => new (SerialConnection as unknown as typeof TestSerialConnection)()).toThrow(
      "SerialConnection is an abstract class and can't be instantiated.",
    )
  })

  it('requires subclasses to implement write', async () => {
    const connection = new MissingWriteConnection()

    await expect(connection.write(Uint8Array.of(1, 2, 3))).rejects.toThrow(
      'Not Implemented: write must be implemented by SerialConnection sub class.',
    )
  })

  it('frames outgoing data and emits tx events', async () => {
    vi.useFakeTimers()

    const connection = new TestSerialConnection()
    const onTx = vi.fn()

    connection.on('tx', onTx)
    await connection.sendToRadioFrame(Uint8Array.of(0xaa, 0xbb))
    await vi.advanceTimersByTimeAsync(0)

    expect(onTx).toHaveBeenCalledWith(Uint8Array.of(0xaa, 0xbb))
    expect(connection.writtenFrames).toEqual([
      Uint8Array.of(Constants.SerialFrameTypes.Outgoing, 0x02, 0x00, 0xaa, 0xbb),
    ])
  })

  it('buffers partial frames and skips invalid or zero-length headers', async () => {
    const connection = new TestSerialConnection()

    await connection.onDataReceived(Uint8Array.of(Constants.SerialFrameTypes.Incoming, 0x02, 0x00, 0xaa))
    expect(connection.receivedFrames).toEqual([])
    expect(connection.readBuffer).toEqual([Constants.SerialFrameTypes.Incoming, 0x02, 0x00, 0xaa])

    await connection.onDataReceived(Uint8Array.of(0xbb))
    expect(connection.receivedFrames).toEqual([Uint8Array.of(0xaa, 0xbb)])
    expect(connection.readBuffer).toEqual([])

    await connection.onDataReceived(
      Uint8Array.of(
        0x00,
        Constants.SerialFrameTypes.Incoming,
        0x00,
        0x00,
        Constants.SerialFrameTypes.Outgoing,
        0x01,
        0x00,
        0x99,
      ),
    )

    expect(connection.receivedFrames).toEqual([Uint8Array.of(0xaa, 0xbb), Uint8Array.of(0x99)])
    expect(connection.readBuffer).toEqual([])
  })

  it('logs processing failures and stops consuming the buffer for that pass', async () => {
    const connection = new ThrowingSerialConnection()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await connection.onDataReceived(Uint8Array.of(Constants.SerialFrameTypes.Incoming, 0x01, 0x00, 0x42))

    expect(errorSpy).toHaveBeenCalledWith('Failed to process frame', expect.any(Error))
  })
})