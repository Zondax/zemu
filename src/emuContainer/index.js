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
const path = require("path");
const Docker = require("dockerode");

export const SCP_PRIVKEY = "ff701d781f43ce106f72dc26a46b6a83e053b5d07bb3d4ceab79c91ca822a66b";
export const BOLOS_SDK = "/project/deps/nanos-secure-sdk";
export const DEFAULT_APP_PATH = "/project/app/bin";
export const DEFAULT_VNC_PORT = "8001";

export default class EmuContainer {
  constructor(elfLocalPath, image, name) {
    // eslint-disable-next-line global-require
    this.image = image;
    this.elfLocalPath = elfLocalPath;
    this.name = name;
  }

  async runContainer(options) {
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line global-require
      const docker = new Docker();

      const app_filename = path.basename(this.elfLocalPath);
      const app_dir = path.dirname(this.elfLocalPath);

      let dirBindings = [
        `${app_dir}:${DEFAULT_APP_PATH}`
      ]

      let displaySetting = "--display headless"
      if ("X11" in options && options["X11"] === true ){
        displaySetting = ""
        dirBindings.push("/tmp/.X11-unix:/tmp/.X11-unix:ro")
      }

      let customOptions = "";
      if ("custom" in options) {
        customOptions = options["custom"]
      }

      const command = `/home/zondax/speculos/speculos.py ${displaySetting} ${customOptions} --vnc-port ${DEFAULT_VNC_PORT} ${DEFAULT_APP_PATH}/${app_filename}`;

      docker
        .createContainer({
          Image: this.image,
          name: this.name,
          Tty: true,
          Privileged: true,
          AttachStdout: true,
          AttachStderr: true,
          User: "1000",
          Env: [
            `SCP_PRIVKEY=${SCP_PRIVKEY}`,
            `BOLOS_SDK=${BOLOS_SDK}`,
            `BOLOS_ENV=/opt/bolos`,
            `DISPLAY=${process.env.DISPLAY}`, // needed if X forwarding
          ],
          PortBindings: {
            [`1234/tcp`]: [{ HostPort: "1234" }],
            [`8001/tcp`]: [{ HostPort: "8001" }],
            [`9997/tcp`]: [{ HostPort: "9997" }],
            [`9998/tcp`]: [{ HostPort: "9998" }],
            [`9999/tcp`]: [{ HostPort: "9999" }],
          },
          Binds: dirBindings,
          Cmd: [command],
        })
        .then((container) => {
          this.currentContainer = container;

          if ("logging" in options && options["logging"] === true ){
            container.attach({ stream: true, stdout: true, stderr: true }, function(err, stream) {
              stream.pipe(process.stdout);
            });
          }

          return container.start();
        })
        .then(function () {
          resolve(true);
        });
    });
  }

  static async killContainerByName(name) {
    const docker = new Docker();
    await new Promise((resolve) => {
      docker.listContainers({ all: true, filters: { name: [name] } }, function (err, containers) {
        containers.forEach(function (containerInfo) {
          docker.getContainer(containerInfo.Id).remove({ force: true }, function () {
            // console.log("container removed");
          });
        });
        return resolve(true);
      });
    });
  }

  async stop() {
    const { currentContainer } = this;
    await currentContainer.stop({ t: 0 });
    await currentContainer.remove();
  }

  static async checkAndPullImage(imageName) {
    const docker = new Docker();
    await new Promise((resolve) => {
      docker.pull(imageName, (err, stream) => {
        docker.modem.followProgress(stream, onFinished, onProgress);
        function onProgress(event) {
          console.clear();
          console.log("*****", "Progress on image:", imageName, "*****");
          console.log(event.status + "\n" + event.progress);
        }
        function onFinished(err, output) {
          if (!err) {
            console.log("\nDone pulling.");
            resolve(true);
          } else {
            console.log(err);
            process.exit(1);
          }
        }
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
}
