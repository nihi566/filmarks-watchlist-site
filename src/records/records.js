// 視聴記録ファイル（records ブランチの records.json）を扱う純関数。
// 形: { version: 1, records: { "<movie_id>": { title, image, watched_on: "YYYY-MM-DD", minutes: 整数|null, updated_at } } }
// 「見たい」は記録なし（既定）で表し、「見た」を付けた作品だけが records に入る。

export const RECORDS_VERSION = 1

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export function emptyRecordsFile() {
  return { version: RECORDS_VERSION, records: {} }
}

export function isValidDate(value) {
  const match = typeof value === 'string' && DATE_RE.exec(value)
  if (!match) return false
  const [, y, m, d] = match.map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

function isValidMinutes(value) {
  return value === null || (Number.isInteger(value) && value >= 0)
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

// 取得したファイル全体の形を確かめる。ここで不正なら例外にし、読めないファイルを上書き保存させない
export function assertRecordsShape(json) {
  if (!isPlainObject(json) || !isPlainObject(json.records)) {
    throw Object.assign(new Error('records.json の形が不正です'), { kind: 'parse' })
  }
  return json
}

// 表示用に正規化する。視聴日が読めない項目は捨て、それ以外の値は安全な既定値へ倒す
export function parseRecordsFile(json) {
  assertRecordsShape(json)
  const records = {}
  for (const [movieId, entry] of Object.entries(json.records)) {
    if (!isPlainObject(entry) || !isValidDate(entry.watched_on)) continue
    records[movieId] = {
      title: String(entry.title ?? ''),
      image: typeof entry.image === 'string' && entry.image.startsWith('https://') ? entry.image : '',
      watched_on: entry.watched_on,
      minutes: isValidMinutes(entry.minutes) ? entry.minutes : null,
      updated_at: typeof entry.updated_at === 'string' ? entry.updated_at : '',
    }
  }
  return { version: RECORDS_VERSION, records }
}

// 1 件の変更を当てた新しいファイルを返す（引数は変更しない）。
// 変更する作品以外の項目・未知のキーはそのまま残す（他端末や将来の版が書いた内容を消さないため）
export function applyChange(file, change, now) {
  const movieId = String(change?.movie_id ?? '')
  if (!movieId) throw new Error('movie_id がありません')
  const records = { ...file.records }

  if (change.type === 'unwatch') {
    delete records[movieId]
  } else if (change.type === 'watch') {
    if (!isValidDate(change.watched_on)) throw new Error('視聴日が不正です')
    const minutes = change.minutes ?? null
    if (!isValidMinutes(minutes)) throw new Error('視聴時間が不正です')
    records[movieId] = {
      title: String(change.title ?? ''),
      image: typeof change.image === 'string' ? change.image : '',
      watched_on: change.watched_on,
      minutes,
      updated_at: now,
    }
  } else {
    throw new Error('未知の変更です')
  }

  return { ...file, records }
}

export function encodeBase64Utf8(text) {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function decodeBase64Utf8(base64) {
  const binary = atob(base64.replace(/\s/g, ''))
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

// 端末のローカル日付（日本時間の朝 9 時前に前日にならないよう UTC を使わない）
export function todayLocal(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// 「見た」の作品をウォッチリストの各グループから外す。全作品が外れたグループは表示しない
export function excludeWatched(tabs, records) {
  if (!records || Object.keys(records).length === 0) return tabs
  return tabs
    .map((tab) => ({ ...tab, movies: tab.movies.filter((movie) => !(movie.movie_id in records)) }))
    .filter((tab) => tab.movies.length > 0)
}
