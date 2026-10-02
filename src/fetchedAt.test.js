import { describe, expect, it } from 'vitest'
import { describeFetchedAt } from './fetchedAt.js'

// watchlist.json の generated_at は scraper が動いた日時（タイムゾーン無しのローカル時刻）
const now = new Date(2026, 8, 27, 1, 0, 0)

describe('describeFetchedAt', () => {
  it('取得日時を分まで表示し、経過時間を添える', () => {
    expect(describeFetchedAt('2026-09-26 21:48:14', now)).toEqual({
      date: '2026/09/26 21:48',
      ago: '3時間前',
      stale: false,
    })
  })

  it('経過時間は 1 分未満・分・時間・日で表す', () => {
    expect(describeFetchedAt('2026-09-27 00:59:30', now).ago).toBe('たった今')
    expect(describeFetchedAt('2026-09-27 00:15:00', now).ago).toBe('45分前')
    expect(describeFetchedAt('2026-09-26 01:00:00', now).ago).toBe('1日前')
    expect(describeFetchedAt('2026-09-17 12:00:00', now).ago).toBe('9日前')
  })

  it('端末の時計が遅れていて未来の日時になっても「たった今」にする', () => {
    expect(describeFetchedAt('2026-09-27 01:05:00', now).ago).toBe('たった今')
  })

  it('取得から 3 日以上たっていたら古い（stale）とする', () => {
    expect(describeFetchedAt('2026-09-26 21:48:14', now).stale).toBe(false)
    expect(describeFetchedAt('2026-09-24 01:00:01', now).stale).toBe(false)
    expect(describeFetchedAt('2026-09-24 01:00:00', now).stale).toBe(true)
    expect(describeFetchedAt('2026-09-17 12:00:00', now).stale).toBe(true)
  })

  it('未来の日時は古いとしない', () => {
    expect(describeFetchedAt('2026-09-27 01:05:00', now).stale).toBe(false)
  })

  it('日時として読めない値は null を返す', () => {
    expect(describeFetchedAt(undefined, now)).toBeNull()
    expect(describeFetchedAt('', now)).toBeNull()
    expect(describeFetchedAt('昨日', now)).toBeNull()
    expect(describeFetchedAt('2026-13-40 99:99:99', now)).toBeNull()
  })
})
