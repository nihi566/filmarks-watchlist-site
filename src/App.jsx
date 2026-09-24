import { useEffect, useMemo, useState } from 'react'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Chip from '@mui/material/Chip'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { visuallyHidden } from '@mui/utils'

const ALL = '__all__'

function loadError(kind, status) {
  return Object.assign(new Error(kind), { kind, status })
}

// watchlist.json はこのリポジトリ外（scraper）が生成するため、形が想定外でも
// 一覧描画（tabs.reduce / movie.title.localeCompare 等）が例外を投げて白画面に
// ならないよう、取得直後の境界で構造を検証し title を文字列へ正規化する
function normalizeWatchlist(json) {
  if (!json || !Array.isArray(json.tabs)) throw loadError('parse')
  return {
    ...json,
    tabs: json.tabs.map((tab) => ({
      ...tab,
      movies: Array.isArray(tab.movies)
        ? tab.movies.map((movie) => ({ ...movie, title: String(movie?.title ?? '') }))
        : [],
    })),
  }
}

// 例外の英語メッセージは画面に出さず、失敗の段階ごとに決めた日本語だけを表示する
function loadErrorMessage(err) {
  switch (err.kind) {
    case 'http':
      return `ウォッチリストを取得できませんでした（HTTP ${err.status}）。時間をおいて再試行してください。`
    case 'network':
      return 'サーバーに接続できませんでした。インターネット接続を確認して再試行してください。'
    case 'parse':
      return 'ウォッチリストのデータを読み取れませんでした。時間をおいて再試行してください。'
    default:
      return 'ウォッチリストを読み込めませんでした。時間をおいて再試行してください。'
  }
}

// 複数サービスに重複して載っている作品を movie_id で 1 件にまとめ、観られるサービス名を集める
function buildUniqueMovies(tabs) {
  const byId = tabs.reduce((acc, tab) => {
    tab.movies.forEach((movie) => {
      const found = acc.get(movie.movie_id)
      acc.set(movie.movie_id, {
        movie_id: movie.movie_id,
        title: found?.title ?? movie.title,
        services: [...(found?.services ?? []), tab.name],
      })
    })
    return acc
  }, new Map())
  return [...byId.values()].sort((a, b) => a.title.localeCompare(b.title, 'ja'))
}

function ServiceFilter({ options, selected, onSelect }) {
  return (
    <Box
      role="group"
      aria-label="配信サービスで絞り込み"
      sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}
    >
      {options.map((option) => {
        const isSelected = option.value === selected
        return (
          <Chip
            key={option.value}
            label={`${option.label} ${option.count}`}
            clickable
            onClick={() => onSelect(option.value)}
            color={isSelected ? 'primary' : 'default'}
            variant={isSelected ? 'filled' : 'outlined'}
            aria-pressed={isSelected}
          />
        )
      })}
    </Box>
  )
}

function MovieList({ movies, showServices, emptyMessage }) {
  if (movies.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">{emptyMessage}</Typography>
      </Box>
    )
  }

  return (
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
          <ListItemText
            primary={
              <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box component="span">{movie.title}</Box>
                <OpenInNewIcon
                  aria-hidden="true"
                  sx={{ fontSize: '1em', color: 'text.secondary', flexShrink: 0 }}
                />
                <Box component="span" sx={visuallyHidden}>
                  （新しいタブで開きます）
                </Box>
              </Box>
            }
            secondary={
              showServices ? (
                <Box component="span" sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                  {movie.services.map((service) => (
                    <Chip key={service} component="span" size="small" variant="outlined" label={service} />
                  ))}
                </Box>
              ) : null
            }
            slotProps={{ secondary: { component: 'div' } }}
          />
        </ListItemButton>
      ))}
    </List>
  )
}

export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(ALL)
  const [query, setQuery] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    // 再試行を連打したとき、古いリクエストの結果で新しい状態を上書きしない
    let active = true
    fetch(`${import.meta.env.BASE_URL}watchlist.json`, { cache: 'no-cache' })
      .catch(() => {
        throw loadError('network')
      })
      .then((res) => {
        if (!res.ok) throw loadError('http', res.status)
        return res.json().catch(() => {
          throw loadError('parse')
        })
      })
      .then((json) => normalizeWatchlist(json))
      .then((normalized) => {
        if (active) setData(normalized)
      })
      .catch((err) => {
        if (active) setError(loadErrorMessage(err))
      })
    return () => {
      active = false
    }
  }, [reloadKey])

  const retry = () => {
    setError(null)
    setReloadKey((key) => key + 1)
  }

  const uniqueMovies = useMemo(() => (data ? buildUniqueMovies(data.tabs) : []), [data])

  const options = useMemo(() => {
    if (!data) return []
    return [
      { value: ALL, label: 'すべて', count: uniqueMovies.length },
      ...data.tabs.map((tab) => ({ value: tab.name, label: tab.name, count: tab.movies.length })),
    ]
  }, [data, uniqueMovies])

  const isAll = selected === ALL
  const selectedLabel = isAll ? 'すべて' : selected
  const keyword = query.trim()

  const visibleMovies = useMemo(() => {
    if (!data) return []
    const base = isAll ? uniqueMovies : (data.tabs.find((tab) => tab.name === selected)?.movies ?? [])
    if (!keyword) return base
    const needle = keyword.toLowerCase()
    return base.filter((movie) => movie.title.toLowerCase().includes(needle))
  }, [data, uniqueMovies, isAll, selected, keyword])

  const heading = keyword
    ? `${selectedLabel}から「${keyword}」を検索 ${visibleMovies.length}件`
    : `${selectedLabel} ${visibleMovies.length}件`
  const emptyMessage = keyword
    ? `「${keyword}」に一致する作品はありません`
    : 'このサービスに作品はありません'

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
        {error && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={retry}>
                再試行
              </Button>
            }
          >
            {error}
          </Alert>
        )}

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

            <TextField
              type="search"
              label="タイトルで検索"
              size="small"
              fullWidth
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              sx={{ mb: 2, bgcolor: 'background.paper' }}
            />

            <ServiceFilter options={options} selected={selected} onSelect={setSelected} />

            <Paper variant="outlined">
              <Typography
                component="h2"
                variant="subtitle1"
                aria-live="polite"
                sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
              >
                {heading}
              </Typography>
              <MovieList movies={visibleMovies} showServices={isAll} emptyMessage={emptyMessage} />
            </Paper>
          </>
        )}
      </Container>
    </Box>
  )
}
