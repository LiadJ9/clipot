import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { mkdtempSync, copyFileSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const MOCK_EDIT = '<<<EDIT\nSEARCH:\nfill="#ccc"\nREPLACE:\nfill="#e8833a"\n>>>\n'

test('recolors a selected element via a mocked LLM stream and saves it to disk', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'clipot-e2e-'))
  const housePath = join(dir, 'house.svg')
  copyFileSync(join(__dirname, 'fixtures', 'house.svg'), housePath)

  const mockPath = join(dir, 'mock.txt')
  writeFileSync(mockPath, MOCK_EDIT, 'utf8')

  let electronApp: ElectronApplication | null = null
  try {
    electronApp = await electron.launch({
      // Isolate userData (keys, prefs) to a temp dir so the test is deterministic
      // and unaffected by any real session prefs on this machine.
      args: ['.', '--no-sandbox', `--user-data-dir=${join(dir, 'userdata')}`],
      env: {
        ...process.env,
        CLIPOT_MOCK_LLM: mockPath,
        CLIPOT_TEST_FOLDER: dir,
        NODE_ENV: 'production',
        // A configured key is a real precondition for sending; the mock stream
        // ignores it, but the renderer's no-key guard requires one to be present.
        ANTHROPIC_API_KEY: 'test-key-not-used-by-mock',
      },
    })

    const window: Page = await electronApp.firstWindow()
    await window.waitForLoadState('domcontentloaded')

    await window.getByText('Open folder').click()
    await window.getByText('house.svg').click()

    const rect = window.locator('.surface rect').first()
    await expect(rect).toHaveAttribute('fill', '#ccc')
    await rect.click()

    await window.locator('[data-testid="prompt-input"]').fill('recolor @1')
    await window.locator('[data-testid="prompt-send"]').click()

    await expect(rect).toHaveAttribute('fill', '#e8833a', { timeout: 15_000 })
    await expect
      .poll(() => readFileSync(housePath, 'utf8'), { timeout: 15_000 })
      .toContain('fill="#e8833a"')
  } finally {
    await electronApp?.close()
    rmSync(dir, { recursive: true, force: true })
  }
})
