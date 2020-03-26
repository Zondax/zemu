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
import FilecoinApp from "@zondax/ledger-filecoin"

test("ledgerSim-Filecoin-get_version", async () => {
  jest.setTimeout(20000);
  const sim = new LedgerSim("../ledger-filecoin/app/bin/", "127.0.0.1", 8001, 9998);
  await sim.start();
  console.log("Emu started");
try{
  const app = new FilecoinApp(sim.getTransport());
  const resp = await app.getVersion();
  console.log(resp);
  expect(resp.return_code).toEqual(36864);
  expect(resp.error_message).toEqual("No errors");
  expect(resp).toHaveProperty("test_mode");
  expect(resp).toHaveProperty("major");
  expect(resp).toHaveProperty("minor");
  expect(resp).toHaveProperty("patch");
  expect(resp.test_mode).toEqual(false);
} finally {
  await sim.close();
  console.log("Emu ended");
}
});

test("ledgerSim-Filecoin-getAddressAndPubKey", async () => {
  jest.setTimeout(20000);
  const sim = new LedgerSim("../ledger-filecoin/app/bin/", "127.0.0.1", 8001, 9998);
  await sim.start();
  console.log("Emu started");
  try {
    const app = new FilecoinApp(sim.getTransport());
    const path = "m/44'/461'/5'/0/3";
    const resp = await app.getAddressAndPubKey(path);

    console.log(resp);

    expect(resp.return_code).toEqual(36864);
    expect(resp.error_message).toEqual("No errors");

    expect(resp).toHaveProperty("addrByte");
    expect(resp).toHaveProperty("addrString");
    expect(resp).toHaveProperty("compressed_pk");

    expect(resp.compressed_pk.length).toEqual(65);
    expect(resp.compressed_pk.toString("hex")).toEqual(
      "04240ecf6ec722b701f051aaaffde7455a56e433139e4c0ff2ad7c8675e2cce104a8027ba13e5bc640ec9932cce184f33a789bb9c32f41e34328118b7862fc9ca2",
    );

    expect(resp.addrByte.toString("hex")).toEqual("0175a6b113220c2f71c4db420753aab2cef5edb6a8");
    expect(resp.addrString).toEqual("f1owtlcezcbqxxdrg3iidvhkvsz3263nvijwpumui");
  } finally {
    await sim.close();
    console.log("Emu ended");
  }
});

test("sign_and_verify", async () => {
  // noinspection ES6ModulesDependencies
  jest.setTimeout(60000);
  const sim = new LedgerSim("../ledger-filecoin/app/bin/", "127.0.0.1", 8001, 9998);
  await sim.start();
  try {
    const app = new FilecoinApp(sim.getTransport());

    // Derivation path. First 3 items are automatically hardened!
    const path = "m/44'/461'/0'/0/0";
    const message = Buffer.from(
      "885501fd1d0f4dfcd7e99afcb99a8326b7dc459d32c6285501b882619d46558f3d9e316d11b48dcf211327025a0144000186a0430009c4430061a80040",
      "hex",
    );

    const responsePk = await app.getAddressAndPubKey(path);
    var responseSign;
    app.sign(path, message).then(function(response){
        responseSign = response;
    });

    await LedgerSim.sleep(500);
 
    await sim.clickBoth();
    await sim.clickRight();
    await sim.clickBoth();

    await LedgerSim.sleep(500);

    expect(responsePk.return_code).toEqual(36864);
    expect(responsePk.error_message).toEqual("No errors");
    expect(responseSign.return_code).toEqual(36864);
    expect(responseSign.error_message).toEqual("No errors");

    /*
    // Calculate message digest
    const msgDigest = getDigest(message);

    // Check signature is valid
    const signatureDER = responseSign.signature_der;
    const signature = secp256k1.signatureImport(signatureDER);

    // Check compact signatures
    const sigBuf = Buffer.from(signature);
    const sigCompBuf = Buffer.from(responseSign.signature_compact.slice(0, 64));

    expect(sigBuf).toEqual(sigCompBuf);

    const signatureOk = secp256k1.ecdsaVerify(signature, msgDigest, responsePk.compressed_pk);
    expect(signatureOk).toEqual(true);
    */

  } finally {
    await sim.close();
    console.log("Emu ended");
  }
});