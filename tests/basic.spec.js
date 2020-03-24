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

test("empty", async () => {
  expect(true).toEqual(true);
});

test("ledgerSim-Container-start-close", async () => {
  jest.setTimeout(20000);
  const sim = new LedgerSim("../ledger-iov/app/bin/", "127.0.0.1", 8001, 9998);
  await sim.start();
  console.log("Emu started");
  await sim.close();
  console.log("Emu ended");
  expect(true).toEqual(true);
});
