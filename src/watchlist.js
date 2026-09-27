// watchlist.json（scraper が生成する Filmarks のウォッチリスト）の取得と正規化。
// ウォッチリスト画面とおすすめ画面で同じデータを使う。

export function loadError(kind, status) {
  return Object.assign(new Error(kind), { kind, status })
}

// サムネ URL は外部（scraper）由来なので https の URL だけを採用し、それ以外は代替表示に倒す
export function safeImageUrl(value) {
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
            image: safeImageUrl(movie?.image),
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

export async function fetchWatchlist() {
  let res
  try {
    res = await fetch(`${import.meta.env.BASE_URL}watchlist.json`, { cache: 'no-cache' })
  } catch {
    throw loadError('network')
  }
  if (!res.ok) throw loadError('http', res.status)
  let json
  try {
    json = await res.json()
  } catch {
    throw loadError('parse')
  }
  return normalizeWatchlist(json)
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
