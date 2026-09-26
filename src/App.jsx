import { useEffect, useMemo, useRef, useState } from 'react'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import Avatar from '@mui/material/Avatar'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import SearchIcon from '@mui/icons-material/Search'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import CheckIcon from '@mui/icons-material/Check'
import MovieIcon from '@mui/icons-material/Movie'
import BlockIcon from '@mui/icons-material/Block'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { visuallyHidden } from '@mui/utils'
import { serviceIconUrl } from './serviceIcons.js'

const UNAVAILABLE = '未配信'
const INITIAL_GROUPS = 12
const INITIAL_MOVIES = 4
const SORTS = [
  { value: 'count', label: '作品数の多い順' },
  { value: 'name', label: 'サービス名順' },
]

function loadError(kind, status) {
  return Object.assign(new Error(kind), { kind, status })
}

// サムネ URL は外部（scraper）由来なので https の URL だけを採用し、それ以外は代替表示に倒す
function safeImageUrl(value) {
  return typeof value === 'string' && value.startsWith('https://') ? value : ''
}

// watchlist.json はこのリポジトリ外（scraper）が生成するため、形が想定外でも
// 一覧描画（localeCompare / toLowerCase 等）が例外を投げて白画面に
// ならないよう、取得直後の境界で構造を検証し title を文字列へ正規化する
function normalizeWatchlist(json) {
  if (!json || !Array.isArray(json.tabs)) throw loadError('parse')
  return {
    ...json,
    tabs: json.tabs.map((tab) => ({
      ...tab,
      name: String(tab?.name ?? ''),
      movies: Array.isArray(tab?.movies)
        ? tab.movies.map((movie) => ({
            ...movie,
            title: String(movie?.title ?? ''),
            image: safeImageUrl(movie?.image),
          }))
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

// 複数サービスに重複して載っている作品は 1 件と数える（「すべて」の件数）
function countUniqueMovies(tabs) {
  return new Set(tabs.flatMap((tab) => tab.movies.map((movie) => movie.movie_id))).size
}

// 未配信はどの並び順でも常に最後に置く
function sortGroups(tabs, sortKey) {
  const compare =
    sortKey === 'name'
      ? (a, b) => a.name.localeCompare(b.name, 'ja')
      : (a, b) => b.movies.length - a.movies.length || a.name.localeCompare(b.name, 'ja')
  return [...tabs].sort((a, b) => {
    const unavailableOrder = (a.name === UNAVAILABLE) - (b.name === UNAVAILABLE)
    return unavailableOrder || compare(a, b)
  })
}

function matchesKeyword(title, needle) {
  return title.toLowerCase().includes(needle)
}

function toggled(set, name) {
  const next = new Set(set)
  if (next.has(name)) next.delete(name)
  else next.add(name)
  return next
}

function ServiceIcon({ name, size }) {
  const sx = { width: size, height: size, borderRadius: '6px', border: 1, borderColor: 'divider' }
  if (name === UNAVAILABLE) {
    return (
      <Avatar variant="rounded" sx={{ ...sx, bgcolor: 'grey.200', color: 'text.secondary' }}>
        <BlockIcon sx={{ fontSize: size * 0.6 }} />
      </Avatar>
    )
  }
  // 画像が無い・読めないときは頭文字を出す（Avatar は src の読み込み失敗時に children を表示する）
  return (
    <Avatar
      variant="rounded"
      src={serviceIconUrl(name) ?? undefined}
      alt=""
      sx={{ ...sx, bgcolor: 'grey.500', fontSize: size * 0.5 }}
    >
      {name.slice(0, 1)}
    </Avatar>
  )
}

function Thumbnail({ src }) {
  const [failed, setFailed] = useState(false)
  const sx = { width: 30, height: 40, borderRadius: 1, flexShrink: 0 }
  if (!src || failed) {
    return (
      <Box
        sx={{ ...sx, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'grey.200', color: 'grey.500' }}
      >
        <MovieIcon fontSize="small" />
      </Box>
    )
  }
  return (
    <Box
      component="img"
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      sx={{ ...sx, objectFit: 'cover', bgcolor: 'grey.200' }}
    />
  )
}

function MovieRow({ movie }) {
  return (
    <ListItemButton
      component="a"
      href={`https://filmarks.com/movies/${movie.movie_id}`}
      target="_blank"
      rel="noopener"
      sx={{ gap: 1.5, py: 0.5, px: 2 }}
    >
      <Thumbnail src={movie.image} />
      <Typography
        variant="body2"
        sx={{
          flexGrow: 1,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {movie.title}
      </Typography>
      <OpenInNewIcon aria-hidden="true" sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
      <Box component="span" sx={visuallyHidden}>
        （新しいタブで開きます）
      </Box>
    </ListItemButton>
  )
}

function MoreButton({ onClick, hiddenLabel }) {
  return (
    <Button size="small" onClick={onClick} endIcon={<MoreHorizIcon />} sx={{ ml: 1, fontWeight: 700 }}>
      もっと見る
      <Box component="span" sx={visuallyHidden}>
        {hiddenLabel}
      </Box>
    </Button>
  )
}

function ServiceGroup({ group, expanded, onToggle, showAll, onShowAll, isFirst }) {
  const movies = showAll ? group.movies : group.movies.slice(0, INITIAL_MOVIES)
  const rest = group.movies.length - movies.length
  return (
    <Accordion
      disableGutters
      square
      elevation={0}
      expanded={expanded}
      onChange={onToggle}
      slotProps={{ transition: { unmountOnExit: true } }}
      sx={{
        bgcolor: 'background.paper',
        borderTop: isFirst ? 0 : 1,
        borderColor: 'divider',
        '&::before': { display: 'none' },
        // 開いているグループだけを独立した角丸カードとして浮かせ、閉じた行と主従を付ける
        '&.Mui-expanded': { m: 1, border: 1, borderColor: 'divider', borderRadius: 3, boxShadow: 1 },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{ minHeight: 56, px: 2, '& .MuiAccordionSummary-content': { alignItems: 'center', gap: 1.5, my: 1 } }}
      >
        <ServiceIcon name={group.name} size={28} />
        <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{group.name}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>
          {group.movies.length}件
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 0, pb: 1 }}>
        <List disablePadding>
          {movies.map((movie) => (
            <MovieRow key={movie.movie_id} movie={movie} />
          ))}
        </List>
        {rest > 0 && <MoreButton onClick={onShowAll} hiddenLabel={`（${group.name}の残り${rest}件）`} />}
      </AccordionDetails>
    </Accordion>
  )
}

function FilterButton({ selected, children, ...props }) {
  return (
    <Button
      size="small"
      variant={selected ? 'contained' : 'outlined'}
      disableElevation
      sx={{
        borderRadius: 999,
        px: 1.75,
        height: 32,
        fontWeight: 700,
        ...(selected ? {} : { bgcolor: 'background.paper', color: 'text.primary', borderColor: 'divider' }),
      }}
      {...props}
    >
      {children}
    </Button>
  )
}

export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [query, setQuery] = useState('')
  const [serviceFilter, setServiceFilter] = useState(null)
  const [sortKey, setSortKey] = useState('count')
  const [expanded, setExpanded] = useState(new Set())
  // 検索中は一致したグループを既定で開き、利用者が閉じたものだけを覚える
  const [collapsedInSearch, setCollapsedInSearch] = useState(new Set())
  const [showAllMovies, setShowAllMovies] = useState(new Set())
  const [showAllGroups, setShowAllGroups] = useState(false)
  const [serviceMenuAnchor, setServiceMenuAnchor] = useState(null)
  const [sortMenuAnchor, setSortMenuAnchor] = useState(null)
  const searchRef = useRef(null)

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
        if (!active) return
        setData(normalized)
        // 初期表示は作品数が最も多いグループだけを開く
        const first = sortGroups(normalized.tabs, 'count')[0]
        setExpanded(new Set(first ? [first.name] : []))
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

  const keyword = query.trim()
  const needle = keyword.toLowerCase()
  const searching = needle !== ''

  const uniqueCount = useMemo(() => (data ? countUniqueMovies(data.tabs) : 0), [data])
  const allGroups = useMemo(() => (data ? sortGroups(data.tabs, sortKey) : []), [data, sortKey])

  const groups = useMemo(() => {
    const base = serviceFilter ? allGroups.filter((tab) => tab.name === serviceFilter) : allGroups
    if (!searching) return base
    return base
      .map((tab) => ({ ...tab, movies: tab.movies.filter((movie) => matchesKeyword(movie.title, needle)) }))
      .filter((tab) => tab.movies.length > 0)
  }, [allGroups, serviceFilter, searching, needle])

  const groupLimit = searching || serviceFilter || showAllGroups ? groups.length : INITIAL_GROUPS
  const visibleGroups = groups.slice(0, groupLimit)
  const hiddenGroupCount = groups.length - visibleGroups.length
  const matchCount = groups.reduce((sum, tab) => sum + tab.movies.length, 0)

  const isExpanded = (name) => (searching ? !collapsedInSearch.has(name) : expanded.has(name))
  const toggleGroup = (name) => {
    if (searching) setCollapsedInSearch((set) => toggled(set, name))
    else setExpanded((set) => toggled(set, name))
  }

  const onQueryChange = (event) => {
    setQuery(event.target.value)
    setCollapsedInSearch(new Set())
  }

  const selectService = (name) => {
    setServiceFilter(name)
    if (name) setExpanded((set) => new Set(set).add(name))
    setServiceMenuAnchor(null)
  }

  const announcement = searching
    ? `「${keyword}」に一致する作品 ${matchCount}件`
    : serviceFilter
      ? `${serviceFilter} ${matchCount}件`
      : ''

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

      <Box sx={{ maxWidth: 600, mx: 'auto', px: 2, pt: 1.5, pb: 4 }}>
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
            <TextField
              type="search"
              placeholder="タイトルで検索"
              size="small"
              fullWidth
              value={query}
              onChange={onQueryChange}
              inputRef={searchRef}
              slotProps={{
                htmlInput: { 'aria-label': 'タイトルで検索' },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ bgcolor: 'background.paper', borderRadius: 1 }}
            />

            <Typography variant="caption" component="p" color="text.secondary" sx={{ mt: 1, mb: 1.5 }}>
              最終更新: {data.generated_at}
            </Typography>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
              <FilterButton selected={!serviceFilter} aria-pressed={!serviceFilter} onClick={() => selectService(null)}>
                すべて {uniqueCount}
              </FilterButton>
              <FilterButton
                selected={Boolean(serviceFilter)}
                endIcon={<KeyboardArrowDownIcon />}
                aria-haspopup="menu"
                aria-controls={serviceMenuAnchor ? 'service-menu' : undefined}
                aria-expanded={serviceMenuAnchor ? 'true' : undefined}
                onClick={(event) => setServiceMenuAnchor(event.currentTarget)}
              >
                {serviceFilter ?? 'サービス別'}
              </FilterButton>
              <FilterButton
                endIcon={<KeyboardArrowDownIcon />}
                aria-haspopup="menu"
                aria-controls={sortMenuAnchor ? 'sort-menu' : undefined}
                aria-expanded={sortMenuAnchor ? 'true' : undefined}
                onClick={(event) => setSortMenuAnchor(event.currentTarget)}
              >
                並び替え
              </FilterButton>
            </Box>

            <Menu
              id="service-menu"
              anchorEl={serviceMenuAnchor}
              open={Boolean(serviceMenuAnchor)}
              onClose={() => setServiceMenuAnchor(null)}
            >
              {allGroups.map((tab) => (
                <MenuItem key={tab.name} selected={tab.name === serviceFilter} onClick={() => selectService(tab.name)}>
                  <ListItemIcon>
                    <ServiceIcon name={tab.name} size={20} />
                  </ListItemIcon>
                  <ListItemText primary={tab.name} />
                  <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                    {tab.movies.length}件
                  </Typography>
                </MenuItem>
              ))}
            </Menu>

            <Menu
              id="sort-menu"
              anchorEl={sortMenuAnchor}
              open={Boolean(sortMenuAnchor)}
              onClose={() => setSortMenuAnchor(null)}
            >
              {SORTS.map((sort) => (
                <MenuItem
                  key={sort.value}
                  selected={sort.value === sortKey}
                  onClick={() => {
                    setSortKey(sort.value)
                    setSortMenuAnchor(null)
                  }}
                >
                  <ListItemIcon>{sort.value === sortKey && <CheckIcon fontSize="small" />}</ListItemIcon>
                  <ListItemText primary={sort.label} />
                </MenuItem>
              ))}
            </Menu>

            <Box component="p" aria-live="polite" sx={visuallyHidden}>
              {announcement}
            </Box>

            <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', bgcolor: 'grey.50' }}>
              {visibleGroups.length === 0 ? (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography color="text.secondary">
                    {searching ? `「${keyword}」に一致する作品はありません` : '表示できる作品はありません'}
                  </Typography>
                </Box>
              ) : (
                visibleGroups.map((group, index) => (
                  <ServiceGroup
                    key={group.name}
                    group={group}
                    isFirst={index === 0}
                    expanded={isExpanded(group.name)}
                    onToggle={() => toggleGroup(group.name)}
                    showAll={searching || showAllMovies.has(group.name)}
                    onShowAll={() => setShowAllMovies((set) => new Set(set).add(group.name))}
                  />
                ))
              )}
              {hiddenGroupCount > 0 && (
                <Box sx={{ borderTop: 1, borderColor: 'divider', py: 0.5, bgcolor: 'background.paper' }}>
                  <MoreButton
                    onClick={() => setShowAllGroups(true)}
                    hiddenLabel={`（残り${hiddenGroupCount}サービス）`}
                  />
                </Box>
              )}
            </Paper>
          </>
        )}
      </Box>
    </Box>
  )
}
