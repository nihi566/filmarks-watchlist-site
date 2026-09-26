import { useCallback, useEffect, useState } from 'react'
import { fetchRecords, saveChange } from './github.js'

// 視聴記録の読み込み状態と保存関数を返す。読み込みに失敗してもウォッチリストの表示は止めない
export function useRecords(token) {
  const [state, setState] = useState({ status: 'loading', file: null, error: null })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    // トークンの変更や再試行が重なったとき、古いリクエストの結果で上書きしない
    let active = true
    setState((current) => ({ ...current, status: 'loading', error: null }))
    fetchRecords(token)
      .then((file) => {
        if (active) setState({ status: 'ready', file, error: null })
      })
      .catch((error) => {
        if (active) setState((current) => ({ ...current, status: 'error', error }))
      })
    return () => {
      active = false
    }
  }, [token, reloadKey])

  const reload = useCallback(() => setReloadKey((key) => key + 1), [])

  const save = useCallback(
    async (change) => {
      const file = await saveChange(token, change)
      setState({ status: 'ready', file, error: null })
      return file
    },
    [token],
  )

  return { ...state, reload, save, canWrite: Boolean(token) }
}
