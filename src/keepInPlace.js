// 押した要素を、しばらく（開閉の動きが終わるまで）画面の同じ位置に留める。
// 例: 見たいリストは同時に開けるグループが 1 つなので、上で開いていた長いグループが閉じるとページが縮み、押した見出しが画面の上へ消える。
// 視聴記録の月の棒は、押すと上の月のまとめの高さが変わり、指の下から棒がずれる
const KEEP_IN_PLACE_MS = 1000

export function keepInPlace(element) {
  if (!element) return
  const startTop = element.getBoundingClientRect().top
  const startTime = performance.now()
  // ここで動かした位置。これと違う位置へのスクロール（利用者の操作やスクロールバー・プログラム）が起きたら、それ以上は動かさない
  let expectedY = window.scrollY
  let cancelled = false
  const cancel = () => {
    cancelled = true
  }
  const onScroll = () => {
    if (Math.abs(window.scrollY - expectedY) > 1) cancel()
  }
  const inputs = ['wheel', 'touchstart', 'keydown']
  inputs.forEach((type) => window.addEventListener(type, cancel, { passive: true }))
  window.addEventListener('scroll', onScroll, { passive: true })
  const stop = () => {
    inputs.forEach((type) => window.removeEventListener(type, cancel))
    window.removeEventListener('scroll', onScroll)
  }
  const step = (now) => {
    if (cancelled || !element.isConnected || now - startTime >= KEEP_IN_PLACE_MS) {
      stop()
      return
    }
    const delta = element.getBoundingClientRect().top - startTop
    if (Math.abs(delta) >= 1) window.scrollBy(0, delta)
    expectedY = window.scrollY
    requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}
