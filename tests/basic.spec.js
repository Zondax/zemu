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
import LedgerSim from "../src";
import MinimalApp from "./minapp";

test("ledgerSim-Container-start-close", async () => {
  jest.setTimeout(20000);
  const sim = new LedgerSim("../ledger-filecoin/app/bin/", "127.0.0.1", 8001, 9998);
  try {
    await sim.start();
  } finally {
    await sim.close();
  }
  expect(true).toEqual(true);
});

test("ledgerSim-snapshot", async () => {
  jest.setTimeout(20000);
  const sim = new LedgerSim("../ledger-filecoin/app/bin/", "127.0.0.1", 8001, 9998);
  expect(sim).not.toBeNull();

  try {
    await sim.start();
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

test("ledgerSim-control", async () => {
  jest.setTimeout(20000);
  const sim = new LedgerSim("../ledger-filecoin/app/bin/", "127.0.0.1", 8001, 9998);
  try {
    await sim.start();

    await sim.clickLeft();
    await sim.clickLeft();
    await sim.clickLeft();

    // Move up and down and check screens
    const view0 = await sim.snapshot("tests/snapshots/0.png");
    const view1 = await sim.clickRight("tests/snapshots/1.png");
    const view2 = await sim.clickLeft("tests/snapshots/2.png");

    // compare to check that it went back to the same view
    expect(view2).toEqual(view0);
    expect(view1).not.toEqual(view0);
  } finally {
    await sim.close();
  }
});

test("ledgerSim-apdu", async () => {
  jest.setTimeout(20000);
  const sim = new LedgerSim("../ledger-filecoin/app/bin/", "127.0.0.1", 8001, 9998);
  try {
    await sim.start();
    const app = new MinimalApp(sim.transport);
    const version = await app.appInfo();
    console.log(version);
  } finally {
    await sim.close();
  }
});
