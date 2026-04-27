# meshcore-ts

TypeScript library for connecting to and working with [MeshCore](https://github.com/meshcore-dev/MeshCore) companion devices.  Supports communication over **Web Serial**, **Web Bluetooth (BLE)**, and any custom transport you implement.

[![npm version](https://badge.fury.io/js/meshcore-ts.svg)](https://www.npmjs.com/package/meshcore-ts)
[![Test](https://github.com/YOUR_ORG/meshcore-ts/actions/workflows/test.yml/badge.svg)](https://github.com/YOUR_ORG/meshcore-ts/actions/workflows/test.yml)

---

## Installation

```bash
npm install meshcore-ts
# or
pnpm add meshcore-ts
```

---

## Quick start

### Connect over Web Serial (browser)

```ts
import { WebSerialConnection } from "meshcore-ts";

// Prompts the user to pick a serial port (115200 baud).
const conn = await WebSerialConnection.open();
if (!conn) throw new Error("No port selected");

conn.on("connected", async () => {
    console.log("Connected to companion!");

    // Fetch device info
    const info = await conn.sendCommandDeviceQuery();
    console.log("Device info:", info);

    // Get all contacts
    const contacts = await conn.sendCommandGetContacts();
    console.log("Contacts:", contacts);
});

conn.on("disconnected", () => {
    console.log("Disconnected.");
});
```

### Connect over BLE (browser)

```ts
import { WebBleConnection } from "meshcore-ts";

// Shows the browser Bluetooth device picker.
const conn = await WebBleConnection.open();
if (!conn) throw new Error("No device selected");

conn.on("connected", async () => {
    const info = await conn.sendCommandDeviceQuery();
    console.log("Device info:", info);
});
```

### Send a direct message to a contact

```ts
import { WebSerialConnection, Constants } from "meshcore-ts";

const conn = await WebSerialConnection.open();

conn.on("connected", async () => {
    const contacts = await conn.sendCommandGetContacts();
    const alice = contacts.find(c => c.advName === "Alice");
    if (!alice) return;

    await conn.sendCommandSendTxtMsg(
        Constants.CommandCodes.SendTxtMsg, // txtType
        0,                                 // attempt
        Math.floor(Date.now() / 1000),     // senderTimestamp
        alice.publicKey.slice(0, 6),       // pubKeyPrefix
        "Hello from meshcore-ts!",         // text
    );
});
```

### Send a channel message

```ts
conn.on("connected", async () => {
    const channelIndex = 0;
    await conn.sendCommandSendChannelTxtMsg(
        0,                               // txtType
        channelIndex,
        Math.floor(Date.now() / 1000),
        "Hello channel!",
    );
});
```

### Listen for incoming messages

```ts
conn.on("contactMessage", (msg) => {
    console.log(`[DM from ${msg.senderPubKeyPrefix}]:`, msg.text);
});

conn.on("channelMessage", (msg) => {
    console.log(`[Channel ${msg.channelIdx}]:`, msg.text);
});
```

### Parse an advertisement

```ts
import { Advert } from "meshcore-ts";

const raw = new Uint8Array([ /* raw advertisement bytes */ ]);
const advert = Advert.fromBytes(raw);

console.log("Node name:", advert.parsed.name);
console.log("Node type:", advert.parsed.type); // "CHAT" | "REPEATER" | "ROOM" | "SENSOR" | "NONE"
console.log("Location:", advert.parsed.lat, advert.parsed.lon);

const valid = await advert.isVerified();
console.log("Signature valid:", valid);
```

### Parse a mesh packet

```ts
import { Packet } from "meshcore-ts";

const raw = new Uint8Array([ /* raw packet bytes */ ]);
const packet = Packet.fromBytes(raw);

console.log("Route type:", packet.route_type_string);    // "DIRECT" | "FLOOD" | ...
console.log("Payload type:", packet.payload_type_string); // "TXT_MSG" | "ADVERT" | ...
```

### Decode Cayenne LPP telemetry

```ts
import { CayenneLpp } from "meshcore-ts";

const raw = new Uint8Array([ /* raw LPP bytes */ ]);
const records = CayenneLpp.decode(raw);

for (const record of records) {
    console.log(`ch=${record.channel} type=${record.type} value=${JSON.stringify(record.value)}`);
}
```

### Derive a hashtag region transport key

```ts
import { TransportKeyUtil } from "meshcore-ts";

const key = await TransportKeyUtil.getHashtagRegionKey("#mygroup");
console.log("Key (hex):", Buffer.from(key).toString("hex"));
```

---

## API reference

### `WebSerialConnection`

Transport over the browser [Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API).

| Member | Description |
|--------|-------------|
| `static open()` | Prompts user for port → returns a connected instance |
| `close()` | Closes the serial port |
| *(all Connection methods)* | Inherited |

### `WebBleConnection`

Transport over the browser [Web Bluetooth API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API).

| Member | Description |
|--------|-------------|
| `static open()` | Shows Bluetooth device picker → returns a connected instance |
| *(all Connection methods)* | Inherited |

### `Connection` (base class)

Provides the full companion protocol command/response API.

| Method | Returns | Description |
|--------|---------|-------------|
| `sendCommandAppStart()` | `Promise<void>` | Initiates the companion app handshake |
| `sendCommandDeviceQuery()` | `Promise<DeviceInfoResponse>` | Queries firmware/hardware info |
| `sendCommandGetContacts(since?)` | `Promise<MeshContactRecord[]>` | Fetches the contact list |
| `sendCommandSendTxtMsg(...)` | `Promise<SentResponse>` | Sends a direct text message |
| `sendCommandSendChannelTxtMsg(...)` | `Promise<SentResponse>` | Sends a channel text message |
| `sendCommandGetDeviceTime()` | `Promise<CurrTimeResponse>` | Reads device clock |
| `sendCommandSetDeviceTime(ts)` | `Promise<OkResponse>` | Sets device clock |
| `sendCommandSendSelfAdvert()` | `Promise<OkResponse>` | Broadcasts a self-advertisement |
| `sendCommandSetAdvertName(name)` | `Promise<OkResponse>` | Sets the node's advertised name |
| `sendCommandGetBatteryVoltage()` | `Promise<BatteryVoltageResponse>` | Reads battery voltage |
| `sendCommandGetChannel(idx)` | `Promise<ChannelDataResponse>` | Reads a stored channel |
| `sendCommandSetChannel(idx, ...)` | `Promise<OkResponse>` | Writes a channel |
| `sendCommandReboot()` | `Promise<void>` | Reboots the companion |
| *(more…)* | — | See source for full list |

#### Events emitted by `Connection`

| Event | Payload type | Fired when |
|-------|-------------|------------|
| `"connected"` | — | Transport connected and handshake done |
| `"disconnected"` | — | Transport disconnected |
| `"contactMessage"` | `ContactMessageResponse` | A direct message arrived |
| `"channelMessage"` | `ChannelMessageResponse` | A channel message arrived |
| `"telemetry"` | `TelemetryResponsePush` | Telemetry push received |
| `"traceData"` | `TraceDataPush` | Trace-path data received |
| `"statusResponse"` | `StatusResponsePush` | Status response push |
| `"logRxData"` | `LogRxDataPush` | Raw RX log data |
| `"rx"` | `ByteArrayLike` | Raw inbound frame (debugging) |
| `"tx"` | `ByteArrayLike` | Raw outbound frame (debugging) |

### `Advert`

Parses MeshCore advertisement packets.

```ts
const advert = Advert.fromBytes(bytes);
advert.parsed.name    // string | null
advert.parsed.type    // "CHAT" | "REPEATER" | "ROOM" | "SENSOR" | "NONE" | null
advert.parsed.lat     // number | null
advert.parsed.lon     // number | null
await advert.isVerified() // boolean — ed25519 signature check
```

### `Packet`

Parses raw mesh packets.

```ts
const packet = Packet.fromBytes(bytes);
packet.route_type_string    // "DIRECT" | "FLOOD" | "TRANSPORT_DIRECT" | "TRANSPORT_FLOOD" | null
packet.payload_type_string  // "TXT_MSG" | "ADVERT" | "PATH" | "TRACE" | … | null
packet.payload              // Uint8Array — raw payload bytes
packet.path                 // Uint8Array — routing path
```

### `CayenneLpp`

Decodes Cayenne LPP binary telemetry.

```ts
const records = CayenneLpp.decode(bytes);
// records: Array<{ channel: number, type: number, value: number | { latitude, longitude, altitude } }>
```

### `Constants`

All protocol constants grouped into nested objects:

- `Constants.CommandCodes.*` — outbound command byte values
- `Constants.ResponseCodes.*` — inbound response byte values
- `Constants.PushCodes.*` — async push notification byte values
- `Constants.Ble.*` — BLE service/characteristic UUIDs
- `Constants.SerialFrameTypes.*` — serial frame type bytes
- `Constants.StatsTypes.*` — stats frame sub-types
- `Constants.DataTypes.*` — datagram data-type values

### `BufferUtils`

```ts
BufferUtils.bytesToHex(bytes)       // Uint8Array → "deadbeef"
BufferUtils.hexToBytes("deadbeef")  // → Uint8Array
BufferUtils.base64ToBytes(str)      // → Uint8Array
BufferUtils.areBuffersEqual(a, b)   // → boolean
```

### `MeshCorePath`

```ts
const path = MeshCorePath.fromPathAndLength(pathBytes, pathLen);
path?.toHexStrings()  // string[] — one hex string per hop
```

### `TransportKeyUtil`

```ts
const key = await TransportKeyUtil.getHashtagRegionKey("#region");
// key: Uint8Array (32 bytes)
```

---

## Publishing a new version

1. Bump the version in `package.json`.
2. Commit and push: `git commit -m "chore: release vX.Y.Z"`.
3. Create and push a tag: `git tag vX.Y.Z && git push --tags`.
4. The `publish.yml` GitHub Action will build, test, and publish to npm automatically.

> **Required secret**: add `NPM_TOKEN` to your repository's **Settings → Secrets and variables → Actions**.

---

## Development

```bash
pnpm install
pnpm test          # run tests with coverage
pnpm run typecheck # type-check only
pnpm run lint      # type-check + ESLint
pnpm run build     # produce dist/
```

### Test coverage

100% coverage is enforced on all metrics (branches, functions, lines, statements) except `src/index.ts` and `src/connection/connection_types.ts` (type-definition and re-export files).

---

## License

MIT


## Browser requirements

- Chrome or Edge desktop with Web Serial support.
- `localhost` or HTTPS.
- A MeshCore device running companion USB firmware.

Safari and Firefox are not supported for this Web Serial path.

## Commands

```bash
pnpm install
pnpm run dev
pnpm run build
pnpm run lint
```

## Implementation notes

- The app uses `@liamcottle/meshcore.js` as the first transport and protocol layer.
- Snapshot commands are issued sequentially to avoid overlapping companion protocol requests.
- Stored routed contacts are actively probed for trace responses after snapshots and topology refreshes, and can also be retraced from the dashboard.
- The current graph is based on companion-visible route state. It is not yet a full network-wide routing model.

## Next steps

- Verify the data surface on real hardware.
- Extend the analytics store with repeater status, telemetry parsing, and route history.
- Decide later whether a BLE fallback or a lower-level protocol integration is needed.
