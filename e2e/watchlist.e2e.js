import { test, expect, record, todayLocal } from './fixtures.js'

test.describe('ウォッチリスト', () => {
  test('一覧が表示され、グループは 1 つだけ開く', async ({ page, errors }) => {
    await page.goto('./')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('ウォッチリスト')
    await expect(page.getByText(/Filmarks からの取得/)).toBeVisible()
    const unext = page.getByRole('button', { name: /^U-NEXT/ })
    await expect(unext).toHaveAttribute('aria-expanded', 'false')
    await unext.click()
    await expect(unext).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('button', { name: /を見たに記録/ }).first()).toBeEnabled()
    const hulu = page.getByRole('button', { name: /^Hulu/ })
    await hulu.click()
    await expect(hulu).toHaveAttribute('aria-expanded', 'true')
    await expect(unext).toHaveAttribute('aria-expanded', 'false')
    expect(errors).toEqual([])
  })

  test('検索: 一致する作品が出て、無いときは案内が出る', async ({ page, errors }) => {
    await page.goto('./')
    await page.getByRole('button', { name: 'タイトル検索へ移動' }).click()
    await expect(page.getByRole('searchbox', { name: 'タイトルで検索' })).toBeFocused()
    await page.keyboard.type('20世紀少年')
    await expect(page.getByRole('link', { name: /^20世紀少年 ＜第1章＞/ }).first()).toBeVisible()
    await page.getByRole('searchbox').fill('zzzzzzzz')
    await expect(page.getByText('「zzzzzzzz」に一致する作品はありません')).toBeVisible()
    // 0 件の案内から検索をやめられる
    await page.getByRole('button', { name: '検索をクリア' }).click()
    await expect(page.getByRole('searchbox')).toHaveValue('')
    await expect(page.getByRole('searchbox')).toBeFocused()
    await expect(page.getByRole('button', { name: /^U-NEXT/ })).toBeVisible()
    expect(errors).toEqual([])
  })

  test('検索と絞り込みで 0 件のとき、絞り込みだけを解除できる', async ({ page, errors }) => {
    await page.goto('./')
    await page.getByRole('button', { name: '種類別' }).click()
    await page.getByRole('menuitem', { name: /^アニメ/ }).click()
    await page.getByRole('searchbox').fill('インターステラー')
    await expect(page.getByText('「インターステラー」に一致する作品はありません')).toBeVisible()
    await expect(page.getByText('絞り込み（アニメ）の中から探しています')).toBeVisible()
    await page.getByRole('button', { name: '絞り込みを解除' }).click()
    await expect(page.getByRole('button', { name: '種類別' })).toBeVisible()
    await expect(page.getByRole('searchbox')).toHaveValue('インターステラー')
    await expect(page.getByRole('link', { name: /^インターステラー/ }).first()).toBeVisible()
    expect(errors).toEqual([])
  })

  test('検索: ひらがな・半角カナでもカタカナのタイトルが見つかる', async ({ page }) => {
    await page.goto('./')
    for (const keyword of ['いんたー', 'ｲﾝﾀｰ']) {
      await page.getByRole('searchbox').fill(keyword)
      await expect(page.getByRole('link', { name: /^インターステラー/ }).first()).toBeVisible()
    }
  })

  test('サービス・種類で絞り込み、並び替えができる', async ({ page, errors }) => {
    await page.goto('./')
    await page.getByRole('button', { name: 'サービス別' }).click()
    await page.getByRole('menuitem', { name: /Netflix/ }).click()
    await expect(page.getByRole('button', { name: 'Netflix', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Netflix\s*\d+件/ })).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('button', { name: /^U-NEXT/ })).toHaveCount(0)

    await page.getByRole('button', { name: '種類別' }).click()
    await page.getByRole('menuitem', { name: /アニメ/ }).click()
    await expect(page.getByRole('button', { name: 'アニメ', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: /^PERFECT BLUE/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /^20世紀少年/ })).toHaveCount(0)

    await page.getByRole('button', { name: /^すべて \d+/ }).click()
    await page.getByRole('button', { name: '並び替え' }).click()
    await page.getByRole('menuitem', { name: 'サービス名順' }).click()
    await expect(page.getByRole('menu')).toHaveCount(0)
    expect(errors).toEqual([])
  })

  test('サービスで観るページへのリンクがある作品だけ「観る」が出る', async ({ page }) => {
    await page.goto('./')
    await page.getByRole('button', { name: /^Hulu/ }).click()
    const watch = page.getByRole('link', { name: 'Huluで「PERFECT BLUE」を観る（新しいタブで開きます）' })
    await expect(watch).toHaveAttribute('href', 'https://www.hulu.jp/perfect-blue-anime')
    await expect(watch).toHaveAttribute('target', '_blank')
    await expect(page.getByRole('link', { name: /「君の名は。」を観る/ })).toHaveCount(0)
    // 同じ作品でもサービスごとに別のリンク
    await page.getByRole('button', { name: /^Netflix/ }).click()
    await expect(page.getByRole('link', { name: 'Netflixで「PERFECT BLUE」を観る（新しいタブで開きます）' })).toHaveAttribute(
      'href',
      'https://www.netflix.com/jp/title/60000043',
    )
  })

  test('作品を最近クリップした順に並べられる', async ({ page }) => {
    await page.goto('./')
    await page.getByRole('button', { name: /^Hulu/ }).click()
    const titles = page.getByRole('button', { name: /を見たに記録/ })
    await expect(titles.first()).toHaveAttribute('aria-label', '「PERFECT BLUE」を見たに記録')
    await page.getByRole('button', { name: '並び替え' }).click()
    await page.getByRole('menuitem', { name: '最近クリップした順' }).click()
    await expect(titles.first()).toHaveAttribute('aria-label', '「インターステラー」を見たに記録')
  })

  test('見たに記録 → 一覧から消える → 元に戻す', async ({ page, github, errors }) => {
    await page.goto('./')
    await page.getByRole('button', { name: /^Hulu/ }).click()
    const target = page.getByRole('button', { name: '「PERFECT BLUE」を見たに記録' })
    await target.click()
    const dialog = page.getByRole('dialog', { name: '見たに記録' })
    await expect(dialog.getByLabel('視聴日')).toHaveValue(todayLocal())
    const radioId = await dialog.getByRole('radio', { name: /4つ星/ }).getAttribute('id')
    await dialog.locator(`label[for="${radioId}"]`).click()
    await dialog.getByRole('button', { name: '保存' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText('「PERFECT BLUE」を見たに記録しました')).toBeVisible()
    await expect(target).toHaveCount(0)
    expect(github.file.records['13580']).toMatchObject({ title: 'PERFECT BLUE', rating: 4, kind: 'anime', minutes: 81 })

    await page.getByRole('button', { name: '元に戻す' }).click()
    await expect(page.getByText('「PERFECT BLUE」を見たいに戻しました')).toBeVisible()
    await expect(page.getByRole('button', { name: '「PERFECT BLUE」を見たに記録' })).toBeFocused()
    expect(github.file.records['13580']).toBeUndefined()
    expect(errors).toEqual([])
  })

  test('見たにした後のフォーカスは「元に戻す」→ 閉じると同じグループの次の作品', async ({ page }) => {
    await page.goto('./')
    await page.getByRole('button', { name: /^Hulu/ }).click()
    await page.getByRole('button', { name: '「PERFECT BLUE」を見たに記録' }).click()
    await page.getByRole('dialog').getByRole('button', { name: '保存' }).click()
    await expect(page.getByRole('button', { name: '元に戻す' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: '「インターステラー」を見たに記録' })).toBeFocused()
  })

  test('見たにした後の通知は閉じるボタンで消せ、フォーカスは同じグループの次の作品へ', async ({ page }) => {
    await page.goto('./')
    await page.getByRole('button', { name: /^Hulu/ }).click()
    await page.getByRole('button', { name: '「PERFECT BLUE」を見たに記録' }).click()
    await page.getByRole('dialog').getByRole('button', { name: '保存' }).click()
    await page.getByRole('button', { name: '閉じる' }).click()
    await expect(page.getByText('「PERFECT BLUE」を見たに記録しました')).toBeHidden()
    await expect(page.getByRole('button', { name: '「インターステラー」を見たに記録' })).toBeFocused()
  })

  test('Esc でダイアログが閉じ、フォーカスが見たボタンへ戻る', async ({ page }) => {
    await page.goto('./')
    await page.getByRole('button', { name: /^Hulu/ }).click()
    const button = page.getByRole('button', { name: '「PERFECT BLUE」を見たに記録' })
    await button.click()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(button).toBeFocused()
  })

  test('保存失敗時はダイアログに理由が出て閉じない', async ({ page, github }) => {
    github.failPut = 403
    await page.goto('./')
    await page.getByRole('button', { name: /^Hulu/ }).click()
    await page.getByRole('button', { name: '「PERFECT BLUE」を見たに記録' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: '保存' }).click()
    await expect(dialog.getByRole('alert')).toContainText('権限がありません')
    await expect(dialog).toBeVisible()
  })

  test('保存が他端末と競合したら 1 回取り直して保存できる', async ({ page, github }) => {
    await page.goto('./')
    await page.getByRole('button', { name: /^Hulu/ }).click()
    await page.getByRole('button', { name: '「PERFECT BLUE」を見たに記録' }).click()
    github.file.records['1'] = record('他端末', todayLocal())
    github.sha += 1
    await page.getByRole('dialog').getByRole('button', { name: '保存' }).click()
    await expect(page.getByText('「PERFECT BLUE」を見たに記録しました')).toBeVisible()
    expect(Object.keys(github.file.records).sort()).toEqual(['1', '13580'])
  })

  test('記録済みの作品は一覧に出ない', async ({ page, github }) => {
    github.file.records['13580'] = record('PERFECT BLUE', todayLocal())
    await page.goto('./')
    await page.getByRole('searchbox').fill('PERFECT BLUE')
    await expect(page.getByText('「PERFECT BLUE」に一致する作品はありません')).toBeVisible()
  })

  test('種類不明で絞り込み中に最後の 1 件を見たにしても、絞り込みボタンに「種類不明」が出たまま', async ({ page, github }) => {
    github.file.records['9003'] = record('配信の無い作品', todayLocal())
    await page.goto('./')
    await page.getByRole('button', { name: '種類別' }).click()
    await page.getByRole('menuitem', { name: /種類不明/ }).click()
    await page.locator('[data-group-summary]').first().click()
    await page.getByRole('button', { name: /を見たに記録/ }).click()
    await page.getByRole('dialog').getByRole('button', { name: '洋画' }).click()
    await page.getByRole('dialog').getByRole('button', { name: '保存' }).click()
    await expect(page.getByText('表示できる作品はありません')).toBeVisible()
    const kindButton = page.getByRole('button', { name: '種類不明', exact: true })
    await kindButton.click()
    await expect(page.getByRole('menuitem', { name: /種類不明\s*0件/ })).toBeVisible()
    await page.getByRole('menuitem', { name: /すべての種類/ }).click()
    await expect(page.getByRole('button', { name: '種類別' })).toBeVisible()
  })

  test('ウォッチリストの取得失敗 → 再試行で回復', async ({ page }) => {
    let fail = true
    await page.route('**/watchlist.json', (route) => (fail ? route.fulfill({ status: 500, body: '' }) : route.fallback()))
    await page.goto('./')
    await expect(page.getByText(/ウォッチリストを取得できませんでした（HTTP 500）/)).toBeVisible()
    fail = false
    await page.getByRole('button', { name: '再試行' }).click()
    await expect(page.getByRole('button', { name: /^U-NEXT/ })).toBeVisible()
  })

  test('視聴記録の読込失敗は警告を出し、見たボタンは押せない', async ({ page, github }) => {
    github.failGet = 401
    await page.goto('./')
    await expect(page.getByText(/視聴記録を読み込めなかったため/)).toBeVisible()
    await page.getByRole('button', { name: /^Hulu/ }).click()
    await expect(page.getByRole('button', { name: '「PERFECT BLUE」を見たに記録' })).toBeDisabled()
  })
})

test.describe('トークン無し', () => {
  test.use({ token: '' })

  test('見たを押すと設定へ案内する', async ({ page }) => {
    await page.goto('./')
    await page.getByRole('button', { name: /^Hulu/ }).click()
    await page.getByRole('button', { name: '「PERFECT BLUE」を見たに記録' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('設定で GitHub トークンを保存してください')).toBeVisible()
    await dialog.getByRole('link', { name: '設定を開く' }).click()
    await expect(page).toHaveURL(/#\/settings$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('設定')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})
