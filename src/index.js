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
import fs from "fs-extra";
import rfb from "rfb2";
import sleep from "sleep";
import TransportHttp from "@ledgerhq/hw-transport-http";
import EmuContainer from "./emuContainer";
import GRPCRouter from "./grpc";

const rndstr = require("randomstring");

const KILL_TIMEOUT = 10000;

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
export const KEYDELAY = 350;
export const DEFAULT_EMU_IMG =
  "zondax/builder-zemu@sha256:4b793ac77c29870e6046e1d0a5019643fd178530205f9cf983bfadd114abca0a";
export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_VNC_PORT = 8001;
export const DEFAULT_TRANSPORT_PORT = 9998;
export const BASE_NAME = "zemu-656d75-";

export default class Zemu {
  constructor(
    elfPath,
    libElfs = {},
    host = DEFAULT_HOST,
    vncPort = DEFAULT_VNC_PORT,
    transportPort = DEFAULT_TRANSPORT_PORT,
  ) {
    this.host = host;
    this.vnc_port = vncPort;
    this.transport_url = `http://${this.host}:${transportPort}`;
    this.elfPath = elfPath;
    this.libElfs = libElfs;
    this.press_delay = KEYDELAY;
    this.grpcManager = null;
    this.mainMenuSnapshot = null;

    if (this.elfPath == null) {
      throw new Error("elfPath cannot be null!");
    }

    if (!fs.existsSync(this.elfPath)) {
      throw new Error("elf file was not found! Did you compile?");
    }

    Object.keys(libElfs).forEach((libName) => {
      if (!fs.existsSync(libElfs[libName])) {
        throw new Error("lib elf file was not found! Did you compile?");
      }
    });

    const containerName = BASE_NAME + rndstr.generate(5);
    this.emuContainer = new EmuContainer(this.elfPath, this.libElfs, DEFAULT_EMU_IMG, containerName);
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

  static LoadPng2RGB(filename) {
    const tmpBuffer = fs.readFileSync(filename);
    return PNG.PNG.sync.read(tmpBuffer, { colorType: 6 });
  }

  static delay(v) {
    if (v) {
      sleep.msleep(v);
    } else {
      sleep.msleep(KEYDELAY);
    }
  }

  static async stopAllEmuContainers() {
    const timer = setTimeout(function () {
      console.log("Could not kill all containers before timeout!");
      process.exit(1);
    }, KILL_TIMEOUT);
    await EmuContainer.killContainerByName(BASE_NAME);
    clearTimeout(timer);
  }

  static async checkAndPullImage() {
    await EmuContainer.checkAndPullImage(DEFAULT_EMU_IMG);
  }

  static sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static async delayedPromise(p, delay) {
    await Promise.race([
      p,
      new Promise((resolve) => {
        setTimeout(resolve, delay);
      }),
    ]);
  }

  async start(options = {}) {
    if ("press_delay" in options) {
      this.press_delay = options["press_delay"];
    }

    await this.emuContainer.runContainer(options);
    // eslint-disable-next-line func-names
    await this.connect().catch((error) => {
      console.log(error);
      this.close();
    });

    // Captures main screen
    this.mainMenuSnapshot = await this.snapshot();
  }

  async connect() {
    // FIXME: Can we detect open ports?
    Zemu.delay(this.emuContainer.start_delay);

    this.transport = await TransportHttp(this.transport_url).open(this.transport_url);
    await this.connectVNC();
  }

  async connectVNC() {
    return new Promise((resolve, reject) => {
      this.session = rfb.createConnection({
        host: this.host,
        port: this.vnc_port,
      });
      if (this.emuContainer.logging) {
        process.stdout.write(`[ZEMU] VNC Connection created ${this.host}:${this.vnc_port}\n`);
      }

      const session = this.session;
      const logging = this.emuContainer.logging;
      this.session.on("connect", () => {
        if (logging) {
          process.stdout.write(`[ZEMU] VNC Session ready\n`);
        }
        session.keyEvent(KEYS.LEFT, KEYS.NOT_PRESSED);
        session.keyEvent(KEYS.RIGHT, KEYS.NOT_PRESSED);
        resolve(true);
      });

      const vnc_port = this.vnc_port;
      const host = this.host;
      this.session.on("error", (error) => {
        console.log(`Could not connect to port ${vnc_port}  on ${host}`);
        reject(error);
      });

      setTimeout(() => reject(new Error("timeout on connectVNC")), 10000);
    });
  }

  startgrpcServer(ip, port, options = {}) {
    this.grpcManager = new GRPCRouter(ip, port, options, this.transport);
    this.grpcManager.startServer();
  }

  stopgrpcServer() {
    if (this.grpcManager) {
      this.grpcManager.stopServer();
    }
  }

  async close() {
    await this.emuContainer.stop();
    if (this.session) {
      this.session.end();
    }

    this.stopgrpcServer();
  }

  getTransport() {
    return this.transport;
  }

  async snapshot(filename) {
    const { session } = this;
    return new Promise((resolve, reject) => {
      session.once("rect", (rect) => {
        if (filename) {
          Zemu.saveRGBA2Png(rect, filename);
        }
        resolve(rect);
      });
      session.requestUpdate(false, 0, 0, WINDOW.width, WINDOW.height);
      setTimeout(() => reject(new Error("timeout")), TIMEOUT);
    });
  }

  async getMainMenuSnapshot() {
    return this.mainMenuSnapshot;
  }

  async waitUntilScreenIsNot(screen, timeout = 10000) {
    const start = new Date();
    const inputSnapshotBufferHex = (await screen).buffer.toString("hex");
    let currentSnapshotBufferHex = (await this.snapshot()).buffer.toString("hex");

    while (inputSnapshotBufferHex === currentSnapshotBufferHex) {
      const elapsed = new Date() - start;
      if (elapsed > timeout) {
        throw `Timeout waiting for screen to change (${timeout} ms)`;
      }
      await Zemu.delay(100);
      currentSnapshotBufferHex = (await this.snapshot()).buffer.toString("hex");
    }
  }

  async compareSnapshotsAndAccept(path, testcaseName, snapshotCount) {
    const snapshotPrefixGolden = `${path}/snapshots/${testcaseName}/`;
    const snapshotPrefixTmp = `${path}/snapshots-tmp/${testcaseName}/`;

    fs.ensureDirSync(snapshotPrefixGolden);
    fs.ensureDirSync(snapshotPrefixTmp);

    let i = 1;
    let indexStr = "00000";
    await this.snapshot(`${snapshotPrefixTmp}${indexStr}.png`);
    for (; i < snapshotCount; i++) {
      indexStr = `${i}`.padStart(5, "0");
      await this.clickRight(`${snapshotPrefixTmp}${indexStr}.png`);
    }
    indexStr = `${i++}`.padStart(5, "0");
    await this.clickBoth(`${snapshotPrefixTmp}${indexStr}.png`);

    console.log("start comparison");
    for (let i = 0; i < snapshotCount; i++) {
      indexStr = `${i}`.padStart(5, "0");
      const img1 = Zemu.LoadPng2RGB(`${snapshotPrefixTmp}${indexStr}.png`);
      const img2 = Zemu.LoadPng2RGB(`${snapshotPrefixGolden}${indexStr}.png`);
      expect(img1).toEqual(img2);
    }
  }

  async clickLeft(filename) {
    this.session.keyEvent(KEYS.LEFT, KEYS.PRESSED);
    Zemu.delay(this.press_delay);
    this.session.keyEvent(KEYS.LEFT, KEYS.NOT_PRESSED);
    Zemu.delay(this.press_delay);
    return this.snapshot(filename);
  }

  async clickRight(filename) {
    this.session.keyEvent(KEYS.RIGHT, KEYS.PRESSED);
    Zemu.delay(this.press_delay);
    this.session.keyEvent(KEYS.RIGHT, KEYS.NOT_PRESSED);
    Zemu.delay(this.press_delay);
    return this.snapshot(filename);
  }

  async clickBoth(filename) {
    this.session.keyEvent(KEYS.LEFT, KEYS.PRESSED);
    this.session.keyEvent(KEYS.RIGHT, KEYS.PRESSED);
    Zemu.delay(this.press_delay);
    this.session.keyEvent(KEYS.LEFT, KEYS.NOT_PRESSED);
    this.session.keyEvent(KEYS.RIGHT, KEYS.NOT_PRESSED);
    Zemu.delay(this.press_delay);
    return this.snapshot(filename);
  }
}
