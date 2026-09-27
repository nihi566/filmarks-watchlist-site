// ローカル LLM の接続設定。GitHub トークンと同じく、この端末のブラウザ（localStorage）にだけ保存する。
// provider は API の形: Ollama 独自の API か、OpenAI 互換 API（LM Studio・llama.cpp など）か。
const SETTINGS_KEY = 'filmarks-watchlist.llm-settings'

export const PROVIDERS = [
  { value: 'ollama', label: 'Ollama', defaultBaseUrl: 'http://localhost:11434' },
  { value: 'openai', label: 'OpenAI 互換（LM Studio など）', defaultBaseUrl: 'http://localhost:1234/v1' },
]

export function defaultBaseUrl(provider) {
  return PROVIDERS.find((item) => item.value === provider)?.defaultBaseUrl ?? PROVIDERS[0].defaultBaseUrl
}

export const DEFAULT_LLM_SETTINGS = { provider: 'ollama', baseUrl: defaultBaseUrl('ollama'), model: '' }

// 壊れた値・古い形の値が入っていても既定値に倒す
export function normalizeLlmSettings(value) {
  const provider = PROVIDERS.some((item) => item.value === value?.provider) ? value.provider : DEFAULT_LLM_SETTINGS.provider
  const baseUrl = typeof value?.baseUrl === 'string' && value.baseUrl.trim() ? value.baseUrl.trim() : defaultBaseUrl(provider)
  const model = typeof value?.model === 'string' ? value.model.trim() : ''
  return { provider, baseUrl, model }
}

export function isValidBaseUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function loadLlmSettings() {
  try {
    return normalizeLlmSettings(JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? 'null'))
  } catch {
    return DEFAULT_LLM_SETTINGS
  }
}

// 保存できたかを返す（呼び出し側が失敗を画面に出す）
export function storeLlmSettings(settings) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalizeLlmSettings(settings)))
    return true
  } catch {
    return false
  }
}
