import { describe, expect, it } from 'vitest'
import { matchesKeyword, normalizeForSearch } from './searchText.js'

describe('normalizeForSearch', () => {
  it('ひらがなをカタカナへ、半角カナを全角へ、全角英数を半角小文字へそろえる', () => {
    expect(normalizeForSearch('いんたー')).toBe('インター')
    expect(normalizeForSearch('ｲﾝﾀｰ')).toBe('インター')
    expect(normalizeForSearch('ＴＥＮＥＴ')).toBe('tenet')
    expect(normalizeForSearch('TeNeT')).toBe('tenet')
  })
})

describe('matchesKeyword', () => {
  it('表記の違いを無視して部分一致する', () => {
    const title = 'インターステラー'
    for (const keyword of ['インター', 'いんたー', 'ｲﾝﾀｰ', 'すてらー']) {
      expect(matchesKeyword(title, normalizeForSearch(keyword))).toBe(true)
    }
    expect(matchesKeyword('TENET テネット', normalizeForSearch('ｔｅｎｅｔ'))).toBe(true)
    expect(matchesKeyword('インターステラー', normalizeForSearch('てねっと'))).toBe(false)
  })
})
