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
import { ClickNavigation, TouchNavigation } from './actions'
import { ButtonKind, type TModel } from './types'

export function isTouchDevice(model: TModel): boolean {
  return model === 'stax' || model === 'flex'
}

export function zondaxMainmenuNavigation(model: TModel, clickArray?: number[]): ClickNavigation | TouchNavigation {
  if (isTouchDevice(model)) {
    return new TouchNavigation(model, [
      ButtonKind.InfoButton,
      ButtonKind.ToggleSettingButton1,
      ButtonKind.ToggleSettingButton1,
      ButtonKind.SettingsNavRightButton,
      ButtonKind.SettingsNavRightButton,
      ButtonKind.SettingsQuitButton,
    ])
  }
  const DEFAULT_MAINMENU_CLICKS = [1, 0, 0, 4, -5]
  return new ClickNavigation(clickArray ?? DEFAULT_MAINMENU_CLICKS)
}

export function zondaxToggleExpertMode(model: TModel, clickArray?: number[]): ClickNavigation | TouchNavigation {
  if (isTouchDevice(model)) {
    return new TouchNavigation(model, [ButtonKind.InfoButton, ButtonKind.ToggleSettingButton1, ButtonKind.SettingsQuitButton])
  }
  const DEFAULT_EXPERT_MODE_CLICKS = [1, 0, -1]
  return new ClickNavigation(clickArray ?? DEFAULT_EXPERT_MODE_CLICKS)
}

export function zondaxToggleBlindSigning(model: TModel, clickArray?: number[]): ClickNavigation | TouchNavigation {
  if (isTouchDevice(model)) {
    return new TouchNavigation(model, [ButtonKind.InfoButton, ButtonKind.ToggleSettingButton2, ButtonKind.SettingsQuitButton])
  }
  const DEFAULT_BLIND_SIGNING_MODE_CLICKS = [2, 0, -2]
  return new ClickNavigation(clickArray ?? DEFAULT_BLIND_SIGNING_MODE_CLICKS)
}

export function zondaxTouchEnableSpecialMode(model: TModel, toggleSettingButton?: ButtonKind): TouchNavigation {
  return new TouchNavigation(model, [
    ButtonKind.InfoButton,
    ButtonKind.ToggleSettingButton1,
    ButtonKind.SettingsNavRightButton,
    ButtonKind.SettingsNavLeftButton,
    toggleSettingButton ?? ButtonKind.ToggleSettingButton2,
    ButtonKind.SwipeContinueButton,
    ButtonKind.ConfirmYesButton,
  ])
}
