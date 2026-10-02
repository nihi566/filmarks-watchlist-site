// タイトル検索で ひらがな/カタカナ・全角/半角・大文字/小文字 の違いを区別しないための正規化。
// NFKC で半角カナ→全角・全角英数→半角にそろえ、ひらがなをカタカナへ寄せる
export function normalizeForSearch(text) {
  return String(text)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60))
}

// needle は normalizeForSearch 済みの検索語
export function matchesKeyword(title, needle) {
  return normalizeForSearch(title).includes(needle)
}
