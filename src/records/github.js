// 視聴記録の保存先: このサイトのリポジトリの records ブランチにある records.json。
// GitHub Contents API で丸ごと読み書きする（件数は数百程度なので差分同期は作らない）。
// トークンは Authorization ヘッダでだけ送り、URL・エラーメッセージ・console には出さない。
import { applyChange, assertRecordsShape, decodeBase64Utf8, encodeBase64Utf8, parseRecordsFile } from './records.js'

export const OWNER = 'nihi566'
export const REPO = 'filmarks-watchlist-site'
export const BRANCH = 'records'
export const PATH = 'records.json'

const CONTENTS_URL = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`

function githubError(kind, status) {
  return Object.assign(new Error(`github:${kind}`), { kind, status })
}

function errorKind(res) {
  if (res.status === 401) return 'auth'
  if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') return 'ratelimit'
  if (res.status === 403) return 'forbidden'
  if (res.status === 404) return 'notfound'
  // sha が古い（他の端末が先に保存した）ときは 409 か 422 が返る
  if (res.status === 409 || res.status === 422) return 'conflict'
  return 'http'
}

function headers(token) {
  const result = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  if (token) result.Authorization = `Bearer ${token}`
  return result
}

async function request(url, options) {
  let res
  try {
    // 古い sha を掴むと保存が必ず競合するため、ブラウザのキャッシュを使わない
    res = await fetch(url, { cache: 'no-store', ...options })
  } catch {
    throw githubError('network')
  }
  if (!res.ok) throw githubError(errorKind(res), res.status)
  try {
    return await res.json()
  } catch {
    throw githubError('parse')
  }
}

// 生の records.json（未知のキーを含む）と sha を返す。トークンが無ければ未認証で読む（公開リポジトリのため閲覧はできる）
async function fetchRaw(token) {
  const body = await request(`${CONTENTS_URL}?ref=${BRANCH}`, { headers: headers(token) })
  let json
  try {
    json = JSON.parse(decodeBase64Utf8(String(body.content ?? '')))
  } catch {
    throw githubError('parse')
  }
  try {
    assertRecordsShape(json)
  } catch {
    throw githubError('parse')
  }
  return { json, sha: body.sha }
}

export async function fetchRecords(token) {
  const { json } = await fetchRaw(token)
  return parseRecordsFile(json)
}

// 最新を取得 → 変更を当てる → sha 付きで保存。他の端末が先に保存して競合したら、
// 取り直して同じ変更を当て直し 1 回だけ再送する（それでも失敗したら呼び出し側へ失敗を返す）
export async function saveChange(token, change) {
  if (!token) throw githubError('auth')
  for (let attempt = 0; ; attempt += 1) {
    const { json, sha } = await fetchRaw(token)
    const next = applyChange(json, change, new Date().toISOString())
    try {
      await request(CONTENTS_URL, {
        method: 'PUT',
        headers: { ...headers(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `record: ${change.type} ${change.movie_id}`,
          content: encodeBase64Utf8(`${JSON.stringify(next, null, 2)}\n`),
          sha,
          branch: BRANCH,
        }),
      })
      return parseRecordsFile(next)
    } catch (err) {
      if (err.kind === 'conflict' && attempt === 0) continue
      throw err
    }
  }
}

export function recordsErrorMessage(err) {
  switch (err?.kind) {
    case 'auth':
      return 'GitHub トークンが無効か期限切れです。設定画面でトークンを入れ直してください。'
    case 'forbidden':
      return 'このトークンには記録の保存先リポジトリへの権限がありません。発行時の対象リポジトリと Contents の権限を確認してください。'
    case 'ratelimit':
      return 'GitHub への問い合わせ回数の上限に達しました。しばらく待つか、設定画面でトークンを保存してください。'
    case 'notfound':
      return '記録ファイルが見つかりません（トークンの対象リポジトリが違う可能性があります）。'
    case 'conflict':
      return '他の端末の保存と重なったため保存できませんでした。もう一度お試しください。'
    case 'network':
      return 'GitHub に接続できませんでした。インターネット接続を確認してください。'
    case 'parse':
      return '記録ファイルを読み取れませんでした。'
    default:
      return '記録の読み書きに失敗しました。時間をおいて再試行してください。'
  }
}
