import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import SearchIcon from '@mui/icons-material/Search'
import MenuIcon from '@mui/icons-material/Menu'
import AppMenu from './AppMenu.jsx'
import { HEADER_HEIGHT, PAGES } from './navigation.js'
import { enterHistoryEntry, startScrollMemory } from './scrollMemory.js'
import WatchlistPage from './pages/WatchlistPage.jsx'
import RecordsPage from './pages/RecordsPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import RecommendPage from './pages/RecommendPage.jsx'
import { useRecords } from './records/useRecords.js'
import { clearToken, loadToken, storeToken } from './records/token.js'
import { useWatchlist } from './useWatchlist.js'
import { loadLlmSettings, normalizeLlmSettings, storeLlmSettings } from './llm/settings.js'

// ページは location.hash の 4 値だけなので、ルーターを入れずに hashchange で切り替える
function pageFromHash(hash) {
  return PAGES.find((page) => page.hash === hash)?.id ?? 'watchlist'
}

function useCurrentPage() {
  const [page, setPage] = useState(() => pageFromHash(window.location.hash))
  const pendingScroll = useRef(null)
  const restorePending = () => {
    if (pendingScroll.current === null) return
    window.scrollTo(0, pendingScroll.current)
    pendingScroll.current = null
  }
  useLayoutEffect(restorePending, [page])
  useEffect(() => {
    const stop = startScrollMemory()
    const onChange = () => {
      const saved = enterHistoryEntry()
      setPage(pageFromHash(window.location.hash))
      if (saved === null) {
        window.scrollTo(0, 0)
        return
      }
      // 戻る・進むのときは、新しいページを描いてから前に見ていた位置へ戻す
      pendingScroll.current = saved
      requestAnimationFrame(restorePending)
    }
    window.addEventListener('hashchange', onChange)
    return () => {
      stop()
      window.removeEventListener('hashchange', onChange)
    }
  }, [])
  return page
}

export default function App() {
  const page = useCurrentPage()
  const [menuOpen, setMenuOpen] = useState(false)
  const [token, setToken] = useState(loadToken)
  const records = useRecords(token)
  // ウォッチリストは一覧とおすすめ（候補）の両方で使うので、ここで 1 回だけ読み込む
  const watchlist = useWatchlist()
  const [llmSettings, setLlmSettings] = useState(loadLlmSettings)
  const searchRef = useRef(null)

  const saveToken = (value) => {
    if (!storeToken(value)) return false
    setToken(value)
    return true
  }

  const removeToken = () => {
    if (!clearToken()) return false
    setToken('')
    return true
  }

  const saveLlmSettings = (value) => {
    if (!storeLlmSettings(value)) return false
    setLlmSettings(normalizeLlmSettings(value))
    return true
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* 長い一覧の途中からもメニュー・検索へ行けるよう、見出しは画面の上に固定する（高さは HEADER_HEIGHT にそろえる） */}
      <AppBar position="sticky" color="header" elevation={0}>
        <Toolbar sx={{ width: '100%', maxWidth: 600, mx: 'auto', px: 2, gap: 0.5, minHeight: HEADER_HEIGHT }}>
          <IconButton
            color="inherit"
            edge="start"
            aria-label="メニューを開く"
            aria-haspopup="true"
            aria-expanded={menuOpen ? 'true' : undefined}
            onClick={() => setMenuOpen(true)}
          >
            <MenuIcon />
          </IconButton>
          <Typography
            variant="h6"
            component="h1"
            // ごく狭い画面でも見出しが 2 行になって固定の見出しの高さからはみ出さないよう、1 行に収めて省略する
            noWrap
            sx={{ flexGrow: 1, minWidth: 0, fontSize: { xs: 17, sm: 18 }, fontWeight: 700 }}
          >
            {page === 'watchlist' ? (
              <>
                <Box component="span" sx={{ fontWeight: 900 }}>
                  Filmarks
                </Box>{' '}
                ウォッチリスト
              </>
            ) : (
              PAGES.find((item) => item.id === page).label
            )}
          </Typography>
          {page === 'watchlist' && (
            <IconButton
              color="inherit"
              edge="end"
              aria-label="タイトル検索へ移動"
              onClick={() => searchRef.current?.focus()}
            >
              <SearchIcon />
            </IconButton>
          )}
        </Toolbar>
      </AppBar>

      <AppMenu open={menuOpen} onClose={() => setMenuOpen(false)} currentPage={page} />

      <Box component="main">
        {page === 'watchlist' && <WatchlistPage searchRef={searchRef} records={records} watchlist={watchlist} />}
        {page === 'records' && <RecordsPage records={records} />}
        {page === 'recommend' && <RecommendPage records={records} watchlist={watchlist} llmSettings={llmSettings} />}
        {page === 'settings' && (
          <SettingsPage
            token={token}
            onSaveToken={saveToken}
            onClearToken={removeToken}
            llmSettings={llmSettings}
            onSaveLlmSettings={saveLlmSettings}
          />
        )}
      </Box>
    </Box>
  )
}
