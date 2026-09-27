import { describe, expect, it } from 'vitest'
import { filterRecordsByKind, isKind, kindLabel, matchesKindFilter } from './kinds.js'

describe('matchesKindFilter', () => {
  it('「映画」は邦画と洋画、「すべて」は種類の無い記録も含む', () => {
    expect(matchesKindFilter('japanese', 'movie')).toBe(true)
    expect(matchesKindFilter('foreign', 'movie')).toBe(true)
    expect(matchesKindFilter('anime', 'movie')).toBe(false)
    expect(matchesKindFilter(null, 'all')).toBe(true)
    expect(matchesKindFilter('anime', 'anime')).toBe(true)
    expect(matchesKindFilter('japanese', 'foreign')).toBe(false)
  })

  it('「未分類」は種類の無い記録だけ', () => {
    expect(matchesKindFilter(null, 'none')).toBe(true)
    expect(matchesKindFilter('anime', 'none')).toBe(false)
  })
})

describe('filterRecordsByKind', () => {
  const records = {
    1: { title: 'A', kind: 'anime' },
    2: { title: 'B', kind: 'japanese' },
    3: { title: 'C', kind: 'foreign' },
    4: { title: 'D', kind: null },
  }

  it('種類で絞り込み、「すべて」はそのまま返す', () => {
    expect(Object.keys(filterRecordsByKind(records, 'anime'))).toEqual(['1'])
    expect(Object.keys(filterRecordsByKind(records, 'movie'))).toEqual(['2', '3'])
    expect(Object.keys(filterRecordsByKind(records, 'none'))).toEqual(['4'])
    expect(filterRecordsByKind(records, 'all')).toBe(records)
    expect(filterRecordsByKind(null, 'anime')).toBeNull()
  })
})

describe('kindLabel / isKind', () => {
  it('保存する値だけを種類とみなし、それ以外は未分類と表示する', () => {
    expect(isKind('anime')).toBe(true)
    expect(isKind('movie')).toBe(false)
    expect(kindLabel('foreign')).toBe('洋画')
    expect(kindLabel(null)).toBe('未分類')
  })
})
