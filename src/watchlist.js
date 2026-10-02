// watchlist.json（scraper が生成する Filmarks のウォッチリスト）の取得と正規化。
// ウォッチリスト画面とおすすめ画面で同じデータを使う。
// 作品の種類（アニメ・邦画・洋画）は movie-meta.json（npm run meta で Filmarks の製作国・ジャンルから作る）で決める。

export function loadError(kind, status) {
  return Object.assign(new Error(kind), { kind, status })
}

// サムネ・観るページの URL は外部（scraper）由来なので https の URL だけを採用し、それ以外は空（出さない）に倒す
export function safeHttpsUrl(value) {
  return typeof value === 'string' && value.startsWith('https://') ? value : ''
}

// watchlist.json はこのリポジトリ外（scraper）が生成するため、形が想定外でも
// 一覧描画（localeCompare / toLowerCase 等）が例外を投げて白画面に
// ならないよう、取得直後の境界で構造を検証し title を文字列へ正規化する
export function normalizeWatchlist(json) {
  if (!json || !Array.isArray(json.tabs)) throw loadError('parse')
  return {
    ...json,
    tabs: json.tabs.map((tab) => ({
      ...tab,
      name: String(tab?.name ?? ''),
      movies: Array.isArray(tab?.movies)
        ? tab.movies.map((movie) => ({
            ...movie,
            title: String(movie?.title ?? ''),
            image: safeHttpsUrl(movie?.image),
            // そのサービスでこの作品を観るページ（Filmarks の配信一覧の「今すぐ観る」）
            watch_url: safeHttpsUrl(movie?.watch_url),
          }))
        : [],
    })),
  }
}

// 例外の英語メッセージは画面に出さず、失敗の段階ごとに決めた日本語だけを表示する
export function loadErrorMessage(err) {
  switch (err.kind) {
    case 'http':
      return `ウォッチリストを取得できませんでした（HTTP ${err.status}）。時間をおいて再試行してください。`
    case 'network':
      return 'サーバーに接続できませんでした。インターネット接続を確認して再試行してください。'
    case 'parse':
      return 'ウォッチリストのデータを読み取れませんでした。時間をおいて再試行してください。'
    default:
      return 'ウォッチリストを読み込めませんでした。時間をおいて再試行してください。'
  }
}

function stringList(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []
}

// 製作国・ジャンルから種類を決める。ジャンルにアニメがあればアニメ、無ければ最初の製作国が日本なら邦画・それ以外は洋画。
// 情報が無い作品は null（種類不明。おすすめでは LLM に任せ、「見た」では利用者が選ぶ）
export function kindFromMeta(meta) {
  const genres = stringList(meta?.genres)
  const countries = stringList(meta?.countries)
  if (genres.includes('アニメ')) return 'anime'
  if (countries.length === 0) return null
  return countries[0] === '日本' ? 'japanese' : 'foreign'
}

// 各作品に種類（kind）と製作国（countries）を付ける。meta が無い・読めないときは全作品を種類不明にする
export function attachKinds(watchlist, metaJson) {
  const metaById = metaJson && typeof metaJson.movies === 'object' ? metaJson.movies : {}
  return {
    ...watchlist,
    tabs: watchlist.tabs.map((tab) => ({
      ...tab,
      movies: tab.movies.map((movie) => {
        const meta = metaById?.[movie.movie_id]
        return { ...movie, kind: kindFromMeta(meta), countries: stringList(meta?.countries) }
      }),
    })),
  }
}

async function fetchJson(name) {
  let res
  try {
    res = await fetch(`${import.meta.env.BASE_URL}${name}`, { cache: 'no-cache' })
  } catch {
    throw loadError('network')
  }
  if (!res.ok) throw loadError('http', res.status)
  try {
    return await res.json()
  } catch {
    throw loadError('parse')
  }
}

export async function fetchWatchlist() {
  // 種類の情報は無くても一覧は出せるので、movie-meta.json の失敗は無視する
  const [json, meta] = await Promise.all([fetchJson('watchlist.json'), fetchJson('movie-meta.json').catch(() => null)])
  return attachKinds(normalizeWatchlist(json), meta)
}

// サービスをまたいで重複する作品を 1 件にまとめ、見られるサービス名を services に集める（未配信は含めない）
export function uniqueMovies(tabs, unavailable = '未配信') {
  const byId = new Map()
  for (const tab of tabs) {
    for (const movie of tab.movies) {
      const current = byId.get(movie.movie_id) ?? { ...movie, services: [] }
      if (tab.name !== unavailable) current.services = [...current.services, tab.name]
      byId.set(movie.movie_id, current)
    }
  }
  return [...byId.values()]
}
