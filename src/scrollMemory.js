// 戻る・進むで前のページに戻ったとき、そのページで見ていた位置（と、見たいリストで開いていたグループ）を戻す。
// 履歴の項目ごとに目印（key）を history.state に付け、位置は記憶の中にだけ持つ
// （スクロールのたびに replaceState すると Safari が回数制限で例外を投げるため）
const positions = new Map()
let currentKey = null

function newKey() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function replaceState(state) {
  try {
    window.history.replaceState(state, '')
  } catch {
    // Safari の回数制限。位置を戻せなくなるだけなので無視する
  }
}

function ensureKey() {
  const state = window.history.state
  if (state?.scrollKey) return state.scrollKey
  const key = newKey()
  replaceState({ ...(state ?? {}), scrollKey: key })
  return key
}

export function startScrollMemory() {
  if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'
  currentKey = ensureKey()
  const onScroll = () => positions.set(currentKey, window.scrollY)
  window.addEventListener('scroll', onScroll, { passive: true })
  return () => window.removeEventListener('scroll', onScroll)
}

// hashchange のときに呼ぶ。戻る・進むで来た項目なら覚えていた位置を、新しく開いた項目なら null を返す
export function enterHistoryEntry() {
  const known = window.history.state?.scrollKey
  currentKey = ensureKey()
  return known ? (positions.get(known) ?? 0) : null
}

// 見たいリストで開いているグループは、ページを離れると消えるので履歴の項目に覚えておく
export function rememberOpenGroup(name) {
  const state = window.history.state ?? {}
  if ((state.openGroup ?? null) === (name ?? null)) return
  replaceState({ ...state, openGroup: name ?? null })
}

export function rememberedOpenGroup() {
  return window.history.state?.openGroup
}
