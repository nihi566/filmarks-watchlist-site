import { describe, expect, it } from 'vitest'
import { normalizeWatchlist, uniqueMovies } from './watchlist.js'

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

  it('tabs が無ければ parse エラー', () => {
    expect(() => normalizeWatchlist({})).toThrow(expect.objectContaining({ kind: 'parse' }))
  })
})
