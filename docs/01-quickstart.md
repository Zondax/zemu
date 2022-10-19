# Quickstart

## Import the library

To start testing with Zemu, you'll need to import and create an instance of the `Zemu` class. This is:

```typescript
import Zemu from '@zondax/zemu'
```

Zemu comes with reasonable defaults. Even though, you might be interested on changing a bit the options of Zemu. We'll explain later how to
apply this options. These are the defaults:

```typescript
const DEFAULT_START_OPTIONS = {
  model: 'nanos', // this can be nanos, nanox and nanosp
  sdk: '', // version of the ledger-secure-sdk to use
  logging: false, // some nice logs
  custom: '', // other options passed directly to speculos, the emulator
  startDelay: 20000, // wait time before timeout before connection
  startText: 'Ready', // text to search at the first screen
  caseSensitive: false, // for every text search in the emulator
  startTimeout: 20000, // wait time to have startText after connecting
}
```

You can get this options directly importing them:

```typescript
import Zemu, { DEFAULT_START_OPTIONS } from '@zondax/zemu'
```

If you want to change the mnemonic key that the emulated device is going to use, you can modify the defaults as follows:

```typescript
const APP_SEED = 'equip will roof matter pink blind book anxiety banner elbow sun young' // that's just an example one
const options = {
  ...DEFAULT_START_OPTIONS,
  custom: `-s "${APP_SEED}"`,
}
```

## Start and close the emulator

A transport-based communication interface will be also needed to run Zemu tests, This module is usually developed in JS/TS and it’s custom
made for every application. Additionally you can use this package to integrate your web wallet with Ledger devices. Let’s suppose that it’s
called `DemoApp`.

After importing and deciding our options for Zemu, we need to start the app.

Let's, first of all, instance Zemu. We need to have the `elf` file of our app compiled:

```typescript
const sim = new Zemu('path/to/your/compiled/app.elf')
```

Then, we can start the emulator and pass our options explained before:

```typescript
const APP_SEED = 'equip will roof matter pink blind book anxiety banner elbow sun young' // that's just an example one
const options = {
  ...DEFAULT_START_OPTIONS,
  custom: `-s "${APP_SEED}"`,
}

await sim.start(options) // it returns a promise!
```

Now, we can start to interact with our (emulated) device! To close the emulator, there's the following method available:

```typescript
await sim.close() // it also returns a Promise!
```

## Basic emulated device control

Almost every method in Zemu returns a Promise unless it's clearly specified. Let's go with some examples:

Let's import `Zemu` and instanciate it before everything:

```typescript
import Zemu, { DEFAULT_START_OPTIONS } from '@zondax/zemu'

const sim = new Zemu('path/to/elf/image')
await sim.start(DEFAULT_START_OPTIONS)
```

#### Click emulated buttons

```typescript
await sim.clickLeft()
await sim.clickRight()
await sim.clickBoth()
```

#### Sleep and wait

```typescript
await Zemu.sleep(timeInMs: number)
```

#### Screenshot

This will take a snapshot of the device (and returns a `Promise`, of course).

```typescript
await sim.snapshot(filename?: string) // if filename is defined, save the snapshot there in png
```

You can find other ways to interact with Zemu [here](./10-advanced-moves.md).

## Full example

This is almost all the boilerplate needed to use Zemu:

```typescript
import Zemu, { DEFAULT_START_OPTIONS } from '@zondax/zemu'
const APP_SEED = 'equip will roof matter pink blind book anxiety banner elbow sun young' // our recurrent example

const customOptions = {
  ...DEFAULT_START_OPTIONS,
  custom: `-s "${APP_SEED}"`,
}

test('example', async () => {
  const sim = new Zemu('path/to/your/elf/file.elf')
  try {
    // create an instance of your ledger-js app
    const demoApp = new DemoApp(sim.getTransport())
    // start your simulator
    await sim.start(customOptions)
    // your testing goes here, as you would do in your wallet
  } finally {
    // this will close and remove the container
    await sim.close()
  }
})
```
