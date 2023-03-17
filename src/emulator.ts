/** ******************************************************************************
 *  (c) 2018 - 2023 Zondax AG
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
import Docker, { type Container, type ContainerInfo } from "dockerode";
import path from "path";

export const DEV_CERT_PRIVATE_KEY = "ff701d781f43ce106f72dc26a46b6a83e053b5d07bb3d4ceab79c91ca822a66b";
export const BOLOS_SDK = "/project/deps/nanos-secure-sdk";
export const DEFAULT_APP_PATH = "/project/app/bin";

export default class EmuContainer {
  private logging: boolean;
  private readonly elfLocalPath: string;
  private readonly name: string;
  private readonly image: string;
  private readonly libElfs: Record<string, string>;
  private currentContainer?: Container;

  constructor(elfLocalPath: string, libElfs: Record<string, string>, image: string, name: string) {
    this.image = image;
    this.elfLocalPath = elfLocalPath;
    this.libElfs = libElfs;
    this.name = name;
    this.logging = false;
  }

  static killContainerByName(name: string): void {
    const docker = new Docker();
    docker.listContainers({ all: true, filters: { name: [name] } }, (listError, containers?: ContainerInfo[]) => {
      if (listError != null) throw listError;
      if (containers == null || containers.length === 0) {
        console.log("No containers found");
        return;
      }
      containers.forEach((containerInfo) => {
        docker.getContainer(containerInfo.Id).remove({ force: true }, (removeError) => {
          if (removeError != null) throw removeError;
        });
      });
    });
  }

  static async checkAndPullImage(imageName: string): Promise<void> {
    const docker = new Docker();
    await new Promise<void>((resolve) => {
      docker.pull(imageName, {}, (err: any, stream: any) => {
        function onProgress(event: any): void {
          const progress = event?.progress ?? "";
          const status = event?.status ?? "";
          process.stdout.write(`[DOCKER] ${status}: ${progress}\n`);
        }

        function onFinished(err: any, _output: any): void {
          if (err != null) {
            process.stdout.write(`[DOCKER] ${err}\n`);
            throw err;
          } else {
            resolve();
          }
        }

        if (err != null) {
          process.stdout.write(`[DOCKER] ${err}\n`);
          throw err;
        }

        docker.modem.followProgress(stream, onFinished, onProgress);
      });
    });
  }

  log(message: string): void {
    if (this.logging ?? false) process.stdout.write(`${message}\n`);
  }

  async runContainer(options: {
    logging: boolean;
    custom: string;
    model: string;
    transportPort: string;
    speculosApiPort: string;
  }): Promise<void> {
    const docker = new Docker();

    this.logging = options.logging;

    const appFilename = path.basename(this.elfLocalPath);
    const appDir = path.dirname(this.elfLocalPath);

    const dirBindings = [`${appDir}:${DEFAULT_APP_PATH}`];

    let libArgs = "";
    Object.entries(this.libElfs).forEach(([libName, libPath]) => {
      const libFilename = path.basename(libPath);
      libArgs += ` -l ${libName}:${DEFAULT_APP_PATH}/${libFilename}`;
    });

    const modelOptions = options.model !== "" ? options.model : "nanos";

    const customOptions = options.custom;

    const displaySetting = "--display headless";
    const command = `/home/zondax/speculos/speculos.py --log-level speculos:DEBUG --color JADE_GREEN ${displaySetting} ${customOptions} -m ${modelOptions} ${DEFAULT_APP_PATH}/${appFilename} ${libArgs}`;

    this.log(`[ZEMU] Command: ${command}`);

    const portBindings: Record<string, Array<{ HostPort: string }>> = {
      [`9998/tcp`]: [{ HostPort: options.transportPort }],
      [`5000/tcp`]: [{ HostPort: options.speculosApiPort }],
    };

    if (customOptions.includes("--debug")) {
      portBindings[`1234/tcp`] = [{ HostPort: "1234" }];
    }

    const displayEnvironment: string =
      process.platform === "darwin" ? "host.docker.internal:0" : process.env.DISPLAY ?? "";
    const environment = [
      `SCP_PRIVKEY='${DEV_CERT_PRIVATE_KEY}'`,
      `BOLOS_SDK='${BOLOS_SDK}'`,
      `BOLOS_ENV='/opt/bolos'`,
      `DISPLAY='${displayEnvironment}'`,
    ];

    this.log(`[ZEMU] Creating Container ${this.image} - ${this.name} `);
    this.currentContainer = await docker.createContainer({
      Image: this.image,
      name: this.name,
      Tty: true,
      AttachStdout: true,
      AttachStderr: true,
      User: "1000",
      Env: environment,
      HostConfig: {
        PortBindings: portBindings,
        Binds: dirBindings,
      },
      Cmd: [command],
    });

    this.log(`[ZEMU] Connected ${this.currentContainer.id}`);

    if (this.logging) {
      this.currentContainer.attach({ stream: true, stdout: true, stderr: true }, (err: any, stream: any) => {
        if (err != null) throw err;
        stream.pipe(process.stdout);
      });
      this.log(`[ZEMU] Attached ${this.currentContainer.id}`);
    }

    await this.currentContainer.start();

    this.log(`[ZEMU] Started ${this.currentContainer.id}`);
  }

  async stop(): Promise<void> {
    if (this.currentContainer != null) {
      const container = this.currentContainer;
      delete this.currentContainer;
      this.log(`[ZEMU] Stopping container`);
      try {
        await container.stop({ t: 0 });
      } catch (e) {
        this.log(`[ZEMU] Stopping: ${e}`);
        throw e;
      }
      this.log(`[ZEMU] Stopped`);
      try {
        await container.remove();
      } catch (err) {
        this.log("[ZEMU] Unable to remove container");
        throw err;
      }
      this.log(`[ZEMU] Removed`);
    }
  }
}
