import { test, expect } from './fixtures.js'

// 絞り込み・検索・並び順を URL に持たせ、リロード・共有・他ページから戻ったときに復元する
// （backlog 20260924-tab-selection-not-persisted-in-url）

test.describe('見え方を URL で保つ', () => {
  test('絞り込み・検索・並び順がリロード後も残る', async ({ page }) => {
    await page.goto('./')
    await page.getByRole('button', { name: 'サービス別' }).click()
    await page.getByRole('menuitem', { name: /Netflix/ }).click()
    await page.getByRole('button', { name: '種類別' }).click()
    await page.getByRole('menuitem', { name: /アニメ/ }).click()
    await page.getByRole('button', { name: '並び替え' }).click()
    await page.getByRole('menuitem', { name: '最近クリップした順' }).click()
    await page.getByRole('searchbox').fill('perfect')
    await expect(page).toHaveURL(/\?service=Netflix&kind=anime&q=perfect&order=clip$/)

    await page.reload()
    await expect(page.getByRole('button', { name: 'Netflix', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'アニメ', exact: true })).toBeVisible()
    await expect(page.getByRole('searchbox')).toHaveValue('perfect')
    await expect(page.getByRole('link', { name: /^PERFECT BLUE/ })).toBeVisible()
    await page.getByRole('button', { name: '並び替え' }).click()
    await expect(page.getByRole('menuitem', { name: '最近クリップした順' })).toHaveClass(/Mui-selected/)
  })

  test('共有された URL のサービスで、そのグループを開いた状態で始まる', async ({ page }) => {
    await page.goto('./?service=Hulu#/')
    await expect(page.getByRole('button', { name: 'Hulu', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Hulu\s*\d+件/ })).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('button', { name: /^U-NEXT/ })).toHaveCount(0)
  })

  test('何も絞り込まないと URL にクエリを付けない', async ({ page }) => {
    await page.goto('./?service=Hulu#/')
    await page.getByRole('button', { name: /^すべて \d+/ }).click()
    await expect(page).toHaveURL(/filmarks-watchlist-site\/#\/$/)
  })

  test('一覧に無いサービス・知らない値の URL は絞り込まずに開く', async ({ page }) => {
    await page.goto(`./?service=${encodeURIComponent('存在しないサービス')}&kind=drama&sort=x#/`)
    await expect(page.getByRole('button', { name: 'サービス別' })).toBeVisible()
    await expect(page.getByRole('button', { name: '種類別' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^U-NEXT/ })).toBeVisible()
    await expect(page).toHaveURL(/filmarks-watchlist-site\/#\/$/)
  })

  test('他のページへ移って戻っても絞り込みが残る', async ({ page }) => {
    await page.goto('./')
    await page.getByRole('button', { name: 'サービス別' }).click()
    await page.getByRole('menuitem', { name: /Hulu/ }).click()
    await page.getByRole('button', { name: 'メニューを開く' }).click()
    await page.getByRole('navigation', { name: 'メインメニュー' }).getByRole('link', { name: '視聴記録' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('視聴記録')
    await page.getByRole('button', { name: 'メニューを開く' }).click()
    await page.getByRole('navigation', { name: 'メインメニュー' }).getByRole('link', { name: 'ウォッチリスト' }).click()
    await expect(page.getByRole('button', { name: 'Hulu', exact: true })).toBeVisible()
  })
})
