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
export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_VNC_PORT = 8001;
export const DEFAULT_TRANSPORT_PORT = 9998;

export default class Zemu {
  constructor(
    elfPath,
    host = DEFAULT_HOST,
    vncPort = DEFAULT_VNC_PORT,
    transportPort = DEFAULT_TRANSPORT_PORT,
  ) {
    this.host = host;
    this.vnc_port = vncPort;
    this.transport_url = `http://${this.host}:${transportPort}`;
    this.elfPath = elfPath;

    if (this.elfPath == null) {
      throw new Error("elfPath cannot be null!");
    }

    this.emuContainer = new EmuContainer(this.elfPath, DEFAULT_EMU_IMG);
  }

  async start(logging = false, x11 = false) {
    await this.emuContainer.runContainer(logging, x11);
    // eslint-disable-next-line func-names
    await this.connect().catch(error => {
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
    // FIXME: Can we detect open ports?
    Zemu.delay(1000);

    this.transport = await TransportHttp(this.transport_url).open(this.transport_url);
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
          Zemu.saveRGBA2Png(rect, filename);
        }
        resolve(rect);
      });
      session.requestUpdate(false, 0, 0, WINDOW.width, WINDOW.height);
      setTimeout(() => reject(new Error("timeout")), TIMEOUT);
    });
  }

  async clickLeft(filename) {
    this.session.keyEvent(KEYS.LEFT, KEYS.PRESSED);
    Zemu.delay();
    this.session.keyEvent(KEYS.LEFT, KEYS.NOT_PRESSED);
    Zemu.delay();
    return this.snapshot(filename);
  }

  async clickRight(filename) {
    this.session.keyEvent(KEYS.RIGHT, KEYS.PRESSED);
    Zemu.delay();
    this.session.keyEvent(KEYS.RIGHT, KEYS.NOT_PRESSED);
    Zemu.delay();
    return this.snapshot(filename);
  }

  async clickBoth(filename) {
    this.session.keyEvent(KEYS.LEFT, KEYS.PRESSED);
    this.session.keyEvent(KEYS.RIGHT, KEYS.PRESSED);
    Zemu.delay();
    this.session.keyEvent(KEYS.LEFT, KEYS.NOT_PRESSED);
    this.session.keyEvent(KEYS.RIGHT, KEYS.NOT_PRESSED);
    Zemu.delay();
    return this.snapshot(filename);
  }
}
