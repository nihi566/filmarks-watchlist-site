import { describe, expect, it } from 'vitest'
import { sortMovies } from './movieOrder.js'

// watchlist.json はタイトル順で届く。clip_order は 0 = いちばん最近クリップした作品
const movies = [
  { movie_id: '1', title: 'A作品', clip_order: 5 },
  { movie_id: '2', title: 'B作品' },
  { movie_id: '3', title: 'C作品', clip_order: 0 },
  { movie_id: '4', title: 'D作品', clip_order: 2 },
  { movie_id: '5', title: 'E作品', clip_order: '1' },
]
const ids = (list) => list.map((movie) => movie.movie_id)

describe('sortMovies', () => {
  it('タイトル順は届いた並び（タイトル順）のまま', () => {
    expect(ids(sortMovies(movies, 'title'))).toEqual(['1', '2', '3', '4', '5'])
  })

  it('最近クリップした順は clip_order の小さい順で、数値でない・無い作品は末尾にタイトル順で並ぶ', () => {
    expect(ids(sortMovies(movies, 'clip'))).toEqual(['3', '4', '1', '2', '5'])
  })

  it('clip_order が 1 件も無ければタイトル順と同じ', () => {
    const noOrder = movies.map((movie) => ({ movie_id: movie.movie_id, title: movie.title }))
    expect(ids(sortMovies(noOrder, 'clip'))).toEqual(['1', '2', '3', '4', '5'])
  })

  it('元の配列を並べ替えない', () => {
    const before = ids(movies)
    sortMovies(movies, 'clip')
    expect(ids(movies)).toEqual(before)
  })
})
