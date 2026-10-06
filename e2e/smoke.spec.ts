import { expect, test } from '@playwright/test'

test.describe('shell', () => {
  test('home renders, name persists, theme switch works', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText("You're visible as")).toBeVisible()
    const nameBtn = page.getByRole('button', { name: /^Device name:/ })
    await nameBtn.click()
    const nameInput = page.getByRole('textbox', { name: 'Device name' })
    await expect(nameInput).toBeFocused()
    await nameInput.fill('Test Otter')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: /Device name: Test Otter/ })).toBeVisible()

    await page.getByRole('button', { name: 'Settings' }).click()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await page.getByRole('radio', { name: 'Dark' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('fastbeam:name') ?? '""'))).toBe('Test Otter')
  })

  test('no horizontal scroll at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 })
    await page.goto('/')
    const scroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(scroll).toBe(false)
  })
})

test.describe('pairing UI', () => {
  test('pair sheet: show my code has a QR, a code and a link', async ({ page }, info) => {
    await page.goto('/')
    if (info.project.name === 'desktop') {
      await page.getByRole('button', { name: 'Show QR' }).click()
    } else {
      await page.getByRole('button', { name: 'Show my code' }).click()
    }
    await expect(page.getByRole('img', { name: /QR code/ })).toBeVisible()
    const code = await page.locator('.bigcode').getAttribute('aria-label')
    expect(code).toMatch(/^Code ([A-Z2-9] ){5}[A-Z2-9]$/)
    await expect(page.getByText(/fastbeam\.app\/#[A-Z2-9]{6}/)).toBeVisible()
  })

  test('code boxes reject ambiguous characters and auto-submit on six', async ({ page }, info) => {
    await page.goto('/')
    if (info.project.name === 'desktop') await page.getByRole('button', { name: 'Scan a QR instead' }).click()
    else await page.getByRole('button', { name: 'Scan or enter' }).click()
    const input = page.getByLabel('6-character code')
    await input.fill('0')
    await expect(page.getByRole('alert')).toHaveText('Codes never use 0, O, 1, I or L')
    await input.fill('k7q-x4m')
    // Six valid characters submit: the sheet closes and Connecting shows the code.
    await expect(page.getByRole('heading', { name: /Connecting to/ })).toBeVisible()
    await expect(page.getByText('K7Q·X4M')).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByText("You're visible as")).toBeVisible()
  })

  test('a pairing link skips Home and goes straight to Connecting', async ({ page }) => {
    await page.goto('/#pair=K7QX4M')
    await expect(page.getByRole('heading', { name: 'Connecting to the other device' })).toBeVisible()
    expect(new URL(page.url()).hash).toBe('')
    await page.getByRole('button', { name: 'Cancel' }).click()
  })

  test('pasting a link into the code boxes fills and submits', async ({ page, context }, info) => {
    await page.goto('/')
    if (info.project.name === 'desktop') await page.getByRole('button', { name: 'Scan a QR instead' }).click()
    else await page.getByRole('button', { name: 'Scan or enter' }).click()
    const input = page.getByLabel('6-character code')
    await input.fill('https://fastbeam.app/#ABCDEF')
    await expect(page.getByRole('heading', { name: /Connecting to/ })).toBeVisible()
    await expect(page.getByText('ABC·DEF')).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
    void context
  })
})
