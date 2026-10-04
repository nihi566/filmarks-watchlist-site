// ウォッチリストの上映時間での絞り込み（「今夜 2 時間以内で観られる作品」を探す）。
// 上限は選択肢の値だけにする（URL の ?runtime= もこの値だけを受け付ける）
export const RUNTIME_LIMITS = [90, 120, 150]

export function runtimeLabel(limit) {
  return `${limit}分以内`
}

// 上限（分）以内の作品だけ true。上限を指定したときは、上映時間が分からない作品は収まるか判断できないので外す
export function matchesRuntime(movie, limit) {
  if (limit == null) return true
  const runtime = movie.runtime_min
  return typeof runtime === 'number' && Number.isFinite(runtime) && runtime > 0 && runtime <= limit
}

// 作品が無くなったサービスは一覧・サービスの選択肢から外す
export function filterTabsByRuntime(tabs, limit) {
  if (limit == null) return tabs
  return tabs
    .map((tab) => ({ ...tab, movies: tab.movies.filter((movie) => matchesRuntime(movie, limit)) }))
    .filter((tab) => tab.movies.length > 0)
}
