import { describe, it, expect } from 'vitest'
import BufferReader from './buffer_reader'

describe('BufferReader', () => {
  it('reads a single byte', () => {
    const reader = new BufferReader([0x42])
    expect(reader.readByte()).toBe(0x42)
  })

  it('reads multiple bytes', () => {
    const reader = new BufferReader([0x01, 0x02, 0x03])
    const bytes = reader.readBytes(2)
    expect(bytes).toEqual(new Uint8Array([0x01, 0x02]))
  })

  it('getRemainingBytesCount tracks position', () => {
    const reader = new BufferReader([0x01, 0x02, 0x03])
    expect(reader.getRemainingBytesCount()).toBe(3)
    reader.readByte()
    expect(reader.getRemainingBytesCount()).toBe(2)
  })

  it('readRemainingBytes returns all remaining', () => {
    const reader = new BufferReader([0x01, 0x02, 0x03])
    reader.readByte()
    expect(reader.readRemainingBytes()).toEqual(new Uint8Array([0x02, 0x03]))
  })

  it('readString decodes remaining bytes as UTF-8', () => {
    const reader = new BufferReader([0x48, 0x69])
    expect(reader.readString()).toBe('Hi')
  })

  it('readCString reads null-terminated string within maxLength', () => {
    const reader = new BufferReader([0x48, 0x69, 0x00, 0xff])
    expect(reader.readCString(4)).toBe('Hi')
  })

  it('readCString reads full length when no null terminator', () => {
    const reader = new BufferReader([0x41, 0x42, 0x43])
    // No null terminator within maxLength, returns undefined (falls through)
    expect(reader.readCString(3)).toBeUndefined()
  })

  it('readInt8 reads signed 8-bit', () => {
    const reader = new BufferReader([0xff])
    expect(reader.readInt8()).toBe(-1)
  })

  it('readUInt8 reads unsigned 8-bit', () => {
    const reader = new BufferReader([0xff])
    expect(reader.readUInt8()).toBe(255)
  })

  it('readUInt16LE reads unsigned 16-bit little-endian', () => {
    const reader = new BufferReader([0x02, 0x01])
    expect(reader.readUInt16LE()).toBe(0x0102)
  })

  it('readUInt16BE reads unsigned 16-bit big-endian', () => {
    const reader = new BufferReader([0x01, 0x02])
    expect(reader.readUInt16BE()).toBe(0x0102)
  })

  it('readUInt32LE reads unsigned 32-bit little-endian', () => {
    const reader = new BufferReader([0x04, 0x03, 0x02, 0x01])
    expect(reader.readUInt32LE()).toBe(0x01020304)
  })

  it('readUInt32BE reads unsigned 32-bit big-endian', () => {
    const reader = new BufferReader([0x01, 0x02, 0x03, 0x04])
    expect(reader.readUInt32BE()).toBe(0x01020304)
  })

  it('readInt16LE reads signed 16-bit little-endian', () => {
    const reader = new BufferReader([0xff, 0xff])
    expect(reader.readInt16LE()).toBe(-1)
  })

  it('readInt16BE reads signed 16-bit big-endian', () => {
    const reader = new BufferReader([0xff, 0xff])
    expect(reader.readInt16BE()).toBe(-1)
  })

  it('readInt32LE reads signed 32-bit little-endian', () => {
    const reader = new BufferReader([0xff, 0xff, 0xff, 0xff])
    expect(reader.readInt32LE()).toBe(-1)
  })

  it('readInt24BE reads positive 24-bit big-endian', () => {
    const reader = new BufferReader([0x01, 0x02, 0x03])
    expect(reader.readInt24BE()).toBe(0x010203)
  })

  it('readInt24BE reads negative 24-bit big-endian', () => {
    // 0xFF0000 has sign bit set for 24-bit
    const reader = new BufferReader([0xff, 0x00, 0x00])
    expect(reader.readInt24BE()).toBe(-0x10000) // 0xFF0000 - 0x1000000
  })
})
