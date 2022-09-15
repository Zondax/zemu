# Zemu

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![npm version](https://badge.fury.io/js/%40zondax%2Fzemu.svg)](https://badge.fury.io/js/%40zondax%2Fzemu)
[![GithubActions](https://github.com/Zondax/zemu/actions/workflows/main.yml/badge.svg)](https://github.com/Zondax/zemu/blob/main/.github/workflows/main.yml)

> **We appreciate any contributions to this effort!**
>
> We recommend using the npmjs package in order to receive updates/fixes.

**This project is under active development - API and usage guidelines are _very_ likely to change**

## Overview

Integration and end-to-end testing of Ledger Apps is a manual and time consuming process. We believe that the Ledger apps ecosystem is
lacking an adequate approach with respect to testing. The Zemu Framework is our solution for this problem. Under the hood, Zemu uses
Ledger's project [speculos](https://github.com/ledgerHQ/speculos). It's currently being used in every Ledger App built by Zondax, among many
others (such as Ethereum one built by Ledger team).

_Zemu is an emulation and testing framework for Ledger Nano S/S+/X devices._

## Features

- Minimal configuration + Docker based
- Speculos/Qemu based emulation
- Easy JS API
  - Mocha / Jest compatible
  - Parallelized testing
  - Abstracted device control (buttons, reset, etc.)
  - Navigate thru screens and take screenshots of them
- Debugging (support for CLion and vscode, even mixed C/Rust)

## Docs

Check our documentation and quickstart at https://docs.zondax.ch
