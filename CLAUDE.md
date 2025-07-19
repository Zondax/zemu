# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Zemu is an emulation and testing framework for Ledger Nano S/S+/X/Stax/Flex devices. It provides a JavaScript/TypeScript
API for automated testing of Ledger applications using Docker-based emulation via Speculos/QEMU.

## Common Development Commands

### Build

```bash
pnpm build              # Builds the TypeScript project to dist/
pnpm copy-files        # Copies proto files to dist/
```

### Testing

```bash
pnpm test              # Runs all tests (includes test:clean and build)
pnpm test:clean        # Cleans up test environment
jest                   # Run tests directly after building
jest tests/basic.s.test.ts  # Run a specific test file
jest --watch           # Run tests in watch mode for development
```

### Linting and Formatting

```bash
pnpm linter            # Run ESLint
pnpm linter:fix        # Run ESLint with auto-fix
pnpm format            # Run Prettier to format code
```

## Architecture

### Core Components

1. **Zemu Class** (`src/Zemu.ts`): Main entry point that manages emulator lifecycle, device interactions, and screenshot
   comparisons.

2. **Device Models & Actions**:
   - `src/types.ts`: Defines device models (nanos, nanosp, nanox, stax, flex) and interaction types
   - `src/actions.ts`: Navigation implementations (ClickNavigation, TouchNavigation)
   - `src/buttons*.ts`: Device-specific button mappings for each model

3. **Communication Layer**:
   - Uses `@ledgerhq/hw-transport-http` for device communication
   - gRPC interface (`src/grpc/`) for advanced emulator control
   - Docker integration via `dockerode` for container management

4. **Testing Utilities**:
   - Screenshot capture and comparison using `pngjs`
   - Built-in wait conditions and timeouts
   - Support for both touch and button-based navigation

### Key Interfaces

- `IStartOptions`: Configuration for emulator startup including model, SDK version, custom parameters
- `IDeviceModel`: Device specifications with display dimensions and paths
- `INavElement`: Navigation element definitions for UI automation

## Testing Patterns

Tests should follow the pattern in `tests/basic.*.test.ts`:

1. Create Zemu instance with appropriate model and options
2. Start the emulator
3. Perform device interactions (button clicks, swipes)
4. Take screenshots for visual regression testing
5. Clean up by closing the emulator

Example test structure:

```typescript
const sim = new Zemu(DEMO_APP_PATH_S);
try {
  await sim.start(ZEMU_OPTIONS_S);
  await sim.clickRight();
  await sim.clickBoth();
  const snapshot = await sim.snapshot();
  expect(snapshot).toMatchImageSnapshot();
} finally {
  await sim.close();
}
```

## Important Notes

- The framework uses Docker containers for emulation - ensure Docker is running
- Default ports are dynamically allocated using `get-port`
- Screenshot comparisons are pixel-perfect by default
- Supports parallel test execution with isolated containers
- Built-in retry logic for HTTP requests via `axios-retry`
- Test snapshots are stored in `tests/snapshots/` for visual regression testing
- Global test setup automatically cleans up dangling containers on SIGINT

## Environment Configuration

- **DISPLAY**: Required for X11 display forwarding on Linux. On macOS, defaults to `host.docker.internal:0`
- **Node.js 22**: Project requires Node.js 22 or later (see .nvmrc)
- **pnpm**: Uses pnpm as package manager (>=8.0.0)

## Release Process

The project uses GitHub releases with automated npm publishing:

- Tags follow format `v[0-9]+(\.[0-9]+)*` (e.g., v1.0.0, v2.3.1)
- Publishing workflow automatically updates package version from git tag
- Published to npm under `@zondax` scope
- Uses pnpm for dependency management and CI/CD
