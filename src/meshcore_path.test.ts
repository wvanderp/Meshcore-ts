import { describe, it, expect } from 'vitest'
import MeshCorePath from './meshcore_path'

describe('MeshCorePath', () => {
  it('fromPathAndLength returns null for pathLen 0xFF', () => {
    const path = new Uint8Array(10)
    expect(MeshCorePath.fromPathAndLength(path, 0xff)).toBeNull()
  })

  it('fromPathAndLength returns null if path is too short', () => {
    // pathLen = 0x42 means pathHashSize = (0x42 >> 6) + 1 = 2, pathHashCount = 0x42 & 63 = 2
    // so pathByteLength = 2 * 2 = 4, but we only provide 2 bytes
    const path = new Uint8Array(2)
    expect(MeshCorePath.fromPathAndLength(path, 0x42)).toBeNull()
  })

  it('fromPathAndLength parses valid path', () => {
    // pathLen = 0x02 means pathHashSize = (0x02 >> 6) + 1 = 1, pathHashCount = 0x02 & 63 = 2
    // pathByteLength = 1 * 2 = 2
    const path = new Uint8Array([0xaa, 0xbb, 0xcc])
    const result = MeshCorePath.fromPathAndLength(path, 0x02)
    expect(result).not.toBeNull()
    expect(result!.pathHashSize).toBe(1)
    expect(result!.pathHashCount).toBe(2)
    expect(result!.pathItems.length).toBe(2)
  })

  it('toHexPathString returns comma-delimited hex', () => {
    const path = new Uint8Array([0xaa, 0xbb])
    const result = MeshCorePath.fromPathAndLength(path, 0x02)!
    expect(result.toHexPathString()).toBe('aa,bb')
  })

  it('handles multi-byte hash sizes', () => {
    // pathLen = 0x41 means pathHashSize = (0x41 >> 6) + 1 = 2, pathHashCount = 0x41 & 63 = 1
    // pathByteLength = 2 * 1 = 2
    const path = new Uint8Array([0xaa, 0xbb, 0xcc])
    const result = MeshCorePath.fromPathAndLength(path, 0x41)
    expect(result).not.toBeNull()
    expect(result!.pathHashSize).toBe(2)
    expect(result!.pathHashCount).toBe(1)
    expect(result!.toHexPathString()).toBe('aabb')
  })
})
