import { describe, it, expect } from 'vitest';
import Packet from './packet';
import BufferWriter from './buffer_writer';

function buildFloodPacket(payloadType: number, pathHashCount: number, pathHashSize: number, pathBytes: number[], payload: number[]): Uint8Array {
    const w = new BufferWriter();
    // header: route_type FLOOD (0x01) | payloadType << 2 | version 0
    const header = 0x01 | (payloadType << Packet.PH_TYPE_SHIFT);
    w.writeByte(header);
    // pathLen: (pathHashSize-1) << 6 | pathHashCount
    const pathLen = ((pathHashSize - 1) << 6) | pathHashCount;
    w.writeByte(pathLen);
    w.writeBytes(pathBytes);
    w.writeBytes(payload);
    return w.toBytes();
}

function buildDirectPacket(payloadType: number, pathBytes: number[], payload: number[]): Uint8Array {
    const w = new BufferWriter();
    const header = Packet.ROUTE_TYPE_DIRECT | (payloadType << Packet.PH_TYPE_SHIFT);
    w.writeByte(header);
    w.writeByte(pathBytes.length); // pathLen: 1-byte hash, N count
    w.writeBytes(pathBytes);
    w.writeBytes(payload);
    return w.toBytes();
}

function buildTransportFloodPacket(payloadType: number, tc1: number, tc2: number, payload: number[]): Uint8Array {
    const w = new BufferWriter();
    const header = Packet.ROUTE_TYPE_TRANSPORT_FLOOD | (payloadType << Packet.PH_TYPE_SHIFT);
    w.writeByte(header);
    w.writeUInt16LE(tc1);
    w.writeUInt16LE(tc2);
    w.writeByte(0); // pathLen = 0
    w.writeBytes(payload);
    return w.toBytes();
}

function buildTransportDirectPacket(payloadType: number, tc1: number, tc2: number, payload: number[]): Uint8Array {
    const w = new BufferWriter();
    const header = Packet.ROUTE_TYPE_TRANSPORT_DIRECT | (payloadType << Packet.PH_TYPE_SHIFT);
    w.writeByte(header);
    w.writeUInt16LE(tc1);
    w.writeUInt16LE(tc2);
    w.writeByte(0); // pathLen = 0
    w.writeBytes(payload);
    return w.toBytes();
}

describe('Packet', () => {
    it('has static constants', () => {
        expect(Packet.PH_ROUTE_MASK).toBe(0x03);
        expect(Packet.PH_TYPE_SHIFT).toBe(2);
        expect(Packet.PH_TYPE_MASK).toBe(0x0f);
        expect(Packet.PH_VER_SHIFT).toBe(6);
        expect(Packet.PH_VER_MASK).toBe(0x03);

        expect(Packet.ROUTE_TYPE_TRANSPORT_FLOOD).toBe(0x00);
        expect(Packet.ROUTE_TYPE_FLOOD).toBe(0x01);
        expect(Packet.ROUTE_TYPE_DIRECT).toBe(0x02);
        expect(Packet.ROUTE_TYPE_TRANSPORT_DIRECT).toBe(0x03);

        expect(Packet.PAYLOAD_TYPE_REQ).toBe(0x00);
        expect(Packet.PAYLOAD_TYPE_RESPONSE).toBe(0x01);
        expect(Packet.PAYLOAD_TYPE_TXT_MSG).toBe(0x02);
        expect(Packet.PAYLOAD_TYPE_ACK).toBe(0x03);
        expect(Packet.PAYLOAD_TYPE_ADVERT).toBe(0x04);
        expect(Packet.PAYLOAD_TYPE_GRP_TXT).toBe(0x05);
        expect(Packet.PAYLOAD_TYPE_GRP_DATA).toBe(0x06);
        expect(Packet.PAYLOAD_TYPE_ANON_REQ).toBe(0x07);
        expect(Packet.PAYLOAD_TYPE_PATH).toBe(0x08);
        expect(Packet.PAYLOAD_TYPE_TRACE).toBe(0x09);
        expect(Packet.PAYLOAD_TYPE_RAW_CUSTOM).toBe(0x0f);
    });

    describe('extractPathHashSize', () => {
        it('returns 1 for 0-bit top', () => {
            expect(Packet.extractPathHashSize(0x02)).toBe(1);
        });
        it('returns 2 for 1-bit top', () => {
            expect(Packet.extractPathHashSize(0x41)).toBe(2);
        });
        it('returns 3 for 2-bit top', () => {
            expect(Packet.extractPathHashSize(0x81)).toBe(3);
        });
    });

    describe('extractPathHashCount', () => {
        it('returns bottom 6 bits', () => {
            expect(Packet.extractPathHashCount(0x42)).toBe(2);
            expect(Packet.extractPathHashCount(0x3f)).toBe(63);
            expect(Packet.extractPathHashCount(0x00)).toBe(0);
        });
    });

    describe('fromBytes', () => {
        it('parses flood packet', () => {
            const bytes = buildFloodPacket(Packet.PAYLOAD_TYPE_TXT_MSG, 2, 1, [0xaa, 0xbb], [0x01, 0x02]);
            const packet = Packet.fromBytes(bytes);
            expect(packet.getRouteType()).toBe(Packet.ROUTE_TYPE_FLOOD);
            expect(packet.getPayloadType()).toBe(Packet.PAYLOAD_TYPE_TXT_MSG);
            expect(packet.transportCode1).toBeNull();
            expect(packet.transportCode2).toBeNull();
        });

        it('parses direct packet', () => {
            const bytes = buildDirectPacket(Packet.PAYLOAD_TYPE_ACK, [0xcc], [0x42]);
            const packet = Packet.fromBytes(bytes);
            expect(packet.getRouteType()).toBe(Packet.ROUTE_TYPE_DIRECT);
            expect(packet.isRouteDirect()).toBe(true);
            expect(packet.isRouteFlood()).toBe(false);
        });

        it('parses transport flood packet with transport codes', () => {
            const bytes = buildTransportFloodPacket(Packet.PAYLOAD_TYPE_REQ, 0x1234, 0x5678, [0xff]);
            const packet = Packet.fromBytes(bytes);
            expect(packet.getRouteType()).toBe(Packet.ROUTE_TYPE_TRANSPORT_FLOOD);
            expect(packet.transportCode1).toBe(0x1234);
            expect(packet.transportCode2).toBe(0x5678);
        });

        it('parses transport direct packet with transport codes', () => {
            const bytes = buildTransportDirectPacket(Packet.PAYLOAD_TYPE_RESPONSE, 0xaaaa, 0xbbbb, [0x01]);
            const packet = Packet.fromBytes(bytes);
            expect(packet.getRouteType()).toBe(Packet.ROUTE_TYPE_TRANSPORT_DIRECT);
            expect(packet.transportCode1).toBe(0xaaaa);
            expect(packet.transportCode2).toBe(0xbbbb);
        });
    });

    describe('route type methods', () => {
        it('getRouteTypeString returns FLOOD', () => {
            const bytes = buildFloodPacket(0, 0, 1, [], []);
            expect(Packet.fromBytes(bytes).getRouteTypeString()).toBe('FLOOD');
        });

        it('getRouteTypeString returns DIRECT', () => {
            const bytes = buildDirectPacket(0, [], []);
            expect(Packet.fromBytes(bytes).getRouteTypeString()).toBe('DIRECT');
        });

        it('getRouteTypeString returns TRANSPORT_FLOOD', () => {
            const bytes = buildTransportFloodPacket(0, 0, 0, []);
            expect(Packet.fromBytes(bytes).getRouteTypeString()).toBe('TRANSPORT_FLOOD');
        });

        it('getRouteTypeString returns TRANSPORT_DIRECT', () => {
            const bytes = buildTransportDirectPacket(0, 0, 0, []);
            expect(Packet.fromBytes(bytes).getRouteTypeString()).toBe('TRANSPORT_DIRECT');
        });

        it('isRouteFlood and isRouteDirect', () => {
            const flood = Packet.fromBytes(buildFloodPacket(0, 0, 1, [], []));
            expect(flood.isRouteFlood()).toBe(true);
            expect(flood.isRouteDirect()).toBe(false);
        });
    });

    describe('payload type methods', () => {
        const typeStrings: Array<[number, string]> = [
            [Packet.PAYLOAD_TYPE_REQ, 'REQ'],
            [Packet.PAYLOAD_TYPE_RESPONSE, 'RESPONSE'],
            [Packet.PAYLOAD_TYPE_TXT_MSG, 'TXT_MSG'],
            [Packet.PAYLOAD_TYPE_ACK, 'ACK'],
            [Packet.PAYLOAD_TYPE_ADVERT, 'ADVERT'],
            [Packet.PAYLOAD_TYPE_GRP_TXT, 'GRP_TXT'],
            [Packet.PAYLOAD_TYPE_GRP_DATA, 'GRP_DATA'],
            [Packet.PAYLOAD_TYPE_ANON_REQ, 'ANON_REQ'],
            [Packet.PAYLOAD_TYPE_PATH, 'PATH'],
            [Packet.PAYLOAD_TYPE_TRACE, 'TRACE'],
            [Packet.PAYLOAD_TYPE_RAW_CUSTOM, 'RAW_CUSTOM'],
        ];

        for (const [type, expected] of typeStrings) {
            it(`getPayloadTypeString returns ${expected}`, () => {
                const bytes = buildFloodPacket(type, 0, 1, [], []);
                expect(Packet.fromBytes(bytes).getPayloadTypeString()).toBe(expected);
            });
        }

        it('getPayloadTypeString returns null for unknown type', () => {
            // Use type value that doesn't match any known (0x0B = 11, no match)
            const bytes = buildFloodPacket(0x0b, 0, 1, [], []);
            expect(Packet.fromBytes(bytes).getPayloadTypeString()).toBeNull();
        });
    });

    describe('version and retransmit', () => {
        it('getPayloadVer extracts version from header', () => {
            const w = new BufferWriter();
            // header with version 2: (2 << 6) | route_type FLOOD
            w.writeByte((2 << Packet.PH_VER_SHIFT) | Packet.ROUTE_TYPE_FLOOD);
            w.writeByte(0); // pathLen
            const packet = Packet.fromBytes(w.toBytes());
            expect(packet.getPayloadVer()).toBe(2);
        });

        it('markDoNotRetransmit sets header to 0xFF', () => {
            const bytes = buildFloodPacket(0, 0, 1, [], []);
            const packet = Packet.fromBytes(bytes);
            expect(packet.isMarkedDoNotRetransmit()).toBe(false);
            packet.markDoNotRetransmit();
            expect(packet.isMarkedDoNotRetransmit()).toBe(true);
            expect(packet.header).toBe(0xff);
        });
    });

    describe('getPath and getPathHashes', () => {
        it('getPath returns MeshCorePath for valid path', () => {
            const bytes = buildFloodPacket(0, 2, 1, [0xaa, 0xbb], []);
            const packet = Packet.fromBytes(bytes);
            const path = packet.getPath();
            expect(path).not.toBeNull();
            expect(path!.pathHashCount).toBe(2);
        });

        it('getPathHashSize and getPathHashCount', () => {
            const bytes = buildFloodPacket(0, 2, 1, [0xaa, 0xbb], []);
            const packet = Packet.fromBytes(bytes);
            expect(packet.getPathHashSize()).toBe(1);
            expect(packet.getPathHashCount()).toBe(2);
        });

        it('getPathHashes returns array of hash bytes', () => {
            const bytes = buildFloodPacket(0, 2, 1, [0xaa, 0xbb], []);
            const packet = Packet.fromBytes(bytes);
            const hashes = packet.getPathHashes();
            expect(hashes.length).toBe(2);
            expect(hashes[0]).toEqual(new Uint8Array([0xaa]));
            expect(hashes[1]).toEqual(new Uint8Array([0xbb]));
        });
    });

    describe('parsePayload', () => {
        it('parsePayload PATH returns src and dest', () => {
            const bytes = buildFloodPacket(Packet.PAYLOAD_TYPE_PATH, 0, 1, [], [0x01, 0x02]);
            const packet = Packet.fromBytes(bytes);
            const parsed = packet.parsePayload();
            expect(parsed).toEqual({ src: 0x02, dest: 0x01 });
        });

        it('parsePayload REQ returns src, dest, encrypted', () => {
            const bytes = buildFloodPacket(Packet.PAYLOAD_TYPE_REQ, 0, 1, [], [0x01, 0x02, 0xaa, 0xbb]);
            const packet = Packet.fromBytes(bytes);
            const parsed = packet.parsePayload();
            expect(parsed).toEqual({
                src: 0x02,
                dest: 0x01,
                encrypted: new Uint8Array([0xaa, 0xbb]),
            });
        });

        it('parsePayload RESPONSE returns src and dest', () => {
            const bytes = buildFloodPacket(Packet.PAYLOAD_TYPE_RESPONSE, 0, 1, [], [0x01, 0x02]);
            const parsed = Packet.fromBytes(bytes).parsePayload();
            expect(parsed).toEqual({ src: 0x02, dest: 0x01 });
        });

        it('parsePayload TXT_MSG returns src and dest', () => {
            const bytes = buildFloodPacket(Packet.PAYLOAD_TYPE_TXT_MSG, 0, 1, [], [0x01, 0x02]);
            const parsed = Packet.fromBytes(bytes).parsePayload();
            expect(parsed).toEqual({ src: 0x02, dest: 0x01 });
        });

        it('parsePayload ACK returns ack_code', () => {
            const bytes = buildFloodPacket(Packet.PAYLOAD_TYPE_ACK, 0, 1, [], [0x42]);
            const parsed = Packet.fromBytes(bytes).parsePayload();
            expect(parsed).toEqual({ ack_code: new Uint8Array([0x42]) });
        });

        it('parsePayload ADVERT parses Advert from payload', () => {
            // Build a minimal advert: 32 publicKey + 4 timestamp + 64 signature + appData
            const w = new BufferWriter();
            w.writeBytes(new Uint8Array(32)); // publicKey
            w.writeUInt32LE(1000);
            w.writeBytes(new Uint8Array(64)); // signature
            w.writeByte(0x01); // flags = CHAT
            const advertPayload = Array.from(w.toBytes());

            const packetBytes = buildFloodPacket(Packet.PAYLOAD_TYPE_ADVERT, 0, 1, [], advertPayload);
            const parsed = Packet.fromBytes(packetBytes).parsePayload();
            expect(parsed).toMatchObject({
                public_key: expect.any(Uint8Array),
                timestamp: 1000,
                app_data: expect.any(Object),
            });
        });

        it('parsePayload ANON_REQ returns dest and src pubkey', () => {
            const payload = [0x01, ...new Array(32).fill(0xaa)];
            const bytes = buildFloodPacket(Packet.PAYLOAD_TYPE_ANON_REQ, 0, 1, [], payload);
            const parsed = Packet.fromBytes(bytes).parsePayload();
            expect(parsed).toEqual({
                dest: 0x01,
                src: new Uint8Array(32).fill(0xaa),
            });
        });

        it('parsePayload returns null for GRP_TXT (unhandled in switch)', () => {
            const bytes = buildFloodPacket(Packet.PAYLOAD_TYPE_GRP_TXT, 0, 1, [], [0x01]);
            expect(Packet.fromBytes(bytes).parsePayload()).toBeNull();
        });
    });
});
