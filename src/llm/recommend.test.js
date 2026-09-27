import { describe, expect, it } from 'vitest'
import { buildRecommendationRequest, normalizeTitle, parseRecommendations, pickCandidates } from './recommend.js'

const records = {
  1: { title: 'インターステラー', watched_on: '2026-09-20', rating: 5, kind: 'foreign' },
  2: { title: '葬送のフリーレン', watched_on: '2026-09-25', rating: 4, kind: 'anime', episodes: 28 },
  3: { title: 'シン・ゴジラ', watched_on: '2026-09-01', rating: 2, kind: 'japanese' },
  4: { title: '古い記録', watched_on: '2026-08-01', rating: null, kind: null },
  5: { title: 'ふつうの映画', watched_on: '2026-08-02', rating: 3, kind: 'japanese' },
}

const movies = [
  { movie_id: '10', title: 'TENET テネット', clip_order: 5, runtime_min: 150, services: ['U-NEXT'] },
  { movie_id: '11', title: 'ブックスマート 卒業前夜のパーティーデビュー', clip_order: 1, runtime_min: 102, services: [] },
  { movie_id: '1', title: 'インターステラー', clip_order: 0, services: [] },
  { movie_id: '12', title: 'インターステラー', clip_order: 3, services: [] },
  { movie_id: '13', title: '運び屋', services: ['Netflix'] },
]

describe('pickCandidates', () => {
  it('見た作品（ID・同じタイトル）を除き、新しくクリップした順に並べる', () => {
    expect(pickCandidates(movies, records).map((movie) => movie.movie_id)).toEqual(['11', '10', '13'])
  })

  it('記録が無ければすべて候補にする', () => {
    expect(pickCandidates(movies, null)).toHaveLength(5)
  })
})

describe('buildRecommendationRequest', () => {
  it('評価ごとに視聴記録を分け、アニメは話数も書く', () => {
    const { messages } = buildRecommendationRequest({ records, candidates: [], mode: 'any' })
    const text = messages[1].content
    expect(messages[0].role).toBe('system')
    expect(text).toContain('## 高評価（★4〜5）')
    // 新しい順
    expect(text.indexOf('葬送のフリーレン')).toBeLessThan(text.indexOf('インターステラー'))
    expect(text).toContain('- 葬送のフリーレン（アニメ・28話） ★4（面白かった）')
    expect(text).toContain('- インターステラー（洋画） ★5（最高）')
    expect(text).toContain('## 低評価（★1〜2）')
    expect(text).toContain('- シン・ゴジラ（邦画） ★2（いまいち）')
    expect(text).toContain('## ふつう（★3）')
    expect(text).toContain('## 評価なし')
    expect(text).toContain('- 古い記録\n')
  })

  it('ウォッチリストから選ぶときは番号付きの候補と上映時間を渡し、出力に id を求める', () => {
    const candidates = pickCandidates(movies, records)
    const { messages, schema } = buildRecommendationRequest({ records, candidates, mode: 'watchlist', count: 3 })
    const text = messages[1].content
    expect(text).toContain('1: ブックスマート 卒業前夜のパーティーデビュー（102分）')
    expect(text).toContain('3: 運び屋\n')
    expect(text).toContain('最大 3 作品')
    const item = schema.properties.recommendations.items
    expect(item.required).toEqual(['id', 'title', 'kind', 'reason'])
    expect(item.properties.kind.enum).toEqual(['anime', 'japanese', 'foreign'])
    expect(schema.properties.recommendations.maxItems).toBe(3)
  })

  it('新しい作品を挙げてもらうときは候補を渡さず、id を求めない', () => {
    const { messages, schema } = buildRecommendationRequest({ records, mode: 'any' })
    expect(messages[1].content).not.toContain('# 候補')
    expect(schema.properties.recommendations.items.required).toEqual(['title', 'kind', 'reason'])
  })

  it('種類の指定と今日の希望を伝える', () => {
    const anime = buildRecommendationRequest({ records, mode: 'any', kind: 'anime', wish: '  短めのもの  ' }).messages[1].content
    expect(anime).toContain('アニメ作品だけを選んでください')
    expect(anime).toContain('1クール12話')
    expect(anime).toContain('# 今日の希望\n短めのもの')
    const foreign = buildRecommendationRequest({ records, mode: 'any', kind: 'foreign' }).messages[1].content
    expect(foreign).toContain('洋画（海外の実写映画）だけ')
    expect(foreign).not.toContain('1クール12話')
    expect(foreign).not.toContain('# 今日の希望')
  })

  it('記録が無くても組み立てられる', () => {
    const text = buildRecommendationRequest({ records: {}, mode: 'any' }).messages[1].content
    expect(text).toContain('まだ視聴記録がありません')
  })
})

describe('parseRecommendations', () => {
  const candidates = pickCandidates(movies, records)

  it('番号で候補の作品に結び付け、候補の正式なタイトルを使う', () => {
    const results = parseRecommendations(
      { recommendations: [{ id: 2, title: 'TENET', kind: 'foreign', reason: '時間もの' }] },
      { mode: 'watchlist', candidates, records },
    )
    expect(results).toEqual([{ title: 'TENET テネット', kind: 'foreign', reason: '時間もの', movie: candidates[1] }])
  })

  it('番号が違ってもタイトルが候補と一致すればその作品にする', () => {
    const results = parseRecommendations(
      { recommendations: [{ id: 99, title: '運び屋', kind: 'foreign', reason: 'x' }] },
      { mode: 'watchlist', candidates, records },
    )
    expect(results.map((item) => item.movie.movie_id)).toEqual(['13'])
  })

  it('番号とタイトルが食い違う回答・候補に無い回答は捨てる', () => {
    const results = parseRecommendations(
      {
        recommendations: [
          { id: 1, title: '葬送のフリーレン', kind: 'anime', reason: '見た作品の話' },
          { id: 42, title: '存在しない映画', kind: 'foreign', reason: 'x' },
        ],
      },
      { mode: 'watchlist', candidates, records },
    )
    expect(results).toEqual([])
  })

  it('見た作品・重複・頼んだ種類と違う作品を除き、件数を上限までにする', () => {
    const results = parseRecommendations(
      {
        recommendations: [
          { title: 'インターステラー', kind: 'foreign', reason: '見た' },
          { title: 'ぼっち・ざ・ろっく！', kind: 'anime', reason: '1クール12話' },
          { title: 'ぼっち ざ ろっく!', kind: 'anime', reason: '重複' },
          { title: 'ラ・ラ・ランド', kind: 'foreign', reason: '種類違い' },
          { title: '', kind: 'anime', reason: '空' },
          { title: 'リコリス・リコイル', kind: 'anime', reason: 'b' },
          { title: '薬屋のひとりごと', kind: 'anime', reason: 'c' },
        ],
      },
      { mode: 'any', records, kind: 'anime', count: 2 },
    )
    expect(results.map((item) => item.title)).toEqual(['ぼっち・ざ・ろっく！', 'リコリス・リコイル'])
    expect(results[0].movie).toBeNull()
  })

  it('形が違う応答でも例外にせず空にする', () => {
    expect(parseRecommendations(null, { mode: 'any', records })).toEqual([])
    expect(parseRecommendations({ recommendations: 'x' }, { mode: 'any', records })).toEqual([])
    expect(parseRecommendations({ recommendations: [null, 1] }, { mode: 'watchlist', candidates, records })).toEqual([])
  })
})

describe('normalizeTitle', () => {
  it('全角半角・空白・記号の違いを無視する', () => {
    expect(normalizeTitle('ＴＥＮＥＴ　テネット')).toBe(normalizeTitle('tenet テネット'))
    expect(normalizeTitle('ぼっち・ざ・ろっく！')).toBe(normalizeTitle('ぼっち ざ ろっく!'))
  })
})
