import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { collectMovieMeta, isMainModule, parseMovieMeta } from './update-movie-meta.js'

const SCRIPT_URL = new URL('./update-movie-meta.js', import.meta.url)
const SCRIPT_PATH = fileURLToPath(SCRIPT_URL)

// Filmarks の作品ページ（2026 年 9 月時点）の該当部分を抜き出したもの
const PAGE = `
<ul class="p-header-modal-menu__list"><li><a href="/list/country">製作国・地域</a></li><li><a href="/list/genre">ジャンル</a></li></ul>
<div class="p-content-detail__primary-info"><h3 class="p-content-detail__primary-info-title">製作国・地域：</h3><ul><li><a href="/list/country/5">アメリカ</a></li><li><a href="/list/country/11">イギリス</a></li></ul><h3 class="p-content-detail__primary-info-title">上映時間：150分</h3></div>
<div class="p-content-detail__secondary-info"><h3 class="p-content-detail__secondary-info-title">ジャンル：</h3><ul><li><a href="/list/genre/2">サスペンス</a></li><li><a href="/list/genre/5">アクション</a></li></ul><h3 class="p-content-detail__secondary-info-title">配給：</h3><ul><li><a href="/list/distributor/503">ワーナー・ブラザース映画</a></li></ul></div>
`

describe('parseMovieMeta', () => {
  it('作品詳細の製作国とジャンルだけを取り出す（メニューや配給のリンクは拾わない）', () => {
    expect(parseMovieMeta(PAGE)).toEqual({ countries: ['アメリカ', 'イギリス'], genres: ['サスペンス', 'アクション'] })
  })

  it('見出しが無ければ空の一覧にする', () => {
    expect(parseMovieMeta('<html></html>')).toEqual({ countries: [], genres: [] })
  })
})

describe('collectMovieMeta', () => {
  const previous = {
    1: { countries: ['日本'], genres: ['アニメ'] },
    2: { countries: ['アメリカ'], genres: ['ドラマ'] },
  }
  const noWait = () => Promise.resolve()
  const quiet = { log: () => {}, warn: () => {} }
  const okPage = { ok: true, status: 200, text: () => Promise.resolve(PAGE) }
  const parsedPage = { countries: ['アメリカ', 'イギリス'], genres: ['サスペンス', 'アクション'] }

  it('--all で取得に失敗した作品は、元の製作国・ジャンルを残して失敗件数に数える', async () => {
    const fetchPage = vi.fn(async (url) => {
      if (url.endsWith('/1')) return { ok: false, status: 500, text: () => Promise.resolve('') }
      if (url.endsWith('/2')) throw new Error('socket hang up')
      return okPage
    })

    const { movies, failed } = await collectMovieMeta({ ids: ['1', '2', '3'], previous, refetchAll: true, fetchPage, wait: noWait, logger: quiet })

    expect(failed).toBe(2)
    expect(movies).toEqual({ 1: previous[1], 2: previous[2], 3: parsedPage })
  })

  it('--all で取得できた作品は新しい値で置き換える', async () => {
    const { movies, failed } = await collectMovieMeta({ ids: ['1'], previous, refetchAll: true, fetchPage: async () => okPage, wait: noWait, logger: quiet })

    expect(failed).toBe(0)
    expect(movies).toEqual({ 1: parsedPage })
  })

  it('--all なしでは取っていない作品だけを取りに行き、失敗したら保存しない（次の実行でもう一度取りに行く）', async () => {
    const fetchPage = vi.fn(async () => ({ ok: false, status: 429, text: () => Promise.resolve('') }))

    const { movies, failed } = await collectMovieMeta({ ids: ['1', '9'], previous, refetchAll: false, fetchPage, wait: noWait, logger: quiet })

    expect(fetchPage).toHaveBeenCalledTimes(1)
    expect(fetchPage).toHaveBeenCalledWith('https://filmarks.com/movies/9')
    expect(failed).toBe(1)
    expect(movies).toEqual(previous)
  })
})

describe('isMainModule', () => {
  it('node に渡したパスがこのスクリプトなら true（OS のパス表記のまま渡される）', () => {
    expect(isMainModule(SCRIPT_URL.href, SCRIPT_PATH)).toBe(true)
  })

  it('別のファイルから import されただけなら false', () => {
    expect(isMainModule(SCRIPT_URL.href, fileURLToPath(import.meta.url))).toBe(false)
    expect(isMainModule(SCRIPT_URL.href, undefined)).toBe(false)
  })
})

describe('node scripts/update-movie-meta.js で直接実行したとき', () => {
  // 空白・日本語を含むフォルダへスクリプトを写し、取得対象 0 件のウォッチリストで実行する（通信は起きない）
  const root = mkdtempSync(join(tmpdir(), 'meta スクリプト '))
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  it('main() が動き、件数を表示して movie-meta.json を書く', () => {
    mkdirSync(join(root, 'scripts'))
    mkdirSync(join(root, 'public'))
    const script = join(root, 'scripts', 'update-movie-meta.js')
    copyFileSync(SCRIPT_PATH, script)
    writeFileSync(join(root, 'public', 'watchlist.json'), JSON.stringify({ tabs: [] }))

    const output = execFileSync(process.execPath, [script], { encoding: 'utf8' })

    expect(output).toContain('作品 0 件のうち 0 件を取得します')
    expect(JSON.parse(readFileSync(join(root, 'public', 'movie-meta.json'), 'utf8'))).toEqual({ movies: {} })
  })
})
