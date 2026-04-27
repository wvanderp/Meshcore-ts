import { afterEach, describe, expect, it, vi } from 'vitest'

import WebSerialConnection from './web_serial_connection'

type MockReader = {
  read: ReturnType<typeof vi.fn>
  cancel: ReturnType<typeof vi.fn>
  releaseLock: ReturnType<typeof vi.fn>
}

type MockWriter = {
  write: ReturnType<typeof vi.fn>
  releaseLock: ReturnType<typeof vi.fn>
}

type MockPort = {
  readable: ReadableStream<Uint8Array> | null
  writable: WritableStream<Uint8Array> | null
  open: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
  dispatchDisconnect: () => void
}

function setNavigator(value: unknown): void {
  Object.defineProperty(globalThis, 'navigator', {
    value,
    configurable: true,
  })
}

function createReader(results: Array<{ value?: Uint8Array; done: boolean }> = [{ done: true }]): MockReader {
  let index = 0

  return {
    read: vi.fn(async () => {
      const result = results[Math.min(index, results.length - 1)]
      index += 1
      return result
    }),
    cancel: vi.fn().mockResolvedValue(undefined),
    releaseLock: vi.fn(),
  }
}

function createWriter(): MockWriter {
  return {
    write: vi.fn().mockResolvedValue(undefined),
    releaseLock: vi.fn(),
  }
}

function attachStreams(port: MockPort, reader = createReader(), writer = createWriter()) {
  port.readable = {
    getReader: vi.fn(() => reader),
  } as unknown as ReadableStream<Uint8Array>
  port.writable = {
    getWriter: vi.fn(() => writer),
  } as unknown as WritableStream<Uint8Array>

  return {
    reader,
    writer,
  }
}

function createPort(): MockPort {
  const handlers = new Map<string, () => void>()

  return {
    readable: null,
    writable: null,
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn((event: string, handler: () => void) => {
      handlers.set(event, handler)
    }),
    removeEventListener: vi.fn((event: string, handler: () => void) => {
      if (handlers.get(event) === handler) {
        handlers.delete(event)
      }
    }),
    dispatchDisconnect: () => {
      handlers.get('disconnect')?.()
    },
  }
}

describe('WebSerialConnection', () => {
  const originalNavigator = globalThis.navigator

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    setNavigator(originalNavigator)
  })

  it('requires an open port for construction', () => {
    expect(() => new WebSerialConnection(createPort() as never)).toThrow(
      'Selected serial port is not open.',
    )
  })

  it('throws when Web Serial is unavailable', async () => {
    setNavigator({})

    await expect(WebSerialConnection.open()).rejects.toThrow(
      'Web Serial is not supported in this browser.',
    )
  })

  it('opens an already-open port, emits connected, and forwards disconnect events', async () => {
    vi.useFakeTimers()

    const port = createPort()
    const { reader } = attachStreams(port)
    const requestPort = vi.fn().mockResolvedValue(port)
    const deviceQuerySpy = vi.spyOn(WebSerialConnection.prototype, 'deviceQuery').mockResolvedValue({} as never)

    setNavigator({
      serial: {
        requestPort,
      },
    })

    const connection = await WebSerialConnection.open()
    const onConnected = vi.fn()
    const onDisconnected = vi.fn()

    connection.on('connected', onConnected)
    connection.on('disconnected', onDisconnected)

    await vi.runAllTimersAsync()

    expect(requestPort).toHaveBeenCalledWith({ filters: [] })
    expect(port.open).not.toHaveBeenCalled()
    expect(deviceQuerySpy).toHaveBeenCalledTimes(1)
    expect(onConnected).toHaveBeenCalledTimes(1)
    expect(reader.releaseLock).toHaveBeenCalledTimes(1)

    port.dispatchDisconnect()
    await vi.runAllTimersAsync()
    expect(onDisconnected).toHaveBeenCalledTimes(1)
  })

  it('recovers when an already-open port has stale streams and the first constructor attempt fails', async () => {
    vi.useFakeTimers()

    const port = createPort()
    let constructorShouldFail = true

    port.close.mockImplementation(async () => {
      port.readable = null
      port.writable = null
    })
    port.open.mockImplementation(async () => {
      attachStreams(port, createReader(), createWriter())
    })

    port.readable = {
      getReader: vi.fn(() => {
        if (constructorShouldFail) {
          constructorShouldFail = false
          throw new Error('stale reader')
        }

        return createReader()
      }),
    } as unknown as ReadableStream<Uint8Array>
    port.writable = {
      getWriter: vi.fn(() => createWriter()),
    } as unknown as WritableStream<Uint8Array>

    setNavigator({
      serial: {
        requestPort: vi.fn().mockResolvedValue(port),
      },
    })
    vi.spyOn(WebSerialConnection.prototype, 'deviceQuery').mockResolvedValue({} as never)

    const connection = await WebSerialConnection.open()
    await vi.advanceTimersByTimeAsync(0)

    expect(connection).toBeInstanceOf(WebSerialConnection)
    expect(port.close).toHaveBeenCalledTimes(1)
    expect(port.open).toHaveBeenCalledTimes(1)
  })

  it('retries opening after invalid-state failures and succeeds on the second attempt', async () => {
    vi.useFakeTimers()

    const port = createPort()
    const invalidState = Object.assign(new Error('port busy'), { name: 'InvalidStateError' })

    port.open
      .mockRejectedValueOnce(invalidState)
      .mockImplementationOnce(async () => {
        attachStreams(port, createReader(), createWriter())
      })

    setNavigator({
      serial: {
        requestPort: vi.fn().mockResolvedValue(port),
      },
    })
    vi.spyOn(WebSerialConnection.prototype, 'deviceQuery').mockResolvedValue({} as never)

    const connection = await WebSerialConnection.open()
    await vi.advanceTimersByTimeAsync(0)

    expect(connection).toBeInstanceOf(WebSerialConnection)
    expect(port.close).toHaveBeenCalledTimes(1)
    expect(port.open).toHaveBeenCalledTimes(2)
    expect(port.open).toHaveBeenNthCalledWith(1, { baudRate: 115200 })
  })

  it('maps cancellation, already-open, network, and unknown open failures to stable errors', async () => {
    const cancellationPort = createPort()
    cancellationPort.open.mockRejectedValueOnce('user cancelled')

    setNavigator({
      serial: {
        requestPort: vi.fn().mockResolvedValue(cancellationPort),
      },
    })
    await expect(WebSerialConnection.open()).rejects.toThrow('No port selected by the user.')

    const abortPort = createPort()
    abortPort.open.mockRejectedValueOnce(
      Object.assign(new Error('user aborted selection'), { name: 'AbortError' }),
    )

    setNavigator({
      serial: {
        requestPort: vi.fn().mockResolvedValue(abortPort),
      },
    })
    await expect(WebSerialConnection.open()).rejects.toThrow('user aborted selection')

    const alreadyOpenPort = createPort()
    const alreadyOpen = new Error('already open')
    alreadyOpenPort.open.mockRejectedValueOnce(alreadyOpen).mockRejectedValueOnce(alreadyOpen)

    setNavigator({
      serial: {
        requestPort: vi.fn().mockResolvedValue(alreadyOpenPort),
      },
    })
    await expect(WebSerialConnection.open()).rejects.toThrow(
      'The selected serial port is already open. Close other MeshTrace tabs or any serial tools using the device, then try again.',
    )

    const networkPort = createPort()
    networkPort.open.mockRejectedValueOnce(
      Object.assign(new Error('permission denied'), { name: 'NetworkError' }),
    )

    setNavigator({
      serial: {
        requestPort: vi.fn().mockResolvedValue(networkPort),
      },
    })
    await expect(WebSerialConnection.open()).rejects.toThrow(
      'MeshTrace could not open the selected serial port. Close other apps that may be using the device, unplug and reconnect it if needed, then try again.',
    )

    const plainErrorPort = createPort()
    plainErrorPort.open.mockRejectedValueOnce(new Error('plain failure'))

    setNavigator({
      serial: {
        requestPort: vi.fn().mockResolvedValue(plainErrorPort),
      },
    })
    await expect(WebSerialConnection.open()).rejects.toThrow('plain failure')

    const unknownPort = createPort()
    unknownPort.open.mockRejectedValueOnce({})

    setNavigator({
      serial: {
        requestPort: vi.fn().mockResolvedValue(unknownPort),
      },
    })
    await expect(WebSerialConnection.open()).rejects.toThrow(
      'Failed to open the selected serial port.',
    )
  })

  it('closes idempotently and ignores reader or port cleanup failures', async () => {
    const connection = Object.create(WebSerialConnection.prototype) as WebSerialConnection
    const reader = {
      cancel: vi.fn().mockRejectedValue(new Error('cancel failed')),
      releaseLock: vi.fn(() => {
        throw new Error('release failed')
      }),
    }
    const serialPort = {
      removeEventListener: vi.fn(),
      close: vi.fn().mockRejectedValue(new Error('close failed')),
    }

    connection.isClosing = false
    connection.disconnectHandler = vi.fn()
    connection.reader = reader as never
    connection.serialPort = serialPort as never

    await expect(connection.close()).resolves.toBeUndefined()
    await expect(connection.close()).resolves.toBeUndefined()

    expect(serialPort.removeEventListener).toHaveBeenCalledTimes(1)
    expect(reader.cancel).toHaveBeenCalledTimes(1)
    expect(serialPort.close).toHaveBeenCalledTimes(1)
  })

  it('writes bytes and always releases the writer lock', async () => {
    const writer = createWriter()
    const connection = Object.create(WebSerialConnection.prototype) as WebSerialConnection

    connection.writable = {
      getWriter: vi.fn(() => writer),
    } as never

    await connection.write(Uint8Array.of(1, 2, 3))

    expect(writer.write).toHaveBeenCalledWith(Uint8Array.of(1, 2, 3))
    expect(writer.releaseLock).toHaveBeenCalledTimes(1)
  })

  it('readLoop forwards bytes and always releases the reader lock', async () => {
    const reader = createReader([
      { value: Uint8Array.of(1, 2), done: false },
      { done: true },
    ])
    const connection = Object.create(WebSerialConnection.prototype) as WebSerialConnection

    connection.reader = reader as never
    connection.isClosing = false
    connection.onDataReceived = vi.fn().mockResolvedValue(undefined)

    await connection.readLoop()

    expect(connection.onDataReceived).toHaveBeenCalledWith(Uint8Array.of(1, 2))
    expect(reader.releaseLock).toHaveBeenCalledTimes(1)
  })

  it('readLoop ignores shutdown, abort, and type errors but logs unexpected ones', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const closingConnection = Object.create(WebSerialConnection.prototype) as WebSerialConnection
    closingConnection.reader = {
      read: vi.fn().mockRejectedValue(new Error('closing')),
      releaseLock: vi.fn(),
    } as never
    closingConnection.isClosing = true
    await closingConnection.readLoop()

    const abortConnection = Object.create(WebSerialConnection.prototype) as WebSerialConnection
    abortConnection.reader = {
      read: vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError')),
      releaseLock: vi.fn(),
    } as never
    abortConnection.isClosing = false
    await abortConnection.readLoop()

    const typeErrorConnection = Object.create(WebSerialConnection.prototype) as WebSerialConnection
    typeErrorConnection.reader = {
      read: vi.fn().mockRejectedValue(new TypeError('released')),
      releaseLock: vi.fn(),
    } as never
    typeErrorConnection.isClosing = false
    await typeErrorConnection.readLoop()

    const unexpectedConnection = Object.create(WebSerialConnection.prototype) as WebSerialConnection
    unexpectedConnection.reader = {
      read: vi.fn().mockRejectedValue(new Error('boom')),
      releaseLock: vi.fn(() => {
        throw new Error('already released')
      }),
    } as never
    unexpectedConnection.isClosing = false
    await unexpectedConnection.readLoop()

    expect(errorSpy).toHaveBeenCalledWith('Error reading from serial port: ', expect.any(Error))
  })
})