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
import { ButtonKind, type IButton, SwipeDirection } from "./types";

export const dummyButton: IButton = {
  x: 0,
  y: 0,
  delay: 0,
  direction: SwipeDirection.NoSwipe,
};

const infoButton: IButton = {
  x: 335,
  y: 65,
  delay: 0.25,
  direction: SwipeDirection.NoSwipe,
};

const quitAppButton: IButton = {
  x: 0,
  y: 0,
  delay: 0.25,
  direction: SwipeDirection.NoSwipe,
};

export const tapContinueButton: IButton = {
  x: 200,
  y: 250,
  delay: 0.25,
  direction: SwipeDirection.NoSwipe,
};

export const swipeContinueButton: IButton = {
  x: 200,
  y: 250,
  delay: 0.1,
  direction: SwipeDirection.SwipeLeft,
};

const prevPageButton: IButton = {
  x: 45,
  y: 45,
  delay: 0.25,
  direction: SwipeDirection.NoSwipe,
};

const toggleOption1: IButton = {
  x: 350,
  y: 125,
  delay: 0.25,
  direction: SwipeDirection.NoSwipe,
};

const toggleOption2: IButton = {
  x: 350,
  y: 200,
  delay: 0.25,
  direction: SwipeDirection.NoSwipe,
};

const toggleOption3: IButton = {
  x: 350,
  y: 250,
  delay: 0.25,
  direction: SwipeDirection.NoSwipe,
};

const navRightButton: IButton = {
  x: 300,
  y: 625,
  delay: 0.25,
  direction: SwipeDirection.NoSwipe,
};

const navLeftButton: IButton = {
  x: 140,
  y: 625,
  delay: 0.25,
  direction: SwipeDirection.NoSwipe,
};

const quitSettingsButton: IButton = {
  x: 40,
  y: 40,
  delay: 0.25,
  direction: SwipeDirection.NoSwipe,
};

const approveTapButton: IButton = {
  x: 200,
  y: 550,
  delay: 0.25,
  direction: SwipeDirection.NoSwipe,
};

const approveHoldButton: IButton = {
  x: 335,
  y: 525,
  delay: 5,
  direction: SwipeDirection.NoSwipe,
};

const rejectButton: IButton = {
  x: 200,
  y: 650,
  delay: 0.25,
  direction: SwipeDirection.NoSwipe,
};

const confirmYesButton: IButton = {
  x: 200,
  y: 550,
  delay: 0.25,
  direction: SwipeDirection.NoSwipe,
};

const confirmNoButton: IButton = {
  x: 200,
  y: 650,
  delay: 0.25,
  direction: SwipeDirection.NoSwipe,
};

const showQRButton: IButton = {
  x: 200,
  y: 300,
  delay: 0.25,
  direction: SwipeDirection.NoSwipe,
};

const closeQRButton: IButton = {
  x: 200,
  y: 650,
  delay: 0.25,
  direction: SwipeDirection.NoSwipe,
};

export const TouchElements = new Map<ButtonKind, IButton>([
  [ButtonKind.InfoButton, infoButton],
  [ButtonKind.QuitAppButton, quitAppButton],

  [ButtonKind.TapContinueButton, tapContinueButton],

  [ButtonKind.PrevPageButton, prevPageButton],

  [ButtonKind.ToggleSettingButton1, toggleOption1],
  [ButtonKind.ToggleSettingButton2, toggleOption2],
  [ButtonKind.ToggleSettingButton3, toggleOption3],

  [ButtonKind.NavRightButton, navRightButton],
  [ButtonKind.NavLeftButton, navLeftButton],
  [ButtonKind.QuitSettingsButton, quitSettingsButton],

  [ButtonKind.ApproveHoldButton, approveHoldButton],
  [ButtonKind.ApproveTapButton, approveTapButton],
  [ButtonKind.RejectButton, rejectButton],

  [ButtonKind.ConfirmYesButton, confirmYesButton],
  [ButtonKind.ConfirmNoButton, confirmNoButton],

  [ButtonKind.ShowQRButton, showQRButton],
  [ButtonKind.CloseQRButton, closeQRButton],
]);
