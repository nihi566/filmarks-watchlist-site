import { describe, expect, it } from 'vitest'
import {
  applyChange,
  decodeBase64Utf8,
  emptyRecordsFile,
  encodeBase64Utf8,
  excludeWatched,
  parseRecordsFile,
  todayLocal,
} from './records.js'

const NOW = '2026-09-26T08:00:00.000Z'

describe('parseRecordsFile', () => {
  it('正しい形の記録をそのまま読める', () => {
    const file = parseRecordsFile({
      version: 1,
      records: {
        83583: { title: 'TENET テネット', image: 'https://example.com/a.jpg', watched_on: '2026-09-01', minutes: 150, updated_at: NOW },
      },
    })
    expect(file.records['83583']).toEqual({
      title: 'TENET テネット',
      image: 'https://example.com/a.jpg',
      watched_on: '2026-09-01',
      minutes: 150,
      updated_at: NOW,
    })
  })

  it('形が不正な項目は捨て、正しい項目だけ残す', () => {
    const file = parseRecordsFile({
      version: 1,
      records: {
        1: { title: 'ok', watched_on: '2026-09-01', minutes: null },
        2: { title: 'bad date', watched_on: '2026-13-40' },
        3: 'not an object',
        4: { title: 'no date' },
      },
    })
    expect(Object.keys(file.records)).toEqual(['1'])
  })

  it('title を文字列に、http の画像や負の分数を安全な値に正規化する', () => {
    const file = parseRecordsFile({
      version: 1,
      records: { 1: { title: 123, image: 'http://insecure/a.jpg', watched_on: '2026-02-28', minutes: -5 } },
    })
    expect(file.records['1']).toMatchObject({ title: '123', image: '', minutes: null })
  })

  it('全体の形が不正なら例外を投げる（読めないまま上書き保存しないため）', () => {
    expect(() => parseRecordsFile(null)).toThrow()
    expect(() => parseRecordsFile({ version: 1, records: [] })).toThrow()
    expect(() => parseRecordsFile('text')).toThrow()
  })
})

describe('applyChange', () => {
  it('watch で記録を追加し、元のオブジェクトは変えない', () => {
    const before = emptyRecordsFile()
    const after = applyChange(
      before,
      { type: 'watch', movie_id: '83583', title: 'TENET', image: '', watched_on: '2026-09-26', minutes: 150 },
      NOW,
    )
    expect(after.records['83583']).toEqual({
      title: 'TENET',
      image: '',
      watched_on: '2026-09-26',
      minutes: 150,
      updated_at: NOW,
    })
    expect(before.records).toEqual({})
  })

  it('watch は同じ作品の記録を上書きする', () => {
    const first = applyChange(
      emptyRecordsFile(),
      { type: 'watch', movie_id: '1', title: 'A', watched_on: '2026-09-01', minutes: 100 },
      NOW,
    )
    const second = applyChange(first, { type: 'watch', movie_id: '1', title: 'A', watched_on: '2026-09-02', minutes: null }, NOW)
    expect(second.records['1']).toMatchObject({ watched_on: '2026-09-02', minutes: null })
  })

  it('unwatch で記録を消す（ほかの記録や未知の項目は残す）', () => {
    const file = { version: 1, extra: 'keep', records: { 1: { title: 'A' }, 2: { title: 'B', note: 'x' } } }
    const after = applyChange(file, { type: 'unwatch', movie_id: '1' }, NOW)
    expect(after).toEqual({ version: 1, extra: 'keep', records: { 2: { title: 'B', note: 'x' } } })
  })

  it('不正な視聴日・視聴時間・作品IDは受け付けない', () => {
    const base = { type: 'watch', movie_id: '1', title: 'A', watched_on: '2026-09-01', minutes: 10 }
    expect(() => applyChange(emptyRecordsFile(), { ...base, watched_on: '2026/09/01' }, NOW)).toThrow()
    expect(() => applyChange(emptyRecordsFile(), { ...base, minutes: 1.5 }, NOW)).toThrow()
    expect(() => applyChange(emptyRecordsFile(), { ...base, movie_id: '' }, NOW)).toThrow()
    expect(() => applyChange(emptyRecordsFile(), { type: 'other', movie_id: '1' }, NOW)).toThrow()
  })
})

describe('base64（UTF-8）', () => {
  it('日本語を含む文字列を往復できる', () => {
    const text = JSON.stringify({ title: '20世紀少年 ＜第1章＞ 終わりの始まり 🎬' })
    expect(decodeBase64Utf8(encodeBase64Utf8(text))).toBe(text)
  })

  it('GitHub API の改行入り base64 を読める', () => {
    const encoded = encodeBase64Utf8('あいうえお'.repeat(20))
    const wrapped = encoded.replace(/(.{60})/g, '$1\n')
    expect(decodeBase64Utf8(wrapped)).toBe('あいうえお'.repeat(20))
  })
})

describe('todayLocal', () => {
  it('端末のローカル日付を YYYY-MM-DD（ゼロ埋め）で返す', () => {
    expect(todayLocal(new Date(2026, 0, 5, 0, 30))).toBe('2026-01-05')
    expect(todayLocal(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31')
  })
})

describe('excludeWatched', () => {
  const tabs = [
    { name: 'U-NEXT', movies: [{ movie_id: '1', title: 'A' }, { movie_id: '2', title: 'B' }] },
    { name: 'Netflix', movies: [{ movie_id: '2', title: 'B' }] },
  ]

  it('見たの作品をすべてのグループから外し、空になったグループは消す', () => {
    const result = excludeWatched(tabs, { 2: { title: 'B', watched_on: '2026-09-26' } })
    expect(result).toEqual([{ name: 'U-NEXT', movies: [{ movie_id: '1', title: 'A' }] }])
  })

  it('記録が無ければそのまま返し、元の配列は変えない', () => {
    expect(excludeWatched(tabs, {})).toEqual(tabs)
    expect(excludeWatched(tabs, null)).toEqual(tabs)
    excludeWatched(tabs, { 1: {} })
    expect(tabs[0].movies).toHaveLength(2)
  })
})
