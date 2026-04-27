import { describe, it, expect } from 'vitest'
import TransportKeyUtil from './transport_key_util'

describe('TransportKeyUtil', () => {
  it('getHashtagRegionKey generates 32-byte SHA-256 hash', async () => {
    const key = await TransportKeyUtil.getHashtagRegionKey('#test')
    expect(key).toBeInstanceOf(Uint8Array)
    expect(key.length).toBe(32)
  })

  it('prepends # when missing', async () => {
    const keyWithHash = await TransportKeyUtil.getHashtagRegionKey('#test')
    const keyWithoutHash = await TransportKeyUtil.getHashtagRegionKey('test')
    expect(keyWithHash).toEqual(keyWithoutHash)
  })

  it('produces different keys for different regions', async () => {
    const key1 = await TransportKeyUtil.getHashtagRegionKey('#region1')
    const key2 = await TransportKeyUtil.getHashtagRegionKey('#region2')
    expect(key1).not.toEqual(key2)
  })
})
