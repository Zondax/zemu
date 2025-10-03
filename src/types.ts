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
export interface IDeviceWindow {
  x: number
  y: number
  width: number
  height: number
}

export interface ISnapshot {
  width: number
  height: number
  data: Buffer
}

export interface IEvent {
  text: string
  x: number
  y: number
  w: number
  h: number
  clear: boolean
}
export interface ISwipeCoordinates {
  x: number
  y: number
}

export type TModel = 'nanos' | 'nanosp' | 'nanox' | 'stax' | 'flex' | 'apex_p'

export interface IStartOptions {
  logging: boolean
  logger?: {
    enabled: boolean
    timestamp: {
      enabled: boolean
      format: 'unix' | 'iso'
    }
  }
  startDelay: number
  custom: string
  model: TModel
  sdk: string
  startText: string
  caseSensitive: boolean
  startTimeout: number
  approveAction: ButtonKind
  approveKeyword: string
  rejectKeyword: string
  disablePool?: boolean
  X11?: boolean
}

export interface IDeviceModel {
  name: TModel
  prefix: string
  path: string
}

export interface IButton {
  x: number
  y: number
  delay: number
  direction: SwipeDirection
}

export interface INavElement {
  type: ActionKind
  button: IButton
}

export enum SwipeDirection {
  NoSwipe = 0,
  SwipeUp = 1,
  SwipeDown = 2,
  SwipeRight = 3,
  SwipeLeft = 4,
}

export enum ActionKind {
  LeftClick = 0,
  RightClick = 1,
  BothClick = 2,
  Touch = 3,
}

export enum ButtonKind {
  InfoButton = 0,
  QuitAppButton = 1,

  SwipeContinueButton = 2,

  PrevPageButton = 3,

  SettingsNavRightButton = 4,
  SettingsNavLeftButton = 5,
  SettingsQuitButton = 6,

  ToggleSettingButton1 = 7,
  ToggleSettingButton2 = 8,
  ToggleSettingButton3 = 9,

  NavRightButton = 10,
  NavLeftButton = 11,

  ApproveHoldButton = 12,
  ApproveTapButton = 13,
  RejectButton = 14,

  ConfirmYesButton = 15,
  ConfirmNoButton = 16,

  ShowQRButton = 17,
  CloseQRButton = 18,

  // Text to compare must match this button
  // Zemu will find the center where the text is displayed and tap there
  DynamicTapButton = 19,
}
