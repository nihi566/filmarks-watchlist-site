// 作品の種類。アニメはテレビシリーズ（1クール12話など）を話数で記録するため、映画（邦画・洋画）と分けて扱う。
// 記録に保存する値は KINDS の value だけ。種類を付ける前の記録は null（未分類）として読む。
export const KINDS = [
  { value: 'anime', label: 'アニメ' },
  { value: 'japanese', label: '邦画' },
  { value: 'foreign', label: '洋画' },
]

const KIND_VALUES = new Set(KINDS.map((kind) => kind.value))

export function isKind(value) {
  return KIND_VALUES.has(value)
}

export function kindLabel(value) {
  return KINDS.find((kind) => kind.value === value)?.label ?? '未分類'
}

// 絞り込みの選択肢。「映画」は邦画と洋画をまとめたもの
export const KIND_FILTERS = [
  { value: 'all', label: 'すべて' },
  { value: 'anime', label: 'アニメ' },
  { value: 'movie', label: '映画' },
  { value: 'japanese', label: '邦画' },
  { value: 'foreign', label: '洋画' },
]

export function matchesKindFilter(kind, filter) {
  if (!filter || filter === 'all') return true
  if (filter === 'movie') return kind === 'japanese' || kind === 'foreign'
  if (filter === 'none') return !isKind(kind)
  return kind === filter
}

// 記録（{ movie_id: entry }）を種類で絞り込む
export function filterRecordsByKind(records, filter) {
  if (!records || !filter || filter === 'all') return records
  return Object.fromEntries(Object.entries(records).filter(([, entry]) => matchesKindFilter(entry.kind, filter)))
}

// ★の段階ごとの意味。画面の補足と、ローカル LLM に渡す好みの説明に使う
export const RATING_LABELS = {
  1: 'つまらなかった',
  2: 'いまいち',
  3: 'ふつう',
  4: '面白かった',
  5: '最高',
}
