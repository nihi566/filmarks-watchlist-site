// ウォッチリストの見え方（サービス・種類の絞り込み、検索語、並び順）を URL のクエリに持たせ、
// リロード・共有・他ページから戻ったときに同じ状態で開けるようにする。
// ページの切り替えは hash（#/records など）が担うので、クエリは hash の前（?service=...#/）に置く
import { KIND_FILTERS } from './records/kinds.js'
import { MOVIE_ORDERS } from './movieOrder.js'

export const GROUP_SORTS = ['count', 'name']

export const DEFAULT_VIEW = { service: null, kind: 'all', query: '', sort: 'count', order: 'title' }

// none は「種類不明」（movie-meta.json に無い作品）
const KIND_VALUES = new Set([...KIND_FILTERS.map((item) => item.value), 'none'])
const ORDER_VALUES = new Set(MOVIE_ORDERS.map((item) => item.value))

function pick(value, allowed, fallback) {
  return allowed.has(value) ? value : fallback
}

// URL は手で書き換えられる・古い形のこともあるので、知らない値は既定に戻す
export function readViewFromSearch(search) {
  const params = new URLSearchParams(search)
  return {
    service: params.get('service') || DEFAULT_VIEW.service,
    kind: pick(params.get('kind'), KIND_VALUES, DEFAULT_VIEW.kind),
    query: params.get('q') ?? DEFAULT_VIEW.query,
    sort: pick(params.get('sort'), new Set(GROUP_SORTS), DEFAULT_VIEW.sort),
    order: pick(params.get('order'), ORDER_VALUES, DEFAULT_VIEW.order),
  }
}

// 既定と同じ値は書かない（何も絞り込んでいなければ URL はクエリ無しのまま）
export function viewToSearch(view) {
  const params = new URLSearchParams()
  if (view.service) params.set('service', view.service)
  if (view.kind !== DEFAULT_VIEW.kind) params.set('kind', view.kind)
  if (view.query.trim()) params.set('q', view.query)
  if (view.sort !== DEFAULT_VIEW.sort) params.set('sort', view.sort)
  if (view.order !== DEFAULT_VIEW.order) params.set('order', view.order)
  const text = params.toString()
  return text ? `?${text}` : ''
}

export function withSearch(location, search) {
  return `${location.pathname}${search}${location.hash}`
}
