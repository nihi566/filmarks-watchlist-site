// 押した要素を、しばらく（開閉の動きが終わるまで）画面の同じ位置に留める。
// 例: 見たいリストは同時に開けるグループが 1 つなので、上で開いていた長いグループが閉じるとページが縮み、押した見出しが画面の上へ消える。
// 視聴記録の月の棒は、押すと上の月のまとめの高さが変わり、指の下から棒がずれる。
//
// ふだんは要素の画面上の位置を保つ（ページ末尾でブラウザがスクロール位置を詰めた分も含めて戻す）。
// 利用者がスクロールしている間は、その移動は生かし、要素のページ内の位置の変化（上の内容が縮んだ・伸びた分）だけを打ち消す
const KEEP_IN_PLACE_MS = 1000
// 入力の後、慣性・スムーズスクロールが続く間も利用者のスクロールとみなす
const USER_SCROLL_MS = 200

export function keepInPlace(element) {
  if (!element) return
  let anchorTop = element.getBoundingClientRect().top
  let lastPageTop = anchorTop + window.scrollY
  let userActiveUntil = 0
  // ここで最後に合わせたスクロール位置。これと違うのに、ページ末尾の詰め（ブラウザが縮んだページに合わせて戻す）でもない
  // スクロールは、利用者やプログラムによる移動として生かす
  let expectedY = window.scrollY
  const startTime = performance.now()

  const onInput = () => {
    userActiveUntil = performance.now() + USER_SCROLL_MS
  }
  const onScroll = () => {
    const atBottom = window.scrollY >= document.documentElement.scrollHeight - window.innerHeight - 1
    if (performance.now() < userActiveUntil || (!atBottom && Math.abs(window.scrollY - expectedY) > 1)) onInput()
  }
  // ブラウザ自身のずれの補正（scroll anchoring）と二重にならないよう、留めている間は止める
  const root = document.documentElement
  const previousAnchor = root.style.overflowAnchor
  root.style.overflowAnchor = 'none'
  const inputs = ['wheel', 'touchmove', 'keydown', 'pointerdown']
  inputs.forEach((type) => window.addEventListener(type, onInput, { passive: true }))
  window.addEventListener('scroll', onScroll, { passive: true })

  const step = (now) => {
    if (!element.isConnected || now - startTime >= KEEP_IN_PLACE_MS) {
      inputs.forEach((type) => window.removeEventListener(type, onInput))
      window.removeEventListener('scroll', onScroll)
      root.style.overflowAnchor = previousAnchor
      return
    }
    const top = element.getBoundingClientRect().top
    if (now < userActiveUntil) {
      const shift = top + window.scrollY - lastPageTop
      if (Math.abs(shift) >= 1) window.scrollBy(0, shift)
      anchorTop = element.getBoundingClientRect().top
    } else {
      const delta = top - anchorTop
      if (Math.abs(delta) >= 1) window.scrollBy(0, delta)
    }
    lastPageTop = element.getBoundingClientRect().top + window.scrollY
    expectedY = window.scrollY
    requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}
