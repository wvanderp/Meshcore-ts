import { describe, it, expect } from 'vitest'
import {
  Connection,
  WebBleConnection,
  SerialConnection,
  WebSerialConnection,
  Constants,
  Advert,
  Packet,
  BufferUtils,
  CayenneLpp,
  MeshCorePath,
  TransportKeyUtil,
} from './index'

describe('meshcore/index re-exports', () => {
  it('exports Connection', () => {
    expect(Connection).toBeDefined()
  })

  it('exports WebBleConnection', () => {
    expect(WebBleConnection).toBeDefined()
  })

  it('exports SerialConnection', () => {
    expect(SerialConnection).toBeDefined()
  })

  it('exports WebSerialConnection', () => {
    expect(WebSerialConnection).toBeDefined()
  })

  it('exports Constants', () => {
    expect(Constants).toBeDefined()
  })

  it('exports Advert', () => {
    expect(Advert).toBeDefined()
  })

  it('exports Packet', () => {
    expect(Packet).toBeDefined()
  })

  it('exports BufferUtils', () => {
    expect(BufferUtils).toBeDefined()
  })

  it('exports CayenneLpp', () => {
    expect(CayenneLpp).toBeDefined()
  })

  it('exports MeshCorePath', () => {
    expect(MeshCorePath).toBeDefined()
  })

  it('exports TransportKeyUtil', () => {
    expect(TransportKeyUtil).toBeDefined()
  })
})
