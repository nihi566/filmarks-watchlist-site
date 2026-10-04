import { describe, expect, it } from 'vitest'
import {
  animeMinutes,
  applyChange,
  decodeBase64Utf8,
  emptyRecordsFile,
  encodeBase64Utf8,
  excludeWatched,
  initialEpisodeFields,
  isManualId,
  newManualId,
  parseRecordsFile,
  todayLocal,
  watchChangeFromEntry,
} from './records.js'

// 評価・種類・話数を付ける前の記録を読んだときの値
const NO_EXTRA = { rating: null, kind: null, episodes: null, episode_minutes: null }

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
      ...NO_EXTRA,
    })
  })

  it('★評価・種類・アニメの話数を読める', () => {
    const file = parseRecordsFile({
      version: 1,
      records: {
        1: { title: 'A', watched_on: '2026-09-01', minutes: 288, rating: 5, kind: 'anime', episodes: 12, episode_minutes: 24 },
        2: { title: 'B', watched_on: '2026-09-01', minutes: 120, rating: 3, kind: 'foreign' },
      },
    })
    expect(file.records['1']).toMatchObject({ rating: 5, kind: 'anime', episodes: 12, episode_minutes: 24 })
    expect(file.records['2']).toMatchObject({ rating: 3, kind: 'foreign', episodes: null, episode_minutes: null })
  })

  it('範囲外の評価・未知の種類・アニメ以外の話数は null に倒す', () => {
    const file = parseRecordsFile({
      version: 1,
      records: {
        1: { title: 'A', watched_on: '2026-09-01', minutes: null, rating: 6, kind: 'drama', episodes: 12 },
        2: { title: 'B', watched_on: '2026-09-01', minutes: null, rating: 3.5, kind: 'japanese', episodes: 3, episode_minutes: 20 },
        3: { title: 'C', watched_on: '2026-09-01', minutes: null, rating: '4', kind: 'anime', episodes: 0, episode_minutes: -1 },
        4: { title: 'D', watched_on: '2026-09-01', minutes: null, rating: 0 },
      },
    })
    expect(file.records['1']).toMatchObject(NO_EXTRA)
    expect(file.records['2']).toMatchObject({ rating: null, kind: 'japanese', episodes: null, episode_minutes: null })
    expect(file.records['3']).toMatchObject({ rating: null, kind: 'anime', episodes: null, episode_minutes: null })
    expect(file.records['4']).toMatchObject({ rating: null })
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
      ...NO_EXTRA,
    })
    expect(before.records).toEqual({})
  })

  it('watch で★評価・種類・アニメの話数を保存する', () => {
    const after = applyChange(
      emptyRecordsFile(),
      {
        type: 'watch',
        movie_id: 'manual-abc',
        title: '葬送のフリーレン',
        watched_on: '2026-09-26',
        minutes: 288,
        rating: 5,
        kind: 'anime',
        episodes: 12,
        episode_minutes: 24,
      },
      NOW,
    )
    expect(after.records['manual-abc']).toMatchObject({ minutes: 288, rating: 5, kind: 'anime', episodes: 12, episode_minutes: 24 })
  })

  it('アニメ以外の記録には話数を保存しない', () => {
    const after = applyChange(
      emptyRecordsFile(),
      { type: 'watch', movie_id: '1', title: 'A', watched_on: '2026-09-26', minutes: 100, kind: 'japanese', episodes: 3, episode_minutes: 30 },
      NOW,
    )
    expect(after.records['1']).toMatchObject({ kind: 'japanese', episodes: null, episode_minutes: null })
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

  it('不正な評価・種類・話数は受け付けない', () => {
    const base = { type: 'watch', movie_id: '1', title: 'A', watched_on: '2026-09-01', minutes: 10 }
    expect(() => applyChange(emptyRecordsFile(), { ...base, rating: 0 }, NOW)).toThrow()
    expect(() => applyChange(emptyRecordsFile(), { ...base, rating: 6 }, NOW)).toThrow()
    expect(() => applyChange(emptyRecordsFile(), { ...base, rating: 4.5 }, NOW)).toThrow()
    expect(() => applyChange(emptyRecordsFile(), { ...base, kind: 'drama' }, NOW)).toThrow()
    expect(() => applyChange(emptyRecordsFile(), { ...base, kind: 'anime', episodes: 0 }, NOW)).toThrow()
    expect(() => applyChange(emptyRecordsFile(), { ...base, kind: 'anime', episode_minutes: -1 }, NOW)).toThrow()
  })
})

describe('watchChangeFromEntry', () => {
  it('記録を書き戻す変更を作り、当て直すと同じ記録に戻る', () => {
    const entry = { title: 'A', image: '', watched_on: '2026-09-01', minutes: 288, updated_at: NOW, rating: 4, kind: 'anime', episodes: 12, episode_minutes: 24 }
    const restored = applyChange(emptyRecordsFile(), watchChangeFromEntry('1', entry), NOW)
    expect(restored.records['1']).toEqual(entry)
  })

  it('評価・種類の無い古い記録も書き戻せる', () => {
    const change = watchChangeFromEntry('1', { title: 'A', image: '', watched_on: '2026-09-01', minutes: 90 })
    expect(change).toMatchObject({ type: 'watch', movie_id: '1', ...NO_EXTRA })
  })
})

describe('手で追加した作品の ID', () => {
  it('manual- で始まる重ならない ID を作り、見分けられる', () => {
    const id = newManualId(1_780_000_000_000, () => 0.5)
    expect(id).toMatch(/^manual-[0-9a-z]+$/)
    expect(isManualId(id)).toBe(true)
    expect(isManualId('83583')).toBe(false)
    expect(newManualId(1, () => 0.1)).not.toBe(newManualId(1, () => 0.2))
  })
})

describe('animeMinutes', () => {
  it('話数 × 1 話の分数。どちらかが不明なら null', () => {
    expect(animeMinutes(12, 24)).toBe(288)
    expect(animeMinutes(1, 107)).toBe(107)
    expect(animeMinutes(null, 24)).toBeNull()
    expect(animeMinutes(12, null)).toBeNull()
  })
})

describe('initialEpisodeFields', () => {
  it('新規の記録: 上映時間が分かれば 1 話ぶん、分からなければ 12 話・24 分', () => {
    expect(initialEpisodeFields(null, 107)).toEqual({ episodes: 1, episode_minutes: 107 })
    expect(initialEpisodeFields(undefined, null)).toEqual({ episodes: 12, episode_minutes: 24 })
  })

  it('アニメの記録の編集: 空欄（null）は既定値で埋めず空欄のまま', () => {
    const anime = { kind: 'anime', minutes: null }
    expect(initialEpisodeFields({ ...anime, episodes: null, episode_minutes: 24 }, null)).toEqual({
      episodes: null,
      episode_minutes: 24,
    })
    expect(initialEpisodeFields({ ...anime, episodes: 12, episode_minutes: null }, null)).toEqual({
      episodes: 12,
      episode_minutes: null,
    })
    expect(initialEpisodeFields({ ...anime, episodes: null, episode_minutes: null }, null)).toEqual({
      episodes: null,
      episode_minutes: null,
    })
    expect(initialEpisodeFields({ kind: 'anime', minutes: 288, episodes: 12, episode_minutes: 24 }, 288)).toEqual({
      episodes: 12,
      episode_minutes: 24,
    })
  })

  it('アニメ以外の記録の編集: アニメへ切り替えたときは記録した時間を 1 話ぶんとして使う', () => {
    const movie = { episodes: null, episode_minutes: null }
    expect(initialEpisodeFields({ ...movie, kind: 'japanese', minutes: 120 }, 120)).toEqual({
      episodes: 1,
      episode_minutes: 120,
    })
    expect(initialEpisodeFields({ ...movie, kind: 'western', minutes: null }, null)).toEqual({
      episodes: 12,
      episode_minutes: 24,
    })
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
