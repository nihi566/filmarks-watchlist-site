// ウォッチリストの作品の製作国・ジャンルを Filmarks の作品ページから取り、public/movie-meta.json に保存する。
// サイトはこれで作品の種類（アニメ・邦画・洋画）を決める。watchlist.json は scraper が作り直すので別のファイルに持つ。
// 使い方: npm run meta（まだ取っていない作品だけを 1 秒に 1 件ずつ取りに行く。--all で全件取り直す）
import { realpathSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const WATCHLIST = new URL('../public/watchlist.json', import.meta.url)
const META = new URL('../public/movie-meta.json', import.meta.url)
const INTERVAL_MS = 1000

// 作品ページの「製作国・地域：」「ジャンル：」の見出しに続く一覧のリンク名を取り出す
export function parseMovieMeta(html) {
  const namesAfter = (heading, kind) => {
    const start = html.indexOf(`${heading}</h3>`)
    if (start < 0) return []
    const end = html.indexOf('</ul>', start)
    const block = html.slice(start, end < 0 ? undefined : end)
    const pattern = new RegExp(`<a href="/list/${kind}/\\d+">([^<]+)</a>`, 'g')
    return [...block.matchAll(pattern)].map((match) => match[1].trim())
  }
  return { countries: namesAfter('製作国・地域：', 'country'), genres: namesAfter('ジャンル：', 'genre') }
}

async function readJson(url, fallback) {
  try {
    return JSON.parse(await readFile(url, 'utf8'))
  } catch (err) {
    if (err.code === 'ENOENT') return fallback
    throw err
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// ids の作品の製作国・ジャンルを取りに行き、previous（前回の movie-meta.json の movies）と合わせて返す。
// refetchAll でなければ previous に無い作品だけを取りに行く。fetchPage / wait / logger はテストで差し替える
export async function collectMovieMeta({ ids, previous = {}, refetchAll, fetchPage = fetch, wait = () => sleep(INTERVAL_MS), logger = console }) {
  const movies = refetchAll ? {} : { ...previous }
  const targets = ids.filter((id) => !(id in movies))
  logger.log(`作品 ${ids.length} 件のうち ${targets.length} 件を取得します`)

  let failed = 0
  for (const [index, id] of targets.entries()) {
    if (index > 0) await wait()
    try {
      const res = await fetchPage(`https://filmarks.com/movies/${id}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      movies[id] = parseMovieMeta(await res.text())
      logger.log(`${index + 1}/${targets.length} ${id}: ${movies[id].countries.join('・') || '製作国不明'} / ${movies[id].genres.join('・') || 'ジャンル不明'}`)
    } catch (err) {
      // 取れなかった作品は前回の値があればそのまま残す（--all で取り直すときに消さない）。
      // 前回の値も無ければ保存しない（次に実行したときにもう一度取りに行く）
      failed += 1
      const kept = id in previous
      if (kept) movies[id] = previous[id]
      logger.warn(`${index + 1}/${targets.length} ${id}: 取得できませんでした（${err.message}）${kept ? '。前回の値を残します' : ''}`)
    }
  }
  return { movies, failed }
}

async function main() {
  const refetchAll = process.argv.includes('--all')
  const watchlist = await readJson(WATCHLIST, { tabs: [] })
  const meta = await readJson(META, { movies: {} })
  const ids = [...new Set(watchlist.tabs.flatMap((tab) => tab.movies.map((movie) => String(movie.movie_id))))]
  const { movies, failed } = await collectMovieMeta({ ids, previous: meta.movies, refetchAll })

  const sorted = Object.fromEntries(Object.entries(movies).sort(([a], [b]) => Number(a) - Number(b)))
  await writeFile(META, `${JSON.stringify({ movies: sorted }, null, 2)}\n`)
  console.log(`public/movie-meta.json に ${Object.keys(sorted).length} 件を保存しました${failed ? `（${failed} 件は取得失敗）` : ''}`)
  if (failed) process.exitCode = 1
}

// node にこのファイルを直接渡して実行したときだけ true（テストから import しただけなら false）。
// URL 文字列どうしで比べると、Windows のパス（C:\...）や空白・日本語を含むパス（URL 側だけ % エンコードされる）で一致しないため、
// 実際のファイルパスに直してから比べる
export function isMainModule(moduleUrl, argvPath) {
  if (!argvPath) return false
  try {
    return realpathSync(argvPath) === realpathSync(fileURLToPath(moduleUrl))
  } catch {
    return false
  }
}

if (isMainModule(import.meta.url, process.argv[1])) await main()
