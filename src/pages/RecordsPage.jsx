import { useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import ButtonBase from '@mui/material/ButtonBase'
import CircularProgress from '@mui/material/CircularProgress'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemAvatar from '@mui/material/ListItemAvatar'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import ListSubheader from '@mui/material/ListSubheader'
import Avatar from '@mui/material/Avatar'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Snackbar from '@mui/material/Snackbar'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import MovieIcon from '@mui/icons-material/Movie'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import Rating from '@mui/material/Rating'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import SearchIcon from '@mui/icons-material/Search'
import { visuallyHidden } from '@mui/utils'
import WatchDialog from '../components/WatchDialog.jsx'
import FilterButton from '../components/FilterButton.jsx'
import { recordsErrorMessage } from '../records/github.js'
import { isManualId, newManualId, todayLocal, watchChangeFromEntry } from '../records/records.js'
import { KIND_FILTERS, RATING_LABELS, filterRecordsByKind, kindLabel, matchesKindFilter } from '../records/kinds.js'
import {
  TOP_RATED_MIN,
  addMonths,
  formatMinutes,
  lastRecordedMonth,
  recordYears,
  searchRecords,
  summarizeMonth,
  summarizeYear,
  weekdayLabel,
} from '../records/summary.js'
import { filmarksMovieUrl, filmarksSearchUrl } from '../filmarks.js'
import { focusFirst } from '../focusFirst.js'
import { useRetryFocus } from '../useRetryFocus.js'
import NoWrapParts from '../components/NoWrapParts.jsx'
import { useElementHeight } from '../useElementHeight.js'
import { keepInPlace } from '../keepInPlace.js'
import { HEADER_HEIGHT } from '../navigation.js'

// 見たいに戻した作品の行が消えた後のフォーカスの移し先の目印（各作品の ︙ ボタン）
const menuButtonSelector = (movieId) => `[data-menu-id="${CSS.escape(movieId)}"]`

function Stat({ label, value, unit }) {
  return (
    <Box>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography component="p" sx={{ fontSize: { xs: 24, sm: 28 }, fontWeight: 800, lineHeight: 1.2 }}>
        {/* 「84時間49分」は「84時間」と「49分」の間でだけ折り返す */}
        {typeof value === 'string' ? <NoWrapParts parts={value.split(/(?<=時間)/)} /> : value}
        {unit && (
          <Box component="span" sx={{ fontSize: 15, fontWeight: 700, ml: 0.5 }}>
            {unit}
          </Box>
        )}
      </Typography>
    </Box>
  )
}

function comparisonText(current, previous) {
  if (previous === 0) return ''
  const diff = current - previous
  if (diff === 0) return '先月と同じ本数です'
  return diff > 0 ? `先月より ${diff} 本多く見ました` : `先月より ${-diff} 本少なめです`
}

// 年の月別本数の棒。押すとその月へ切り替える（未来の月は押せない）
function MonthBars({ months, selectedMonth, lastSelectableMonth, onSelect }) {
  const max = Math.max(1, ...months.map((item) => item.count))
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 0.5, mt: 2 }}>
      {months.map(({ month, count }) => {
        const selected = month === selectedMonth
        return (
          <ButtonBase
            key={month}
            disabled={month > lastSelectableMonth}
            onClick={(event) => {
              keepInPlace(event.currentTarget)
              onSelect(month)
            }}
            aria-label={`${month}月 ${count}本`}
            aria-pressed={selected}
            sx={{ flexDirection: 'column', justifyContent: 'flex-end', borderRadius: 1, py: 0.5, '&.Mui-disabled': { opacity: 0.4 } }}
          >
            {/* 本数は棒のすぐ上に出す（棒の高さの枠の上に置くと、短い棒から離れて浮いて見える） */}
            <Box sx={{ height: 82, width: '70%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                {count > 0 ? count : ''}
              </Typography>
              <Box
                sx={{
                  width: '100%',
                  flexShrink: 0,
                  height: count > 0 ? Math.max(5, Math.round((count / max) * 64)) : 2,
                  borderRadius: '4px 4px 0 0',
                  bgcolor: selected ? 'primary.main' : count > 0 ? 'primary.light' : 'grey.300',
                }}
              />
            </Box>
            <Typography variant="caption" color={selected ? 'primary' : 'text.secondary'} sx={{ fontWeight: selected ? 700 : 400 }}>
              {month}
            </Typography>
          </ButtonBase>
        )
      })}
    </Box>
  )
}

// 年のまとめの★評価: ★ごとの本数と、★4 以上の作品（その年のベストを振り返る）
function YearRatings({ year }) {
  const counts = year.ratings.filter((item) => item.count > 0)
  return (
    <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        ★評価
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {counts.length > 0 ? (
          <NoWrapParts parts={counts.map((item) => `★${item.rating} ${item.count}本`)} separator="・" />
        ) : (
          'まだ★評価を付けた作品はありません'
        )}
        {counts.length > 0 && year.unratedCount > 0 && (
          <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
            （未評価 {year.unratedCount}本）
          </Box>
        )}
      </Typography>
      {year.topRated.length > 0 && (
        <>
          <Typography variant="body2" sx={{ fontWeight: 700, mt: 1.5 }}>
            ★{TOP_RATED_MIN}以上の作品
          </Typography>
          <List dense disablePadding aria-label="★の高い作品">
            {year.topRated.map((item) => (
              <ListItem key={item.movie_id} disableGutters sx={{ py: 0.25, gap: 1 }}>
                <ItemRating value={item.rating} />
                <ListItemText primary={item.title} slotProps={{ primary: { variant: 'body2', sx: { overflowWrap: 'anywhere', wordBreak: 'normal' } } }} sx={{ my: 0 }} />
              </ListItem>
            ))}
          </List>
        </>
      )}
    </Box>
  )
}

function dayHeading(date) {
  const [, m, d] = date.split('-').map(Number)
  return `${m}月${d}日（${weekdayLabel(date)}）`
}

// 「アニメ 2本（24話）・邦画 1本」のような種類ごとの内訳（1 種類の中では折り返さない）
function KindsText({ kinds }) {
  return (
    <NoWrapParts
      parts={kinds.map(({ kind, count, episodes }) => `${kindLabel(kind)} ${count}本${kind === 'anime' && episodes > 0 ? `（${episodes}話）` : ''}`)}
      separator="・"
    />
  )
}

// 一覧の 2 行目: 種類・話数・視聴時間（「4時間48 / 分」のように項目の途中で割れないようにする）
function ItemDetail({ item }) {
  const parts = [kindLabel(item.kind)]
  if (item.kind === 'anime' && item.episodes) parts.push(`${item.episodes}話`)
  parts.push(item.minutes != null ? formatMinutes(item.minutes) : '視聴時間不明')
  return <NoWrapParts parts={parts} separator="・" />
}

function itemUrl(item) {
  return isManualId(item.movie_id) ? filmarksSearchUrl(item.title, item.kind) : filmarksMovieUrl(item.movie_id)
}

// 検索結果は月をまたぐので、年から出す
function fullDateLabel(date) {
  const [y] = date.split('-')
  return `${y}年${dayHeading(date)}`
}

// 一覧の 1 行。行本体は Filmarks へのリンク、右端の ︙（記録を編集・見たいに戻す）は書き込めるときだけ出す。
// dateText を渡すと、作品名の下に視聴日も出す（検索結果用）
function RecordRow({ item, canEdit, onOpenMenu, dateText }) {
  return (
    <ListItem
      disablePadding
      // 日付の見出し（36px）も画面の上に固定されるので、キーボードで移ったフォーカスがその下に隠れないよう、見出しの分も空ける
      sx={{ '& :is(a, button)': { scrollMarginTop: { xs: 92, sm: 100 } } }}
      secondaryAction={
        canEdit && (
          <IconButton
            edge="end"
            data-menu-id={item.movie_id}
            aria-label={`「${item.title}」の操作`}
            onClick={(event) => onOpenMenu(event.currentTarget, item)}
          >
            <MoreVertIcon />
          </IconButton>
        )
      }
    >
      {/* 記録した作品の Filmarks ページ（レビューや Mark を付けに行く導線） */}
      <ListItemButton component="a" href={itemUrl(item)} target="_blank" rel="noopener" sx={{ pr: canEdit ? 7 : 2 }}>
        <ListItemAvatar sx={{ minWidth: 44 }}>
          <Avatar
            variant="rounded"
            src={item.image || undefined}
            alt=""
            sx={{ width: 30, height: 40, bgcolor: 'grey.200', color: 'grey.500' }}
          >
            <MovieIcon fontSize="small" />
          </Avatar>
        </ListItemAvatar>
        <ListItemText
          primary={item.title}
          secondary={
            <>
              {dateText && (
                <Box component="span" sx={{ display: 'block' }}>
                  {dateText}
                </Box>
              )}
              <ItemRating value={item.rating} />
              <Box component="span" sx={{ display: 'block' }}>
                <ItemDetail item={item} />
              </Box>
            </>
          }
          slotProps={{ primary: { variant: 'body2', sx: { overflowWrap: 'anywhere', wordBreak: 'normal' } } }}
        />
        <OpenInNewIcon aria-hidden="true" sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0, ml: 1 }} />
        <Box component="span" sx={visuallyHidden}>
          （新しいタブで開きます）
        </Box>
      </ListItemButton>
    </ListItem>
  )
}

function ItemRating({ value }) {
  if (!value) {
    return (
      <Typography component="span" variant="caption" color="text.secondary">
        未評価
      </Typography>
    )
  }
  return (
    <Rating
      value={value}
      readOnly
      size="small"
      getLabelText={(stars) => `★${stars}（${RATING_LABELS[stars]}）`}
      sx={{ verticalAlign: 'middle' }}
    />
  )
}

export default function RecordsPage({ records }) {
  const today = todayLocal()
  const [thisYear, thisMonth] = today.split('-').map(Number)
  const [period, setPeriod] = useState({ year: thisYear, month: thisMonth })
  // 閉じても item は残す（閉じるアニメーションの間に項目名が入れ替わらないように）
  const [menu, setMenu] = useState(null)
  const closeMenu = () => setMenu((current) => current && { ...current, open: false })
  const [editTarget, setEditTarget] = useState(null)
  const [notice, setNotice] = useState(null)
  const [kindFilter, setKindFilter] = useState('all')
  // タイトル検索（全期間）。入力中は月の表示の代わりに検索結果を出す
  const [searchText, setSearchText] = useState('')
  // 見たいに戻した作品の行が消えた後のフォーカスの移し先（次・前の作品の ︙ → 作品を追加）
  const returnFocus = useRef([])
  const addButton = useRef(null)
  const searchInput = useRef(null)
  const previousButton = useRef(null)
  // 再試行で消えた Alert の代わりに、成功したら「追加」へ、また失敗したら新しい「再試行」へ戻す
  const recordsRetry = useRetryFocus(records.status, () => addButton.current?.focus())
  const undoButton = useRef(null)
  const noticeRoot = useRef(null)
  const noticeHeight = useElementHeight(noticeRoot, Boolean(notice))
  // 通知を閉じた瞬間にフォーカスが通知の中にあったか（空白をクリックして外した人の画面を引き戻さない）
  const restoreOnExit = useRef(false)
  const [focusRequest, setFocusRequest] = useState(null)

  // 一覧の描き直しが終わってから移す（元に戻した作品の行は、記録の更新を描いた後にしか無い）
  useEffect(() => {
    if (!focusRequest) return
    // 検索中は「作品を追加」が無いので検索欄へ
    if (!focusFirst(focusRequest)) (addButton.current ?? searchInput.current)?.focus()
    setFocusRequest(null)
  }, [focusRequest])

  // 見たいに戻した直後は「元に戻す」へ移す（フォーカス中は Snackbar が自動で閉じない）
  useEffect(() => {
    if (!notice?.undo) return
    const frame = requestAnimationFrame(() => undoButton.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [notice])

  const closeNotice = () => {
    restoreOnExit.current = Boolean(noticeRoot.current?.contains(document.activeElement))
    setNotice(null)
  }

  // entries は操作（編集・取り消し）用に全件、shown は種類で絞り込んだ集計・一覧用
  const entries = records.file?.records
  const shown = useMemo(() => filterRecordsByKind(entries, kindFilter), [entries, kindFilter])
  const hasUnclassified = useMemo(() => Object.values(entries ?? {}).some((entry) => !entry.kind), [entries])
  const month = useMemo(() => summarizeMonth(shown, period.year, period.month), [shown, period])
  const previous = addMonths(period.year, period.month, -1)
  const previousCount = useMemo(
    () => summarizeMonth(shown, previous.year, previous.month).count,
    [shown, previous.year, previous.month],
  )
  const year = useMemo(() => summarizeYear(shown, period.year), [shown, period.year])
  // 年の切り替えの選択肢は、種類の絞り込みに関係なく記録のある年
  const years = useMemo(() => recordYears(entries), [entries])
  const keyword = searchText.trim()
  const searching = keyword !== ''
  const results = useMemo(() => searchRecords(shown, keyword), [shown, keyword])
  const isThisMonth = period.year === thisYear && period.month === thisMonth
  // 記録を読み終えるまで編集・見たいに戻すを出さない（古い内容で上書きしないため）
  const canEdit = records.canWrite && records.status === 'ready'

  const move = (delta) => setPeriod((current) => addMonths(current.year, current.month, delta))
  // 押した「今月へ」は消えるので、フォーカスは月の切り替えへ移す
  const goThisMonth = () => {
    setPeriod({ year: thisYear, month: thisMonth })
    previousButton.current?.focus()
  }
  // 選んだ年の、記録のある最後の月へ移る（今の種類の絞り込みで記録が無ければ 1 月。今年は今月より先へ行かない）
  const goYear = (selected) => {
    const last = lastRecordedMonth(shown, selected) ?? 1
    setPeriod({ year: selected, month: selected === thisYear ? Math.min(last, thisMonth) : last })
  }
  const clearSearch = () => {
    setSearchText('')
    searchInput.current?.focus()
  }
  const openMenu = (anchor, item) => setMenu({ anchor, item, open: true })

  // ウォッチリスト由来の作品は「見たい」に戻し、手で追加した作品は記録を消す（どちらも元に戻せる）
  const unwatch = async (item) => {
    closeMenu()
    const items = searching ? results : month.days.flatMap((day) => day.items)
    const index = items.findIndex((other) => other.movie_id === item.movie_id)
    const neighbors = index < 0 ? [] : [items[index + 1], items[index - 1]]
    returnFocus.current = neighbors.map((other) => other && menuButtonSelector(other.movie_id))
    const entry = entries[item.movie_id]
    const manual = isManualId(item.movie_id)
    try {
      await records.save({ type: 'unwatch', movie_id: item.movie_id })
      setNotice({
        severity: 'info',
        text: manual ? `「${item.title}」の記録を削除しました` : `「${item.title}」を見たいに戻しました`,
        undo: watchChangeFromEntry(item.movie_id, entry),
      })
    } catch (err) {
      setNotice({ severity: 'error', text: `${manual ? '削除できませんでした' : '見たいに戻せませんでした'}。${recordsErrorMessage(err)}` })
    }
  }

  // 追加・編集した記録が今の表示（月・種類）から外れるときは、見える所へ切り替える
  const showRecord = (change) => {
    const [y, m] = change.watched_on.split('-').map(Number)
    setPeriod({ year: y, month: m })
    if (!matchesKindFilter(change.kind, kindFilter)) setKindFilter('all')
  }

  const undo = async (change) => {
    closeNotice()
    try {
      await records.save(change)
      setNotice({ severity: 'success', text: `「${change.title}」の記録を元に戻しました` })
      // 一覧に戻ってきた作品の ︙ へ戻す
      setFocusRequest([menuButtonSelector(change.movie_id), ...returnFocus.current])
    } catch (err) {
      // 失敗しても復元する内容を捨てない（捨てると元の視聴日・視聴時間を取り戻せなくなる）
      setNotice({ severity: 'error', text: `元に戻せませんでした。${recordsErrorMessage(err)}`, undo: change })
    }
  }

  if (!records.file) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', px: 2, pt: 2, pb: 4 }}>
        {records.status === 'error' ? (
          <Alert
            severity="error"
            action={
              <Button ref={recordsRetry.buttonRef} color="inherit" size="small" onClick={recordsRetry.wrapRetry(records.reload)}>
                再試行
              </Button>
            }
          >
            {recordsErrorMessage(records.error)}
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress aria-label="視聴記録を読み込み中" />
          </Box>
        )}
      </Box>
    )
  }

  const comparison = comparisonText(month.count, previousCount)

  return (
    // 下に出る通知（Snackbar）が一覧の最後の行を隠さないよう、出ている間は通知の高さの分だけ下の余白を広げる
    <Box sx={{ maxWidth: 600, mx: 'auto', px: 2, pt: 1.5, pb: noticeHeight > 0 ? `${noticeHeight + 32}px` : 4, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 2 }}>
      {records.status === 'error' && (
        <Alert
          severity="warning"
          action={
            <Button ref={recordsRetry.buttonRef} color="inherit" size="small" onClick={recordsRetry.wrapRetry(records.reload)}>
              再試行
            </Button>
          }
        >
          最新の視聴記録を読み込めませんでした。{recordsErrorMessage(records.error)}
        </Alert>
      )}
      {/* トークンが無いと「作品を追加」と各行の ︙ が出ないので、理由と設定への導線を出す */}
      {!records.canWrite && (
        <Alert
          severity="info"
          action={
            <Button color="inherit" size="small" href="#/settings">
              設定を開く
            </Button>
          }
        >
          記録の追加・編集には、設定で GitHub トークンを保存してください。
        </Alert>
      )}

      <Box role="group" aria-label="種類で絞り込む" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {/* 未分類で絞り込んだまま最後の 1 件を戻しても、選択中のボタンとしては残す */}
        {[...KIND_FILTERS, ...(hasUnclassified || kindFilter === 'none' ? [{ value: 'none', label: '未分類' }] : [])].map((filter) => (
          <FilterButton
            key={filter.value}
            selected={kindFilter === filter.value}
            aria-pressed={kindFilter === filter.value}
            onClick={() => setKindFilter(filter.value)}
          >
            {filter.label}
          </FilterButton>
        ))}
      </Box>

      <TextField
        type="search"
        size="small"
        placeholder="タイトルで検索（全期間）"
        value={searchText}
        onChange={(event) => setSearchText(event.target.value)}
        inputRef={searchInput}
        slotProps={{
          htmlInput: { 'aria-label': '視聴記録をタイトルで検索' },
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

      {searching ? (
        <Paper variant="outlined" component="section" aria-label="検索結果" sx={{ borderRadius: 3, overflow: 'clip' }}>
          <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
            <Typography component="h2" aria-live="polite" sx={{ fontWeight: 700 }}>
              {results.length > 0 ? `「${keyword}」に一致する記録 ${results.length}件` : `「${keyword}」に一致する記録はありません`}
            </Typography>
            {kindFilter !== 'all' && (
              <Typography variant="caption" color="text.secondary">
                種類の絞り込み（{KIND_FILTERS.find((filter) => filter.value === kindFilter)?.label ?? '未分類'}）の中から探しています
              </Typography>
            )}
          </Box>
          {results.length === 0 && (
            <Box sx={{ py: 3, px: 2, textAlign: 'center' }}>
              <Button variant="outlined" size="small" onClick={clearSearch}>
                検索をクリア
              </Button>
            </Box>
          )}
          {results.length > 0 && (
            <List disablePadding>
              {results.map((item) => (
                <RecordRow
                  key={item.movie_id}
                  item={item}
                  canEdit={canEdit}
                  onOpenMenu={openMenu}
                  dateText={fullDateLabel(item.watched_on)}
                />
              ))}
            </List>
          )}
        </Paper>
      ) : (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            <IconButton ref={previousButton} aria-label="前の月" onClick={() => move(-1)}>
              <ChevronLeftIcon />
            </IconButton>
            <Typography component="h2" aria-live="polite" sx={{ fontWeight: 800, fontSize: 18, minWidth: 120, textAlign: 'center' }}>
              {period.year}年{period.month}月
            </Typography>
            <IconButton aria-label="次の月" onClick={() => move(1)} disabled={isThisMonth}>
              <ChevronRightIcon />
            </IconButton>
          </Box>

          <Paper variant="outlined" component="section" aria-label={`${period.year}年${period.month}月のまとめ`} sx={{ borderRadius: 3, p: 2 }}>
            {/* 前の月・次の月の並びに置くと出し入れで矢印の位置がずれ、続けて押すと押し間違えるので、ここに置く */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, minHeight: 30 }}>
              <Typography sx={{ fontWeight: 700, flexGrow: 1 }}>
                {period.year}年{period.month}月のまとめ
              </Typography>
              {!isThisMonth && (
                <Button size="small" onClick={goThisMonth} sx={{ whiteSpace: 'nowrap' }}>
                  今月へ
                </Button>
              )}
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Stat label="見た作品" value={month.count} unit="本" />
              <Stat label="視聴時間" value={formatMinutes(month.minutes)} />
            </Box>
            {comparison && (
              <Typography variant="body2" sx={{ mt: 1, fontWeight: 700, color: month.count >= previousCount ? 'success.main' : 'text.secondary' }}>
                {comparison}
              </Typography>
            )}
            {month.kinds.length > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                <KindsText kinds={month.kinds} />
              </Typography>
            )}
            {month.unknownCount > 0 && (
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5 }}>
                視聴時間が分からない {month.unknownCount} 本は時間に含めていません
              </Typography>
            )}
          </Paper>

          <Paper variant="outlined" component="section" aria-label={`${period.year}年のまとめ`} sx={{ borderRadius: 3, p: 2 }}>
            {/* 年を選ぶと、その年のまとめへ直接移る（月送りで何年も遡らなくて済む） */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <TextField
                select
                size="small"
                variant="standard"
                value={period.year}
                onChange={(event) => goYear(Number(event.target.value))}
                slotProps={{
                  select: { native: true },
                  htmlInput: { 'aria-label': '表示する年' },
                  input: { sx: { fontWeight: 700 } },
                }}
              >
                {/* 月送りで記録の無い年を表示している間は、その年を選べない項目として見せるだけにする */}
                {!years.includes(period.year) && (
                  <option value={period.year} disabled>
                    {period.year}年（記録なし）
                  </option>
                )}
                {years.map((item) => (
                  <option key={item} value={item}>
                    {item}年
                  </option>
                ))}
              </TextField>
              <Typography sx={{ fontWeight: 700 }}>のまとめ</Typography>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Stat label="見た作品" value={year.count} unit="本" />
              <Stat label="視聴時間" value={formatMinutes(year.minutes)} />
            </Box>
            {year.kinds.length > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                <KindsText kinds={year.kinds} />
              </Typography>
            )}
            <MonthBars
              months={year.months}
              selectedMonth={period.month}
              lastSelectableMonth={period.year === thisYear ? thisMonth : 12}
              onSelect={(selected) => setPeriod({ year: period.year, month: selected })}
            />
            {year.count > 0 && <YearRatings year={year} />}
          </Paper>

          <Paper variant="outlined" component="section" aria-label="見た作品" sx={{ borderRadius: 3, overflow: 'clip' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
              <Typography component="h2" sx={{ fontWeight: 700, flexGrow: 1 }}>
                見た作品
              </Typography>
              {canEdit && (
                <Button
                  ref={addButton}
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    // 前の通知が残っていると、ダイアログの保存ボタンの上に重なる
                    setNotice(null)
                    setEditTarget({ movie: { movie_id: newManualId(), title: '', image: '' }, isNew: true })
                  }}
                >
                  作品を追加
                </Button>
              )}
            </Box>
            {month.days.length === 0 ? (
              <Box sx={{ py: 4, px: 2, textAlign: 'center' }}>
                <Typography color="text.secondary" sx={{ mb: 1.5 }}>
                  {kindFilter !== 'all'
                    ? 'この月に、この種類の視聴記録はありません。'
                    : records.canWrite
                      ? (
                        <>
                          この月の視聴記録はまだありません。ウォッチリストの「見た」か、ウォッチリストに無い作品（テレビアニメなど）は
                          <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
                            「作品を追加」
                          </Box>
                          から記録できます。
                        </>
                      )
                      : 'この月の視聴記録はまだありません。'}
                </Typography>
                <Button variant="outlined" href="#/">
                  ウォッチリストへ
                </Button>
              </Box>
            ) : (
              <List disablePadding>
                {month.days.map((day) => (
                  <li key={day.date}>
                    <List disablePadding>
                      <ListSubheader sx={{ bgcolor: 'grey.50', fontWeight: 700, lineHeight: '36px', top: HEADER_HEIGHT }}>{dayHeading(day.date)}</ListSubheader>
                      {day.items.map((item) => (
                        <RecordRow key={item.movie_id} item={item} canEdit={canEdit} onOpenMenu={openMenu} />
                      ))}
                    </List>
                  </li>
                ))}
              </List>
            )}
          </Paper>
        </>
      )}

      <Menu anchorEl={menu?.anchor} open={Boolean(menu?.open)} onClose={closeMenu}>
        <MenuItem
          onClick={() => {
            const { item } = menu
            closeMenu()
            setNotice(null)
            setEditTarget({ movie: item, initial: entries[item.movie_id] })
          }}
        >
          記録を編集
        </MenuItem>
        <MenuItem onClick={() => unwatch(menu.item)}>
          {menu && isManualId(menu.item.movie_id) ? '記録を削除' : '見たいに戻す'}
        </MenuItem>
      </Menu>

      {editTarget && (
        <WatchDialog
          key={editTarget.movie.movie_id}
          movie={editTarget.movie}
          initial={editTarget.initial}
          title={editTarget.isNew ? '作品を追加して記録' : '記録を編集'}
          // 手で追加した作品はタイトルも直せる（新規はテレビアニメを記録する場面が多いのでアニメを選んでおく）
          editableTitle={isManualId(editTarget.movie.movie_id)}
          defaultKind={editTarget.isNew ? 'anime' : null}
          canWrite={records.canWrite}
          onSave={records.save}
          onSaved={(change) => {
            setNotice({
              severity: 'success',
              text: editTarget.isNew ? `「${change.title}」を記録しました` : `「${change.title}」の記録を更新しました`,
            })
            showRecord(change)
            setEditTarget(null)
          }}
          onClose={() => setEditTarget(null)}
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
                // action を渡すと Alert の閉じるボタンが消えるので自分で置く（再試行の失敗通知は自動では閉じないため）
                <>
                  <Button ref={undoButton} color="inherit" size="small" onClick={() => undo(notice.undo)}>
                    {notice.severity === 'error' ? '再試行' : '元に戻す'}
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
