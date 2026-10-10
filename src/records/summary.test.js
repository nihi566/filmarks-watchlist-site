import { describe, expect, it } from 'vitest'
import { filterRecordsByKind } from './kinds.js'
import {
  addMonths,
  formatMinutes,
  lastRecordedMonth,
  recordYears,
  searchRecords,
  summarizeMonth,
  summarizeYear,
  weekdayLabel,
  yearComparisonText,
} from './summary.js'

const records = {
  1: { title: 'B作品', image: '', watched_on: '2026-09-26', minutes: 150, updated_at: '' },
  2: { title: 'A作品', image: '', watched_on: '2026-09-26', minutes: null, updated_at: '' },
  3: { title: 'C作品', image: '', watched_on: '2026-09-01', minutes: 90, updated_at: '' },
  4: { title: 'D作品', image: '', watched_on: '2026-08-31', minutes: 100, updated_at: '' },
  5: { title: 'E作品', image: '', watched_on: '2025-12-31', minutes: 60, updated_at: '' },
}

describe('summarizeMonth', () => {
  it('その月の本数・視聴時間の合計・時間不明の本数を返す', () => {
    const month = summarizeMonth(records, 2026, 9)
    expect(month.count).toBe(3)
    expect(month.minutes).toBe(240)
    expect(month.unknownCount).toBe(1)
  })

  it('日ごとに新しい日付順でまとめ、同じ日の中は作品名順に並べる', () => {
    const month = summarizeMonth(records, 2026, 9)
    expect(month.days.map((day) => day.date)).toEqual(['2026-09-26', '2026-09-01'])
    expect(month.days[0].items.map((item) => item.title)).toEqual(['A作品', 'B作品'])
    expect(month.days[0].items[0]).toMatchObject({ movie_id: '2', minutes: null })
  })

  it('月の境界をまたがない（8/31 は 9 月に入らない）', () => {
    expect(summarizeMonth(records, 2026, 8)).toMatchObject({ count: 1, minutes: 100 })
  })

  it('記録が無い月・記録自体が無いときは 0 件', () => {
    expect(summarizeMonth(records, 2026, 7)).toEqual({ count: 0, minutes: 0, unknownCount: 0, episodes: 0, kinds: [], days: [] })
    expect(summarizeMonth(null, 2026, 9).count).toBe(0)
  })
})

describe('種類ごとの内訳', () => {
  const mixed = {
    1: { title: 'フリーレン', watched_on: '2026-09-20', minutes: 288, rating: 5, kind: 'anime', episodes: 12 },
    2: { title: '劇場アニメ', watched_on: '2026-09-10', minutes: 107, rating: 4, kind: 'anime', episodes: 1 },
    3: { title: '邦画', watched_on: '2026-09-05', minutes: 120, rating: 3, kind: 'japanese', episodes: null },
    4: { title: '古い記録', watched_on: '2026-09-01', minutes: 90 },
    5: { title: '洋画', watched_on: '2026-08-01', minutes: 150, rating: 2, kind: 'foreign' },
  }

  it('月の種類ごとの本数とアニメの話数を、アニメ・邦画・洋画・未分類の順で返す', () => {
    const month = summarizeMonth(mixed, 2026, 9)
    expect(month.episodes).toBe(13)
    expect(month.kinds).toEqual([
      { kind: 'anime', count: 2, episodes: 13 },
      { kind: 'japanese', count: 1, episodes: 0 },
      { kind: 'none', count: 1, episodes: 0 },
    ])
  })

  it('日ごとの作品に★評価・種類・話数を含める', () => {
    const month = summarizeMonth(mixed, 2026, 9)
    const day = month.days.find((item) => item.date === '2026-09-20')
    expect(day.items[0]).toEqual({ movie_id: '1', title: 'フリーレン', image: undefined, minutes: 288, rating: 5, kind: 'anime', episodes: 12 })
    const old = month.days.find((item) => item.date === '2026-09-01')
    expect(old.items[0]).toMatchObject({ rating: null, kind: null, episodes: null })
  })

  it('年の内訳も返す', () => {
    expect(summarizeYear(mixed, 2026).kinds.map((item) => [item.kind, item.count])).toEqual([
      ['anime', 2],
      ['japanese', 1],
      ['foreign', 1],
      ['none', 1],
    ])
  })
})

describe('summarizeYear', () => {
  it('年の合計と 1〜12 月の内訳を返す', () => {
    const year = summarizeYear(records, 2026)
    expect(year).toMatchObject({ count: 4, minutes: 340, unknownCount: 1 })
    expect(year.months).toHaveLength(12)
    expect(year.months[8]).toEqual({ month: 9, count: 3, minutes: 240 })
    expect(year.months[7]).toEqual({ month: 8, count: 1, minutes: 100 })
    expect(year.months[0]).toEqual({ month: 1, count: 0, minutes: 0 })
  })

  it('別の年の記録は含めない', () => {
    expect(summarizeYear(records, 2025)).toMatchObject({ count: 1, minutes: 60 })
  })
})

describe('summarizeYear の★評価', () => {
  const rated = {
    1: { title: 'A', watched_on: '2026-02-01', minutes: 100, rating: 5, kind: 'anime' },
    2: { title: 'B', watched_on: '2026-05-01', minutes: 100, rating: 4, kind: 'japanese' },
    3: { title: 'C', watched_on: '2026-06-01', minutes: 100, rating: 5, kind: 'foreign' },
    4: { title: 'D', watched_on: '2026-07-01', minutes: 100, rating: 3, kind: 'anime' },
    5: { title: 'E', watched_on: '2026-08-01', minutes: 100, rating: null, kind: 'anime' },
    6: { title: 'F', watched_on: '2026-09-01', minutes: 100, rating: 4, kind: 'anime' },
    7: { title: 'G', watched_on: '2026-09-02', minutes: 100, rating: 4, kind: 'anime' },
    8: { title: 'H', watched_on: '2026-09-03', minutes: 100, rating: 4, kind: 'anime' },
    9: { title: '去年', watched_on: '2025-09-03', minutes: 100, rating: 5, kind: 'anime' },
  }

  it('★ごとの本数（★5→★1）と未評価の本数を返す', () => {
    const year = summarizeYear(rated, 2026)
    expect(year.ratings).toEqual([
      { rating: 5, count: 2 },
      { rating: 4, count: 4 },
      { rating: 3, count: 1 },
      { rating: 2, count: 0 },
      { rating: 1, count: 0 },
    ])
    expect(year.unratedCount).toBe(1)
  })

  it('★4 以上の作品を★の高い順・同じ★は新しい視聴日順で最大 5 件返す', () => {
    const year = summarizeYear(rated, 2026)
    expect(year.topRated.map((item) => item.title)).toEqual(['C', 'A', 'H', 'G', 'F'])
    expect(year.topRated[0]).toMatchObject({ movie_id: '3', rating: 5, watched_on: '2026-06-01', kind: 'foreign' })
  })

  it('種類で絞り込んだ記録を渡すと★の集計も絞り込まれる', () => {
    const year = summarizeYear(filterRecordsByKind(rated, 'anime'), 2026)
    expect(year.ratings.map((item) => item.count)).toEqual([1, 3, 1, 0, 0])
    expect(year.topRated.map((item) => item.title)).toEqual(['A', 'H', 'G', 'F'])
  })

  it('記録が無ければ 0 本・上位作品なし', () => {
    const year = summarizeYear({}, 2026)
    expect(year.ratings.every((item) => item.count === 0)).toBe(true)
    expect(year.topRated).toEqual([])
    expect(year.unratedCount).toBe(0)
  })
})

describe('formatMinutes', () => {
  it('分を「◯時間◯分」で表す', () => {
    expect(formatMinutes(0)).toBe('0分')
    expect(formatMinutes(45)).toBe('45分')
    expect(formatMinutes(120)).toBe('2時間')
    expect(formatMinutes(725)).toBe('12時間5分')
  })
})

describe('addMonths', () => {
  it('年をまたいで前後の月を返す', () => {
    expect(addMonths(2026, 1, -1)).toEqual({ year: 2025, month: 12 })
    expect(addMonths(2025, 12, 1)).toEqual({ year: 2026, month: 1 })
    expect(addMonths(2026, 9, -1)).toEqual({ year: 2026, month: 8 })
  })
})

describe('weekdayLabel', () => {
  it('日付文字列から曜日を返す（UTC で解釈してずれない）', () => {
    expect(weekdayLabel('2026-09-26')).toBe('土')
    expect(weekdayLabel('2026-01-01')).toBe('木')
  })
})

describe('searchRecords', () => {
  const library = {
    10: { title: '君の名は。', image: '', watched_on: '2024-03-02', minutes: 107, rating: 5, kind: 'anime', episodes: 1 },
    11: { title: '君の名は。（2回目）', image: '', watched_on: '2026-01-15', minutes: 107, rating: null, kind: 'anime' },
    12: { title: 'ｲﾝﾀｰｽﾃﾗｰ', image: '', watched_on: '2025-07-01', minutes: 169, rating: 4, kind: 'western' },
    13: { title: 'Ａｍｅｌｉｅ', image: '', watched_on: '2023-11-11', minutes: 122, kind: 'western' },
  }

  it('全期間からタイトルに一致する記録を、新しい視聴日順で返す（視聴日・★評価付き）', () => {
    const result = searchRecords(library, 'の名ハ')
    expect(result.map((item) => item.movie_id)).toEqual(['11', '10'])
    expect(result[1]).toMatchObject({ title: '君の名は。', watched_on: '2024-03-02', rating: 5, kind: 'anime', episodes: 1 })
    expect(result[0]).toMatchObject({ rating: null, episodes: null })
  })

  it('ひらがな/カタカナ・全角/半角・大文字/小文字を区別しない', () => {
    expect(searchRecords(library, 'いんたー').map((item) => item.movie_id)).toEqual(['12'])
    expect(searchRecords(library, 'amelie').map((item) => item.movie_id)).toEqual(['13'])
  })

  it('検索語が空白だけ・記録が無いときは空', () => {
    expect(searchRecords(library, '  ')).toEqual([])
    expect(searchRecords(null, 'きみ')).toEqual([])
  })
})

describe('recordYears', () => {
  it('記録のある年だけを、新しい年から重複なく返す', () => {
    expect(recordYears(records)).toEqual([2026, 2025])
  })

  it('記録が無いときは空', () => {
    expect(recordYears(null)).toEqual([])
    expect(recordYears({})).toEqual([])
  })
})

describe('lastRecordedMonth', () => {
  it('その年で記録のある最後の月を返す', () => {
    expect(lastRecordedMonth(records, 2026)).toBe(9)
    expect(lastRecordedMonth(records, 2025)).toBe(12)
  })

  it('その年に記録が無いときは null', () => {
    expect(lastRecordedMonth(records, 2024)).toBeNull()
    expect(lastRecordedMonth(null, 2026)).toBeNull()
  })
})

describe('yearComparisonText', () => {
  it('前年より本数・時間が多いときは差を出す', () => {
    expect(yearComparisonText({ count: 15, minutes: 1500 }, { count: 12, minutes: 1290 })).toBe(
      '前年より 3 本多く、視聴時間は 3時間30分 長くなりました',
    )
  })

  it('前年より少ないときは少なめと出す', () => {
    expect(yearComparisonText({ count: 10, minutes: 600 }, { count: 12, minutes: 720 })).toBe(
      '前年より 2 本少なく、視聴時間は 2時間 短くなりました',
    )
  })

  it('本数だけ同じ・時間だけ同じ・両方同じを言い分ける', () => {
    expect(yearComparisonText({ count: 12, minutes: 700 }, { count: 12, minutes: 720 })).toBe('前年と同じ本数で、視聴時間は 20分 短くなりました')
    expect(yearComparisonText({ count: 13, minutes: 720 }, { count: 12, minutes: 720 })).toBe('前年より 1 本多く、視聴時間は前年と同じでした')
    expect(yearComparisonText({ count: 12, minutes: 720 }, { count: 12, minutes: 720 })).toBe('前年と同じ本数・視聴時間でした')
  })

  it('前年に記録が無ければ出さない', () => {
    expect(yearComparisonText({ count: 5, minutes: 300 }, { count: 0, minutes: 0 })).toBe('')
  })

  it('種類で絞り込んだ記録どうしで比べられる', () => {
    const records = {
      1: { title: 'A', watched_on: '2026-03-01', minutes: 100, kind: 'anime' },
      2: { title: 'B', watched_on: '2026-04-01', minutes: 120, kind: 'japanese' },
      3: { title: 'C', watched_on: '2025-05-01', minutes: 60, kind: 'japanese' },
      4: { title: 'D', watched_on: '2025-06-01', minutes: 90, kind: 'japanese' },
    }
    const anime = filterRecordsByKind(records, 'anime')
    expect(yearComparisonText(summarizeYear(anime, 2026), summarizeYear(anime, 2025))).toBe('')
    const japanese = filterRecordsByKind(records, 'japanese')
    expect(yearComparisonText(summarizeYear(japanese, 2026), summarizeYear(japanese, 2025))).toBe(
      '前年より 1 本少なく、視聴時間は 30分 短くなりました',
    )
  })
})
