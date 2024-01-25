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
import { ButtonKind, type IDeviceWindow, type IStartOptions } from "./types";

export const DEFAULT_EMU_IMG = "zondax/builder-zemu:speculos-e262a0ca9d2b37810d0339b37c50ce0d7171c9a2";

export const DEFAULT_MODEL = "nanos";
export const DEFAULT_NANO_START_TEXT = "Ready";
export const DEFAULT_STAX_START_TEXT = "This application enables";
export const DEFAULT_PENDING_REVIEW_TEXT = "Ledger review"
export const DEFAULT_START_DELAY = 20000;
export const DEFAULT_KEY_DELAY = 250;
export const DEFAULT_HOST = "127.0.0.1";
export const BASE_NAME = "zemu-";
export const DEFAULT_START_TIMEOUT = 30000;
export const KILL_TIMEOUT = 5000;
export const DEFAULT_METHOD_TIMEOUT = 15000;
export const DEFAULT_WAIT_TIMEOUT = 45000;

export const DEFAULT_NANO_APPROVE_KEYWORD = "APPROVE";
export const DEFAULT_NANO_REJECT_KEYWORD = "REJECT";

export const DEFAULT_STAX_APPROVE_KEYWORD = "Hold to sign";
export const DEFAULT_STAX_REJECT_KEYWORD = "Cancel";

export const DEFAULT_START_OPTIONS: IStartOptions = {
  logging: false,
  startDelay: DEFAULT_START_DELAY,
  custom: "",
  model: DEFAULT_MODEL,
  sdk: "",
  startText: "",
  caseSensitive: false,
  startTimeout: DEFAULT_START_TIMEOUT,
  approveAction: ButtonKind.ApproveHoldButton,
  approveKeyword: "",
  rejectKeyword: "",
};

export const KEYS = {
  NOT_PRESSED: 0,
  PRESSED: 1,
  LEFT: 0xff51,
  RIGHT: 0xff53,
};

export const WINDOW_S: IDeviceWindow = {
  x: 0,
  y: 0,
  width: 128,
  height: 32,
};

export const WINDOW_X: IDeviceWindow = {
  x: 0,
  y: 0,
  width: 128,
  height: 64,
};

export const WINDOW_STAX: IDeviceWindow = {
  x: 0,
  y: 0,
  width: 400,
  height: 672,
};
