/** ******************************************************************************
 *  (c) 2020 ZondaX GmbH
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

jest.setTimeout(10000);
const DEMO_APP_PATH = Resolve("bin/demoApp/app.elf");

const APP_SEED = "equip will roof matter pink blind book anxiety banner elbow sun young";
const ZEMU_OPTIONS = {
  logging: true,
  start_delay: 3000,
  custom: `-s "${APP_SEED}" `,
  //  custom: `-s "${APP_SEED}" --debug`,
  X11: true,
};

test("File-Missing", async () => {
  assert.throws(() => new Zemu("it_does_not_exist"), /Did you compile/);
});

test("Start&Close", async () => {
  const sim = new Zemu(DEMO_APP_PATH);
  expect(sim).not.toBeNull();
  try {
    await sim.start(ZEMU_OPTIONS);
  } finally {
    await sim.close();
  }
});

test("Snapshot", async () => {
  const sim = new Zemu(DEMO_APP_PATH);
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

test("Basic Control", async () => {
  const sim = new Zemu(DEMO_APP_PATH);
  try {
    await sim.start(ZEMU_OPTIONS);

    await sim.clickLeft();
    await sim.clickLeft();
    await sim.clickLeft();

    // Move up and down and check screens
    const view0 = await sim.snapshot("tests/tmp/0.png");
    const view1 = await sim.clickRight("tests/tmp/1.png");
    const view2 = await sim.clickLeft("tests/tmp/2.png");

    // compare to check that it went back to the same view
    expect(view2).toEqual(view0);
    expect(view1).not.toEqual(view0);
  } finally {
    await sim.close();
  }
});

test("Load/Compare Snapshots", async () => {
  const image1A = Zemu.LoadPng2RGB("tests/snapshots/image1A.png")
  const image1B = Zemu.LoadPng2RGB("tests/snapshots/image1B.png")
  const image2A = Zemu.LoadPng2RGB("tests/snapshots/image2A.png")

  expect(image1A).toEqual(image1B);
  expect(image1A).not.toEqual(image2A);
});

test("GRPC Server start-stop", async () => {
  const sim = new Zemu(DEMO_APP_PATH);
  await sim.start(ZEMU_OPTIONS);
  sim.startgrpcServer("localhost", "3002");
  await Zemu.sleep(3000);
  await sim.close();
});
