// 視聴記録（records.json の records）を月・年で集計する純関数。
// 視聴日は 'YYYY-MM-DD' の文字列のまま扱い、Date に変換しない（UTC 解釈で日付がずれるため）。
// 視聴時間が不明（null）の作品は合計時間に含めず、unknownCount として別に数える。
// 種類で絞り込むときは、呼び出し側で filterRecordsByKind を通した records を渡す。
import { KINDS, isKind } from './kinds.js'
import { matchesKeyword, normalizeForSearch } from '../searchText.js'

function entriesOf(records) {
  return Object.entries(records ?? {}).map(([movieId, entry]) => ({ movie_id: movieId, ...entry }))
}

function prefixOf(year, month) {
  return month ? `${year}-${String(month).padStart(2, '0')}-` : `${year}-`
}

function sumEpisodes(items) {
  return items.reduce((sum, item) => sum + (item.kind === 'anime' ? (item.episodes ?? 0) : 0), 0)
}

function totals(items) {
  return {
    count: items.length,
    minutes: items.reduce((sum, item) => sum + (item.minutes ?? 0), 0),
    unknownCount: items.filter((item) => item.minutes == null).length,
    episodes: sumEpisodes(items),
  }
}

// 種類ごとの本数（アニメは話数も）。0 本の種類は出さず、種類の無い記録は最後に「未分類」（none）でまとめる
function countByKind(items) {
  const groups = [...KINDS.map((kind) => kind.value), 'none'].map((value) => {
    const matched = items.filter((item) => (isKind(item.kind) ? item.kind : 'none') === value)
    return { kind: value, count: matched.length, episodes: sumEpisodes(matched) }
  })
  return groups.filter((group) => group.count > 0)
}

// 一覧の 1 行に出す項目
function listItem({ movie_id, title, image, minutes, rating, kind, episodes }) {
  return { movie_id, title, image, minutes, rating: rating ?? null, kind: kind ?? null, episodes: episodes ?? null }
}

export function summarizeMonth(records, year, month) {
  const prefix = prefixOf(year, month)
  const items = entriesOf(records).filter((item) => item.watched_on.startsWith(prefix))
  const byDate = new Map()
  for (const item of items) {
    byDate.set(item.watched_on, [...(byDate.get(item.watched_on) ?? []), item])
  }
  const days = [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([date, dayItems]) => ({
      date,
      items: dayItems.map(listItem).sort((a, b) => a.title.localeCompare(b.title, 'ja')),
    }))
  return { ...totals(items), kinds: countByKind(items), days }
}

// 全期間からタイトルで探す（ひらがな/カタカナ・全角/半角を区別しない）。新しい視聴日順、同じ日は作品名順
export function searchRecords(records, keyword) {
  const needle = normalizeForSearch(String(keyword ?? '').trim())
  if (!needle) return []
  return entriesOf(records)
    .filter((item) => matchesKeyword(item.title, needle))
    .map((item) => ({ ...listItem(item), watched_on: item.watched_on }))
    .sort((a, b) => (a.watched_on === b.watched_on ? a.title.localeCompare(b.title, 'ja') : a.watched_on < b.watched_on ? 1 : -1))
}

export function summarizeYear(records, year) {
  const items = entriesOf(records).filter((item) => item.watched_on.startsWith(prefixOf(year)))
  const months = Array.from({ length: 12 }, (_, index) => {
    const monthItems = items.filter((item) => item.watched_on.startsWith(prefixOf(year, index + 1)))
    const { count, minutes } = totals(monthItems)
    return { month: index + 1, count, minutes }
  })
  return { ...totals(items), kinds: countByKind(items), months, ...summarizeRatings(items) }
}

// 記録のある年（年の切り替えの選択肢）。新しい年から
export function recordYears(records) {
  const years = new Set(entriesOf(records).map((item) => Number(item.watched_on.slice(0, 4))))
  return [...years].sort((a, b) => b - a)
}

// その年で記録のある最後の月。無ければ null
export function lastRecordedMonth(records, year) {
  const months = entriesOf(records)
    .filter((item) => item.watched_on.startsWith(prefixOf(year)))
    .map((item) => Number(item.watched_on.slice(5, 7)))
  return months.length > 0 ? Math.max(...months) : null
}

// 年のまとめに出す「★の高い作品」の基準と件数
export const TOP_RATED_MIN = 4
export const TOP_RATED_LIMIT = 5

// ★ごとの本数（★5→★1）・未評価の本数と、★4 以上の作品（★の高い順、同じ★は新しい視聴日順）
function summarizeRatings(items) {
  const ratingOf = (item) => (Number.isInteger(item.rating) && item.rating >= 1 && item.rating <= 5 ? item.rating : null)
  const ratings = [5, 4, 3, 2, 1].map((rating) => ({ rating, count: items.filter((item) => ratingOf(item) === rating).length }))
  const topRated = items
    .filter((item) => ratingOf(item) >= TOP_RATED_MIN)
    .sort((a, b) => b.rating - a.rating || (a.watched_on === b.watched_on ? a.title.localeCompare(b.title, 'ja') : a.watched_on < b.watched_on ? 1 : -1))
    .slice(0, TOP_RATED_LIMIT)
    .map((item) => ({ ...listItem(item), watched_on: item.watched_on }))
  return { ratings, unratedCount: items.filter((item) => ratingOf(item) === null).length, topRated }
}

export function formatMinutes(minutes) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest}分`
  return rest === 0 ? `${hours}時間` : `${hours}時間${rest}分`
}

export function addMonths(year, month, delta) {
  const index = year * 12 + (month - 1) + delta
  return { year: Math.floor(index / 12), month: (index % 12) + 1 }
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

export function weekdayLabel(date) {
  const [y, m, d] = date.split('-').map(Number)
  return WEEKDAYS[new Date(y, m - 1, d).getDay()]
}
