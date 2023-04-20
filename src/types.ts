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
export interface IDeviceWindow {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ISnapshot {
  width: number;
  height: number;
  data: Buffer;
}

export interface IEvent {
  x: number;
  y: number;
  text: string;
}

export type TModel = "nanos" | "nanosp" | "nanox" | "stax";

export interface IStartOptions {
  logging: boolean;
  startDelay: number;
  custom: string;
  model: TModel;
  sdk: string;
  startText: string;
  caseSensitive: boolean;
  startTimeout: number;
  approveAction: ButtonKind;
  approveKeyword: string;
  rejectKeyword: string;
}

export interface IDeviceModel {
  name: TModel;
  prefix: string;
  path: string;
}

export interface IButton {
  x: number;
  y: number;
  delay: number;
}

export interface INavElement {
  type: ActionKind;
  button: IButton;
}

export const enum ActionKind {
  LeftClick = 0,
  RightClick,
  BothClick,
  Touch,
}

export const enum ButtonKind {
  InfoButton = 0,
  QuitAppButton,

  TapContinueButton,

  PrevPageButton,

  ToggleSettingButton1,
  ToggleSettingButton2,
  ToggleSettingButton3,

  NavRightButton,
  NavLeftButton,
  QuitSettingsButton,

  ApproveHoldButton,
  ApproveTapButton,
  RejectButton,

  ConfirmYesButton,
  ConfirmNoButton,

  ShowQRButton,
  CloseQRButton,
}
