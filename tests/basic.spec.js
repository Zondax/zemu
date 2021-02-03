/** ******************************************************************************
 *  (c) 2020 Zondax GmbH
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 ******************************************************************************* */
import { expect, test } from "jest";
import assert from "assert";
import Zemu from "../src";

const Resolve = require("path").resolve;

jest.setTimeout(15000);
const DEMO_APP_PATH_S = Resolve("bin/demoAppS.elf");
const DEMO_APP_PATH_X = Resolve("bin/demoAppX.elf");

const APP_SEED = "equip will roof matter pink blind book anxiety banner elbow sun young";
const ZEMU_OPTIONS = {
  logging: true,
  start_delay: 3000,
  custom: `-s "${APP_SEED}" `,
  X11: false,
};

const ZEMU_OPTIONS_S = {
  model : 'nanos',
  ...ZEMU_OPTIONS
};

const ZEMU_OPTIONS_X = {
  model : 'nanox',
  ...ZEMU_OPTIONS
};

test("File-Missing", async () => {
  assert.throws(() => new Zemu("it_does_not_exist"), /Did you compile/);
});

test("Start&Close-NanoS", async () => {
  const sim = new Zemu(DEMO_APP_PATH_S);
  expect(sim).not.toBeNull();
  try {
    await sim.start(ZEMU_OPTIONS_S);
  } finally {
    await sim.close();
  }
});

test("Start&Close-NanoX", async () => {
  const sim = new Zemu(DEMO_APP_PATH_X);
  expect(sim).not.toBeNull();
  try {
    await sim.start(ZEMU_OPTIONS_X);
  } finally {
    await sim.close();
  }
});

test("Trying to run in nano S mode with a nano X elf", async () => {
  const sim = new Zemu(DEMO_APP_PATH_S);
  expect(sim).not.toBeNull();
  try {
    await sim.start(ZEMU_OPTIONS_X);
  } catch(err) {
    expect(err).toEqual(new Error("Zemu model is set to 'nanox' but elf file doesn't seem to be nano x build. Did you pass the right elf ?"));
  } finally {
    await sim.close();
  }
});

test("Snapshot", async () => {
  const sim = new Zemu(DEMO_APP_PATH_S);
  try {
    await sim.start(ZEMU_OPTIONS);
    expect(sim.session.title).toEqual("LibVNCServer");
    expect(sim.session.width).toEqual(128);
    expect(sim.session.height).toEqual(32);

    const snapshot = await sim.snapshot();
    expect(snapshot.width).toEqual(128);
    expect(snapshot.height).toEqual(32);
  } finally {
    await sim.close();
  }
});

test("Basic Control - S", async () => {
  const sim = new Zemu(DEMO_APP_PATH_S);
  try {
    await sim.start(ZEMU_OPTIONS);

    await sim.clickLeft();
    await sim.clickLeft();
    await sim.clickLeft();

    // Move up and down and check screens
    const view0 = await sim.snapshot("tests/tmp/00000.png");
    const view1 = await sim.clickRight("tests/tmp/00001.png");
    const view2 = await sim.clickLeft("tests/tmp/00002.png");

    // compare to check that it went back to the same view
    expect(view2).toEqual(view0);
    expect(view1).not.toEqual(view0);
  } finally {
    await sim.close();
  }
});

test("Basic Control - X", async () => {
  const sim = new Zemu(DEMO_APP_PATH_X);
  try {
    await sim.start(ZEMU_OPTIONS_X);

    await sim.clickLeft();
    await sim.clickLeft();
    await sim.clickLeft();

    // Move up and down and check screens
    const view0 = await sim.snapshot("tests/tmpX/00000.png");
    const view1 = await sim.clickRight("tests/tmpX/00001.png");
    const view2 = await sim.clickLeft("tests/tmpX/00002.png");

    // compare to check that it went back to the same view
    expect(view2).toEqual(view0);
    expect(view1).not.toEqual(view0);
  } finally {
    await sim.close();
  }
});

test("Load/Compare Snapshots", async () => {
  const image1A = Zemu.LoadPng2RGB("tests/snapshots/image1A.png");
  const image1B = Zemu.LoadPng2RGB("tests/snapshots/image1B.png");
  const image2A = Zemu.LoadPng2RGB("tests/snapshots/image2A.png");

  expect(image1A).toEqual(image1B);
  expect(image1A).not.toEqual(image2A);
});

test("Wait for change / timeout", async () => {
  const sim = new Zemu(DEMO_APP_PATH_S);
  try {
    await sim.start(ZEMU_OPTIONS);
    const result = sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot(), 2000);
    await expect(result).rejects.toEqual("Timeout waiting for screen to change (2000 ms)");
  } finally {
    await sim.close();
  }
});

test("GRPC Server start-stop", async () => {
  const sim = new Zemu(DEMO_APP_PATH_S);
  await sim.start(ZEMU_OPTIONS);
  sim.startgrpcServer("localhost", "3002");
  await Zemu.sleep(3000);
  await sim.close();
});

test("Snapshot and compare", async () => {
  const sim = new Zemu(DEMO_APP_PATH_S);
  try {
    await sim.start(ZEMU_OPTIONS);

    await sim.compareSnapshotsAndAccept("tests", "compare_test", 2);
  } finally {
    await sim.close();
  }
});

test("Snapshot and compare 2", async () => {
  const sim = new Zemu(DEMO_APP_PATH_S);
  try {
    await sim.start(ZEMU_OPTIONS);

    await sim.compareSnapshotsAndAccept("tests", "compare_test2", 2, 1);
  } finally {
    await sim.close();
  }
});

test("Load and run a library", async () => {
  const LITECOIN_PATH = Resolve("bin/litecoin.elf");
  const BITCOIN_LIB = { "Bitcoin": Resolve("bin/bitcoin.elf") };
  const sim = new Zemu(LITECOIN_PATH, BITCOIN_LIB);
  try {
    await sim.start(ZEMU_OPTIONS);

    // If we can see the main screen, then the library has been loaded with success
    await sim.snapshot("tests/tmp/libWelcome.png");
    const testLibWelcome = Zemu.LoadPng2RGB("tests/tmp/libWelcome.png");
    const goldenLibWelcome = Zemu.LoadPng2RGB("tests/snapshots/libWelcome.png");
    expect(testLibWelcome).toEqual(goldenLibWelcome);
  } finally {
    await sim.close();
  }
});