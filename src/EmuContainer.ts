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
import path from "path";
import Docker from "dockerode";

export const SCP_PRIVKEY = "ff701d781f43ce106f72dc26a46b6a83e053b5d07bb3d4ceab79c91ca822a66b";
export const BOLOS_SDK = "/project/deps/nanos-secure-sdk";
export const DEFAULT_APP_PATH = "/project/app/bin";
export const DEFAULT_VNC_PORT = "8001";

export interface EmuRunOptions {
  logging?: boolean;
  X11?: boolean;
  custom?: string;
  start_delay?: number;
}

export default class EmuContainer {
  image: string;
  elfLocalPath: string;
  name: string;
  logging: boolean;
  start_delay: number = 1000;
  currentContainer?: Docker.Container;

  constructor(elfLocalPath: string, image: string, name: string) {
    this.image = image;
    this.elfLocalPath = elfLocalPath;
    this.name = name;
    this.logging = false;
  }

  async runContainer(options: EmuRunOptions): Promise<boolean> {
    const docker = new Docker();

    this.logging = options.logging ?? false;
    this.start_delay = options.start_delay ?? 1000;

    const app_filename = path.basename(this.elfLocalPath);
    const app_dir = path.dirname(this.elfLocalPath);

    const volumes = [`${app_dir}:${DEFAULT_APP_PATH}`];

    let displaySetting = "--display headless";
    if (options.X11) {
      displaySetting = "";
      volumes.push("/tmp/.X11-unix:/tmp/.X11-unix:ro");
    }

    const customOptions = options.custom ?? "";
    const command = `/home/zondax/speculos/speculos.py --color LAGOON_BLUE ${displaySetting} ${customOptions} --vnc-port ${DEFAULT_VNC_PORT} ${DEFAULT_APP_PATH}/${app_filename}`;

    if (this.logging) {
      process.stdout.write(`[ZEMU] Command: ${command}\n`);
    }

    const container = await docker.createContainer({
      Image: this.image,
      name: this.name,
      Tty: true,
      AttachStdout: true,
      AttachStderr: true,
      User: "1000",
      Env: [
        `SCP_PRIVKEY=${SCP_PRIVKEY}`,
        `BOLOS_SDK=${BOLOS_SDK}`,
        `BOLOS_ENV=/opt/bolos`,
        `DISPLAY=${process.env.DISPLAY}`, // needed if X forwarding
      ],
      HostConfig: {
        Privileged: true,
        Binds: volumes,
        PortBindings: {
          [`1234/tcp`]: [{ HostPort: "1234" }],
          [`8001/tcp`]: [{ HostPort: "8001" }],
          [`9997/tcp`]: [{ HostPort: "9997" }],
          [`9998/tcp`]: [{ HostPort: "9998" }],
          [`9999/tcp`]: [{ HostPort: "9999" }],
        },
      },
      Cmd: [command],
    });

    this.currentContainer = container;

    if (this.logging) {
      process.stdout.write(`[ZEMU] Connected ${container.id}\n`);
    }

    if (this.logging) {
      container.attach({ stream: true, stdout: true, stderr: true }, (err, stream) => {
        if (err) {
          console.error(err);
          return;
        }
        if (!stream) {
          console.error("empty stream");
          return;
        }
        stream.pipe(process.stdout);
      });
    }

    await container.start();
    return true;
  }

  static async killContainerByName(name: string) {
    const docker = new Docker();
    await new Promise((resolve, reject) => {
      docker.listContainers({ all: true, filters: { name: [name] } }, function (err, containers) {
        if (err) {
          reject(err);
          return;
        }
        containers?.forEach(function (containerInfo) {
          docker.getContainer(containerInfo.Id).remove({ force: true }, function () {
            // console.log("container removed");
          });
        });
        return resolve(true);
      });
    });
  }

  async stop() {
    if (this.logging) {
      process.stdout.write(`\n[ZEMU] Stopping container\n`);
    }

    const { currentContainer } = this;
    if (currentContainer) {
      await currentContainer.stop({ t: 0 });
      await currentContainer.remove();
    }
  }

  static async checkAndPullImage(imageName: string) {
    const docker = new Docker();
    await new Promise((resolve, reject) => {
      docker.pull(imageName, (err: unknown, stream: NodeJS.ReadStream) => {
        if (err) {
          reject(err);
          return;
        }

        function onFinished(err: Error) {
          if (err) {
            reject(err);
            return;
          }
          resolve(true);
        }

        function onProgress(event: any) {
          const progress = event.progress ?? "";
          const status = event.status ?? "";
          console.clear();
          console.log("*****", "Progress on image:", imageName, "*****");
          console.log(status, "\n", progress);
        }

        docker.modem.followProgress(stream, onFinished, onProgress);
      });
    });
  }
}
