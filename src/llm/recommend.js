// 視聴記録（★評価・種類）からローカル LLM へのおすすめの頼み方を組み立て、返ってきた JSON を画面用に整える純関数。
// 小さなモデルでも文脈に収まるよう、記録と候補は件数を絞って 1 行ずつの短い形で渡す。
import { isKind, kindLabel, matchesKindFilter, RATING_LABELS } from '../records/kinds.js'

export const RECOMMEND_COUNT = 5
const FORMATS = ['アニメ', '実写']
// 候補・記録を渡す上限（新しい順に残す）
const MAX_CANDIDATES = 150
const MAX_LIKED = 40
const MAX_NEUTRAL = 20
const MAX_DISLIKED = 20
const MAX_UNRATED = 30

// mode: 'watchlist' はウォッチリストのまだ見ていない作品から選ぶ、'any' はウォッチリストに無い作品も挙げてもらう
export const RECOMMEND_MODES = [
  { value: 'watchlist', label: 'ウォッチリストから' },
  { value: 'any', label: '新しい作品も' },
]

const KIND_REQUESTS = {
  all: '種類は問いません（アニメ・邦画・洋画のどれでも構いません）。',
  anime: 'アニメ作品だけを選んでください（テレビアニメのシリーズや劇場アニメ。実写は除きます）。',
  movie: '実写の映画（邦画・洋画）だけを選んでください。アニメは除きます。',
  japanese: '邦画（日本の実写映画）だけを選んでください。アニメと海外の作品は除きます。',
  foreign: '洋画（海外の実写映画）だけを選んでください。アニメと日本の作品は除きます。',
}

const SYSTEM_PROMPT =
  'あなたは映画とアニメに詳しいレコメンドの専門家です。' +
  'ユーザーの視聴記録と 5 段階の評価（★1〜★5）から好みを読み取り、次に見る作品を薦めます。' +
  '回答は必ず日本語で、指定された形の JSON だけを出力してください。'

// 表記ゆれ（全角半角・空白・記号）を無視してタイトルを比べるための形
export function normalizeTitle(title) {
  return String(title ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s・:'"「」『』【】!?、。,.\-～~/／]/g, '')
}

function recordLine(entry) {
  const details = []
  if (isKind(entry.kind)) details.push(kindLabel(entry.kind))
  if (entry.kind === 'anime' && entry.episodes) details.push(`${entry.episodes}話`)
  const detail = details.length > 0 ? `（${details.join('・')}）` : ''
  const rating = entry.rating ? ` ★${entry.rating}（${RATING_LABELS[entry.rating]}）` : ''
  return `- ${entry.title}${detail}${rating}`
}

function section(heading, entries, limit) {
  if (entries.length === 0) return []
  const shown = entries.slice(0, limit)
  const rest = entries.length - shown.length
  return [`## ${heading}`, ...shown.map(recordLine), ...(rest > 0 ? [`（ほか ${rest} 作品）`] : [])]
}

function recordSections(records) {
  const entries = Object.values(records ?? {}).sort((a, b) => (a.watched_on < b.watched_on ? 1 : -1))
  if (entries.length === 0) return ['（まだ視聴記録がありません。一般に評価の高い作品から選んでください）']
  return [
    ...section('高評価（★4〜5）：こういう作品が好き', entries.filter((e) => e.rating >= 4), MAX_LIKED),
    ...section('ふつう（★3）', entries.filter((e) => e.rating === 3), MAX_NEUTRAL),
    ...section('低評価（★1〜2）：こういう作品は避けたい', entries.filter((e) => e.rating && e.rating <= 2), MAX_DISLIKED),
    ...section('評価なし（見たことだけ分かっている）', entries.filter((e) => !e.rating), MAX_UNRATED),
  ]
}

function schemaFor(mode, count) {
  const properties = {
    ...(mode === 'watchlist' ? { id: { type: 'integer' } } : {}),
    title: { type: 'string' },
    // 種類（アニメ・邦画・洋画）は直接聞かず、製作国と「アニメか実写か」を答えさせてこちらで決める。
    // 小さなモデルは japanese を「日本の作品」と読んで日本のアニメに付けたり、邦画を洋画と取り違えたりするため
    country: { type: 'string' },
    format: { type: 'string', enum: FORMATS },
    reason: { type: 'string' },
  }
  return {
    type: 'object',
    properties: {
      recommendations: {
        type: 'array',
        maxItems: count,
        items: { type: 'object', properties, required: Object.keys(properties), additionalProperties: false },
      },
    },
    required: ['recommendations'],
    additionalProperties: false,
  }
}

// ウォッチリストの候補から、記録済みの作品と、種類が分かっていて頼んだ種類と違う作品を除き、
// 新しくクリップした順に上限まで残す（種類が分からない作品は残し、LLM に判断させる）
export function pickCandidates(movies, records, kind = 'all') {
  const watchedTitles = new Set(Object.values(records ?? {}).map((entry) => normalizeTitle(entry.title)))
  const rank = (movie) => (Number.isFinite(movie.clip_order) ? movie.clip_order : Infinity)
  return movies
    .filter((movie) => !(movie.movie_id in (records ?? {})) && !watchedTitles.has(normalizeTitle(movie.title)))
    .filter((movie) => !isKind(movie.kind) || matchesKindFilter(movie.kind, kind))
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, MAX_CANDIDATES)
}

function candidateLine(movie, index) {
  const details = [isKind(movie.kind) && kindLabel(movie.kind), movie.runtime_min && `${movie.runtime_min}分`].filter(Boolean)
  return `${index + 1}: ${movie.title}${details.length > 0 ? `（${details.join('・')}）` : ''}`
}

// LLM に送る messages と出力の JSON Schema を返す。candidates は pickCandidates の結果（mode が watchlist のときだけ使う）
export function buildRecommendationRequest({ records, candidates = [], kind = 'all', mode = 'watchlist', wish = '', count = RECOMMEND_COUNT }) {
  const lines = ['# 私の視聴記録（新しい順）', ...recordSections(records), '', '# お願い', KIND_REQUESTS[kind] ?? KIND_REQUESTS.all]

  if (mode === 'watchlist') {
    lines.push(
      `次の「候補」の中から、私の好みに合いそうな作品を合う順に最大 ${count} 作品選んでください。候補に無い作品は選ばないでください。`,
      '',
      '# 候補（番号: タイトル（種類・上映時間））',
      ...candidates.map(candidateLine),
    )
  } else {
    lines.push(
      `私がまだ見ていない作品を、好みに合いそうな順に最大 ${count} 作品挙げてください。視聴記録にある作品は挙げないでください。`,
      '実在する作品だけを、日本で使われている正式なタイトルで答えてください。',
    )
  }
  if (kind === 'anime' || kind === 'all') {
    lines.push('テレビアニメを薦めるときは、1クール12話など、どのくらいの長さの作品かも理由に書いてください。')
  }
  const trimmedWish = wish.trim()
  if (trimmedWish) lines.push('', '# 今日の希望', trimmedWish)

  lines.push(
    '',
    '# 出力の形',
    mode === 'watchlist'
      ? '{"recommendations": [{"id": 候補の番号, "title": "候補のタイトル", "country": "製作国", "format": "アニメ か 実写", "reason": "薦める理由"}]}'
      : '{"recommendations": [{"title": "作品のタイトル", "country": "製作国", "format": "アニメ か 実写", "reason": "薦める理由"}]}',
    'country はその作品の製作国（例: 日本、アメリカ、イギリス、韓国）です。',
    'format はアニメーション作品なら「アニメ」、俳優が演じる実写作品なら「実写」です。',
    'reason は、視聴記録のどの作品と似ているか・どこが好みに合いそうかを、日本語で 2 文以内で書いてください。',
  )

  return {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: lines.join('\n') },
    ],
    schema: schemaFor(mode, count),
  }
}

// 回答の作品を候補から探す。タイトルが候補と一致すればそれを使い、無ければ番号の候補を使う。
// ただし番号の候補とタイトルが食い違う回答は捨てる（小さなモデルは番号を取り違え、理由が別作品の話になるため）。
// 副題を省いた答え（「イミテーション・ゲーム」など）は、片方がもう片方を含んでいれば同じ作品とみなす
function findCandidate(item, candidates, candidateByTitle) {
  const title = normalizeTitle(item?.title)
  const byTitle = candidateByTitle.get(title)
  if (byTitle) return byTitle
  const byId = Number.isInteger(item?.id) ? candidates[item.id - 1] : null
  if (!byId) return null
  const candidateTitle = normalizeTitle(byId.title)
  return !title || candidateTitle.includes(title) || title.includes(candidateTitle) ? byId : null
}

const JAPAN = new Set(['日本', 'japan', 'jp'])

// 実写の作品は製作国で邦画か洋画かを決める（製作国が無ければ null）
function kindFromCountry(country) {
  const place = String(country ?? '').normalize('NFKC').trim().toLowerCase()
  if (!place) return null
  return JAPAN.has(place) ? 'japanese' : 'foreign'
}

// 答えの種類。「アニメか実写か」と製作国から決め、format が無い答えは kind を読んで製作国で正す
function kindOfAnswer(item) {
  if (item?.format === 'アニメ') return 'anime'
  if (item?.format === '実写') return kindFromCountry(item.country)
  const kind = isKind(item?.kind) ? item.kind : null
  return kind === 'anime' ? kind : (kindFromCountry(item?.country) ?? kind)
}

// LLM の JSON を画面用の配列にする。候補に無い作品・見た作品・重複・頼んだ種類と違う作品は捨てる
export function parseRecommendations(json, { mode = 'watchlist', candidates = [], records, kind = 'all', count = RECOMMEND_COUNT }) {
  const items = Array.isArray(json?.recommendations) ? json.recommendations : []
  const watchedTitles = new Set(Object.values(records ?? {}).map((entry) => normalizeTitle(entry.title)))
  const candidateByTitle = new Map(candidates.map((movie) => [normalizeTitle(movie.title), movie]))
  const seen = new Set()
  const results = []

  for (const item of items) {
    if (results.length >= count) break
    let movie = null
    if (mode === 'watchlist') {
      movie = findCandidate(item, candidates, candidateByTitle)
      if (!movie) continue
    }
    // 候補の種類が Filmarks の情報で分かっていればそれを使い、LLM の答えより優先する
    const itemKind = isKind(movie?.kind) ? movie.kind : kindOfAnswer(item)
    const title = movie ? movie.title : String(item?.title ?? '').trim()
    const key = normalizeTitle(title)
    if (!key || seen.has(key) || watchedTitles.has(key)) continue
    if (itemKind && !matchesKindFilter(itemKind, kind)) continue
    seen.add(key)
    // 製作国も Filmarks の情報があればそれを出す（LLM の答えは作品を知らないと誤る）
    const country = movie?.countries?.length ? movie.countries.join('・') : String(item?.country ?? '').trim() || null
    results.push({ title, kind: itemKind, country, reason: String(item?.reason ?? '').trim(), movie })
  }
  return results
}
