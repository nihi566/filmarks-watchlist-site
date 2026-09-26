import { useEffect, useMemo, useState } from 'react'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Button from '@mui/material/Button'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import Snackbar from '@mui/material/Snackbar'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import Avatar from '@mui/material/Avatar'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import SearchIcon from '@mui/icons-material/Search'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import CheckIcon from '@mui/icons-material/Check'
import MovieIcon from '@mui/icons-material/Movie'
import BlockIcon from '@mui/icons-material/Block'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import { visuallyHidden } from '@mui/utils'
import { serviceIconUrl } from '../serviceIcons.js'
import WatchDialog from '../components/WatchDialog.jsx'
import { excludeWatched } from '../records/records.js'
import { recordsErrorMessage } from '../records/github.js'

const UNAVAILABLE = '未配信'
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

// 行本体は Filmarks へのリンク、右端の「見た」ボタンはリンクの外（secondaryAction）に置く
function MovieRow({ movie, onWatch }) {
  return (
    <ListItem
      disablePadding
      secondaryAction={
        <Button
          size="small"
          variant="outlined"
          startIcon={<CheckCircleOutlineIcon />}
          onClick={() => onWatch(movie)}
          aria-label={`「${movie.title}」を見たに記録`}
          sx={{ borderRadius: 999, minWidth: 0, px: 1.25, whiteSpace: 'nowrap' }}
        >
          見た
        </Button>
      }
      sx={{ '& .MuiListItemSecondaryAction-root': { right: 12 } }}
    >
    <ListItemButton
      component="a"
      href={`https://filmarks.com/movies/${movie.movie_id}`}
      target="_blank"
      rel="noopener"
      sx={{ gap: 1.5, py: 0.5, pl: 2, pr: '92px !important' }}
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
    </ListItem>
  )
}

function ServiceGroup({ group, expanded, onToggle, isFirst, onWatch }) {
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
          {group.movies.map((movie) => (
            <MovieRow key={movie.movie_id} movie={movie} onWatch={onWatch} />
          ))}
        </List>
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

export default function WatchlistPage({ searchRef, records }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [query, setQuery] = useState('')
  const [serviceFilter, setServiceFilter] = useState(null)
  const [sortKey, setSortKey] = useState('count')
  // 同時に開けるグループは 1 つだけ（別のグループを開くと前のグループは閉じる）
  const [expandedName, setExpandedName] = useState(null)
  // 検索中は一致したグループを既定で開き、利用者が閉じたものだけを覚える
  const [collapsedInSearch, setCollapsedInSearch] = useState(new Set())
  const [serviceMenuAnchor, setServiceMenuAnchor] = useState(null)
  const [sortMenuAnchor, setSortMenuAnchor] = useState(null)
  // 「見た」に記録しようとしている作品と、記録後の通知（元に戻す用の作品を持つ）
  const [watchTarget, setWatchTarget] = useState(null)
  const [notice, setNotice] = useState(null)

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
        setExpandedName(first ? first.name : null)
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

  // 「見た」の作品は一覧・検索・件数のすべてから外す（記録の読込前・失敗時は全件）
  const watched = records.file?.records
  const visibleTabs = useMemo(() => (data ? excludeWatched(data.tabs, watched) : []), [data, watched])
  const uniqueCount = useMemo(() => countUniqueMovies(visibleTabs), [visibleTabs])
  const allGroups = useMemo(() => sortGroups(visibleTabs, sortKey), [visibleTabs, sortKey])

  const groups = useMemo(() => {
    const base = serviceFilter ? allGroups.filter((tab) => tab.name === serviceFilter) : allGroups
    if (!searching) return base
    return base
      .map((tab) => ({ ...tab, movies: tab.movies.filter((movie) => matchesKeyword(movie.title, needle)) }))
      .filter((tab) => tab.movies.length > 0)
  }, [allGroups, serviceFilter, searching, needle])

  const matchCount = groups.reduce((sum, tab) => sum + tab.movies.length, 0)

  const isExpanded = (name) => (searching ? !collapsedInSearch.has(name) : expandedName === name)
  const toggleGroup = (name) => {
    if (searching) setCollapsedInSearch((set) => toggled(set, name))
    else setExpandedName((current) => (current === name ? null : name))
  }

  const onQueryChange = (event) => {
    setQuery(event.target.value)
    setCollapsedInSearch(new Set())
  }

  const selectService = (name) => {
    setServiceFilter(name)
    if (name) setExpandedName(name)
    setServiceMenuAnchor(null)
  }

  const announcement = searching
    ? `「${keyword}」に一致する作品 ${matchCount}件`
    : serviceFilter
      ? `${serviceFilter} ${matchCount}件`
      : ''

  const onWatched = () => {
    setNotice({ severity: 'success', text: `「${watchTarget.title}」を見たに記録しました`, undo: watchTarget })
    setWatchTarget(null)
  }

  const undoWatch = async (movie) => {
    setNotice(null)
    try {
      await records.save({ type: 'unwatch', movie_id: movie.movie_id })
      setNotice({ severity: 'info', text: `「${movie.title}」を見たいに戻しました` })
    } catch (err) {
      setNotice({ severity: 'error', text: `元に戻せませんでした。${recordsErrorMessage(err)}` })
    }
  }

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', px: 2, pt: 1.5, pb: 4 }}>
      {records.status === 'error' && (
        <Alert
          severity="warning"
          action={
            <Button color="inherit" size="small" onClick={records.reload}>
              再試行
            </Button>
          }
          sx={{ mb: 1.5 }}
        >
          視聴記録を読み込めなかったため、見た作品も表示しています。{recordsErrorMessage(records.error)}
        </Alert>
      )}
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
            {groups.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">
                  {searching ? `「${keyword}」に一致する作品はありません` : '表示できる作品はありません'}
                </Typography>
              </Box>
            ) : (
              groups.map((group, index) => (
                <ServiceGroup
                  key={group.name}
                  group={group}
                  isFirst={index === 0}
                  expanded={isExpanded(group.name)}
                  onToggle={() => toggleGroup(group.name)}
                  onWatch={setWatchTarget}
                />
              ))
            )}
          </Paper>
        </>
      )}

      {watchTarget && (
        <WatchDialog
          key={watchTarget.movie_id}
          movie={watchTarget}
          canWrite={records.canWrite}
          onSave={records.save}
          onSaved={onWatched}
          onClose={() => setWatchTarget(null)}
        />
      )}

      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={notice?.severity === 'error' ? null : 8000}
        onClose={(_, reason) => {
          if (reason !== 'clickaway') setNotice(null)
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {notice ? (
          <Alert
            severity={notice.severity}
            variant="filled"
            onClose={() => setNotice(null)}
            action={
              notice.undo ? (
                <Button color="inherit" size="small" onClick={() => undoWatch(notice.undo)}>
                  元に戻す
                </Button>
              ) : undefined
            }
            sx={{ width: '100%' }}
          >
            {notice.text}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  )
}
