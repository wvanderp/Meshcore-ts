# MeshTrace

This project is aimed at extracting as much information as possible from the meshcore network and companion device, and rendering it in a browser-based dashboard. This means that if information is available in the companion protocol, it should be surfaced in the meshcore library and then rendered in the react app.

Keep a clear architectural break between the meshcore library in the `meshcore` folder and the react app. The meshcore library should be framework agnostic and should not contain any React-specific code. The react app should only import the meshcore library and should not have to parse the meshcore package any further. All processing should be done in the meshcore lib.

A meshcore companion is a device that runs the meshcore companion firmware, it has a lora radio and can connect to the mesh network. The companion firmware exposes a protocol over USB, BLE, or WiFi that allows a host device (like a computer or smartphone) to interact with the mesh network through the companion. The meshcore library is a JavaScript library that implements the client-side of this protocol, allowing us to pull data from the companion and render it in our react app.

## Guide to the external Meshcore companion software

If you have questions about how client-side serial, BLE, WiFi, or companion protocol handling works, use the source at <https://github.com/meshcore-dev/MeshCore> as a navigation target.

When looking for client-related sources in MeshCore, use this map first:

- Start with `examples/companion_radio/`.
  - `main.cpp`: firmware bootstrap, filesystem setup, transport selection, and interface startup.
  - `MyMesh.h` and `MyMesh.cpp`: companion command codes, response codes, push codes, contact sync, channel sync, device info, adverts, and path handling.
  - `DataStore.*` and `NodePrefs.h`: persisted companion-facing state and preferences.
  - `AbstractUITask.h`, `ui-new/`, and `ui-orig/`: on-device UI only. Useful for display behavior, not for host client protocol logic.

- Transport implementations live under `src/helpers/`.
  - `BaseSerialInterface.h`: common transport abstraction.
  - `ArduinoSerialInterface.*`: USB and UART framing.
  - `nrf52/SerialBLEInterface.*` and `esp32/SerialBLEInterface.*`: BLE transport.
  - `esp32/SerialWifiInterface.*`: WiFi and TCP transport.

- Protocol docs live under `docs/`.
  - `companion_protocol.md`: connection flow, command expectations, and push behavior.
  - `stats_binary_frames.md`: binary stats payload layouts, including JavaScript and TypeScript parsing examples.
  - `packet_format.md`, `qr_codes.md`, and `cli_commands.md`: nearby protocol references.

- Broader mesh and shared state live under `src/`.
  - `Mesh.*`, `Packet.*`, and `Utils.*`: routing, packet, and crypto primitives.
  - `helpers/BaseChatMesh.*`: shared chat behavior used by companion firmware.
  - `helpers/CommonCLI.*`, `helpers/ClientACL.*`, and `helpers/IdentityStore.*`: config, ACLs, and persisted identity state.

- Fast lookup rules:
  - For connection setup, start with `docs/companion_protocol.md`, then `examples/companion_radio/main.cpp`.
  - For command and response behavior, go straight to `examples/companion_radio/MyMesh.cpp`.
  - For frame boundaries over USB, BLE, or WiFi, inspect the relevant `src/helpers/*Serial*Interface*` implementation.
  - For companion persistence and settings, inspect `examples/companion_radio/DataStore.*`, `examples/companion_radio/NodePrefs.h`, and `src/helpers/IdentityStore.*`.

In this project we use pnpm.

When creating a new feature first write extensive unit tests, and only then implement the feature itself. This way we can find the edge cases and expected behavior before we have to write the actual implementation.
