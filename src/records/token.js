// GitHub トークンはこの端末のブラウザ（localStorage）にだけ保存する。
// プライベートブラウズ等で localStorage が使えないときは例外にせず「未設定」として扱う
const TOKEN_KEY = 'filmarks-watchlist.github-token'

export function loadToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

// 保存できたかを返す（呼び出し側が失敗を画面に出す）
export function storeToken(token) {
  try {
    window.localStorage.setItem(TOKEN_KEY, token)
    return true
  } catch {
    return false
  }
}

export function clearToken() {
  try {
    window.localStorage.removeItem(TOKEN_KEY)
    return true
  } catch {
    return false
  }
}
