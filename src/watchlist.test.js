import { describe, expect, it } from 'vitest'
import { attachKinds, kindFromMeta, normalizeWatchlist, uniqueMovies } from './watchlist.js'

describe('uniqueMovies', () => {
  it('サービスをまたいだ同じ作品を 1 件にまとめ、見られるサービスを集める（未配信は含めない）', () => {
    const tabs = [
      { name: 'U-NEXT', movies: [{ movie_id: '1', title: 'A' }, { movie_id: '2', title: 'B' }] },
      { name: 'Netflix', movies: [{ movie_id: '1', title: 'A' }] },
      { name: '未配信', movies: [{ movie_id: '3', title: 'C' }] },
    ]
    expect(uniqueMovies(tabs)).toEqual([
      { movie_id: '1', title: 'A', services: ['U-NEXT', 'Netflix'] },
      { movie_id: '2', title: 'B', services: ['U-NEXT'] },
      { movie_id: '3', title: 'C', services: [] },
    ])
  })
})

describe('normalizeWatchlist', () => {
  it('title を文字列に、http の画像を空にする', () => {
    const result = normalizeWatchlist({ tabs: [{ name: 'X', movies: [{ movie_id: '1', title: 1, image: 'http://a' }] }] })
    expect(result.tabs[0].movies[0]).toMatchObject({ title: '1', image: '' })
  })

  it('観るページの URL は https のものだけ残す', () => {
    const movies = ['https://www.hulu.jp/a', 'javascript:alert(1)', 'http://a', 123, undefined].map((watch_url, i) => ({
      movie_id: String(i),
      title: 'A',
      watch_url,
    }))
    const result = normalizeWatchlist({ tabs: [{ name: 'Hulu', movies }] })
    expect(result.tabs[0].movies.map((movie) => movie.watch_url)).toEqual(['https://www.hulu.jp/a', '', '', '', ''])
  })

  // 白画面対策（backlog 20260924-f-77e362）: サービス名が文字列以外で届いても描画できる形にする
  it('サービス名を文字列にし、無ければ空文字にする', () => {
    const result = normalizeWatchlist({ tabs: [{ name: 123, movies: [] }, { name: { a: 1 }, movies: [] }, { movies: [] }] })
    expect(result.tabs.map((tab) => tab.name)).toEqual(['123', '[object Object]', ''])
  })

  it('tabs が無ければ parse エラー', () => {
    expect(() => normalizeWatchlist({})).toThrow(expect.objectContaining({ kind: 'parse' }))
  })
})

describe('kindFromMeta', () => {
  it('ジャンルにアニメがあればアニメ、無ければ最初の製作国で邦画・洋画を決める', () => {
    expect(kindFromMeta({ countries: ['日本'], genres: ['アニメ', 'SF'] })).toBe('anime')
    expect(kindFromMeta({ countries: ['アメリカ'], genres: ['アニメ'] })).toBe('anime')
    expect(kindFromMeta({ countries: ['日本'], genres: ['ドラマ'] })).toBe('japanese')
    expect(kindFromMeta({ countries: ['アメリカ', '日本'], genres: ['アクション'] })).toBe('foreign')
    expect(kindFromMeta({ countries: ['韓国'], genres: [] })).toBe('foreign')
  })

  it('情報が無い・形が違うときは種類不明（null）', () => {
    expect(kindFromMeta(undefined)).toBeNull()
    expect(kindFromMeta({ countries: [], genres: ['ドラマ'] })).toBeNull()
    expect(kindFromMeta({ countries: '日本', genres: 'アニメ' })).toBeNull()
  })
})

describe('attachKinds', () => {
  const watchlist = { tabs: [{ name: 'U-NEXT', movies: [{ movie_id: '1', title: 'A' }, { movie_id: '2', title: 'B' }] }] }

  it('movie-meta.json の情報から各作品に種類を付ける', () => {
    const result = attachKinds(watchlist, { movies: { 1: { countries: ['日本'], genres: ['アニメ'] } } })
    expect(result.tabs[0].movies.map((movie) => movie.kind)).toEqual(['anime', null])
    expect(result.tabs[0].movies.map((movie) => movie.countries)).toEqual([['日本'], []])
  })

  it('movie-meta.json が無くても全作品を種類不明にして返す', () => {
    expect(attachKinds(watchlist, null).tabs[0].movies.map((movie) => movie.kind)).toEqual([null, null])
  })
})
