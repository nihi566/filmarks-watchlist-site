import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchRecords, recordsErrorMessage, saveChange } from './github.js'
import { decodeBase64Utf8, encodeBase64Utf8 } from './records.js'

const TOKEN = 'github_pat_SECRET_VALUE_1234'

function contentsResponse(file, sha) {
  return new Response(JSON.stringify({ content: encodeBase64Utf8(JSON.stringify(file)), sha }), { status: 200 })
}

const WATCH = { type: 'watch', movie_id: '2', title: 'B', image: '', watched_on: '2026-09-26', minutes: 90 }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('saveChange', () => {
  it('他の端末の保存と競合したら取り直して 1 回だけ再送し、相手の記録を消さない', async () => {
    const calls = []
    const responses = [
      contentsResponse({ version: 1, records: {} }, 'sha-old'),
      new Response('{}', { status: 409 }),
      contentsResponse({ version: 1, records: { 1: { title: 'A', watched_on: '2026-09-25', minutes: null } } }, 'sha-new'),
      new Response('{}', { status: 200 }),
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options = {}) => {
        calls.push({ url, options })
        return responses.shift()
      }),
    )

    const file = await saveChange(TOKEN, WATCH)

    expect(Object.keys(file.records).sort()).toEqual(['1', '2'])
    const put = calls.filter((call) => call.options.method === 'PUT')
    expect(put).toHaveLength(2)
    const lastBody = JSON.parse(put[1].options.body)
    expect(lastBody.sha).toBe('sha-new')
    expect(lastBody.branch).toBe('records')
    expect(Object.keys(JSON.parse(decodeBase64Utf8(lastBody.content)).records).sort()).toEqual(['1', '2'])
    // トークンはヘッダでだけ送り、URL には載せない
    for (const call of calls) {
      expect(call.url).not.toContain(TOKEN)
      expect(call.options.headers.Authorization).toBe(`Bearer ${TOKEN}`)
    }
  })

  it('2 回続けて競合したら失敗を返す（黙って成功扱いにしない）', async () => {
    const responses = [
      contentsResponse({ version: 1, records: {} }, 'a'),
      new Response('{}', { status: 422 }),
      contentsResponse({ version: 1, records: {} }, 'b'),
      new Response('{}', { status: 409 }),
    ]
    vi.stubGlobal('fetch', vi.fn(async () => responses.shift()))

    await expect(saveChange(TOKEN, WATCH)).rejects.toMatchObject({ kind: 'conflict' })
  })

  it('記録ファイルの形が不正なら上書き保存しない', async () => {
    const fetchMock = vi.fn(async () => contentsResponse({ version: 1, records: [] }, 'x'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(saveChange(TOKEN, WATCH)).rejects.toMatchObject({ kind: 'parse' })
    expect(fetchMock.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(false)
  })

  it('トークンが無ければ送信せずに失敗する', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(saveChange('', WATCH)).rejects.toMatchObject({ kind: 'auth' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('fetchRecords', () => {
  it('トークンが無ければ Authorization を付けずに読む', async () => {
    const fetchMock = vi.fn(async () => contentsResponse({ version: 1, records: {} }, 's'))
    vi.stubGlobal('fetch', fetchMock)

    await fetchRecords('')

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined()
  })

  it('401 は auth、通信失敗は network として扱い、メッセージにトークンを含めない', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
    const authError = await fetchRecords(TOKEN).catch((err) => err)
    expect(authError.kind).toBe('auth')
    expect(authError.message).not.toContain(TOKEN)
    expect(recordsErrorMessage(authError)).not.toContain(TOKEN)

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    await expect(fetchRecords(TOKEN)).rejects.toMatchObject({ kind: 'network' })
  })
})
