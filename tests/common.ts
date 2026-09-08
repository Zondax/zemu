/** ******************************************************************************
 *  (c) 2018 - 2024 Zondax AG
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
import { resolve } from 'node:path'
import { DEFAULT_START_OPTIONS, type IDeviceModel, type IStartOptions } from '../src'

// Test fixtures are builds of the Polymesh Ledger app (https://github.com/Zondax/ledger-polymesh)
export const models: IDeviceModel[] = [
  { name: 'nanosp', prefix: 'SP', path: resolve('bin/app_s2.elf') },
  { name: 'nanox', prefix: 'X', path: resolve('bin/app_x.elf') },
  { name: 'stax', prefix: 'ST', path: resolve('bin/app_stax.elf') },
  { name: 'flex', prefix: 'FL', path: resolve('bin/app_flex.elf') },
  { name: 'apex_p', prefix: 'AP', path: resolve('bin/app_apex_p.elf') },
]

export const nanoModels = models.filter((m) => m.name.startsWith('nano'))
export const touchModels = models.filter((m) => !m.name.startsWith('nano'))

export const APP_SEED = 'equip will roof matter pink blind book anxiety banner elbow sun young'

export const defaultOptions: IStartOptions = {
  ...DEFAULT_START_OPTIONS,
  logging: true,
  custom: `-s "${APP_SEED}"`,
}

// Polymesh derivation path and SS58 prefix
export const PATH = "m/44'/595'/0'/0'/0'"
export const POLYMESH_SS58_PREFIX = 12

export const SNAPSHOTS_DIR = 'tests'
