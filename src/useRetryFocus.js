import { useCallback, useEffect, useRef } from 'react'

// 「再試行」を押すと読み込み中は Alert ごとボタンが消え、フォーカスが body（ページ先頭）へ落ちる。
// 結果が出たら、また失敗していれば新しい Alert の「再試行」へ、成功していれば onSucceeded で決めた場所へ戻す。
// status は 'loading' / 'error' / それ以外（成功）。buttonRef は「再試行」ボタンに付ける
export function useRetryFocus(status, onSucceeded) {
  const pending = useRef(false)
  const buttonRef = useRef(null)
  const succeeded = useRef(onSucceeded)

  useEffect(() => {
    succeeded.current = onSucceeded
  })

  useEffect(() => {
    if (!pending.current || status === 'loading') return
    pending.current = false
    if (status === 'error') buttonRef.current?.focus()
    else succeeded.current?.()
  }, [status])

  const wrapRetry = useCallback(
    (retry) => () => {
      pending.current = true
      retry()
    },
    [],
  )

  return { buttonRef, wrapRetry }
}
