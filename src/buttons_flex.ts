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
export namespace flex {
  export const infoButton: IButton = {
    x: 405,
    y: 75,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  export const quitAppButton: IButton = {
    x: 240,
    y: 550,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  export const swipeContinueButton: IButton = {
    x: 250,
    y: 325,
    delay: 0.1,
    direction: SwipeDirection.SwipeLeft,
  }

  export const navRightButton: IButton = {
    x: 435,
    y: 555,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  export const navLeftButton: IButton = {
    x: 235,
    y: 555,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  // Placeholder if Ledger moves this button
  export const settingsNavRightButton: IButton = navRightButton

  export const settingsNavnavLeftButton: IButton = {
    x: 315,
    y: 555,
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
    y: 555,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  // From y:96 to y:235 (both included), the first switch is toggleable.
  export const toggleOption1: IButton = {
    x: 415,
    y: 96,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  export const approveTapButton: IButton = {
    x: 240,
    y: 435,
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
    x: 400,
    y: 435,
    delay: 5,
    direction: SwipeDirection.NoSwipe,
  }

  // From y:236 to y:375 (both included), the second switch is toggleable.
  export const toggleOption2: IButton = {
    x: 350,
    y: 236,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  export const confirmYesButton: IButton = {
    x: 235,
    y: 460,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  export const confirmNoButton: IButton = {
    x: 235,
    y: 555,
    delay: 0.25,
    direction: SwipeDirection.NoSwipe,
  }

  export const showQRButton: IButton = {
    x: 250,
    y: 245,
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
    [ButtonKind.InfoButton, flex.infoButton],
    [ButtonKind.QuitAppButton, flex.quitAppButton],

    [ButtonKind.SwipeContinueButton, flex.swipeContinueButton],
    [ButtonKind.PrevPageButton, flex.prevPageButton],

    [ButtonKind.SettingsNavRightButton, flex.settingsNavRightButton],
    [ButtonKind.SettingsNavLeftButton, flex.settingsNavnavLeftButton],
    [ButtonKind.SettingsQuitButton, flex.settingsQuitButton],

    [ButtonKind.ToggleSettingButton1, flex.toggleOption1],
    [ButtonKind.ToggleSettingButton2, flex.toggleOption2],

    [ButtonKind.NavRightButton, flex.navRightButton],
    [ButtonKind.NavLeftButton, flex.navLeftButton],

    [ButtonKind.ApproveHoldButton, flex.approveHoldButton],
    [ButtonKind.ApproveTapButton, flex.approveTapButton],
    [ButtonKind.RejectButton, flex.rejectButton],
    [ButtonKind.ConfirmYesButton, flex.confirmYesButton],
    [ButtonKind.ConfirmNoButton, flex.confirmNoButton],
    [ButtonKind.ShowQRButton, flex.showQRButton],
    [ButtonKind.CloseQRButton, flex.closeQRButton],

    [ButtonKind.DynamicTapButton, flex.approveTapButton],
  ])
}
