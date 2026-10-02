import { test, expect, localDate, record, todayLocal } from './fixtures.js'

// 今月の 1 日から offset か月ずらした月の 1 日
function monthStart(offset = 0) {
  const date = new Date()
  date.setDate(1)
  date.setMonth(date.getMonth() + offset)
  return localDate(date)
}

test.describe('視聴記録', () => {
  test('今月の記録が出て、月を移動・種類で絞り込みできる', async ({ page, github, errors }) => {
    github.file.records = {
      '13580': record('PERFECT BLUE', todayLocal(), { kind: 'anime', minutes: 81, rating: 5 }),
      '564': record('20世紀少年', monthStart(-1), { minutes: 142 }),
    }
    await page.goto('./#/records')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('視聴記録')
    await expect(page.getByRole('link', { name: /PERFECT BLUE/ })).toBeVisible()
    await expect(page.getByRole('button', { name: '次の月' })).toBeDisabled()
    await page.getByRole('button', { name: '前の月' }).click()
    await expect(page.getByRole('link', { name: /20世紀少年/ })).toBeVisible()
    await page.getByRole('button', { name: 'アニメ', exact: true }).click()
    await expect(page.getByText('この月に、この種類の視聴記録はありません。')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('作品を追加 → 編集 → 削除 → 元に戻す', async ({ page, github, errors }) => {
    await page.goto('./#/records')
    await page.getByRole('button', { name: '作品を追加' }).click()
    const dialog = page.getByRole('dialog', { name: '作品を追加して記録' })
    await dialog.getByLabel('タイトル').fill('ぼっち・ざ・ろっく！')
    await expect(dialog.getByText('視聴時間: 4時間48分')).toBeVisible()
    await dialog.getByRole('button', { name: '保存' }).click()
    await expect(page.getByText('「ぼっち・ざ・ろっく！」を記録しました')).toBeVisible()
    const id = Object.keys(github.file.records)[0]
    expect(id).toMatch(/^manual-/)
    expect(github.file.records[id]).toMatchObject({ kind: 'anime', episodes: 12, episode_minutes: 24, minutes: 288 })

    await page.getByRole('button', { name: '「ぼっち・ざ・ろっく！」の操作' }).click()
    await page.getByRole('menuitem', { name: '記録を編集' }).click()
    const edit = page.getByRole('dialog', { name: '記録を編集' })
    await edit.getByLabel('見た話数').fill('13')
    await edit.getByRole('button', { name: '保存' }).click()
    await expect(page.getByText('「ぼっち・ざ・ろっく！」の記録を更新しました')).toBeVisible()
    expect(github.file.records[id]).toMatchObject({ episodes: 13, minutes: 312 })

    await page.getByRole('button', { name: '「ぼっち・ざ・ろっく！」の操作' }).click()
    await page.getByRole('menuitem', { name: '記録を削除' }).click()
    await expect(page.getByText('「ぼっち・ざ・ろっく！」の記録を削除しました')).toBeVisible()
    expect(github.file.records[id]).toBeUndefined()
    await page.getByRole('button', { name: '元に戻す' }).click()
    await expect(page.getByText('の記録を元に戻しました')).toBeVisible()
    expect(github.file.records[id]).toMatchObject({ episodes: 13 })
    expect(errors).toEqual([])
  })

  test('入力の検証: 未来日・0 話は保存できない', async ({ page }) => {
    await page.goto('./#/records')
    await page.getByRole('button', { name: '作品を追加' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('タイトル').fill('テスト')
    await dialog.getByLabel('視聴日').fill('2999-01-01')
    await expect(dialog.getByText('未来の日付は選べません')).toBeVisible()
    await expect(dialog.getByRole('button', { name: '保存' })).toBeDisabled()
    await dialog.getByLabel('視聴日').fill(todayLocal())
    await dialog.getByLabel('見た話数').fill('0')
    await expect(dialog.getByText('1 以上の整数で入力してください')).toBeVisible()
    await expect(dialog.getByRole('button', { name: '保存' })).toBeDisabled()
  })

  test('編集で日付を前の月に変えると、その月へ切り替わる', async ({ page, github }) => {
    github.file.records = { '13580': record('PERFECT BLUE', todayLocal(), { kind: 'anime', minutes: 81 }) }
    await page.goto('./#/records')
    await page.getByRole('button', { name: '「PERFECT BLUE」の操作' }).click()
    await page.getByRole('menuitem', { name: '記録を編集' }).click()
    const lastDay = new Date()
    lastDay.setDate(0)
    await page.getByRole('dialog').getByLabel('視聴日').fill(localDate(lastDay))
    await page.getByRole('dialog').getByRole('button', { name: '保存' }).click()
    await expect(
      page.getByRole('heading', { level: 2, name: `${lastDay.getFullYear()}年${lastDay.getMonth() + 1}月` }),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: /PERFECT BLUE/ })).toBeVisible()
  })

  test('見たいに戻すと、ウォッチリストに戻っている', async ({ page, github }) => {
    github.file.records = { '13580': record('PERFECT BLUE', todayLocal(), { kind: 'anime', minutes: 81 }) }
    await page.goto('./#/records')
    await page.getByRole('button', { name: '「PERFECT BLUE」の操作' }).click()
    await page.getByRole('menuitem', { name: '見たいに戻す' }).click()
    await expect(page.getByText('「PERFECT BLUE」を見たいに戻しました')).toBeVisible()
    await page.goto('./#/')
    await page.getByRole('searchbox').fill('PERFECT')
    // Hulu と Netflix の両方に載っている
    await expect(page.getByRole('button', { name: '「PERFECT BLUE」を見たに記録' })).toHaveCount(2)
  })

  test('未分類で絞り込み中に最後の 1 件を戻しても、未分類ボタンが選択中のまま残る', async ({ page, github }) => {
    github.file.records = { '1': record('NoKind', todayLocal(), { kind: null }), '2': record('B', todayLocal()) }
    await page.goto('./#/records')
    await page.getByRole('button', { name: '未分類' }).click()
    await page.getByRole('button', { name: '「NoKind」の操作' }).click()
    await page.getByRole('menuitem', { name: '見たいに戻す' }).click()
    await expect(page.getByText('を見たいに戻しました')).toBeVisible()
    await expect(page.getByRole('button', { name: '未分類' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('元に戻すの失敗通知を閉じるボタンで消せる', async ({ page, github }) => {
    github.file.records = {
      '13580': record('PERFECT BLUE', todayLocal(), { kind: 'anime' }),
      '1': record('B', todayLocal()),
    }
    await page.goto('./#/records')
    await page.getByRole('button', { name: '「PERFECT BLUE」の操作' }).click()
    await page.getByRole('menuitem', { name: '見たいに戻す' }).click()
    await expect(page.getByText('「PERFECT BLUE」を見たいに戻しました')).toBeVisible()
    github.failPut = 500
    await page.getByRole('button', { name: '元に戻す' }).click()
    const alert = page.getByRole('alert').filter({ hasText: '元に戻せませんでした' })
    await expect(alert.getByRole('button', { name: '再試行' })).toBeVisible()
    await alert.getByRole('button', { name: '閉じる' }).click()
    await expect(alert).toHaveCount(0)
  })

  test('読込失敗時はエラーと再試行', async ({ page, github }) => {
    github.failGet = 500
    await page.goto('./#/records')
    await expect(page.getByText('記録の読み書きに失敗しました')).toBeVisible()
    github.failGet = null
    await page.getByRole('button', { name: '再試行' }).click()
    await expect(page.getByRole('button', { name: '作品を追加' })).toBeVisible()
  })
})

test.describe('設定', () => {
  test.use({ token: '' })

  test('トークンを保存・確認・削除できる', async ({ page, github, errors }) => {
    github.file.records = { '1': record('A', todayLocal()) }
    await page.goto('./#/settings')
    await page.getByLabel('トークン').fill('ghp_1234abcd')
    await page.getByRole('button', { name: '保存' }).first().click()
    await expect(page.getByText('保存済み（末尾 abcd）')).toBeVisible()
    await page.getByRole('button', { name: '接続を確認' }).first().click()
    await expect(page.getByText('接続できました（視聴記録 1件）')).toBeVisible()
    await page.getByRole('button', { name: '削除' }).click()
    await expect(page.getByText('トークンを削除しました')).toBeVisible()
    await page.getByLabel('トークン').fill('全角ｔｏｋｅｎ')
    await page.getByRole('button', { name: '保存' }).first().click()
    await expect(page.getByText('トークンに使えない文字')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('LLM の接続確認とモデル保存', async ({ page, errors }) => {
    await page.route('http://localhost:11434/api/tags', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ models: [{ name: 'qwen2.5:7b' }, { name: 'gemma3:4b' }] }),
      }),
    )
    await page.goto('./#/settings')
    await page.getByRole('button', { name: '接続を確認' }).click()
    await expect(page.getByText('接続できました（モデル 2 個）')).toBeVisible()
    await expect(page.getByLabel('モデル')).toHaveValue('gemma3:4b')
    await page.getByRole('button', { name: '保存' }).last().click()
    await expect(page.getByText('保存しました。「おすすめ」画面から使えます。')).toBeVisible()
    await page.getByLabel('接続先 URL').fill('ftp://x')
    await expect(page.getByText('http:// か https:// で始まる URL を入力してください')).toBeVisible()
    expect(errors).toEqual([])
  })
})

test.describe('おすすめ', () => {
  test.use({ llm: { provider: 'ollama', baseUrl: 'http://localhost:11434', model: 'qwen2.5:7b' } })

  test('LLM の答えがカードで出る（候補に無い作品は出さない）', async ({ page, errors }) => {
    await page.route('http://localhost:11434/api/chat', (route) => {
      const content = JSON.stringify({
        recommendations: [
          { id: 1, title: 'PERFECT BLUE', country: '日本', format: 'アニメ', reason: '好みに合う' },
          { id: 99, title: '存在しない作品', country: '日本', format: '実写', reason: 'x' },
        ],
      })
      route.fulfill({ status: 200, contentType: 'application/x-ndjson', body: `${JSON.stringify({ message: { content } })}\n` })
    })
    await page.goto('./#/recommend')
    await page.getByRole('button', { name: 'おすすめを聞く' }).click()
    await expect(page.getByRole('heading', { name: /PERFECT BLUE/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /存在しない作品/ })).toHaveCount(0)
    await page.getByText('LLM に送った内容').click()
    await expect(page.locator('pre')).toContainText('PERFECT BLUE')
    expect(errors).toEqual([])
  })

  test('LLM に接続できないとき案内が出る', async ({ page }) => {
    await page.route('http://localhost:11434/api/chat', (route) => route.abort())
    await page.goto('./#/recommend')
    await page.getByRole('button', { name: 'おすすめを聞く' }).click()
    await expect(page.getByRole('alert')).toContainText('接続できませんでした')
  })

  test('中止できる', async ({ page }) => {
    // 応答を返さないまま待たせる（中止で打ち切られる）
    await page.route('http://localhost:11434/api/chat', () => {})
    await page.goto('./#/recommend')
    await page.getByRole('button', { name: 'おすすめを聞く' }).click()
    await expect(page.getByText(/考え中…/)).toBeVisible()
    await page.getByRole('button', { name: '中止' }).click()
    await expect(page.getByRole('button', { name: 'おすすめを聞く' })).toBeEnabled()
    await expect(page.getByRole('alert')).toHaveCount(0)
  })
})

test.describe('おすすめ（モデル未設定）', () => {
  test('設定へ案内し、ボタンは押せない', async ({ page }) => {
    await page.goto('./#/recommend')
    await expect(page.getByText('おすすめを使うには、設定画面で')).toBeVisible()
    await expect(page.getByRole('button', { name: 'おすすめを聞く' })).toBeDisabled()
  })
})

test.describe('ナビゲーション', () => {
  test('メニューから各ページへ移動できる', async ({ page, errors }) => {
    await page.goto('./')
    for (const label of ['視聴記録', 'おすすめ', '設定', 'ウォッチリスト']) {
      await page.getByRole('button', { name: 'メニューを開く' }).click()
      await page.getByRole('navigation', { name: 'メインメニュー' }).getByRole('link', { name: label }).click()
      await expect(page.getByRole('heading', { level: 1 })).toContainText(label)
      await expect(page.getByRole('navigation', { name: 'メインメニュー' })).toBeHidden()
    }
    expect(errors).toEqual([])
  })

  test('未知の hash はウォッチリストになる', async ({ page }) => {
    await page.goto('./#/unknown')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('ウォッチリスト')
  })
})
