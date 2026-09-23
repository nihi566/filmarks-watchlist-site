import { useEffect, useMemo, useState } from 'react'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Chip from '@mui/material/Chip'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Paper from '@mui/material/Paper'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'

function tabPanelId(index) {
  return `watchlist-tabpanel-${index}`
}

function tabId(index) {
  return `watchlist-tab-${index}`
}

function MovieList({ movies, tabIndex }) {
  const content =
    movies.length === 0 ? (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">このタブに作品はありません</Typography>
      </Box>
    ) : (
      <List disablePadding>
        {movies.map((movie) => (
          <ListItemButton
            key={movie.movie_id}
            component="a"
            href={`https://filmarks.com/movies/${movie.movie_id}`}
            target="_blank"
            rel="noopener"
            divider
          >
            <ListItemText primary={movie.title} />
          </ListItemButton>
        ))}
      </List>
    )

  return (
    <Box role="tabpanel" id={tabPanelId(tabIndex)} aria-labelledby={tabId(tabIndex)}>
      {content}
    </Box>
  )
}

export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState(0)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}watchlist.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`データの取得に失敗しました (HTTP ${res.status})`)
        return res.json()
      })
      .then(setData)
      .catch((err) => setError(err.message))
  }, [])

  const activeMovies = useMemo(() => {
    if (!data) return []
    return data.tabs[activeTab]?.movies ?? []
  }, [data, activeTab])

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100' }}>
      <AppBar position="static" color="primary" enableColorOnDark>
        <Toolbar>
          <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
            Filmarks ウォッチリスト
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: 3 }}>
        {error && <Alert severity="error">{error}</Alert>}

        {!data && !error && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress aria-label="ウォッチリストを読み込み中" />
          </Box>
        )}

        {data && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              最終更新: {data.generated_at}
            </Typography>

            <Paper variant="outlined">
              <Tabs
                value={activeTab}
                onChange={(_, value) => setActiveTab(value)}
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
              >
                {data.tabs.map((tab, index) => (
                  <Tab
                    key={tab.name}
                    id={tabId(index)}
                    aria-controls={tabPanelId(index)}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {tab.name}
                        <Chip
                          size="small"
                          label={tab.movies.length}
                          color={activeTab === index ? 'primary' : 'default'}
                        />
                      </Box>
                    }
                  />
                ))}
              </Tabs>

              <MovieList movies={activeMovies} tabIndex={activeTab} />
            </Paper>
          </>
        )}
      </Container>
    </Box>
  )
}
