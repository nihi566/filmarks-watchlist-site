import { useMemo, useState } from 'react'
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
import Rating from '@mui/material/Rating'
import { visuallyHidden } from '@mui/utils'
import WatchDialog from '../components/WatchDialog.jsx'
import FilterButton from '../components/FilterButton.jsx'
import { recordsErrorMessage } from '../records/github.js'
import { isManualId, newManualId, todayLocal, watchChangeFromEntry } from '../records/records.js'
import { KIND_FILTERS, RATING_LABELS, filterRecordsByKind, kindLabel, matchesKindFilter } from '../records/kinds.js'
import { addMonths, formatMinutes, summarizeMonth, summarizeYear, weekdayLabel } from '../records/summary.js'
import { filmarksMovieUrl, filmarksSearchUrl } from '../filmarks.js'

function Stat({ label, value, unit }) {
  return (
    <Box>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography component="p" sx={{ fontSize: 28, fontWeight: 800, lineHeight: 1.2 }}>
        {value}
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
            onClick={() => onSelect(month)}
            aria-label={`${month}月 ${count}本`}
            aria-pressed={selected}
            sx={{ flexDirection: 'column', justifyContent: 'flex-end', borderRadius: 1, py: 0.5, '&.Mui-disabled': { opacity: 0.4 } }}
          >
            <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {count > 0 ? count : ''}
            </Typography>
            <Box sx={{ height: 64, width: '70%', display: 'flex', alignItems: 'flex-end' }}>
              <Box
                sx={{
                  width: '100%',
                  height: count > 0 ? `${Math.max(8, (count / max) * 100)}%` : 2,
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

function dayHeading(date) {
  const [, m, d] = date.split('-').map(Number)
  return `${m}月${d}日（${weekdayLabel(date)}）`
}

// 「アニメ 2本（24話）・邦画 1本」のような種類ごとの内訳
function kindsText(kinds) {
  return kinds
    .map(({ kind, count, episodes }) => `${kindLabel(kind)} ${count}本${kind === 'anime' && episodes > 0 ? `（${episodes}話）` : ''}`)
    .join('・')
}

// 一覧の 2 行目: 種類・話数・視聴時間
function itemDetail(item) {
  const parts = [kindLabel(item.kind)]
  if (item.kind === 'anime' && item.episodes) parts.push(`${item.episodes}話`)
  parts.push(item.minutes != null ? formatMinutes(item.minutes) : '視聴時間不明')
  return parts.join('・')
}

function itemUrl(item) {
  return isManualId(item.movie_id) ? filmarksSearchUrl(item.title, item.kind) : filmarksMovieUrl(item.movie_id)
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
  const [menu, setMenu] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [notice, setNotice] = useState(null)
  const [kindFilter, setKindFilter] = useState('all')

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
  const isThisMonth = period.year === thisYear && period.month === thisMonth
  // 記録を読み終えるまで編集・見たいに戻すを出さない（古い内容で上書きしないため）
  const canEdit = records.canWrite && records.status === 'ready'

  const move = (delta) => setPeriod((current) => addMonths(current.year, current.month, delta))

  // ウォッチリスト由来の作品は「見たい」に戻し、手で追加した作品は記録を消す（どちらも元に戻せる）
  const unwatch = async (item) => {
    setMenu(null)
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
    setNotice(null)
    try {
      await records.save(change)
      setNotice({ severity: 'success', text: `「${change.title}」の記録を元に戻しました` })
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
              <Button color="inherit" size="small" onClick={records.reload}>
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
    <Box sx={{ maxWidth: 600, mx: 'auto', px: 2, pt: 1.5, pb: 4, display: 'grid', gap: 2 }}>
      {records.status === 'error' && (
        <Alert
          severity="warning"
          action={
            <Button color="inherit" size="small" onClick={records.reload}>
              再試行
            </Button>
          }
        >
          最新の視聴記録を読み込めませんでした。{recordsErrorMessage(records.error)}
        </Alert>
      )}

      <Box role="group" aria-label="種類で絞り込む" sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {[...KIND_FILTERS, ...(hasUnclassified ? [{ value: 'none', label: '未分類' }] : [])].map((filter) => (
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

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
        <IconButton aria-label="前の月" onClick={() => move(-1)}>
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
        <Typography sx={{ fontWeight: 700, mb: 1 }}>
          {period.year}年{period.month}月のまとめ
        </Typography>
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
            {kindsText(month.kinds)}
          </Typography>
        )}
        {month.unknownCount > 0 && (
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5 }}>
            視聴時間が分からない {month.unknownCount} 本は時間に含めていません
          </Typography>
        )}
      </Paper>

      <Paper variant="outlined" component="section" aria-label={`${period.year}年のまとめ`} sx={{ borderRadius: 3, p: 2 }}>
        <Typography sx={{ fontWeight: 700, mb: 1 }}>{period.year}年のまとめ</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Stat label="見た作品" value={year.count} unit="本" />
          <Stat label="視聴時間" value={formatMinutes(year.minutes)} />
        </Box>
        {year.kinds.length > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {kindsText(year.kinds)}
          </Typography>
        )}
        <MonthBars
          months={year.months}
          selectedMonth={period.month}
          lastSelectableMonth={period.year === thisYear ? thisMonth : 12}
          onSelect={(selected) => setPeriod({ year: period.year, month: selected })}
        />
      </Paper>

      <Paper variant="outlined" component="section" aria-label="見た作品" sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
          <Typography component="h2" sx={{ fontWeight: 700, flexGrow: 1 }}>
            見た作品
          </Typography>
          {canEdit && (
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setEditTarget({ movie: { movie_id: newManualId(), title: '', image: '' }, isNew: true })}
            >
              作品を追加
            </Button>
          )}
        </Box>
        {month.days.length === 0 ? (
          <Box sx={{ py: 4, px: 2, textAlign: 'center' }}>
            <Typography color="text.secondary" sx={{ mb: 1.5 }}>
              {kindFilter === 'all'
                ? 'この月の視聴記録はまだありません。ウォッチリストの「見た」か、ウォッチリストに無い作品（テレビアニメなど）は「作品を追加」から記録できます。'
                : 'この月に、この種類の視聴記録はありません。'}
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
                  <ListSubheader sx={{ bgcolor: 'grey.50', fontWeight: 700, lineHeight: '36px' }}>{dayHeading(day.date)}</ListSubheader>
                  {day.items.map((item) => (
                    <ListItem
                      key={item.movie_id}
                      disablePadding
                      secondaryAction={
                        canEdit && (
                          <IconButton
                            edge="end"
                            aria-label={`「${item.title}」の操作`}
                            onClick={(event) => setMenu({ anchor: event.currentTarget, item })}
                          >
                            <MoreVertIcon />
                          </IconButton>
                        )
                      }
                    >
                      {/* 記録した作品の Filmarks ページ（レビューや Mark を付けに行く導線） */}
                      <ListItemButton
                        component="a"
                        href={itemUrl(item)}
                        target="_blank"
                        rel="noopener"
                        sx={{ pr: canEdit ? 7 : 2 }}
                      >
                      <ListItemAvatar sx={{ minWidth: 44 }}>
                        <Avatar variant="rounded" src={item.image || undefined} alt="" sx={{ width: 30, height: 40, bgcolor: 'grey.200', color: 'grey.500' }}>
                          <MovieIcon fontSize="small" />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={item.title}
                        secondary={
                          <>
                            <ItemRating value={item.rating} />
                            <Box component="span" sx={{ display: 'block' }}>
                              {itemDetail(item)}
                            </Box>
                          </>
                        }
                        slotProps={{ primary: { variant: 'body2' } }}
                      />
                      <OpenInNewIcon aria-hidden="true" sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0, ml: 1 }} />
                      <Box component="span" sx={visuallyHidden}>
                        （新しいタブで開きます）
                      </Box>
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </li>
            ))}
          </List>
        )}
      </Paper>

      <Menu anchorEl={menu?.anchor} open={Boolean(menu)} onClose={() => setMenu(null)}>
        <MenuItem
          onClick={() => {
            const { item } = menu
            setMenu(null)
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
                <Button color="inherit" size="small" onClick={() => undo(notice.undo)}>
                  {notice.severity === 'error' ? '再試行' : '元に戻す'}
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
