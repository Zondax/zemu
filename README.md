# Zondax Zemu Testing Framework

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![npm version](https://badge.fury.io/js/%40zondax%2Fzemu.svg)](https://badge.fury.io/js/%40zondax%2Fzemu)
[![CircleCI](https://circleci.com/gh/Zondax/zemu.svg?style=shield&circle-token=4766b9b560d35854bdf5991fcf3497585a8cc57e)](https://circleci.com/gh/Zondax/zemu)

> **We appreciate any contributions to this effort!**
>
> We recommend using the npmjs package in order to receive updates/fixes.

**This project is under active development - API and usage guidelines are *very* likely to change**

## Overview

Integration and end-to-end testing of Ledger Apps is a manual and time consuming process. We believe that the Ledger apps ecosystem is lacking an adequate approach with respect to testing. The Zemu Framework is our solution for this problem. We stand on the shoulders of the giant [greenknot’s](https://github.com/greenknot) speculos.

*Zemu is an emulation and testing framework for Ledger Nano S/X devices.*

## Features

- Minimal configuration + Docker based
- Speculous/Qemu based emulation
- Easy JS API
    - Mocha / Jest compatible
    - Parallelized testing
    - Abstracted device control (buttons, reset, etc.)
    - Screenshots + comparisons
- Debugging (support for CLion and vscode, even mixed C/Rust)
- Used by Zondax in multiple apps

## QuickStart

```Zemu``` class provides access and control to your emulated Ledger app running on a docker container.

Basic testing code:
```javascript
jest.setTimeout(20000);

test("demo", async () => {
    //Create Zemu object. Pass the path to your .elf file
    const sim = new Zemu("/ledger-demo/app/bin/");
    //Create an instance of your Ledger-js app
  try {
    const demoJSApp = new DemoApp(sim.getTransport());
    //Start simulator. A new docker container instance will be created.
    await sim.start();
    //Do your tests
    ...
    //Finally, close the simulator. This will stop and remove the container.
  } finally {
    await sim.close();
  }
});
```

## Basic control commands examples:**

- Take a screenshot and save it: \
  ```await sim.snapshot("tests/snapshots/0.png")```

- Send "click left": \
```await sim.clickLeft()```

- Send "click right": \
```await sim.clickRight()```

- Send "click both": \
```await sim.clickBoth()```

- Wait some time: \
```await Zemu.sleep(500) //Time in [ms]```
