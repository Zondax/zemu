# Zemu Testing Framework

:::warning Work in progress This project is under development.

API and usage guidelines are **very** likely to change
:::

## Overview

Integration and end-to-end testing of Ledger Apps is a manual and time consuming process. We believe that the Ledger
apps ecosystem is lacking an adequate approach with respect to testing. The Zemu Framework is our solution for this
problem. We stand on the shoulders of the giant [greenknot’s](https://github.com/greenknot) speculos.

_Zemu is an emulation and testing framework for Ledger Nano S/X devices._

## Features

- Minimal configuration + Docker based
- Speculous/Qemu based emulation
- Easy JS API
  - Mocha / Jest compatible
  - Parallelized testing
  - Abstracted device control (buttons, reset, etc.)
  - Screenshots + comparisons
- Future support for Rust & Go
- Debugging Apps with VSCode (Planned)
- PDF reporting (Planned)
- Used by Zondax in multiple apps
