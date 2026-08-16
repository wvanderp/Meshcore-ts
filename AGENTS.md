# meshcore-ts agent guide

## Project purpose

`meshcore-ts` is a framework-agnostic TypeScript library for connecting to MeshCore companion devices over serial, Web Serial, and Web Bluetooth. It implements the client side of the companion protocol and exposes parsed, validated, strongly typed data to applications.

Keep protocol knowledge in this library. Consumers should not need to interpret frames, decode payloads, validate protocol values, or reproduce companion behavior. Do not add React or other application-framework concerns to the package.

## Source of truth

The current [MeshCore firmware](https://github.com/meshcore-dev/MeshCore) is authoritative for wire formats and runtime behavior. Trace the relevant firmware path before implementing or changing protocol behavior; do not rely only on assumptions, existing library behavior, or prose documentation.

Use these upstream locations as starting points:

- `examples/companion_radio/MyMesh.h` and `MyMesh.cpp` define companion commands, responses, pushes, and their behavior.
- `examples/companion_radio/DataStore.*` and `NodePrefs.h` cover companion state and settings.
- `src/helpers/*Serial*Interface*` implementations define framing over USB, UART, BLE, and WiFi.
- `docs/companion_protocol.md`, `docs/stats_binary_frames.md`, and nearby protocol documents provide supporting explanations.

When documentation and current firmware disagree, implement the firmware behavior. Preserve the discrepancy in a focused test and, where it helps future maintainers, a concise code comment or documentation note.

## Architecture and clean code

Maintain clear responsibilities between binary readers and writers, protocol models and constants, command serialization, frame parsing, connection orchestration, and transport implementations. Parse a piece of protocol data in one canonical place and expose the result through a stable library API.

Prefer small, cohesive abstractions and straightforward control flow. Avoid duplicated parsing, large multi-purpose methods, hidden coupling, unsafe casts, and speculative generalization. Names should express protocol meaning rather than incidental byte positions or implementation details.

Leave code you touch cleaner than you found it. Refactor confusing, duplicated, weakly typed, or poorly separated code when it is relevant to the requested work. Protect refactors with tests and preserve public behavior unless a compatibility change is intentional. Keep cleanup within the affected subsystem; record unrelated redesign opportunities instead of silently expanding the change.

## Types and parsing

Use TypeScript as the first correctness check. Model protocol concepts with precise types, literal types, discriminated unions, and explicit optional or nullable fields. Avoid `any`, unnecessarily broad primitives, and type assertions that conceal uncertainty.

Treat bytes received from a device as untrusted input. At the parsing boundary, validate frame lengths, tags, ranges, variants, and other firmware-defined invariants before producing typed domain values. Unknown, malformed, and truncated data must have intentional behavior. A type assertion is never a substitute for runtime validation.

Keep public types useful to consumers: return meaningful protocol values rather than loosely typed objects or raw fields that require further interpretation. Treat exported types, events, errors, and method behavior as compatibility-sensitive. Add new public exports deliberately through `src/index.ts`.

## Tests and implementation workflow

Use pnpm. For behavior changes, write or update tests before implementing the change. A defect fix starts with a regression test that demonstrates the defect.

Tests must exercise both the type contract and runtime behavior. Cover the cases relevant to the change, including:

- Compile-time inference and narrowing for changed public types, using Vitest's type assertions where appropriate.
- Representative firmware-compatible frames and values.
- Malformed and truncated input.
- Unknown tags or variants and numeric boundaries.
- Asynchronous response ordering, timeouts, rejection, and listener cleanup.
- Transport connection, framing, disconnection, and error behavior.

Keep tests deterministic and assert observable behavior instead of private implementation details. Maintain the coverage thresholds configured in `vitest.config.ts`; do not weaken them to make a change pass.

we are working with the clasical school of testing, that means that we try to use as many of the real classes as possible, and we try to avoid mocking. The only exception are when we need to simulate side effects, or when we cant simulate the behavior in the real classes. this means that we should design our classes to be testable, and we should avoid static methods, singletons, and other patterns that make testing difficult.

Run checks in this order:

1. `pnpm run typecheck`
2. `pnpm run lint`
3. `pnpm run test`
4. `pnpm run build` when changing exports, declarations, package configuration, or generated package behavior

## Documentation and examples

Documentation is part of the implementation and is required before work is complete. The code, JSDoc, README, examples, types, and tests must describe the same behavior as the current firmware.

Add or update JSDoc for affected public classes and non-obvious public APIs. Document parameters, return values, emitted events, errors, validation behavior, and firmware constraints where relevant. Explain why a protocol-specific decision exists rather than narrating the code.

Public classes and non-obvious APIs need realistic, type-correct examples. Update README examples and API guidance whenever an important consumer workflow or public behavior changes. Examples should use the package's actual exports and demonstrate recommended usage rather than merely proving that a method can be called.

Documentation-only and internal refactoring changes do not require artificial new tests or README sections, but any existing documentation made inaccurate by the change must be corrected.

## definitions

companion: the hardware that run the meshcore and has the lora antenna
companion software or firmwere: is the CPP code running on the hardware that communicates with the lib over bluetooth, ip, or usb
library: this library and related code
client: a pice of software that consumes this library to make connection to the meshcore device.