import { describe, it, expect } from 'vitest'
import RandomUtils from './random_utils'

describe('RandomUtils', () => {
  it('getRandomInt returns integer within range', () => {
    for (let i = 0; i < 100; i++) {
      const result = RandomUtils.getRandomInt(1, 10)
      expect(result).toBeGreaterThanOrEqual(1)
      expect(result).toBeLessThanOrEqual(10)
      expect(Number.isInteger(result)).toBe(true)
    }
  })

  it('getRandomInt works with same min and max', () => {
    expect(RandomUtils.getRandomInt(5, 5)).toBe(5)
  })

  it('getRandomInt floors max and ceils min', () => {
    const result = RandomUtils.getRandomInt(1.3, 3.7)
    expect(result).toBeGreaterThanOrEqual(2)
    expect(result).toBeLessThanOrEqual(3)
  })
})
