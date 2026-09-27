import { describe, expect, it } from 'vitest'
import { DEFAULT_LLM_SETTINGS, defaultBaseUrl, isValidBaseUrl, normalizeLlmSettings } from './settings.js'

describe('normalizeLlmSettings', () => {
  it('壊れた値は既定値（Ollama・localhost:11434）に倒す', () => {
    expect(normalizeLlmSettings(null)).toEqual(DEFAULT_LLM_SETTINGS)
    expect(normalizeLlmSettings({ provider: 'x', baseUrl: 1, model: 2 })).toEqual(DEFAULT_LLM_SETTINGS)
    expect(DEFAULT_LLM_SETTINGS.baseUrl).toBe('http://localhost:11434')
  })

  it('URL が空なら種類ごとの既定値にし、前後の空白を除く', () => {
    expect(normalizeLlmSettings({ provider: 'openai', baseUrl: ' ', model: ' m ' })).toEqual({
      provider: 'openai',
      baseUrl: defaultBaseUrl('openai'),
      model: 'm',
    })
  })
})

describe('isValidBaseUrl', () => {
  it('http と https の URL だけを受け付ける', () => {
    expect(isValidBaseUrl('http://localhost:11434')).toBe(true)
    expect(isValidBaseUrl('https://example.com/v1')).toBe(true)
    expect(isValidBaseUrl('localhost:11434')).toBe(false)
    expect(isValidBaseUrl('javascript:alert(1)')).toBe(false)
  })
})
