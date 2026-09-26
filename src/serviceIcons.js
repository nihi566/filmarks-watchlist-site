// 配信サービス名（watchlist.json の tabs[].name）→ public/service-icons/ のアイコン画像。
// 名前が変わった・新しいサービスが増えた場合は null になり、呼び出し側が頭文字表示に倒す
const ICON_FILES = {
  'U-NEXT': 'unext.png',
  'Prime Video': 'prime-video.png',
  Hulu: 'hulu.png',
  Netflix: 'netflix.png',
  'WOWOWオンデマンド': 'wowow.png',
  'DMM TV': 'dmm-tv.png',
  'J:COM STREAM': 'jcom-stream.png',
  FOD: 'fod.png',
  Lemino: 'lemino.jpg',
  'ディズニープラス': 'disney-plus.png',
  ABEMA: 'abema.png',
  TELASA: 'telasa.png',
}

export function serviceIconUrl(name) {
  const file = ICON_FILES[name]
  return file ? `${import.meta.env.BASE_URL}service-icons/${file}` : null
}
