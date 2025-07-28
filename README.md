# Zemu

![zondax_light](docs/assets/zondax_light.png#gh-light-mode-only)

![zondax_dark](docs/assets/zondax_dark.png#gh-dark-mode-only)

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![npm version](https://badge.fury.io/js/%40zondax%2Fzemu.svg)](https://badge.fury.io/js/%40zondax%2Fzemu)
[![CI](https://github.com/Zondax/zemu/actions/workflows/ci-ts.yaml/badge.svg)](https://github.com/Zondax/zemu/actions/workflows/ci-ts.yaml)

> **We appreciate any contributions to this effort!**
>
> We recommend using the npmjs package in order to receive updates/fixes.

**This project is under active development - API and usage guidelines are _very_ likely to change**

## Overview

Integration and end-to-end testing of Ledger Apps is a manual and time consuming process. We believe that the Ledger
apps ecosystem is lacking an adequate approach with respect to testing. The Zemu Framework is our solution for this
problem. Under the hood, Zemu uses Ledger's project [speculos](https://github.com/ledgerHQ/speculos). It's currently
being used in every Ledger App built by Zondax, among many others (such as Ethereum one built by Ledger team).

_Zemu is an emulation and testing framework for Ledger Nano S/S+/X/Stax/Flex devices._

## Features

- Minimal configuration + Docker based
- Speculos/Qemu based emulation
- Container pooling for improved test performance
- Easy JS/TypeScript API
  - Vitest / Jest / Mocha compatible
  - Parallelized testing
  - Abstracted device control (buttons, reset, etc.)
  - Navigate thru screens and take screenshots of them
- Support for all Ledger devices (Nano S/S+/X/Stax/Flex)
- Enhanced error handling with detailed APDU status codes
- Debugging (support for CLion and vscode, even mixed C/Rust)

## Installation

```bash
npm install --save-dev @zondax/zemu
# or
pnpm add -D @zondax/zemu
```

## Quick Start

```typescript
import Zemu from '@zondax/zemu'

const sim = new Zemu(APP_PATH)
await sim.start({ model: 'nanos' })

// Interact with your app
await sim.clickRight()
await sim.clickBoth()

// Take screenshots
const screenshot = await sim.snapshot()

// Clean up
await sim.close()
```

## Docs

Check our documentation and quickstart at https://docs.zondax.ch

# Who we are?

We are Zondax, a company pioneering blockchain services. If you want to know more about us, please visit us at
[zondax.ch](https://zondax.ch)
