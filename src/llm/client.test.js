import { afterEach, describe, expect, it, vi } from 'vitest'
import { chatJson, extractJson, listModels, llmErrorMessage } from './client.js'

const OLLAMA = { provider: 'ollama', baseUrl: 'http://localhost:11434/', model: 'qwen2.5:7b' }
const OPENAI = { provider: 'openai', baseUrl: 'http://localhost:1234/v1', model: 'local-model' }
const REQUEST = { messages: [{ role: 'user', content: 'hi' }], schema: { type: 'object' } }

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

// 少しずつ届く応答（行の途中で区切れても読めることを確かめるため、わざと半端な位置で分ける）
function streamed(text, chunkSize = 7) {
  const bytes = new TextEncoder().encode(text)
  const body = new ReadableStream({
    start(controller) {
      for (let i = 0; i < bytes.length; i += chunkSize) controller.enqueue(bytes.slice(i, i + chunkSize))
      controller.close()
    },
  })
  return new Response(body, { status: 200 })
}

function ollamaStream(content) {
  const parts = content.match(/.{1,4}/gsu)
  return streamed(
    [...parts.map((part) => JSON.stringify({ message: { content: part }, done: false })), JSON.stringify({ message: { content: '' }, done: true })].join('\n') + '\n',
  )
}

function openAiStream(content) {
  const parts = content.match(/.{1,4}/gsu)
  return streamed(
    [...parts.map((part) => `data: ${JSON.stringify({ choices: [{ delta: { content: part } }] })}`), 'data: [DONE]'].join('\n\n') + '\n\n',
  )
}

function stubFetch(...responses) {
  const calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, options = {}) => {
      calls.push({ url, options, body: options.body ? JSON.parse(options.body) : null })
      const next = responses.shift()
      if (next instanceof Error) throw next
      return next
    }),
  )
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('extractJson', () => {
  it('考える過程やコードブロックの囲みを除いて JSON を読む', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 })
    expect(extractJson('<think>候補を比べる {x}</think>\n```json\n{"a":2}\n```')).toEqual({ a: 2 })
    expect(extractJson('はい、こちらです: {"a":3} 以上です')).toEqual({ a: 3 })
  })

  it('JSON が無ければ parse エラーにする', () => {
    expect(() => extractJson('ごめんなさい')).toThrow(expect.objectContaining({ kind: 'parse' }))
    expect(() => extractJson(undefined)).toThrow(expect.objectContaining({ kind: 'parse' }))
  })
})

describe('chatJson（Ollama）', () => {
  it('/api/chat に JSON Schema と文脈長を付けて送り、少しずつ届く応答をつないで JSON を返す', async () => {
    const calls = stubFetch(ollamaStream('{"recommendations":[{"title":"ぼっち・ざ・ろっく！"}]}'))
    const progress = []
    const result = await chatJson(OLLAMA, REQUEST, { onProgress: (count) => progress.push(count) })
    expect(result).toEqual({ recommendations: [{ title: 'ぼっち・ざ・ろっく！' }] })
    expect(calls[0].url).toBe('http://localhost:11434/api/chat')
    expect(calls[0].body).toMatchObject({ model: 'qwen2.5:7b', stream: true, format: { type: 'object' }, options: { num_ctx: 8192 } })
    expect(progress.at(-1)).toBe('{"recommendations":[{"title":"ぼっち・ざ・ろっく！"}]}'.length)
  })

  it('途中でエラーの行が届いたら失敗にする', async () => {
    stubFetch(streamed(`${JSON.stringify({ message: { content: '{' } })}\n${JSON.stringify({ error: 'out of memory' })}\n`))
    await expect(chatJson(OLLAMA, REQUEST)).rejects.toMatchObject({ kind: 'http' })
  })

  it('モデルが無いときは notfound、接続できないときは network にする', async () => {
    stubFetch(json({ error: "model 'x' not found" }, 404))
    await expect(chatJson(OLLAMA, REQUEST)).rejects.toMatchObject({ kind: 'notfound' })
    stubFetch(new TypeError('Failed to fetch'))
    await expect(chatJson(OLLAMA, REQUEST)).rejects.toMatchObject({ kind: 'network' })
  })

  it('中止したときは abort にする', async () => {
    stubFetch(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    await expect(chatJson(OLLAMA, REQUEST)).rejects.toMatchObject({ kind: 'abort' })
  })

  it('モデルが未設定なら送らずに config エラーにする', async () => {
    const calls = stubFetch()
    await expect(chatJson({ ...OLLAMA, model: '' }, REQUEST)).rejects.toMatchObject({ kind: 'config' })
    expect(calls).toHaveLength(0)
  })
})

describe('chatJson（OpenAI 互換）', () => {
  it('/chat/completions に response_format を付けて送り、SSE の差分をつなぐ', async () => {
    const calls = stubFetch(openAiStream('<think>考え中</think>{"a":1}'))
    expect(await chatJson(OPENAI, REQUEST)).toEqual({ a: 1 })
    expect(calls[0].url).toBe('http://localhost:1234/v1/chat/completions')
    expect(calls[0].body.stream).toBe(true)
    expect(calls[0].body.response_format).toEqual({ type: 'json_schema', json_schema: { name: 'result', schema: { type: 'object' } } })
  })

  it('構造化出力に対応していない（400）なら指定を外して 1 回だけ送り直す', async () => {
    const calls = stubFetch(json({ error: 'unsupported' }, 400), openAiStream('{"a":2}'))
    expect(await chatJson(OPENAI, REQUEST)).toEqual({ a: 2 })
    expect(calls).toHaveLength(2)
    expect(calls[1].body.response_format).toBeUndefined()
  })

  it('400 以外のエラーは送り直さない', async () => {
    const calls = stubFetch(json({}, 500))
    await expect(chatJson(OPENAI, REQUEST)).rejects.toMatchObject({ kind: 'http', status: 500 })
    expect(calls).toHaveLength(1)
  })
})

describe('listModels', () => {
  it('Ollama は /api/tags、OpenAI 互換は /models から名前順の一覧を返す', async () => {
    let calls = stubFetch(json({ models: [{ name: 'qwen2.5:7b' }, { name: 'gemma3:4b' }, { name: 'qwen2.5:7b' }] }))
    expect(await listModels(OLLAMA)).toEqual(['gemma3:4b', 'qwen2.5:7b'])
    expect(calls[0].url).toBe('http://localhost:11434/api/tags')

    calls = stubFetch(json({ data: [{ id: 'b' }, { id: 'a' }, { id: null }] }))
    expect(await listModels(OPENAI)).toEqual(['a', 'b'])
    expect(calls[0].url).toBe('http://localhost:1234/v1/models')
  })
})

describe('llmErrorMessage', () => {
  it('接続できないときは接続先と許可の設定を案内する', () => {
    const text = llmErrorMessage({ kind: 'network' }, OLLAMA)
    expect(text).toContain('http://localhost:11434/')
    expect(text).toContain('OLLAMA_ORIGINS')
    expect(llmErrorMessage({ kind: 'notfound' }, OLLAMA)).toContain('qwen2.5:7b')
  })
})
