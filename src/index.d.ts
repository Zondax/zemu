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
import Transport from '@ledgerhq/hw-transport';

export interface Snapshot {
  width: number;
  height: number;
}

declare class LedgerSim {
  constructor (elfPath: string, host?: string, vncPort?: number, transportPort?: number);

  start();
  close();
  sleep(ms: number);

  getTransport() : Transport;

  snapshot(filename?: string): Promise<Snapshot>;
  clickLeft(filename?: string): Promise<Snapshot>;
  clickRight(filename?: string): Promise<Snapshot>;
  clickBoth(filename?: string): Promise<Snapshot>;
}

export default LedgerSim;
