// グループ内の作品の並び。watchlist.json はタイトル順で届くので「タイトル順」はそのまま返す
export const MOVIE_ORDERS = [
  { value: 'title', label: 'タイトル順' },
  { value: 'clip', label: '最近クリップした順' },
]

// clip_order（0 = いちばん最近クリップ）の小さい順。数値でない・無い作品は末尾に届いた順（タイトル順）で並べる
export function sortMovies(movies, order) {
  if (order !== 'clip') return movies
  const rank = (movie) => (Number.isFinite(movie.clip_order) ? movie.clip_order : Infinity)
  return [...movies].sort((a, b) => {
    const ra = rank(a)
    const rb = rank(b)
    return ra === rb ? 0 : ra - rb
  })
}
