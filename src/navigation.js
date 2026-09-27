import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted'
import EventNoteIcon from '@mui/icons-material/EventNote'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import SettingsIcon from '@mui/icons-material/Settings'

// ハンバーガーメニューの項目。hash がそのままページの URL になる
export const PAGES = [
  { id: 'watchlist', hash: '#/', label: 'ウォッチリスト', Icon: FormatListBulletedIcon },
  { id: 'records', hash: '#/records', label: '視聴記録', Icon: EventNoteIcon },
  { id: 'recommend', hash: '#/recommend', label: 'おすすめ', Icon: AutoAwesomeIcon },
  { id: 'settings', hash: '#/settings', label: '設定', Icon: SettingsIcon },
]
