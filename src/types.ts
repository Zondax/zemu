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
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  clear: boolean;
}

export function areEventsEqual(event1: IEvent, event2: IEvent): boolean {
  return event1.text === event2.text &&
         event1.x === event2.x &&
         event1.y === event2.y &&
         event1.w === event2.w &&
         event1.h === event2.h &&
         event1.clear === event2.clear;
}

export interface ISwipeCoordinates {
  x: number;
  y: number;
}

export type TModel = "nanos" | "nanosp" | "nanox" | "stax" | "flex";

export interface IStartOptions {
  logging: boolean;
  logger?: {
    enabled: boolean;
    timestamp: {
      enabled: boolean;
      format: "unix" | "iso";
    };
  };
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
  direction: SwipeDirection;
}

export interface INavElement {
  type: ActionKind;
  button: IButton;
}

export const enum SwipeDirection {
  NoSwipe = 0,
  SwipeUp,
  SwipeDown,
  SwipeRight,
  SwipeLeft,
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

  SwipeContinueButton,

  PrevPageButton,

  SettingsNavRightButton,
  SettingsNavLeftButton,
  SettingsQuitButton,

  ToggleSettingButton1,
  ToggleSettingButton2,
  ToggleSettingButton3,

  NavRightButton,
  NavLeftButton,

  ApproveHoldButton,
  ApproveTapButton,
  RejectButton,

  ConfirmYesButton,
  ConfirmNoButton,

  ShowQRButton,
  CloseQRButton,

  // Text to compare must match this button
  // Zemu will find the center where the text is displayed and tap there
  DynamicTapButton,
}
