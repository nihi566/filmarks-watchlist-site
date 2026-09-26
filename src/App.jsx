import { useRef } from 'react'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import SearchIcon from '@mui/icons-material/Search'
import WatchlistPage from './pages/WatchlistPage.jsx'

export default function App() {
  const searchRef = useRef(null)

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" color="header" elevation={0}>
        <Toolbar sx={{ width: '100%', maxWidth: 600, mx: 'auto', px: 2 }}>
          <Typography variant="h6" component="h1" sx={{ flexGrow: 1, fontSize: 18, fontWeight: 700 }}>
            <Box component="span" sx={{ fontWeight: 900 }}>
              Filmarks
            </Box>{' '}
            ウォッチリスト
          </Typography>
          <IconButton
            color="inherit"
            edge="end"
            aria-label="タイトル検索へ移動"
            onClick={() => searchRef.current?.focus()}
          >
            <SearchIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <WatchlistPage searchRef={searchRef} />
    </Box>
  )
}
