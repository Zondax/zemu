# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Zemu is an emulation and testing framework for Ledger Nano S+/X, Stax, Flex and Apex P devices. It provides a JavaScript/TypeScript
API for automated testing of Ledger applications using Docker-based emulation via Speculos/QEMU.

## Common Development Commands

### Build

```bash
pnpm build              # Builds the TypeScript project to dist/
```

### Testing

```bash
pnpm test              # Runs all tests (includes test:clean and build)
pnpm test:clean        # Cleans up test environment
pnpm test:watch        # Run tests in watch mode for development
vitest run             # Run tests directly after building
vitest tests/basic.test.ts  # Run a specific test file
```

### Linting and Formatting

```bash
pnpm lint              # Run Biome linter
pnpm lint:fix          # Run Biome linter with auto-fix
pnpm format            # Run Biome formatter
pnpm check             # Run both linting and formatting
pnpm check:fix         # Run both linting and formatting with auto-fix
```

## Architecture

### Core Components

1. **Zemu Class** (`src/Zemu.ts`): Main entry point that manages emulator lifecycle, device interactions, and screenshot
   comparisons.

2. **Device Models & Actions**:
   - `src/types.ts`: Defines device models (nanosp, nanox, stax, flex, apex_p) and interaction types
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

- `IStartOptions`: Configuration for emulator startup including model, custom Speculos parameters and timeouts
- `IDeviceModel`: Device specifications with display dimensions and paths
- `INavElement`: Navigation element definitions for UI automation

## Testing Patterns

Tests should follow the pattern in `tests/basic.test.ts` (device list and options live in `tests/common.ts`):

1. Create Zemu instance with appropriate model and options
2. Start the emulator
3. Perform device interactions (button clicks, swipes)
4. Take screenshots for visual regression testing
5. Clean up by closing the emulator

Example test structure:

```typescript
const sim = new Zemu(m.path);
try {
  await sim.start({ ...defaultOptions, model: m.name });
  await sim.clickRight();
  await sim.clickBoth();
  expect(await sim.navigateAndCompareSnapshots('tests', 'my-testcase', [1, 0])).toBe(true);
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
- Test snapshots are stored in `tests/snapshots/`; new runs write to `tests/snapshots-tmp/`, copy them over to update the goldens
- Test fixtures in `bin/` are builds of the Polymesh Ledger app for each supported device
- Global test setup automatically cleans up dangling containers on SIGINT

## Environment Configuration

- **DISPLAY**: Passed through to the container. Speculos always runs headless, so it is not required
- **Node.js 22**: Project requires Node.js 22 or later (see .mise.toml)
- **pnpm**: Uses pnpm 10 as package manager (see .mise.toml)

## Release Process

The project uses GitHub releases with automated npm publishing:

- Tags follow format `v[0-9]+(\.[0-9]+)*` (e.g., v1.0.0, v2.3.1)
- Publishing workflow automatically updates package version from git tag
- Published to npm under `@zondax` scope
- Uses pnpm for dependency management and CI/CD
