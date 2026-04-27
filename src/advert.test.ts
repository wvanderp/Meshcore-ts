import { describe, it, expect } from 'vitest'
import Advert from './advert'
import BufferWriter from './buffer_writer'

async function createSignedAdvert() {
  const { ed25519 } = await import('@noble/curves/ed25519.js')
  const secretKey = ed25519.utils.randomSecretKey()
  const publicKey = ed25519.getPublicKey(secretKey)
  const timestamp = 1_706_406_400
  const appData = new Uint8Array([Advert.ADV_TYPE_CHAT | Advert.ADV_NAME_MASK, 0x4f, 0x4b])
  const writer = new BufferWriter()

  writer.writeBytes(publicKey)
  writer.writeUInt32LE(timestamp)
  writer.writeBytes(appData)

  const signature = ed25519.sign(writer.toBytes(), secretKey)

  return {
    publicKey,
    timestamp,
    signature,
    appData,
  }
}

function buildAdvertBytes(
  flags: number,
  options: { lat?: number; lon?: number; feat1?: number; feat2?: number; name?: string } = {},
): Uint8Array {
  const appDataWriter = new BufferWriter()
  appDataWriter.writeByte(flags)
  if (flags & Advert.ADV_LATLON_MASK) {
    appDataWriter.writeInt32LE(options.lat ?? 0)
    appDataWriter.writeInt32LE(options.lon ?? 0)
  }
  if (flags & Advert.ADV_FEAT1_MASK) {
    appDataWriter.writeUInt16LE(options.feat1 ?? 0)
  }
  if (flags & Advert.ADV_FEAT2_MASK) {
    appDataWriter.writeUInt16LE(options.feat2 ?? 0)
  }
  if (flags & Advert.ADV_NAME_MASK) {
    appDataWriter.writeString(options.name ?? '')
  }

  const writer = new BufferWriter()
  writer.writeBytes(new Uint8Array(32)) // publicKey
  writer.writeUInt32LE(1000)            // timestamp
  writer.writeBytes(new Uint8Array(64)) // signature
  writer.writeBytes(appDataWriter.toBytes()) // appData
  return writer.toBytes()
}

describe('Advert', () => {
  it('has type constants', () => {
    expect(Advert.ADV_TYPE_NONE).toBe(0)
    expect(Advert.ADV_TYPE_CHAT).toBe(1)
    expect(Advert.ADV_TYPE_REPEATER).toBe(2)
    expect(Advert.ADV_TYPE_ROOM).toBe(3)
    expect(Advert.ADV_TYPE_SENSOR).toBe(4)
  })

  it('has flag mask constants', () => {
    expect(Advert.ADV_LATLON_MASK).toBe(0x10)
    expect(Advert.ADV_FEAT1_MASK).toBe(0x20)
    expect(Advert.ADV_FEAT2_MASK).toBe(0x40)
    expect(Advert.ADV_NAME_MASK).toBe(0x80)
  })

  it('fromBytes parses publicKey, timestamp, signature, appData', () => {
    const bytes = buildAdvertBytes(Advert.ADV_TYPE_CHAT)
    const advert = Advert.fromBytes(bytes)
    expect(advert.publicKey.length).toBe(32)
    expect(advert.timestamp).toBe(1000)
    expect(advert.signature.length).toBe(64)
    expect(advert.appData.length).toBeGreaterThan(0)
  })

  it('getFlags returns first byte of appData', () => {
    const bytes = buildAdvertBytes(0x81) // ADV_TYPE_CHAT | ADV_NAME_MASK
    const advert = Advert.fromBytes(bytes)
    expect(advert.getFlags()).toBe(0x81)
  })

  it('getType returns bottom 4 bits', () => {
    const bytes = buildAdvertBytes(Advert.ADV_TYPE_REPEATER)
    const advert = Advert.fromBytes(bytes)
    expect(advert.getType()).toBe(2)
  })

  it('getTypeString returns NONE', () => {
    const bytes = buildAdvertBytes(Advert.ADV_TYPE_NONE)
    expect(Advert.fromBytes(bytes).getTypeString()).toBe('NONE')
  })

  it('getTypeString returns CHAT', () => {
    const bytes = buildAdvertBytes(Advert.ADV_TYPE_CHAT)
    expect(Advert.fromBytes(bytes).getTypeString()).toBe('CHAT')
  })

  it('getTypeString returns REPEATER', () => {
    const bytes = buildAdvertBytes(Advert.ADV_TYPE_REPEATER)
    expect(Advert.fromBytes(bytes).getTypeString()).toBe('REPEATER')
  })

  it('getTypeString returns ROOM', () => {
    const bytes = buildAdvertBytes(Advert.ADV_TYPE_ROOM)
    expect(Advert.fromBytes(bytes).getTypeString()).toBe('ROOM')
  })

  it('getTypeString returns SENSOR', () => {
    const bytes = buildAdvertBytes(Advert.ADV_TYPE_SENSOR)
    expect(Advert.fromBytes(bytes).getTypeString()).toBe('SENSOR')
  })

  it('getTypeString returns null for unknown type', () => {
    const bytes = buildAdvertBytes(0x0f) // unknown type
    expect(Advert.fromBytes(bytes).getTypeString()).toBeNull()
  })

  it('parseAppData extracts lat/lon when flag set', () => {
    const flags = Advert.ADV_TYPE_CHAT | Advert.ADV_LATLON_MASK
    const bytes = buildAdvertBytes(flags, { lat: 51234500, lon: 4234500 })
    const advert = Advert.fromBytes(bytes)
    expect(advert.parsed.lat).toBe(51234500)
    expect(advert.parsed.lon).toBe(4234500)
  })

  it('parseAppData returns null lat/lon when flag not set', () => {
    const bytes = buildAdvertBytes(Advert.ADV_TYPE_CHAT)
    const advert = Advert.fromBytes(bytes)
    expect(advert.parsed.lat).toBeNull()
    expect(advert.parsed.lon).toBeNull()
  })

  it('parseAppData extracts feat1 when flag set', () => {
    const flags = Advert.ADV_TYPE_CHAT | Advert.ADV_FEAT1_MASK
    const bytes = buildAdvertBytes(flags, { feat1: 42 })
    const advert = Advert.fromBytes(bytes)
    expect(advert.parsed.feat1).toBe(42)
  })

  it('parseAppData returns null feat1 when flag not set', () => {
    const bytes = buildAdvertBytes(Advert.ADV_TYPE_CHAT)
    expect(Advert.fromBytes(bytes).parsed.feat1).toBeNull()
  })

  it('parseAppData extracts feat2 when flag set', () => {
    const flags = Advert.ADV_TYPE_CHAT | Advert.ADV_FEAT2_MASK
    const bytes = buildAdvertBytes(flags, { feat2: 99 })
    const advert = Advert.fromBytes(bytes)
    expect(advert.parsed.feat2).toBe(99)
  })

  it('parseAppData returns null feat2 when flag not set', () => {
    const bytes = buildAdvertBytes(Advert.ADV_TYPE_CHAT)
    expect(Advert.fromBytes(bytes).parsed.feat2).toBeNull()
  })

  it('parseAppData extracts name when flag set', () => {
    const flags = Advert.ADV_TYPE_CHAT | Advert.ADV_NAME_MASK
    const bytes = buildAdvertBytes(flags, { name: 'TestNode' })
    const advert = Advert.fromBytes(bytes)
    expect(advert.parsed.name).toBe('TestNode')
  })

  it('parseAppData returns null name when flag not set', () => {
    const bytes = buildAdvertBytes(Advert.ADV_TYPE_CHAT)
    expect(Advert.fromBytes(bytes).parsed.name).toBeNull()
  })

  it('parseAppData with all flags set', () => {
    const flags = Advert.ADV_TYPE_REPEATER | Advert.ADV_LATLON_MASK | Advert.ADV_FEAT1_MASK | Advert.ADV_FEAT2_MASK | Advert.ADV_NAME_MASK
    const bytes = buildAdvertBytes(flags, { lat: 100, lon: 200, feat1: 10, feat2: 20, name: 'All' })
    const advert = Advert.fromBytes(bytes)
    expect(advert.parsed.type).toBe('REPEATER')
    expect(advert.parsed.lat).toBe(100)
    expect(advert.parsed.lon).toBe(200)
    expect(advert.parsed.feat1).toBe(10)
    expect(advert.parsed.feat2).toBe(20)
    expect(advert.parsed.name).toBe('All')
  })

  it('isVerified returns true for a matching signature', async () => {
    const signedAdvert = await createSignedAdvert()
    const advert = new Advert(
      signedAdvert.publicKey,
      signedAdvert.timestamp,
      signedAdvert.signature,
      signedAdvert.appData,
    )

    await expect(advert.isVerified()).resolves.toBe(true)
  })

  it('isVerified returns false when the payload changes', async () => {
    const signedAdvert = await createSignedAdvert()
    const advert = new Advert(
      signedAdvert.publicKey,
      signedAdvert.timestamp,
      signedAdvert.signature,
      new Uint8Array([Advert.ADV_TYPE_CHAT | Advert.ADV_NAME_MASK, 0x4e, 0x4f]),
    )

    await expect(advert.isVerified()).resolves.toBe(false)
  })
})
