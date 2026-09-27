// 視聴記録ファイル（records ブランチの records.json）を扱う純関数。
// 形: { version: 1, records: { "<movie_id>": {
//   title, image, watched_on: "YYYY-MM-DD", minutes: 整数|null, updated_at,
//   rating: 1〜5|null（★の数）, kind: "anime"|"japanese"|"foreign"|null（種類）,
//   episodes: 整数|null, episode_minutes: 整数|null（アニメだけ。見た話数と 1 話の分数。minutes はその積）
// } } }
// 「見たい」は記録なし（既定）で表し、「見た」を付けた作品だけが records に入る。
// rating 以降は後から足した項目で、無い記録（古い記録）は null として読む。
// ウォッチリストに無い作品（テレビアニメなど）は movie_id を MANUAL_ID_PREFIX 付きの ID で記録する。
import { isKind } from './kinds.js'

export const RECORDS_VERSION = 1

export const MANUAL_ID_PREFIX = 'manual-'

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

function isValidRating(value) {
  return value === null || (Number.isInteger(value) && value >= 1 && value <= 5)
}

function isValidEpisodes(value) {
  return value === null || (Number.isInteger(value) && value >= 1)
}

// アニメの視聴時間 = 見た話数 × 1 話の分数（どちらかが分からなければ不明）
export function animeMinutes(episodes, episodeMinutes) {
  return episodes != null && episodeMinutes != null ? episodes * episodeMinutes : null
}

export function isManualId(movieId) {
  return String(movieId).startsWith(MANUAL_ID_PREFIX)
}

export function newManualId(now = Date.now(), random = Math.random) {
  return `${MANUAL_ID_PREFIX}${now.toString(36)}${Math.floor(random() * 36 ** 4).toString(36).padStart(4, '0')}`
}

// 無い値・検査に通らない値は null に倒す
function validOrNull(value, isValid) {
  return value != null && isValid(value) ? value : null
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
    const kind = isKind(entry.kind) ? entry.kind : null
    records[movieId] = {
      title: String(entry.title ?? ''),
      image: typeof entry.image === 'string' && entry.image.startsWith('https://') ? entry.image : '',
      watched_on: entry.watched_on,
      minutes: isValidMinutes(entry.minutes) ? entry.minutes : null,
      updated_at: typeof entry.updated_at === 'string' ? entry.updated_at : '',
      rating: validOrNull(entry.rating, isValidRating),
      kind,
      // 話数はアニメの記録でだけ意味を持つ
      episodes: kind === 'anime' ? validOrNull(entry.episodes, isValidEpisodes) : null,
      episode_minutes: kind === 'anime' ? validOrNull(entry.episode_minutes, isValidMinutes) : null,
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
    const rating = change.rating ?? null
    if (!isValidRating(rating)) throw new Error('評価が不正です')
    const kind = change.kind ?? null
    if (kind !== null && !isKind(kind)) throw new Error('種類が不正です')
    const episodes = kind === 'anime' ? (change.episodes ?? null) : null
    const episodeMinutes = kind === 'anime' ? (change.episode_minutes ?? null) : null
    if (!isValidEpisodes(episodes) || !isValidMinutes(episodeMinutes)) throw new Error('話数が不正です')
    records[movieId] = {
      title: String(change.title ?? ''),
      image: typeof change.image === 'string' ? change.image : '',
      watched_on: change.watched_on,
      minutes,
      updated_at: now,
      rating,
      kind,
      episodes,
      episode_minutes: episodeMinutes,
    }
  } else {
    throw new Error('未知の変更です')
  }

  return { ...file, records }
}

// 保存済みの記録をそのまま書き戻す変更（「見たいに戻す」「削除」の取り消し用）
export function watchChangeFromEntry(movieId, entry) {
  return {
    type: 'watch',
    movie_id: movieId,
    title: entry.title,
    image: entry.image,
    watched_on: entry.watched_on,
    minutes: entry.minutes,
    rating: entry.rating ?? null,
    kind: entry.kind ?? null,
    episodes: entry.episodes ?? null,
    episode_minutes: entry.episode_minutes ?? null,
  }
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
