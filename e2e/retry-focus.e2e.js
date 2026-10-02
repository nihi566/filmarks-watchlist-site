import { test, expect, record, todayLocal } from './fixtures.js'

// 「再試行」を押すと Alert ごとボタンが消える。フォーカスが body（ページ先頭）へ落ちたままにしない
// （backlog 20260924-f-10tfdu）

test.describe('再試行後のフォーカス', () => {
  test('ウォッチリスト: 成功したら検索欄へ', async ({ page }) => {
    let fail = true
    await page.route('**/watchlist.json', (route) => (fail ? route.fulfill({ status: 500, body: '' }) : route.fallback()))
    await page.goto('./')
    const retry = page.getByRole('button', { name: '再試行' })
    await expect(retry).toBeVisible()
    fail = false
    await retry.click()
    await expect(page.getByRole('searchbox', { name: 'タイトルで検索' })).toBeFocused()
  })

  test('ウォッチリスト: また失敗したら新しい「再試行」へ', async ({ page }) => {
    await page.route('**/watchlist.json', (route) => route.fulfill({ status: 500, body: '' }))
    await page.goto('./')
    await page.getByRole('button', { name: '再試行' }).click()
    await expect(page.getByRole('button', { name: '再試行' })).toBeFocused()
  })

  test('ウォッチリスト画面の視聴記録: 成功したら検索欄へ、失敗なら「再試行」へ', async ({ page, github }) => {
    github.failGet = 500
    await page.goto('./')
    const retry = page.getByRole('button', { name: '再試行' })
    await retry.click()
    await expect(retry).toBeFocused()
    github.failGet = null
    await retry.click()
    await expect(page.getByText(/視聴記録を読み込めなかったため/)).toHaveCount(0)
    await expect(page.getByRole('searchbox', { name: 'タイトルで検索' })).toBeFocused()
  })

  test('視聴記録: 成功したら「作品を追加」へ、失敗なら「再試行」へ', async ({ page, github }) => {
    github.file.records = { '1': record('A', todayLocal()) }
    github.failGet = 500
    await page.goto('./#/records')
    const retry = page.getByRole('button', { name: '再試行' })
    await retry.click()
    await expect(retry).toBeFocused()
    github.failGet = null
    await retry.click()
    await expect(page.getByRole('button', { name: '作品を追加' })).toBeFocused()
  })

  test.describe('おすすめ', () => {
    test.use({ llm: { provider: 'ollama', baseUrl: 'http://localhost:11434', model: 'm' } })

    test('視聴記録: 成功したら選択中の種類へ', async ({ page, github }) => {
      github.failGet = 500
      await page.goto('./#/recommend')
      const retry = page.getByRole('button', { name: '再試行' })
      await retry.click()
      await expect(retry).toBeFocused()
      github.failGet = null
      await retry.click()
      await expect(page.getByRole('group', { name: '種類' }).getByRole('button', { pressed: true })).toBeFocused()
    })

    test('ウォッチリスト: 成功したら選択中の「どこから選ぶか」へ', async ({ page }) => {
      let fail = true
      await page.route('**/watchlist.json', (route) => (fail ? route.fulfill({ status: 500, body: '' }) : route.fallback()))
      await page.goto('./#/recommend')
      const retry = page.getByRole('button', { name: '再試行' })
      await retry.click()
      await expect(retry).toBeFocused()
      fail = false
      await retry.click()
      await expect(page.getByRole('group', { name: 'どこから選ぶか' }).getByRole('button', { pressed: true })).toBeFocused()
    })
  })
})
