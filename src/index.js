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
import PNG from "pngjs";
import fs from "fs";
import rfb from "rfb2";
import sleep from "sleep";
import TransportHttp from "@ledgerhq/hw-transport-http";
import EmuContainer from "./emuContainer";

export const KEYS = {
  NOT_PRESSED: 0,
  PRESSED: 1,
  // /
  LEFT: 0xff51,
  RIGHT: 0xff53,
};

export const WINDOW = {
  x: 0,
  y: 0,
  width: 128,
  height: 32,
};

export const TIMEOUT = 1000;
export const KEYDELAY = 50;
export const DEFAULT_EMU_IMG = "zondax/builder-bolos-emu:latest";

export default class LedgerSim {
  constructor(elfPath, host, vncPort, transportPort) {
    this.host = host;
    this.vnc_port = vncPort;
    this.transport_url = `http://${this.host}:${transportPort}`;
    this.elfPath = elfPath;

    if (elfPath == null) {
      throw new Error("Parameters cannot be null!");
    }

    this.emuContainer = new EmuContainer(elfPath, DEFAULT_EMU_IMG);
  }

  async start() {
    await this.emuContainer.runContainer();
    await this.connect().catch(function(error) {
      console.log(error);
      this.close();
    });
  }

  static saveRGBA2Png(rect, filename) {
    const png = new PNG.PNG({
      width: rect.width,
      height: rect.height,
      data: rect.data,
    });
    png.data = rect.data.slice();
    const buffer = PNG.PNG.sync.write(png, { colorType: 6 });
    fs.writeFileSync(filename, buffer);
  }

  static delay(v) {
    if (v) {
      sleep.msleep(v);
    } else {
      sleep.msleep(KEYDELAY);
    }
  }

  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static async delayedPromise(p, delay) {
    await Promise.race([
      p,
      new Promise(resolve => {
        setTimeout(resolve, delay);
      }),
    ]);
  }

  async connect() {
    this.transport = await TransportHttp(this.transport_url).create(1000);
    await this.connectVNC();
  }

  async connectVNC() {
    return new Promise((resolve, reject) => {
      this.session = rfb.createConnection({
        host: this.host,
        port: this.vnc_port,
      });
      const { session } = this;
      this.session.on("connect", function() {
        console.log("successfully connected and authorised");
        session.keyEvent(KEYS.LEFT, KEYS.NOT_PRESSED);
        session.keyEvent(KEYS.RIGHT, KEYS.NOT_PRESSED);
        resolve(true);
      });

      this.session.on("error", function(error) {
        console.log("Could not connect to port ", this.vnc_port, " on ", this.host);
        reject(error);
      });

      setTimeout(() => reject(new Error("timeout on connectVNC")), 10000);
    });
  }

  async close() {
    await this.emuContainer.stop();
    this.session.end();
  }

  getTransport() {
    return this.transport;
  }

  async snapshot(filename) {
    const { session } = this;
    return new Promise((resolve, reject) => {
      session.once("rect", rect => {
        if (filename) {
          LedgerSim.saveRGBA2Png(rect, filename);
        }
        resolve(rect);
      });
      session.requestUpdate(false, 0, 0, WINDOW.width, WINDOW.height);
      setTimeout(() => reject(new Error("timeout")), TIMEOUT);
    });
  }

  async clickLeft(filename) {
    this.session.keyEvent(KEYS.LEFT, KEYS.PRESSED);
    LedgerSim.delay();
    this.session.keyEvent(KEYS.LEFT, KEYS.NOT_PRESSED);
    LedgerSim.delay();
    return this.snapshot(filename);
  }

  async clickRight(filename) {
    this.session.keyEvent(KEYS.RIGHT, KEYS.PRESSED);
    LedgerSim.delay();
    this.session.keyEvent(KEYS.RIGHT, KEYS.NOT_PRESSED);
    LedgerSim.delay();
    return this.snapshot(filename);
  }

  async clickBoth(filename) {
    this.session.keyEvent(KEYS.LEFT, KEYS.PRESSED);
    this.session.keyEvent(KEYS.RIGHT, KEYS.PRESSED);
    LedgerSim.delay();
    this.session.keyEvent(KEYS.LEFT, KEYS.NOT_PRESSED);
    this.session.keyEvent(KEYS.RIGHT, KEYS.NOT_PRESSED);
    LedgerSim.delay();
    return this.snapshot(filename);
  }
}
