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
import { getTouchElement } from './buttons'
import { ActionKind, ButtonKind, type INavElement, type TModel, SwipeDirection, type IButton } from './types'

const dummyButton: IButton = {
  x: 0,
  y: 0,
  delay: 0,
  direction: SwipeDirection.NoSwipe,
}

export function scheduleToNavElement(clickSchedule: Array<INavElement | number>): INavElement[] {
  const nav: INavElement[] = []
  for (const click of clickSchedule) {
    if (typeof click !== 'number') {
      nav.push(click)
      continue
    }
    if (click === 0) {
      nav.push({
        type: ActionKind.BothClick,
        button: dummyButton,
      })
    } else {
      for (let i = 0; i < Math.abs(click); i++) {
        nav.push({
          type: click > 0 ? ActionKind.RightClick : ActionKind.LeftClick,
          button: dummyButton,
        })
      }
    }
  }
  return nav
}

export class ClickNavigation {
  schedule: INavElement[]

  constructor(clickSchedule: number[]) {
    this.schedule = scheduleToNavElement(clickSchedule)
  }
}

export class TouchNavigation {
  schedule: INavElement[]

  constructor(model: TModel, buttonKindArray: ButtonKind[]) {
    this.schedule = []
    for (const buttonKind of buttonKindArray) {
      const touchButton = getTouchElement(model, buttonKind)
      if (touchButton == null) throw new Error('Undefined touch action')
      this.schedule.push({
        type: ActionKind.Touch,
        button: touchButton,
      })
    }
  }
}
