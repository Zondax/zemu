# Zemu

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![npm version](https://badge.fury.io/js/zondpeculos.svg)](https://badge.fury.io/js/zondpeculos)
[![CircleCI](https://circleci.com/gh/Zondax/zondpeculos.svg?style=shield&circle-token=4766b9b560d35854bdf5991fcf3497585a8cc57e)](https://circleci.com/gh/Zondax/zondpeculos)
[![CodeFactor](https://www.codefactor.io/repository/github/zondax/zondpeculos/badge)](https://www.codefactor.io/repository/github/zondax/zondpeculos)

This package is part of our Ledger development and integration testing process. It allows full device/app mocking.

**QuickStart:** \
```LedgerSim``` class provides access and control to your emulated Ledger app running on a docker container.

Basic testing code:
```javascript
jest.setTimeout(20000);

test("demo", async () => {
    //Create LedgerSim object. Pass the path to your .elf file
    const sim = new LedgerSim("/ledger-demo/app/bin/");
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

**Basic control commands examples:**
- Take a screenshot and save it: \
  ```await sim.snapshot("tests/snapshots/0.png")```

- Send "click left": \
```await sim.clickLeft()```

- Send "click right": \
```await sim.clickRight()```

- Send "click both": \
```await sim.clickBoth()```

- Wait some time: \
```await LedgerSim.sleep(500) //Time in [ms]```

We recommend using the npmjs package in order to receive updates/fixes.

**We appreciate any contributions to this effort!**
