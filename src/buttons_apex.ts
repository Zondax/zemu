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
import { ButtonKind, type IButton, SwipeDirection } from './types'

/* eslint-disable @typescript-eslint/no-namespace */
export namespace apex_p {
  export const infoButton: IButton = {
    x: 256,
    y: 43,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  // TODO
  export const quitAppButton: IButton = {
    x: 200,
    y: 625,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  export const swipeContinueButton: IButton = {
    x: 270,
    y: 200,
    delay: 0.1,
    direction: SwipeDirection.SwipeLeft,
  }

  export const navRightButton: IButton = {
    x: 270,
    y: 360,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  // TODO
  export const navLeftButton: IButton = {
    x: 195,
    y: 625,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  // Placeholder if Ledger moves this button
  export const settingsNavRightButton: IButton = navRightButton

  // TODO
  export const settingsNavLeftButton: IButton = {
    x: 275,
    y: 625,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  export const settingsQuitButton: IButton = {
    x: 40,
    y: 45,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  export const rejectButton: IButton = {
    x: 95,
    y: 380,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  // From y:88 to y:227 (both included), the first switch is toggleable.
  export const toggleOption1: IButton = {
    x: 240,
    y: 105,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  export const approveTapButton: IButton = {
    x: 180,
    y: 290,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  // TODO
  export const prevPageButton: IButton = {
    x: 45,
    y: 45,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  export const approveHoldButton: IButton = {
    x: 240,
    y: 290,
    delay: 5,
    direction: SwipeDirection.NoSwipe,
  }

  // From y:228 to y:367 (both included), the second switch is toggleable.
  export const toggleOption2: IButton = {
    x: 240,
    y: 190,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  // TODO
  export const toggleOption3: IButton = {
    x: 350,
    y: 368,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  export const confirmYesButton: IButton = {
    x: 150,
    y: 330,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  // TODO
  export const confirmNoButton: IButton = {
    x: 200,
    y: 630,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  // TODO
  export const showQRButton: IButton = {
    x: 200,
    y: 300,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  // TODO
  export const closeQRButton: IButton = {
    x: 200,
    y: 650,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  export const TouchElements = new Map<ButtonKind, IButton>([
    [ButtonKind.InfoButton, apex_p.infoButton],
    [ButtonKind.QuitAppButton, apex_p.quitAppButton],

    [ButtonKind.SwipeContinueButton, apex_p.swipeContinueButton],
    [ButtonKind.PrevPageButton, apex_p.prevPageButton],

    [ButtonKind.SettingsNavRightButton, apex_p.settingsNavRightButton],
    [ButtonKind.SettingsNavLeftButton, apex_p.settingsNavLeftButton],
    [ButtonKind.SettingsQuitButton, apex_p.settingsQuitButton],

    [ButtonKind.ToggleSettingButton1, apex_p.toggleOption1],
    [ButtonKind.ToggleSettingButton2, apex_p.toggleOption2],
    [ButtonKind.ToggleSettingButton3, apex_p.toggleOption3],

    [ButtonKind.NavRightButton, apex_p.navRightButton],
    [ButtonKind.NavLeftButton, apex_p.navLeftButton],
    [ButtonKind.ApproveHoldButton, apex_p.approveHoldButton],
    [ButtonKind.ApproveTapButton, apex_p.approveTapButton],
    [ButtonKind.RejectButton, apex_p.rejectButton],
    [ButtonKind.ConfirmYesButton, apex_p.confirmYesButton],
    [ButtonKind.ConfirmNoButton, apex_p.confirmNoButton],
    [ButtonKind.ShowQRButton, apex_p.showQRButton],
    [ButtonKind.CloseQRButton, apex_p.closeQRButton],

    [ButtonKind.DynamicTapButton, apex_p.approveTapButton],
  ])
}
