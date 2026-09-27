import { describe, expect, it } from 'vitest'
import { parseMovieMeta } from './update-movie-meta.js'

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
