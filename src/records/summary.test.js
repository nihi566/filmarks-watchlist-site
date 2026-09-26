import { describe, expect, it } from 'vitest'
import { addMonths, formatMinutes, summarizeMonth, summarizeYear, weekdayLabel } from './summary.js'

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
    expect(summarizeMonth(records, 2026, 7)).toEqual({ count: 0, minutes: 0, unknownCount: 0, days: [] })
    expect(summarizeMonth(null, 2026, 9).count).toBe(0)
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
