import { test, expect, record, todayLocal } from './fixtures.js'

// スマホ幅（playwright.config.js の mobile プロジェクトだけで流す）
const HASHES = ['#/', '#/records', '#/recommend', '#/settings']

async function expectNoHorizontalScroll(page, hash) {
  await page.goto(`./${hash}`)
  await page.waitForLoadState('networkidle')
  if (hash === '#/') await page.getByRole('button', { name: /^U-NEXT/ }).click()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

test.describe('スマホ幅', () => {
  test.beforeEach(({ github }) => {
    github.file.records = {
      '13580': record('PERFECT BLUE とても長いタイトルの作品名がここに入る場合のテスト用', todayLocal(), {
        kind: 'anime',
        rating: 3,
      }),
    }
  })

  for (const hash of HASHES) {
    test(`${hash} で横スクロールが出ない`, ({ page }) => expectNoHorizontalScroll(page, hash))
  }

  test.describe('トークン未設定', () => {
    test.use({ token: '' })

    // 「設定を開く」が「設定を開/く」と 2 行に割れると、押せる範囲が読み取りにくい
    for (const hash of ['#/records', '#/recommend']) {
      test(`${hash} の案内の「設定を開く」が 1 行に収まる`, async ({ page }) => {
        await page.goto(`./${hash}`)
        const button = page.getByRole('link', { name: '設定を開く' })
        await expect(button).toBeVisible()
        const lineHeight = await button.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight))
        const box = await button.boundingBox()
        expect(box.height).toBeLessThan(lineHeight * 2)
      })
    }
  })

  test.describe('320px', () => {
    test.use({ viewport: { width: 320, height: 640 } })

    for (const hash of HASHES) {
      test(`${hash} で横にはみ出さない`, ({ page }) => expectNoHorizontalScroll(page, hash))
    }

    test('見たダイアログが画面に収まる', async ({ page }) => {
      await page.goto('./')
      await page.getByRole('button', { name: /^Hulu/ }).click()
      await page.getByRole('button', { name: /を見たに記録/ }).first().click()
      const box = await page.getByRole('dialog').boundingBox()
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(320)
    })
  })
})
