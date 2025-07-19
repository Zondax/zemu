/** ******************************************************************************
 *  (c) 2019 Zondax GmbH
 *  (c) 2016-2017 Ledger
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

function isDict(v: any) {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date)
}

export function processErrorResponse(response: any) {
  if (response) {
    if (isDict(response)) {
      if (Object.hasOwn(response, 'statusCode')) {
        return {
          return_code: response.statusCode,
          error_message: response.statusCode.toString,
        }
      }

      if (Object.hasOwn(response, 'return_code') && Object.hasOwn(response, 'error_message')) {
        return response
      }
    }
    return {
      return_code: 0xffff,
      error_message: response.toString(),
    }
  }

  return {
    return_code: 0xffff,
    error_message: response.toString(),
  }
}

export default class MinimalApp {
  private transport: any

  constructor(transport: any) {
    if (!transport) {
      throw new Error('Transport has not been defined')
    }

    this.transport = transport
    transport.decorateAppAPIMethods(this, ['appInfo'])
  }

  async appInfo() {
    return this.transport.send(0xb0, 0x01, 0, 0).then((response: any) => {
      const errorCodeData = response.slice(-2)
      const returnCode = errorCodeData[0] * 256 + errorCodeData[1]

      const result: any = {}

      let appName = 'err'
      let appVersion = 'err'
      let flagLen = 0
      let flagsValue = 0

      if (response[0] !== 1) {
        // Ledger responds with format ID 1. There is no spec for any format != 1
        result.error_message = 'response format ID not recognized'
        result.return_code = 0x9001
      } else {
        const appNameLen = response[1]
        appName = response.slice(2, 2 + appNameLen).toString('ascii')
        let idx = 2 + appNameLen
        const appVersionLen = response[idx]
        idx += 1
        appVersion = response.slice(idx, idx + appVersionLen).toString('ascii')
        idx += appVersionLen
        const appFlagsLen = response[idx]
        idx += 1
        flagLen = appFlagsLen
        flagsValue = response[idx]
      }

      return {
        return_code: returnCode,
        error_message: returnCode.toString(),
        appName,
        appVersion,
        flagLen,
        flagsValue,
        flag_recovery: (flagsValue & 1) !== 0,
        flag_signed_mcu_code: (flagsValue & 2) !== 0,
        flag_onboarded: (flagsValue & 4) !== 0,
        flag_pin_validated: (flagsValue & 128) !== 0,
      }
    }, processErrorResponse)
  }
}
