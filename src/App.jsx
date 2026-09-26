import { useEffect, useRef, useState } from 'react'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import SearchIcon from '@mui/icons-material/Search'
import MenuIcon from '@mui/icons-material/Menu'
import AppMenu from './AppMenu.jsx'
import { PAGES } from './navigation.js'
import WatchlistPage from './pages/WatchlistPage.jsx'
import RecordsPage from './pages/RecordsPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import { useRecords } from './records/useRecords.js'
import { clearToken, loadToken, storeToken } from './records/token.js'

// ページは location.hash の 3 値だけなので、ルーターを入れずに hashchange で切り替える
function pageFromHash(hash) {
  return PAGES.find((page) => page.hash === hash)?.id ?? 'watchlist'
}

function useCurrentPage() {
  const [page, setPage] = useState(() => pageFromHash(window.location.hash))
  useEffect(() => {
    const onChange = () => {
      setPage(pageFromHash(window.location.hash))
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return page
}

export default function App() {
  const page = useCurrentPage()
  const [menuOpen, setMenuOpen] = useState(false)
  const [token, setToken] = useState(loadToken)
  const records = useRecords(token)
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

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" color="header" elevation={0}>
        <Toolbar sx={{ width: '100%', maxWidth: 600, mx: 'auto', px: 2, gap: 0.5 }}>
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
          <Typography variant="h6" component="h1" sx={{ flexGrow: 1, fontSize: 18, fontWeight: 700 }}>
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

      {page === 'watchlist' && <WatchlistPage searchRef={searchRef} records={records} />}
      {page === 'records' && <RecordsPage records={records} />}
      {page === 'settings' && <SettingsPage token={token} onSaveToken={saveToken} onClearToken={removeToken} />}
    </Box>
  )
}
