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
import WatchDialog from '../components/WatchDialog.jsx'
import { recordsErrorMessage } from '../records/github.js'
import { todayLocal } from '../records/records.js'
import { addMonths, formatMinutes, summarizeMonth, summarizeYear, weekdayLabel } from '../records/summary.js'

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

export default function RecordsPage({ records }) {
  const today = todayLocal()
  const [thisYear, thisMonth] = today.split('-').map(Number)
  const [period, setPeriod] = useState({ year: thisYear, month: thisMonth })
  const [menu, setMenu] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [notice, setNotice] = useState(null)

  const entries = records.file?.records
  const month = useMemo(() => summarizeMonth(entries, period.year, period.month), [entries, period])
  const previous = addMonths(period.year, period.month, -1)
  const previousCount = useMemo(
    () => summarizeMonth(entries, previous.year, previous.month).count,
    [entries, previous.year, previous.month],
  )
  const year = useMemo(() => summarizeYear(entries, period.year), [entries, period.year])
  const isThisMonth = period.year === thisYear && period.month === thisMonth
  // 記録を読み終えるまで編集・見たいに戻すを出さない（古い内容で上書きしないため）
  const canEdit = records.canWrite && records.status === 'ready'

  const move = (delta) => setPeriod((current) => addMonths(current.year, current.month, delta))

  const unwatch = async (item) => {
    setMenu(null)
    const entry = entries[item.movie_id]
    try {
      await records.save({ type: 'unwatch', movie_id: item.movie_id })
      setNotice({
        severity: 'info',
        text: `「${item.title}」を見たいに戻しました`,
        undo: { type: 'watch', movie_id: item.movie_id, title: entry.title, image: entry.image, watched_on: entry.watched_on, minutes: entry.minutes },
      })
    } catch (err) {
      setNotice({ severity: 'error', text: `見たいに戻せませんでした。${recordsErrorMessage(err)}` })
    }
  }

  const undo = async (change) => {
    setNotice(null)
    try {
      await records.save(change)
      setNotice({ severity: 'success', text: `「${change.title}」の記録を元に戻しました` })
    } catch (err) {
      setNotice({ severity: 'error', text: `元に戻せませんでした。${recordsErrorMessage(err)}` })
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
        <MonthBars
          months={year.months}
          selectedMonth={period.month}
          lastSelectableMonth={period.year === thisYear ? thisMonth : 12}
          onSelect={(selected) => setPeriod({ year: period.year, month: selected })}
        />
      </Paper>

      <Paper variant="outlined" component="section" aria-label="見た作品" sx={{ borderRadius: 3, overflow: 'hidden' }}>
        {month.days.length === 0 ? (
          <Box sx={{ py: 4, px: 2, textAlign: 'center' }}>
            <Typography color="text.secondary" sx={{ mb: 1.5 }}>
              この月の視聴記録はまだありません。ウォッチリストの「見た」から記録できます。
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
                      <ListItemAvatar sx={{ minWidth: 44 }}>
                        <Avatar variant="rounded" src={item.image || undefined} alt="" sx={{ width: 30, height: 40, bgcolor: 'grey.200', color: 'grey.500' }}>
                          <MovieIcon fontSize="small" />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={item.title}
                        secondary={item.minutes != null ? formatMinutes(item.minutes) : '視聴時間不明'}
                        slotProps={{ primary: { variant: 'body2' } }}
                      />
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
        <MenuItem onClick={() => unwatch(menu.item)}>見たいに戻す</MenuItem>
      </Menu>

      {editTarget && (
        <WatchDialog
          key={editTarget.movie.movie_id}
          movie={editTarget.movie}
          initial={editTarget.initial}
          title="記録を編集"
          canWrite={records.canWrite}
          onSave={records.save}
          onSaved={() => {
            setNotice({ severity: 'success', text: `「${editTarget.movie.title}」の記録を更新しました` })
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
