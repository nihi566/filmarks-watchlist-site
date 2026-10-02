// E2E テストの共通部品。外部への通信はすべて差し替える:
// - watchlist.json / movie-meta.json は e2e/data の固定データ（scraper の更新でテストが揺れないように）
// - GitHub Contents API（視聴記録）は記憶の中だけの偽物（FakeGitHub）
// - サムネの CDN は 1px の画像
// ローカル LLM（localhost:11434）は各テストで必要なときだけ page.route で差し替える
import { readFileSync } from 'node:fs'
import { test as base, expect } from '@playwright/test'

const TOKEN_KEY = 'filmarks-watchlist.github-token'
const LLM_KEY = 'filmarks-watchlist.llm-settings'
const DATA_DIR = new URL('./data/', import.meta.url)
const WATCHLIST = JSON.parse(readFileSync(new URL('watchlist.json', DATA_DIR), 'utf8'))
const MOVIE_META = readFileSync(new URL('movie-meta.json', DATA_DIR), 'utf8')
const BLANK_GIF = Buffer.from('R0lGODlhAQABAAAAACw=', 'base64')

const pad = (n) => String(n).padStart(2, '0')

function b64(text) {
  return Buffer.from(text, 'utf8').toString('base64')
}

// scraper と同じ "YYYY-MM-DD HH:MM:SS"（ローカル時刻）
export function localDateTime(date = new Date()) {
  return `${localDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function todayLocal() {
  return localDate()
}

export function record(title, watched_on, extra = {}) {
  return {
    title,
    image: '',
    watched_on,
    minutes: 120,
    updated_at: '',
    rating: null,
    kind: 'japanese',
    episodes: null,
    episode_minutes: null,
    ...extra,
  }
}

// GitHub Contents API を記憶の中だけで再現する（records ブランチの records.json）
export class FakeGitHub {
  constructor(records = {}) {
    this.file = { version: 1, records }
    this.sha = 1
    this.puts = []
    this.failGet = null
    this.failPut = null
  }

  async handle(route) {
    const req = route.request()
    if (req.method() === 'GET') {
      if (this.failGet) return route.fulfill({ status: this.failGet, body: '{}' })
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ content: b64(JSON.stringify(this.file)), sha: String(this.sha) }),
      })
    }
    if (req.method() === 'PUT') {
      if (this.failPut) return route.fulfill({ status: this.failPut, body: '{}' })
      const body = req.postDataJSON()
      if (body.sha !== String(this.sha)) return route.fulfill({ status: 409, body: '{}' })
      this.file = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'))
      this.sha += 1
      this.puts.push(body)
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    }
    return route.fulfill({ status: 405, body: '{}' })
  }
}

export const test = base.extend({
  // Playwright は第 1 引数の分割代入から依存する fixture を読むので、空でも {} が要る
  // eslint-disable-next-line no-empty-pattern
  github: async ({}, use) => {
    await use(new FakeGitHub())
  },
  token: ['test-token-abcd', { option: true }],
  llm: [null, { option: true }],
  // 画面で起きた例外・console のエラーと警告を集める（各テストの最後に空であることを確かめる）
  errors: async ({ page }, use) => {
    const errors = []
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') errors.push(`${msg.type()}: ${msg.text()}`)
    })
    await use(errors)
  },
  page: async ({ page, github, token, llm }, use) => {
    await page.route('https://d2ueuvlup6lbue.cloudfront.net/**', (route) =>
      route.fulfill({ status: 200, contentType: 'image/gif', body: BLANK_GIF }),
    )
    await page.route('**/watchlist.json', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...WATCHLIST, generated_at: localDateTime() }),
      }),
    )
    await page.route('**/movie-meta.json', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: MOVIE_META }),
    )
    await page.route('https://api.github.com/**', (route) => github.handle(route))
    // 最初の読み込みのときだけ保存済みの設定を入れる（テスト中に消した・変えた値をリロードで戻さない）
    await page.addInitScript(
      ([tokenKey, tokenValue, llmKey, llmValue]) => {
        if (sessionStorage.getItem('__e2e_init')) return
        sessionStorage.setItem('__e2e_init', '1')
        if (tokenValue) localStorage.setItem(tokenKey, tokenValue)
        if (llmValue) localStorage.setItem(llmKey, JSON.stringify(llmValue))
      },
      [TOKEN_KEY, token, LLM_KEY, llm],
    )
    await use(page)
  },
})

export { expect }
