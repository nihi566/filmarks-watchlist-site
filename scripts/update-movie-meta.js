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

async function main() {
  const refetchAll = process.argv.includes('--all')
  const watchlist = await readJson(WATCHLIST, { tabs: [] })
  const meta = await readJson(META, { movies: {} })
  const movies = refetchAll ? {} : { ...meta.movies }
  const ids = [...new Set(watchlist.tabs.flatMap((tab) => tab.movies.map((movie) => String(movie.movie_id))))]
  const missing = ids.filter((id) => !(id in movies))
  console.log(`作品 ${ids.length} 件のうち ${missing.length} 件を取得します`)

  let failed = 0
  for (const [index, id] of missing.entries()) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS))
    try {
      const res = await fetch(`https://filmarks.com/movies/${id}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      movies[id] = parseMovieMeta(await res.text())
      console.log(`${index + 1}/${missing.length} ${id}: ${movies[id].countries.join('・') || '製作国不明'} / ${movies[id].genres.join('・') || 'ジャンル不明'}`)
    } catch (err) {
      // 取れなかった作品は保存しない（次に実行したときにもう一度取りに行く）
      failed += 1
      console.warn(`${index + 1}/${missing.length} ${id}: 取得できませんでした（${err.message}）`)
    }
  }

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
