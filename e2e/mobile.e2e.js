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
      // 区切りの無い英字タイトル（★4 以上なので年のまとめにも出る）でも画面の横に広がらないこと
      '9003': record('Supercalifragilisticexpialidocious_TheMovieWithoutAnySpaces_2024', todayLocal(), {
        kind: 'foreign',
        rating: 5,
      }),
    }
  })

  for (const hash of HASHES) {
    test(`${hash} で横スクロールが出ない`, ({ page }) => expectNoHorizontalScroll(page, hash))
  }

  // 見出しは画面の上に固定している。見出しのボタンへフォーカスが戻っても（メニューを閉じたとき）ページが跳ねないこと
  test('スクロールした状態でメニューを開いて閉じても位置が変わらない', async ({ page, github }) => {
    for (let i = 0; i < 40; i += 1) github.file.records[`manual-${i}`] = record(`作品 ${i}`, todayLocal())
    await page.goto('./#/records')
    await expect(page.getByRole('link', { name: /^作品 39/ })).toBeVisible()
    await page.evaluate(() => window.scrollTo(0, 1200))
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(1200)
    // Playwright の click() は押す前にページを先頭までスクロールするので、DOM でフォーカスしてから押す
    await page.getByRole('button', { name: 'メニューを開く' }).evaluate((button) => button.focus())
    expect(await page.evaluate(() => window.scrollY)).toBe(1200)
    await page.getByRole('button', { name: 'メニューを開く' }).evaluate((button) => button.click())
    await expect(page.getByRole('link', { name: 'ウォッチリスト' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'メニューを開く' })).toBeFocused()
    expect(await page.evaluate(() => window.scrollY)).toBe(1200)
  })

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

    test('視聴時間の合計が数と単位の途中で改行されない', async ({ page }) => {
      await page.goto('./#/records')
      const total = page.getByText(/^\d+時間/).first()
      await expect(total).toBeVisible()
      // 「4時間」「120分」のそれぞれが 1 行に収まる（「4時 / 間」「12 / 0分」にならない）
      for (const part of await total.locator('span').all()) {
        const lineHeight = await part.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight))
        expect((await part.boundingBox()).height).toBeLessThan(lineHeight * 1.5)
      }
    })

    test('見たダイアログの保存ボタンが画面内に見える', async ({ page }) => {
      await page.goto('./')
      await page.getByRole('button', { name: /^Hulu/ }).click()
      // アニメは話数の欄が増えて縦に長くなる
      await page.getByRole('button', { name: '「君の名は。」を見たに記録' }).click()
      await expect(page.getByRole('dialog').getByRole('button', { name: '保存' })).toBeInViewport({ ratio: 1 })
    })

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
