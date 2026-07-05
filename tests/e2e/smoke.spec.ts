import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { mkdtempSync, copyFileSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const MOCK_EDIT = '<<<EDIT\nSEARCH:\nfill="#ccc"\nREPLACE:\nfill="#e8833a"\n>>>\n'
// A conversational reply with the SVG in a code fence (NO <<<FILE>>> block) — the
// exact shape a chatty model returns and the user's reported "dog" scenario.
const MOCK_NEW_FENCED =
  'Here is a simple illustration of a dog.\n```svg\n' +
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle id="dog" cx="50" cy="50" r="40" fill="#e8833a"/></svg>\n' +
  '```\n'

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

    // Scope to the sidebar: the no-folder placeholder also has an "Open folder" button.
    await window.getByTestId('sidebar').getByText('Open folder').click()
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

    // Prompt history: ArrowUp recalls the last sent prompt.
    const input = window.locator('[data-testid="prompt-input"]')
    await input.press('ArrowUp')
    await expect(input).toHaveValue('recolor @1')
  } finally {
    await electronApp?.close()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('creates a new SVG from a fenced (loose) model reply via the in-app filename dialog', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'clipot-e2e-new-')) // empty folder → new-file screen
  const mockPath = join(dir, 'mock.txt')
  writeFileSync(mockPath, MOCK_NEW_FENCED, 'utf8')

  let electronApp: ElectronApplication | null = null
  try {
    electronApp = await electron.launch({
      args: ['.', '--no-sandbox', `--user-data-dir=${join(dir, 'userdata')}`],
      env: {
        ...process.env,
        CLIPOT_MOCK_LLM: mockPath,
        CLIPOT_TEST_FOLDER: dir,
        NODE_ENV: 'production',
        ANTHROPIC_API_KEY: 'test-key-not-used-by-mock',
      },
    })

    const window: Page = await electronApp.firstWindow()
    await window.waitForLoadState('domcontentloaded')

    // Open the (empty) folder → the new-file screen appears.
    await window.getByTestId('sidebar').getByText('Open folder').click()
    await window.getByTestId('new-file-input').fill('a dog')
    await window.getByTestId('new-file-send').click()

    // The in-app filename dialog (Electron has no window.prompt) must appear.
    const nameInput = window.getByTestId('prompt-modal-input')
    await expect(nameInput).toBeVisible({ timeout: 15_000 })
    await nameInput.fill('dog.svg')
    await window.getByTestId('prompt-modal-ok').click()

    // The file is actually written to disk with the recovered SVG.
    const dogPath = join(dir, 'dog.svg')
    await expect
      .poll(() => (existsSync(dogPath) ? readFileSync(dogPath, 'utf8') : ''), { timeout: 15_000 })
      .toContain('id="dog"')
  } finally {
    await electronApp?.close()
    rmSync(dir, { recursive: true, force: true })
  }
})

const MOCK_NEW_NAMED =
  'Here is a dog.\n<<<FILE dog.svg\n' +
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle id="dog" cx="50" cy="50" r="40" fill="#e8833a"/></svg>\n' +
  '>>>\n'

test('new file: pre-fills the model filename and migrates the conversation to the file', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'clipot-e2e-name-'))
  const mockPath = join(dir, 'mock.txt')
  writeFileSync(mockPath, MOCK_NEW_NAMED, 'utf8')

  let electronApp: ElectronApplication | null = null
  try {
    electronApp = await electron.launch({
      args: ['.', '--no-sandbox', `--user-data-dir=${join(dir, 'userdata')}`],
      env: { ...process.env, CLIPOT_MOCK_LLM: mockPath, CLIPOT_TEST_FOLDER: dir, NODE_ENV: 'production', ANTHROPIC_API_KEY: 'k' },
    })
    const window: Page = await electronApp.firstWindow()
    await window.waitForLoadState('domcontentloaded')

    await window.getByTestId('sidebar').getByText('Open folder').click()
    await window.getByTestId('new-file-input').fill('a dog')
    await window.getByTestId('new-file-send').click()

    const nameInput = window.getByTestId('prompt-modal-input')
    await expect(nameInput).toBeVisible({ timeout: 15_000 })
    await expect(nameInput).toHaveValue('dog.svg') // pre-filled from the model
    await window.getByTestId('prompt-modal-ok').click()

    // Migration: the new file's thread on disk contains the generating prompt.
    const threadPath = join(dir, '.clipot', 'threads', 'dog.json')
    await expect
      .poll(() => (existsSync(threadPath) ? readFileSync(threadPath, 'utf8') : ''), { timeout: 15_000 })
      .toContain('a dog')
  } finally {
    await electronApp?.close()
    rmSync(dir, { recursive: true, force: true })
  }
})
