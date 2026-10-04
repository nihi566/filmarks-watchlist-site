import { useEffect, useState } from 'react'

// 要素の高さ（px）を追いかける。下に重なって出る通知の分だけ、ページの下の余白を広げるのに使う
// （通知の高さは画面幅や作品名の長さで変わるので決め打ちにしない）
export function useElementHeight(ref, active) {
  const [height, setHeight] = useState(0)
  useEffect(() => {
    const element = ref.current
    if (!active || !element) {
      setHeight(0)
      return undefined
    }
    const update = () => setHeight(element.getBoundingClientRect().height)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, active])
  return height
}
