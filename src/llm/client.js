// 利用者の PC で動くローカル LLM（Ollama / OpenAI 互換 API）への問い合わせ。
// ブラウザから直接 http://localhost へ送るため、LLM 側でこのサイトからの接続（CORS）を許可しておく必要がある。
// 視聴記録はこの LLM にだけ送り、ほかの外部サービスへは送らない。

// 大きめの文脈長を頼む（Ollama の既定 4096 では視聴記録と候補の一覧が収まらないことがある）
const OLLAMA_NUM_CTX = 8192
const TEMPERATURE = 0.7

function llmError(kind, status) {
  return Object.assign(new Error(`llm:${kind}`), { kind, status })
}

function isAbort(err) {
  return err?.name === 'AbortError'
}

function joinUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/+$/, '')}${path}`
}

async function send(url, options) {
  let res
  try {
    res = await fetch(url, { cache: 'no-store', ...options })
  } catch (err) {
    throw llmError(isAbort(err) ? 'abort' : 'network')
  }
  if (!res.ok) throw llmError(res.status === 404 ? 'notfound' : 'http', res.status)
  return res
}

async function request(url, options) {
  const res = await send(url, options)
  try {
    return await res.json()
  } catch (err) {
    throw llmError(isAbort(err) ? 'abort' : 'parse')
  }
}

// 応答を 1 行ずつ読む（Ollama は 1 行 1 JSON、OpenAI 互換は "data: {...}" の行で少しずつ届く）
async function readLines(res, onLine) {
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { value, done } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) if (line.trim()) onLine(line.trim())
      if (done) break
    }
  } catch (err) {
    // 読み取りを途中でやめたら、LLM にも生成をやめさせる
    reader.cancel().catch(() => {})
    if (err?.kind) throw err
    throw llmError(isAbort(err) ? 'abort' : 'network')
  }
  if (buffer.trim()) onLine(buffer.trim())
}

function parseLine(line) {
  try {
    return JSON.parse(line)
  } catch {
    throw llmError('parse')
  }
}

// 使えるモデル名の一覧（名前順）
export async function listModels(settings, signal) {
  if (settings.provider === 'ollama') {
    const body = await request(joinUrl(settings.baseUrl, '/api/tags'), { signal })
    const names = Array.isArray(body?.models) ? body.models.map((model) => model?.name) : []
    return [...new Set(names.filter((name) => typeof name === 'string' && name))].sort()
  }
  const body = await request(joinUrl(settings.baseUrl, '/models'), { signal })
  const ids = Array.isArray(body?.data) ? body.data.map((model) => model?.id) : []
  return [...new Set(ids.filter((id) => typeof id === 'string' && id))].sort()
}

// 考える過程（<think>…</think>）やコードブロックの囲みが混じった応答からも JSON を取り出す
export function extractJson(text) {
  const cleaned = String(text ?? '')
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/```(?:json)?/g, '')
    .trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1))
      } catch {
        // 下で parse エラーにする
      }
    }
    throw llmError('parse')
  }
}

// 答えは少しずつ受け取る（stream）。CPU だけで動かすと数分かかることがあり、
// 全部できるまで応答が始まらないと途中の仕組みに待ちきれず切られるため。onText には受け取った分の全文を渡す
async function chatOllama(settings, messages, schema, signal, onText) {
  const res = await send(joinUrl(settings.baseUrl, '/api/chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model: settings.model,
      messages,
      stream: true,
      // JSON Schema を渡すと、その形の JSON だけを出力させられる（構造化出力）
      format: schema,
      options: { temperature: TEMPERATURE, num_ctx: OLLAMA_NUM_CTX },
    }),
  })
  let content = ''
  await readLines(res, (line) => {
    const chunk = parseLine(line)
    if (chunk?.error) throw llmError('http', res.status)
    content += chunk?.message?.content ?? ''
    onText(content)
  })
  return content
}

async function chatOpenAi(settings, messages, schema, signal, onText) {
  const post = (extra) =>
    send(joinUrl(settings.baseUrl, '/chat/completions'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({ model: settings.model, messages, temperature: TEMPERATURE, stream: true, ...extra }),
    })
  let res
  try {
    res = await post({ response_format: { type: 'json_schema', json_schema: { name: 'result', schema } } })
  } catch (err) {
    // 構造化出力に対応していないサーバーは 400 を返すので、指定を外して 1 回だけ送り直す
    if (err.kind !== 'http' || err.status !== 400) throw err
    res = await post({})
  }
  let content = ''
  await readLines(res, (line) => {
    if (!line.startsWith('data:')) return
    const data = line.slice('data:'.length).trim()
    if (data === '[DONE]') return
    content += parseLine(data)?.choices?.[0]?.delta?.content ?? ''
    onText(content)
  })
  return content
}

// messages を送り、schema の形の JSON を受け取って返す。onProgress には受け取った文字数を渡す（進み具合の表示用）
export async function chatJson(settings, { messages, schema }, { signal, onProgress } = {}) {
  if (!settings.model) throw llmError('config')
  const onText = (text) => onProgress?.(text.length)
  const content =
    settings.provider === 'ollama'
      ? await chatOllama(settings, messages, schema, signal, onText)
      : await chatOpenAi(settings, messages, schema, signal, onText)
  return extractJson(content)
}

export function llmErrorMessage(err, settings) {
  switch (err?.kind) {
    case 'network':
      return `ローカル LLM（${settings.baseUrl}）に接続できませんでした。LLM が起動しているか、このサイトからの接続を許可する設定（Ollama は OLLAMA_ORIGINS、LM Studio は CORS）をしたかを確認してください。`
    case 'notfound':
      return `モデル「${settings.model}」が見つかりません（接続先の URL が違う可能性もあります）。設定画面でモデルを選び直してください。`
    case 'config':
      return '設定画面でローカル LLM のモデルを選んでください。'
    case 'http':
      return `ローカル LLM がエラーを返しました（HTTP ${err.status}）。モデルが読み込めるか、LLM 側の画面やログを確認してください。`
    case 'parse':
      return 'LLM の応答を読み取れませんでした。もう一度試すか、より大きなモデルを選んでください。'
    case 'abort':
      return '中止しました。'
    default:
      return 'ローカル LLM への問い合わせに失敗しました。'
  }
}
