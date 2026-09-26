// 視聴記録（records.json の records）を月・年で集計する純関数。
// 視聴日は 'YYYY-MM-DD' の文字列のまま扱い、Date に変換しない（UTC 解釈で日付がずれるため）。
// 視聴時間が不明（null）の作品は合計時間に含めず、unknownCount として別に数える。

function entriesOf(records) {
  return Object.entries(records ?? {}).map(([movieId, entry]) => ({ movie_id: movieId, ...entry }))
}

function prefixOf(year, month) {
  return month ? `${year}-${String(month).padStart(2, '0')}-` : `${year}-`
}

function totals(items) {
  return {
    count: items.length,
    minutes: items.reduce((sum, item) => sum + (item.minutes ?? 0), 0),
    unknownCount: items.filter((item) => item.minutes == null).length,
  }
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
      items: dayItems
        .map(({ movie_id, title, image, minutes }) => ({ movie_id, title, image, minutes }))
        .sort((a, b) => a.title.localeCompare(b.title, 'ja')),
    }))
  return { ...totals(items), days }
}

export function summarizeYear(records, year) {
  const items = entriesOf(records).filter((item) => item.watched_on.startsWith(prefixOf(year)))
  const months = Array.from({ length: 12 }, (_, index) => {
    const monthItems = items.filter((item) => item.watched_on.startsWith(prefixOf(year, index + 1)))
    const { count, minutes } = totals(monthItems)
    return { month: index + 1, count, minutes }
  })
  return { ...totals(items), months }
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
