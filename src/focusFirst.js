// 押した行が一覧から消えるとフォーカスが body（ページ先頭）へ落ちるので、近くの要素へ移すために使う。
// 候補（CSS セレクタ。空の候補は飛ばす）を先頭から試し、画面にあって押せる最初の要素へフォーカスする
export function focusFirst(selectors) {
  for (const selector of selectors) {
    const element = selector ? document.querySelector(selector) : null
    if (element && !element.disabled) {
      element.focus()
      return true
    }
  }
  return false
}
