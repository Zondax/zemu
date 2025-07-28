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
export namespace stax {
  export const infoButton: IButton = {
    x: 335,
    y: 65,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  export const quitAppButton: IButton = {
    x: 200,
    y: 625,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  export const swipeContinueButton: IButton = {
    x: 200,
    y: 350,
    delay: 0.1,
    direction: SwipeDirection.SwipeLeft,
  }

  export const navRightButton: IButton = {
    x: 360,
    y: 625,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  export const navLeftButton: IButton = {
    x: 195,
    y: 625,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  // Placeholder if Ledger moves this button
  export const settingsNavRightButton: IButton = navRightButton

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
    x: 75,
    y: 625,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  // From y:88 to y:227 (both included), the first switch is toggleable.
  export const toggleOption1: IButton = {
    x: 350,
    y: 88,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  export const approveTapButton: IButton = {
    x: 205,
    y: 520,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  export const prevPageButton: IButton = {
    x: 45,
    y: 45,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  export const approveHoldButton: IButton = {
    x: 335,
    y: 520,
    delay: 5,
    direction: SwipeDirection.NoSwipe,
  }

  // From y:228 to y:367 (both included), the second switch is toggleable.
  export const toggleOption2: IButton = {
    x: 350,
    y: 228,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  export const toggleOption3: IButton = {
    x: 350,
    y: 368,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  export const confirmYesButton: IButton = {
    x: 200,
    y: 550,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  export const confirmNoButton: IButton = {
    x: 200,
    y: 630,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  export const showQRButton: IButton = {
    x: 200,
    y: 300,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  export const closeQRButton: IButton = {
    x: 200,
    y: 650,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  export const TouchElements = new Map<ButtonKind, IButton>([
    [ButtonKind.InfoButton, stax.infoButton],
    [ButtonKind.QuitAppButton, stax.quitAppButton],

    [ButtonKind.SwipeContinueButton, stax.swipeContinueButton],
    [ButtonKind.PrevPageButton, stax.prevPageButton],

    [ButtonKind.SettingsNavRightButton, stax.settingsNavRightButton],
    [ButtonKind.SettingsNavLeftButton, stax.settingsNavLeftButton],
    [ButtonKind.SettingsQuitButton, stax.settingsQuitButton],

    [ButtonKind.ToggleSettingButton1, stax.toggleOption1],
    [ButtonKind.ToggleSettingButton2, stax.toggleOption2],
    [ButtonKind.ToggleSettingButton3, stax.toggleOption3],

    [ButtonKind.NavRightButton, stax.navRightButton],
    [ButtonKind.NavLeftButton, stax.navLeftButton],
    [ButtonKind.ApproveHoldButton, stax.approveHoldButton],
    [ButtonKind.ApproveTapButton, stax.approveTapButton],
    [ButtonKind.RejectButton, stax.rejectButton],
    [ButtonKind.ConfirmYesButton, stax.confirmYesButton],
    [ButtonKind.ConfirmNoButton, stax.confirmNoButton],
    [ButtonKind.ShowQRButton, stax.showQRButton],
    [ButtonKind.CloseQRButton, stax.closeQRButton],

    [ButtonKind.DynamicTapButton, stax.approveTapButton],
  ])
}
