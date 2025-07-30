import { describe, expect, test, vi } from 'vitest'
import EmuContainer from '../src/emulator'
import Zemu from '../src/Zemu'
import { DEFAULT_EMU_IMG } from '../src/constants'

describe('checkAndPullImage', () => {
  test('EmuContainer should throw if checking for image fails', async () => {
    await expect(() => EmuContainer.checkAndPullImage('please fail')).rejects.toThrow()
  })

  test('Zemu should throw if checking for image fails', async () => {
    vi.spyOn(EmuContainer, 'checkAndPullImage').mockImplementationOnce(async (discarded) => {
      // expect a typical call
      expect(discarded).toBe(DEFAULT_EMU_IMG)
      // forward to the original implementation
      return EmuContainer.checkAndPullImage('please fail')
    })

    await expect(() => Zemu.checkAndPullImage()).rejects.toThrow()
  })
})
