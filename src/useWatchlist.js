import { useCallback, useEffect, useState } from 'react'
import { fetchWatchlist, loadErrorMessage } from './watchlist.js'

// ウォッチリストの読み込み状態。data は取得できた watchlist.json（正規化済み）、error は画面に出す日本語
export function useWatchlist() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    // 再試行を連打したとき、古いリクエストの結果で新しい状態を上書きしない
    let active = true
    fetchWatchlist()
      .then((normalized) => {
        if (active) setData(normalized)
      })
      .catch((err) => {
        if (active) setError(loadErrorMessage(err))
      })
    return () => {
      active = false
    }
  }, [reloadKey])

  const retry = useCallback(() => {
    setError(null)
    setReloadKey((key) => key + 1)
  }, [])

  return { data, error, retry }
}
