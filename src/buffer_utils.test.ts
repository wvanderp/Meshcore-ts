import { describe, it, expect } from 'vitest'
import BufferUtils from './buffer_utils'

describe('BufferUtils', () => {
  describe('bytesToHex', () => {
    it('converts bytes to hex string', () => {
      expect(BufferUtils.bytesToHex(new Uint8Array([0x0a, 0xff, 0x00]))).toBe('0aff00')
    })

    it('handles empty array', () => {
      expect(BufferUtils.bytesToHex(new Uint8Array([]))).toBe('')
    })
  })

  describe('hexToBytes', () => {
    it('converts hex string to bytes', () => {
      expect(BufferUtils.hexToBytes('0aff00')).toEqual(new Uint8Array([0x0a, 0xff, 0x00]))
    })

    it('handles single byte hex', () => {
      expect(BufferUtils.hexToBytes('ff')).toEqual(new Uint8Array([0xff]))
    })
  })

  describe('base64ToBytes', () => {
    it('converts base64 string to bytes', () => {
      // "AQID" is base64 for [1, 2, 3]
      expect(BufferUtils.base64ToBytes('AQID')).toEqual(new Uint8Array([1, 2, 3]))
    })
  })

  describe('areBuffersEqual', () => {
    it('returns true for equal buffers', () => {
      expect(BufferUtils.areBuffersEqual([1, 2, 3], [1, 2, 3])).toBe(true)
    })

    it('returns false for different lengths', () => {
      expect(BufferUtils.areBuffersEqual([1, 2], [1, 2, 3])).toBe(false)
    })

    it('returns false for different content', () => {
      expect(BufferUtils.areBuffersEqual([1, 2, 3], [1, 2, 4])).toBe(false)
    })

    it('returns true for empty buffers', () => {
      expect(BufferUtils.areBuffersEqual([], [])).toBe(true)
    })
  })
})
