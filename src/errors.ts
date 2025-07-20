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

/**
 * Common Ledger APDU status codes
 */
export const APDU_STATUS_CODES = {
  SUCCESS: 0x9000,
  DEVICE_LOCKED: 0x5515,
  INVALID_DATA: 0x6984, // APDU_CODE_DATA_INVALID - data reversibly blocked
  CONDITIONS_NOT_SATISFIED: 0x6985,
  COMMAND_NOT_ALLOWED: 0x6986,
  INS_NOT_SUPPORTED: 0x6d00,
  CLA_NOT_SUPPORTED: 0x6e00,
  UNKNOWN_ERROR: 0x6f00,
  INVALID_P1P2: 0x6b00,
  INVALID_LENGTH: 0x6700,
  USER_CANCELLED: 0x6501,
} as const

export type APDUStatusCode = (typeof APDU_STATUS_CODES)[keyof typeof APDU_STATUS_CODES]

/**
 * Transport-related errors that should cause immediate failure
 */
export const CRITICAL_TRANSPORT_ERRORS = [
  APDU_STATUS_CODES.INVALID_DATA,
  APDU_STATUS_CODES.CLA_NOT_SUPPORTED,
  APDU_STATUS_CODES.INS_NOT_SUPPORTED,
  APDU_STATUS_CODES.INVALID_P1P2,
] as const

export class TransportError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public originalError?: unknown
  ) {
    super(message)
    this.name = 'TransportError'
  }
}

/**
 * Checks if an error is a critical transport error that should cause immediate failure
 */
export function isCriticalTransportError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  
  const statusCode = (error as any).statusCode
  if (typeof statusCode !== 'number') return false
  
  return CRITICAL_TRANSPORT_ERRORS.includes(statusCode as any)
}

/**
 * Gets a human-readable message for an APDU status code
 */
export function getAPDUStatusMessage(statusCode: number): string {
  switch (statusCode) {
    case APDU_STATUS_CODES.SUCCESS:
      return 'Success'
    case APDU_STATUS_CODES.DEVICE_LOCKED:
      return 'Device is locked'
    case APDU_STATUS_CODES.INVALID_DATA:
      return 'Invalid data (0x6984)'
    case APDU_STATUS_CODES.CONDITIONS_NOT_SATISFIED:
      return 'Conditions not satisfied'
    case APDU_STATUS_CODES.COMMAND_NOT_ALLOWED:
      return 'Command not allowed'
    case APDU_STATUS_CODES.INS_NOT_SUPPORTED:
      return 'Instruction not supported'
    case APDU_STATUS_CODES.CLA_NOT_SUPPORTED:
      return 'Class not supported'
    case APDU_STATUS_CODES.UNKNOWN_ERROR:
      return 'Unknown error'
    case APDU_STATUS_CODES.INVALID_P1P2:
      return 'Invalid parameters (P1/P2)'
    case APDU_STATUS_CODES.INVALID_LENGTH:
      return 'Invalid length'
    case APDU_STATUS_CODES.USER_CANCELLED:
      return 'User cancelled the operation'
    default:
      return `Unknown status code: 0x${statusCode.toString(16)}`
  }
}