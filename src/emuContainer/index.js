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

export const SCP_PRIVKEY = "ff701d781f43ce106f72dc26a46b6a83e053b5d07bb3d4ceab79c91ca822a66b";
export const BOLOS_SDK = "/project/deps/nanos-secure-sdk";
export const DEFAULT_APP_PATH = "/project/app/bin";
export const DEFAULT_APP_NAME = "app.elf";
export const DEFAULT_VNC_PORT = "8001";

export default class EmuContainer {
  constructor(elfPath, image) {
    // eslint-disable-next-line global-require
    const Resolve = require("path").resolve;
    this.image = image;
    this.elfPath = Resolve(elfPath);
  }

  async runContainer() {
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line global-require
      const Docker = require("dockerode");
      const docker = new Docker();

      docker.createContainer({
          Image: this.image,
          Tty: true,
          Privileged: true,
          User: "1000",
          Env: [
            `SCP_PRIVKEY=${SCP_PRIVKEY}`,
            `BOLOS_SDK=${BOLOS_SDK}`,
            `BOLOS_ENV=/opt/bolos`,
            // `DISPLAY=:0`, //needed if X forwarding
          ],
          PortBindings: {
            [`1234/tcp`]: [{ HostPort: "1234" }],
            [`8001/tcp`]: [{ HostPort: "8001" }],
            [`9997/tcp`]: [{ HostPort: "9997" }],
            [`9998/tcp`]: [{ HostPort: "9998" }],
            [`9999/tcp`]: [{ HostPort: "9999" }],
          },
          Binds: [
            `${this.elfPath}:${DEFAULT_APP_PATH}`,
            // `/tmp/.X11-unix:/tmp/.X11-unix` //needed if X forwarding
          ],
          Cmd: [
            `/home/zondax/speculos/speculos.py --display headless --vnc-port ${DEFAULT_VNC_PORT} ${DEFAULT_APP_PATH}/${DEFAULT_APP_NAME}`,
          ],
          AttachStdout: true,
          AttachStderr: true,
        })
        .then(container => {
          this.currentContainer = container;
          console.log("Docker container started!");
          return container.start();
        })
        .then(function() {
          console.log("Docker container ready!");
          resolve(true);
        });
    });
  }

  /*
  async copyElf(appPath) {
    console.log("Will copy app elf");
    this.currentContainer.putArchive(appPath, { path: "/project/app/bin/" }, function(error, response) {
      if (error) {
        console.error(error);
      }
    });
  }
*/
  stop() {
    const { currentContainer } = this;
    return new Promise((resolve, reject) => {
      return currentContainer.stop({ t: 0 }).then(function() {
        return currentContainer.remove().then(function() {
          console.log("Container stopped!");
          resolve(true);
        });
      });
    });
  }
}
