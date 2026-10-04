// 押した要素を、しばらく（開閉の動きが終わるまで）画面の同じ位置に留める。
// 例: 見たいリストは同時に開けるグループが 1 つなので、上で開いていた長いグループが閉じるとページが縮み、押した見出しが画面の上へ消える。
// 視聴記録の月の棒は、押すと上の月のまとめの高さが変わり、指の下から棒がずれる。
// 打ち消すのは要素のページ内の位置の変化（上の内容が縮んだ・伸びた分）だけで、利用者自身のスクロールはそのまま生かす
const KEEP_IN_PLACE_MS = 1000

function pageTop(element) {
  return element.getBoundingClientRect().top + window.scrollY
}

export function keepInPlace(element) {
  if (!element) return
  let lastPageTop = pageTop(element)
  const startTime = performance.now()
  const step = (now) => {
    if (!element.isConnected || now - startTime >= KEEP_IN_PLACE_MS) return
    const current = pageTop(element)
    const shift = current - lastPageTop
    if (Math.abs(shift) >= 1) window.scrollBy(0, shift)
    lastPageTop = current
    requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}
