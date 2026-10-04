import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { isMainModule, parseMovieMeta } from './update-movie-meta.js'

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
