import { useEffect, useMemo, useRef, useState } from 'react'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Button from '@mui/material/Button'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListSubheader from '@mui/material/ListSubheader'
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
import UpdateIcon from '@mui/icons-material/Update'
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline'
import IconButton from '@mui/material/IconButton'
import CloseIcon from '@mui/icons-material/Close'
import { visuallyHidden } from '@mui/utils'
import { serviceIconUrl } from '../serviceIcons.js'
import WatchDialog from '../components/WatchDialog.jsx'
import FilterButton from '../components/FilterButton.jsx'
import { excludeWatched } from '../records/records.js'
import { MOVIE_ORDERS, sortMovies } from '../movieOrder.js'
import { recordsErrorMessage } from '../records/github.js'
import { STALE_AFTER_DAYS, describeFetchedAt } from '../fetchedAt.js'
import { filmarksMovieUrl } from '../filmarks.js'
import { focusFirst } from '../focusFirst.js'
import { useRetryFocus } from '../useRetryFocus.js'
import { matchesKeyword, normalizeForSearch } from '../searchText.js'
import { KIND_FILTERS, isKind, kindLabel, matchesKindFilter } from '../records/kinds.js'
import { readViewFromSearch, viewToSearch, withSearch } from '../watchlistUrl.js'
import { RUNTIME_LIMITS, filterTabsByRuntime, runtimeLabel } from '../runtimeFilter.js'

const UNAVAILABLE = '未配信'
const SORTS = [
  { value: 'count', label: '作品数の多い順' },
  { value: 'name', label: 'サービス名順' },
]

// 種類の絞り込みの選択肢。種類が分からない作品（movie-meta.json に無い作品）があれば「種類不明」も出す
const KIND_MENU_LABELS = { all: 'すべての種類', movie: '映画（邦画・洋画）' }
const KIND_MENU = KIND_FILTERS.map((item) => ({ ...item, label: KIND_MENU_LABELS[item.value] ?? item.label }))
const UNKNOWN_KIND = { value: 'none', label: '種類不明' }

function filterTabsByKind(tabs, kindFilter) {
  if (kindFilter === 'all') return tabs
  return tabs
    .map((tab) => ({ ...tab, movies: tab.movies.filter((movie) => matchesKindFilter(movie.kind, kindFilter)) }))
    .filter((tab) => tab.movies.length > 0)
}

// 一覧の 2 行目: 種類・上映時間（分からないものは出さない）
function movieDetail(movie) {
  return [isKind(movie.kind) && kindLabel(movie.kind), movie.runtime_min && `${movie.runtime_min}分`].filter(Boolean).join('・')
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

// 押した行が一覧から消えるとフォーカスが body（ページ先頭）へ落ちるので、近くの要素へ移すための目印
const watchButtonSelector = (movieId) => `[data-watch-id="${CSS.escape(movieId)}"]`
const groupSummarySelector = (name) => `[data-group-summary="${CSS.escape(name)}"]`

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

// 行本体は Filmarks へのリンク、右端の「観る」「見た」ボタンはリンクの外（secondaryAction）に置く。
// 「観る」はそのサービスでこの作品を開くページ（scraper が Filmarks の配信一覧から取った URL がある作品だけ）
function MovieRow({ movie, serviceName, onWatch, canWatch }) {
  const detail = movieDetail(movie)
  return (
    // ボタンを絶対配置（secondaryAction）にすると、その幅を見込んだ余白を決め打ちで取ることになり狭い画面で作品名が潰れるので、
    // 行本体とボタンを横に並べ、ボタンの幅だけを確保して残りを作品名に回す
    <ListItem disablePadding sx={{ pr: 1.5 }}>
      <ListItemButton
        component="a"
        href={filmarksMovieUrl(movie.movie_id)}
        target="_blank"
        rel="noopener"
        sx={{ gap: 1.5, py: 0.5, pl: 2, pr: 1, minWidth: 0, alignSelf: 'stretch' }}
      >
        <Thumbnail src={movie.image} />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography
            variant="body2"
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              overflowWrap: 'anywhere',
            }}
          >
            {movie.title}
          </Typography>
          {detail && (
            <Typography
              variant="caption"
              color="text.secondary"
              component="p"
              sx={{ lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {detail}
            </Typography>
          )}
        </Box>
        {/* 狭い画面では作品名の幅を優先して、新しいタブの印は出さない（読み上げ用の文言は残す） */}
        <OpenInNewIcon aria-hidden="true" sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0, display: { xs: 'none', sm: 'block' } }} />
        <Box component="span" sx={visuallyHidden}>
          （新しいタブで開きます）
        </Box>
      </ListItemButton>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
        {movie.watch_url && (
          <IconButton
            component="a"
            href={movie.watch_url}
            target="_blank"
            rel="noopener noreferrer"
            size="small"
            color="primary"
            aria-label={`${serviceName}で「${movie.title}」を観る（新しいタブで開きます）`}
            title={`${serviceName}で観る`}
          >
            <PlayCircleOutlineIcon />
          </IconButton>
        )}
        <Button
          size="small"
          variant="outlined"
          startIcon={<CheckCircleOutlineIcon />}
          onClick={() => onWatch(movie)}
          disabled={!canWatch}
          data-watch-id={movie.movie_id}
          aria-label={`「${movie.title}」を見たに記録`}
          sx={{
            borderRadius: 999,
            minWidth: 0,
            px: 1.25,
            whiteSpace: 'nowrap',
            // 狭い画面ではチェックの印を省いて幅を詰める
            '& .MuiButton-startIcon': { display: { xs: 'none', sm: 'inherit' } },
          }}
        >
          見た
        </Button>
      </Box>
    </ListItem>
  )
}

function ServiceGroup({ group, expanded, onToggle, isFirst, onWatch, canWatch }) {
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
        data-group-summary={group.name}
        sx={{ minHeight: 56, px: 2, '& .MuiAccordionSummary-content': { alignItems: 'center', gap: 1.5, my: 1 } }}
      >
        <ServiceIcon name={group.name} size={28} />
        <Typography sx={{ fontWeight: 700, fontSize: 15, minWidth: 0, overflowWrap: 'anywhere' }}>{group.name}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13, flexShrink: 0, whiteSpace: 'nowrap' }}>
          {group.movies.length}件
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 0, pb: 1 }}>
        <List disablePadding>
          {group.movies.map((movie) => (
            <MovieRow
              key={movie.movie_id}
              movie={movie}
              serviceName={group.name}
              onWatch={(target) => onWatch(target, group)}
              canWatch={canWatch}
            />
          ))}
        </List>
      </AccordionDetails>
    </Accordion>
  )
}

// 一覧がいつ時点の Filmarks か（scraper が最後に取得した日時）を、検索欄より上で見落とさない位置に出す
function FetchedAt({ value }) {
  const fetched = describeFetchedAt(value)
  const label = (
    <>
      Filmarks からの取得:{' '}
      {fetched ? (
        <>
          <Box component="span" sx={{ color: 'text.primary', fontWeight: 700, whiteSpace: 'nowrap' }}>
            {fetched.date}
          </Box>
          <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
            （{fetched.ago}）
          </Box>
        </>
      ) : (
        '日時不明'
      )}
    </>
  )
  // 取得が止まっていても「N日前」を読み取らないと気づけないので、古いときは注意として出す
  if (fetched?.stale) {
    return (
      <Alert severity="warning" sx={{ mb: 1.5, py: 0 }}>
        {label}
        <Box component="span" sx={{ display: 'block' }}>
          データが古い可能性があります（{STALE_AFTER_DAYS}日以上更新されていません）
        </Box>
      </Alert>
    )
  }
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5, color: 'text.secondary' }}>
      <UpdateIcon fontSize="small" />
      <Typography variant="body2">{label}</Typography>
    </Box>
  )
}

export default function WatchlistPage({ searchRef, records, watchlist }) {
  const { data, error, retry } = watchlist
  // 絞り込み・検索・並び順は URL のクエリから始める（リロード・共有・他ページから戻ったときに同じ状態で開く）
  const [initialView] = useState(() => readViewFromSearch(window.location.search))
  const [query, setQuery] = useState(initialView.query)
  const [serviceFilter, setServiceFilter] = useState(initialView.service)
  const [sortKey, setSortKey] = useState(initialView.sort)
  const [movieOrder, setMovieOrder] = useState(initialView.order)
  // 同時に開けるグループは 1 つだけ（別のグループを開くと前のグループは閉じる）
  const [expandedName, setExpandedName] = useState(initialView.service)
  // 検索中は一致したグループを既定で開き、利用者が閉じたものだけを覚える
  const [collapsedInSearch, setCollapsedInSearch] = useState(new Set())
  const [serviceMenuAnchor, setServiceMenuAnchor] = useState(null)
  const [kindFilter, setKindFilter] = useState(initialView.kind)
  const [kindMenuAnchor, setKindMenuAnchor] = useState(null)
  // 上映時間の上限（分）。null は指定なし
  const [runtimeLimit, setRuntimeLimit] = useState(initialView.runtime)
  const [runtimeMenuAnchor, setRuntimeMenuAnchor] = useState(null)
  const [sortMenuAnchor, setSortMenuAnchor] = useState(null)
  // 「見た」に記録しようとしている作品と、記録後の通知（元に戻す用の作品を持つ）
  const [watchTarget, setWatchTarget] = useState(null)
  const [notice, setNotice] = useState(null)
  // 見たに記録した作品の行が消えた後のフォーカスの移し先（同じグループの次・前の作品 → グループ見出し）
  const returnFocus = useRef([])
  const undoButton = useRef(null)
  const noticeRoot = useRef(null)
  // 通知を閉じた瞬間にフォーカスが通知の中にあったか（空白をクリックして外した人の画面を引き戻さない）
  const restoreOnExit = useRef(false)
  const [focusRequest, setFocusRequest] = useState(null)
  // 再試行で消えた Alert の代わりに、成功したら検索欄へ、また失敗したら新しい「再試行」へ戻す
  const focusSearch = () => searchRef.current?.focus()
  const watchlistRetry = useRetryFocus(data ? 'ready' : error ? 'error' : 'loading', focusSearch)
  const recordsRetry = useRetryFocus(records.status, focusSearch)

  // 一覧の描き直しが終わってから移す（元に戻した作品の行は、記録の更新を描いた後にしか無い）
  useEffect(() => {
    if (!focusRequest) return
    if (!focusFirst(focusRequest)) searchRef.current?.focus()
    setFocusRequest(null)
  }, [focusRequest, searchRef])

  // 保存直後は「元に戻す」へ移す（フォーカス中は Snackbar が自動で閉じない）。通知が開いたまま
  // 次の作品を保存して中身だけ入れ替わる場合もあるので、開閉のアニメーションではなく通知の変化で移す
  useEffect(() => {
    if (!notice?.undo) return
    const frame = requestAnimationFrame(() => undoButton.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [notice])

  const closeNotice = () => {
    restoreOnExit.current = Boolean(noticeRoot.current?.contains(document.activeElement))
    setNotice(null)
  }

  const keyword = query.trim()
  const needle = normalizeForSearch(keyword)
  const searching = needle !== ''

  // 「見た」の作品は一覧・検索・件数のすべてから外す（記録の読込前・失敗時は全件）
  const watched = records.file?.records
  const unwatchedTabs = useMemo(() => (data ? excludeWatched(data.tabs, watched) : []), [data, watched])
  // 種類・上映時間の絞り込みは件数・サービスの一覧を含むすべてに効かせる
  const runtimeTabs = useMemo(() => filterTabsByRuntime(unwatchedTabs, runtimeLimit), [unwatchedTabs, runtimeLimit])
  const kindTabs = useMemo(() => filterTabsByKind(unwatchedTabs, kindFilter), [unwatchedTabs, kindFilter])
  const visibleTabs = useMemo(() => filterTabsByRuntime(kindTabs, runtimeLimit), [kindTabs, runtimeLimit])
  // 各選択肢の件数は、もう一方の絞り込みを掛けたうえでの件数（選んだ後の「すべて」の件数と一致させる）
  const kindOptions = useMemo(() => {
    // 種類不明で絞り込んだまま最後の 1 件を「見た」にしても、選択中の項目としては残す
    const hasUnknown = kindFilter === 'none' || unwatchedTabs.some((tab) => tab.movies.some((movie) => !isKind(movie.kind)))
    return [...KIND_MENU, ...(hasUnknown ? [UNKNOWN_KIND] : [])].map((option) => ({
      ...option,
      count: countUniqueMovies(filterTabsByKind(runtimeTabs, option.value)),
    }))
  }, [unwatchedTabs, runtimeTabs, kindFilter])
  const runtimeOptions = useMemo(
    () =>
      [null, ...RUNTIME_LIMITS].map((limit) => ({
        value: limit,
        label: limit == null ? '指定なし' : runtimeLabel(limit),
        count: countUniqueMovies(filterTabsByRuntime(kindTabs, limit)),
      })),
    [kindTabs],
  )
  const uniqueCount = useMemo(() => countUniqueMovies(visibleTabs), [visibleTabs])
  const allGroups = useMemo(() => sortGroups(visibleTabs, sortKey), [visibleTabs, sortKey])

  // URL のサービス名がもう一覧に無い（配信終了・名前の変更・書き間違い）ときは、読み込んだ時点で 1 回だけ絞り込みを外す
  // （開いた後に最後の 1 件を「見た」にしてグループが消えた場合は、選んだサービスのまま残す）
  const serviceChecked = useRef(false)
  useEffect(() => {
    if (!data || serviceChecked.current) return
    serviceChecked.current = true
    if (serviceFilter && !data.tabs.some((tab) => tab.name === serviceFilter)) {
      setServiceFilter(null)
      setExpandedName(null)
    }
  }, [data, serviceFilter])

  // 見え方が変わるたびに URL のクエリを書き換える（履歴は増やさない）
  useEffect(() => {
    const search = viewToSearch({
      service: serviceFilter,
      kind: kindFilter,
      query,
      sort: sortKey,
      order: movieOrder,
      runtime: runtimeLimit,
    })
    if (search === window.location.search) return
    try {
      window.history.replaceState(window.history.state, '', withSearch(window.location, search))
    } catch {
      // Safari は短時間に replaceState を呼びすぎると SecurityError を投げる。URL が古いままになるだけなので一覧は止めない
    }
  }, [serviceFilter, kindFilter, query, sortKey, movieOrder, runtimeLimit])

  const groups = useMemo(() => {
    const base = serviceFilter ? allGroups.filter((tab) => tab.name === serviceFilter) : allGroups
    const matched = searching
      ? base
          .map((tab) => ({ ...tab, movies: tab.movies.filter((movie) => matchesKeyword(movie.title, needle)) }))
          .filter((tab) => tab.movies.length > 0)
      : base
    return matched.map((tab) => ({ ...tab, movies: sortMovies(tab.movies, movieOrder) }))
  }, [allGroups, serviceFilter, searching, needle, movieOrder])

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

  const selectKind = (value) => {
    setKindFilter(value)
    setKindMenuAnchor(null)
  }

  const selectRuntime = (value) => {
    setRuntimeLimit(value)
    setRuntimeMenuAnchor(null)
  }

  const clearSearch = () => {
    setQuery('')
    setCollapsedInSearch(new Set())
    searchRef.current?.focus()
  }

  // サービス・種類・上映時間の絞り込みをまとめて外す（検索語と並び順は残す）
  const clearFilters = () => {
    setServiceFilter(null)
    setKindFilter('all')
    setRuntimeLimit(null)
    searchRef.current?.focus()
  }

  const kindName = kindFilter === 'all' ? '' : kindOptions.find((option) => option.value === kindFilter)?.label
  const runtimeName = runtimeLimit == null ? '' : runtimeLabel(runtimeLimit)
  const filterNames = [serviceFilter, kindName, runtimeName].filter(Boolean)
  const announcement = searching
    ? `「${keyword}」に一致する作品 ${matchCount}件`
    : filterNames.length > 0
      ? `${filterNames.join('・')} ${matchCount}件`
      : ''

  const startWatch = (movie, group) => {
    const index = group.movies.findIndex((item) => item.movie_id === movie.movie_id)
    const next = group.movies[index + 1]
    const prev = group.movies[index - 1]
    returnFocus.current = [
      next && watchButtonSelector(next.movie_id),
      prev && watchButtonSelector(prev.movie_id),
      groupSummarySelector(group.name),
    ]
    setWatchTarget(movie)
  }

  const onWatched = () => {
    setNotice({ severity: 'success', text: `「${watchTarget.title}」を見たに記録しました`, undo: watchTarget })
    setWatchTarget(null)
  }

  const undoWatch = async (movie) => {
    closeNotice()
    try {
      await records.save({ type: 'unwatch', movie_id: movie.movie_id })
      setNotice({ severity: 'info', text: `「${movie.title}」を見たいに戻しました` })
      // 一覧に戻ってきた作品の「見た」ボタンへ戻す
      setFocusRequest([watchButtonSelector(movie.movie_id), ...returnFocus.current])
    } catch (err) {
      setNotice({ severity: 'error', text: `元に戻せませんでした。${recordsErrorMessage(err)}` })
    }
  }

  return (
    // 下に出る通知（Snackbar）が一覧の最後の行を隠さないよう、出ている間は下の余白を広げる
    <Box sx={{ maxWidth: 600, mx: 'auto', px: 2, pt: 1.5, pb: notice ? 12 : 4 }}>
      {records.status === 'error' && (
        <Alert
          severity="warning"
          action={
            <Button ref={recordsRetry.buttonRef} color="inherit" size="small" onClick={recordsRetry.wrapRetry(records.reload)}>
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
            <Button ref={watchlistRetry.buttonRef} color="inherit" size="small" onClick={watchlistRetry.wrapRetry(retry)}>
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
          <FetchedAt value={data.generated_at} />

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

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5, mb: 1.5 }}>
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
              selected={kindFilter !== 'all'}
              endIcon={<KeyboardArrowDownIcon />}
              aria-haspopup="menu"
              aria-controls={kindMenuAnchor ? 'kind-menu' : undefined}
              aria-expanded={kindMenuAnchor ? 'true' : undefined}
              onClick={(event) => setKindMenuAnchor(event.currentTarget)}
            >
              {kindFilter === 'all' ? '種類別' : kindName}
            </FilterButton>
            <FilterButton
              selected={runtimeLimit != null}
              endIcon={<KeyboardArrowDownIcon />}
              aria-haspopup="menu"
              aria-controls={runtimeMenuAnchor ? 'runtime-menu' : undefined}
              aria-expanded={runtimeMenuAnchor ? 'true' : undefined}
              onClick={(event) => setRuntimeMenuAnchor(event.currentTarget)}
            >
              {runtimeLimit == null ? '上映時間' : runtimeName}
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

          <Menu id="kind-menu" anchorEl={kindMenuAnchor} open={Boolean(kindMenuAnchor)} onClose={() => setKindMenuAnchor(null)}>
            {kindOptions.map((option) => (
              <MenuItem key={option.value} selected={option.value === kindFilter} onClick={() => selectKind(option.value)}>
                <ListItemIcon>{option.value === kindFilter && <CheckIcon fontSize="small" />}</ListItemIcon>
                <ListItemText primary={option.label} />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                  {option.count}件
                </Typography>
              </MenuItem>
            ))}
          </Menu>

          <Menu
            id="runtime-menu"
            anchorEl={runtimeMenuAnchor}
            open={Boolean(runtimeMenuAnchor)}
            onClose={() => setRuntimeMenuAnchor(null)}
          >
            {runtimeOptions.map((option) => (
              <MenuItem
                key={option.label}
                selected={option.value === runtimeLimit}
                onClick={() => selectRuntime(option.value)}
              >
                <ListItemIcon>{option.value === runtimeLimit && <CheckIcon fontSize="small" />}</ListItemIcon>
                <ListItemText primary={option.label} />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                  {option.count}件
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
            <ListSubheader>サービスの並び</ListSubheader>
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
            <ListSubheader>作品の並び</ListSubheader>
            {MOVIE_ORDERS.map((order) => (
              <MenuItem
                key={order.value}
                selected={order.value === movieOrder}
                onClick={() => {
                  setMovieOrder(order.value)
                  setSortMenuAnchor(null)
                }}
              >
                <ListItemIcon>{order.value === movieOrder && <CheckIcon fontSize="small" />}</ListItemIcon>
                <ListItemText primary={order.label} />
              </MenuItem>
            ))}
          </Menu>

          <Box component="p" aria-live="polite" sx={visuallyHidden}>
            {announcement}
          </Box>

          <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', bgcolor: 'grey.50' }}>
            {groups.length === 0 ? (
              <Box sx={{ py: 4, px: 2, textAlign: 'center' }}>
                <Typography color="text.secondary">
                  {searching ? `「${keyword}」に一致する作品はありません` : '表示できる作品はありません'}
                </Typography>
                {/* 0 件の理由になっている条件を見せ、その場で外せるようにする */}
                {filterNames.length > 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {searching ? `絞り込み（${filterNames.join('・')}）の中から探しています` : `絞り込み: ${filterNames.join('・')}`}
                  </Typography>
                )}
                {(searching || filterNames.length > 0) && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1, mt: 1.5 }}>
                    {searching && (
                      <Button variant="outlined" size="small" onClick={clearSearch}>
                        検索をクリア
                      </Button>
                    )}
                    {filterNames.length > 0 && (
                      <Button variant="outlined" size="small" onClick={clearFilters}>
                        絞り込みを解除
                      </Button>
                    )}
                  </Box>
                )}
              </Box>
            ) : (
              groups.map((group, index) => (
                <ServiceGroup
                  key={group.name}
                  group={group}
                  isFirst={index === 0}
                  expanded={isExpanded(group.name)}
                  onToggle={() => toggleGroup(group.name)}
                  onWatch={startWatch}
                  // 記録を読み終えるまで押せなくする（読込前・失敗中に記録済みの作品を上書き→元に戻すで消す事故を防ぐ）
                  canWatch={records.status === 'ready'}
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
          // Filmarks の製作国・ジャンルで種類が分かる作品は、その種類を選んでおく
          defaultKind={isKind(watchTarget.kind) ? watchTarget.kind : null}
          kindNote="Filmarks のジャンル・製作国から選んでいます。違っていたら選び直してください"
          canWrite={records.canWrite}
          onSave={records.save}
          onSaved={onWatched}
          onClose={() => setWatchTarget(null)}
        />
      )}

      <Snackbar
        ref={noticeRoot}
        open={Boolean(notice)}
        autoHideDuration={notice?.severity === 'error' ? null : 8000}
        onClose={(_, reason) => {
          if (reason !== 'clickaway') closeNotice()
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        slotProps={{
          transition: {
            // 通知の中にあったフォーカスが閉じて行き場を失ったら、消えた作品の近くへ戻す
            onExited: () => {
              const lost = !document.activeElement || document.activeElement === document.body
              if (restoreOnExit.current && lost) setFocusRequest(returnFocus.current)
              restoreOnExit.current = false
            },
          },
        }}
      >
        {notice ? (
          <Alert
            severity={notice.severity}
            variant="filled"
            onClose={closeNotice}
            action={
              notice.undo ? (
                // action を渡すと Alert の閉じるボタンが消えるので自分で置く（スマホで下の行を隠したままにしない）
                <>
                  <Button ref={undoButton} color="inherit" size="small" onClick={() => undoWatch(notice.undo)}>
                    元に戻す
                  </Button>
                  <IconButton color="inherit" size="small" aria-label="閉じる" onClick={closeNotice}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </>
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
