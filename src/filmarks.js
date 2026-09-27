// Filmarks のページへのリンク。作品 ID が分かる作品（ウォッチリスト由来）は作品ページ、
// 分からない作品（手で追加した記録・LLM が挙げた作品）はタイトルでの検索結果を開く。
export function filmarksMovieUrl(movieId) {
  return `https://filmarks.com/movies/${encodeURIComponent(movieId)}`
}

export function filmarksSearchUrl(title, kind) {
  const section = kind === 'anime' ? 'animes' : 'movies'
  return `https://filmarks.com/search/${section}?q=${encodeURIComponent(title)}`
}
