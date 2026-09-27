const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// generated_at は "YYYY-MM-DD HH:MM:SS"（タイムゾーン無し）。scraper と閲覧者は同じ日本時間の前提で
// ローカル時刻として読み、表示用の日時と経過時間を返す。読めない値は null（呼び出し側で「不明」と出す）
export function describeFetchedAt(value, now = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(value ?? ''))
  if (!match) return null
  const [, y, mo, d, h, mi, s = 0] = match.map((part) => part && Number(part))
  const fetched = new Date(y, mo - 1, d, h, mi, s)
  if (fetched.getMonth() !== mo - 1 || fetched.getDate() !== d || fetched.getHours() !== h || fetched.getMinutes() !== mi) {
    return null
  }

  const pad = (n) => String(n).padStart(2, '0')
  return {
    date: `${y}/${pad(mo)}/${pad(d)} ${pad(h)}:${pad(mi)}`,
    ago: formatAgo(now - fetched),
  }
}

function formatAgo(elapsed) {
  if (elapsed < MINUTE) return 'たった今'
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}分前`
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}時間前`
  return `${Math.floor(elapsed / DAY)}日前`
}
