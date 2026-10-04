import { describe, expect, it } from 'vitest'
import { RUNTIME_LIMITS, filterTabsByRuntime, matchesRuntime, runtimeLabel } from './runtimeFilter.js'

const movie = (movie_id, runtime_min) => ({ movie_id, title: String(movie_id), runtime_min })

describe('matchesRuntime', () => {
  it('上限なし（null）ならすべて残す（上映時間が分からない作品も）', () => {
    expect(matchesRuntime(movie(1, 200), null)).toBe(true)
    expect(matchesRuntime(movie(2, undefined), null)).toBe(true)
  })

  it('上限ちょうどまでは残し、超えたら外す', () => {
    expect(matchesRuntime(movie(1, 120), 120)).toBe(true)
    expect(matchesRuntime(movie(2, 121), 120)).toBe(false)
  })

  it('上限を指定したら、上映時間が分からない・数値でない作品は外す', () => {
    expect(matchesRuntime(movie(1, undefined), 120)).toBe(false)
    expect(matchesRuntime(movie(2, null), 120)).toBe(false)
    expect(matchesRuntime(movie(3, 0), 120)).toBe(false)
    expect(matchesRuntime(movie(4, '90'), 120)).toBe(false)
  })
})

describe('filterTabsByRuntime', () => {
  const tabs = [
    { name: 'Hulu', movies: [movie(1, 81), movie(2, 169)] },
    { name: 'U-NEXT', movies: [movie(2, 169)] },
  ]

  it('上限なしならそのまま返す', () => {
    expect(filterTabsByRuntime(tabs, null)).toBe(tabs)
  })

  it('上限に収まる作品だけ残し、作品が無くなったサービスは外す', () => {
    expect(filterTabsByRuntime(tabs, 90)).toEqual([{ name: 'Hulu', movies: [movie(1, 81)] }])
  })
})

describe('RUNTIME_LIMITS / runtimeLabel', () => {
  it('90 / 120 / 150 分以内を選べる', () => {
    expect(RUNTIME_LIMITS).toEqual([90, 120, 150])
    expect(runtimeLabel(120)).toBe('120分以内')
  })
})
