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

import { flex } from "./buttons_flex"
import { stax } from "./buttons_stax"
import { type ButtonKind, type IButton, SwipeDirection, type TModel } from "./types"

const dummyButton: IButton = {
  x: 0,
  y: 0,
  delay: 0,
  direction: SwipeDirection.NoSwipe,
}

export function getTouchElement(model: TModel, buttonKind: ButtonKind): IButton {
  switch (model) {
    case "stax": {
      const button = stax.TouchElements.get(buttonKind)
      if (button != null) {
        return button
      }
      break
    }

    case "flex": {
      const button = flex.TouchElements.get(buttonKind)
      if (button != null) {
        return button
      }
      break
    }

    // Add cases for other models here when they become available

    default:
      return dummyButton
  }

  console.log(`Unsupported ButtonKind: ${model}, ${buttonKind}`)
  return dummyButton
}
