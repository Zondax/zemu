import { describe, expect, test, vi } from 'vitest'
import EmuContainer from '../src/emulator'
import Zemu from '../src/Zemu'
import { DEFAULT_EMU_IMG } from '../src/constants'

describe('checkAndPullImage fails', () => {
  const BAD_IMAGE_NAME = 'this is not a valid image name'

  test('EmuContainer should throw if checking for image fails', async () => {
    await expect(() => EmuContainer.checkAndPullImage(BAD_IMAGE_NAME)).rejects.toThrow()
  })

  test('Zemu should throw if checking for image fails', async () => {
    vi.spyOn(EmuContainer, 'checkAndPullImage').mockImplementationOnce(async (discarded) => {
      // expect a typical call
      expect(discarded).toBe(DEFAULT_EMU_IMG)
      // forward to the original implementation
      return EmuContainer.checkAndPullImage(BAD_IMAGE_NAME)
    })

    await expect(() => Zemu.checkAndPullImage()).rejects.toThrow()
  })
})
