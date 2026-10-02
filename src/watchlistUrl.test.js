import { describe, expect, it } from 'vitest'
import { DEFAULT_VIEW, readViewFromSearch, viewToSearch, withSearch } from './watchlistUrl.js'

describe('readViewFromSearch', () => {
  it('何も無ければ既定（すべて・タイトル順など）', () => {
    expect(readViewFromSearch('')).toEqual(DEFAULT_VIEW)
  })

  it('URL のクエリから絞り込み・検索・並び順を読む', () => {
    const search = `?service=${encodeURIComponent('U-NEXT')}&kind=anime&q=${encodeURIComponent('いんたー')}&sort=name&order=clip`
    expect(readViewFromSearch(search)).toEqual({ service: 'U-NEXT', kind: 'anime', query: 'いんたー', sort: 'name', order: 'clip' })
  })

  it('知らない値は既定に戻す（手で書き換えた URL・古い URL でも壊れない）', () => {
    expect(readViewFromSearch('?kind=drama&sort=x&order=y&service=')).toEqual(DEFAULT_VIEW)
  })

  it('種類不明（none）は選べる', () => {
    expect(readViewFromSearch('?kind=none').kind).toBe('none')
  })
})

describe('viewToSearch', () => {
  it('既定の値は書かない', () => {
    expect(viewToSearch(DEFAULT_VIEW)).toBe('')
  })

  it('読み取りと往復できる', () => {
    const view = { service: 'ディズニープラス', kind: 'movie', query: 'a&b=c', sort: 'name', order: 'clip' }
    expect(readViewFromSearch(viewToSearch(view))).toEqual(view)
  })

  it('検索語の前後の空白だけなら書かない', () => {
    expect(viewToSearch({ ...DEFAULT_VIEW, query: '  ' })).toBe('')
  })
})

describe('withSearch', () => {
  it('パスと hash（ページ）を保ったままクエリだけ差し替える', () => {
    const location = { pathname: '/filmarks-watchlist-site/', hash: '#/' }
    expect(withSearch(location, '?kind=anime')).toBe('/filmarks-watchlist-site/?kind=anime#/')
    expect(withSearch(location, '')).toBe('/filmarks-watchlist-site/#/')
  })
})
