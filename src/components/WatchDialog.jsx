import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import InputAdornment from '@mui/material/InputAdornment'
import { recordsErrorMessage } from '../records/github.js'
import { isValidDate, todayLocal } from '../records/records.js'

// 空欄は「視聴時間不明」として null で保存する
function parseMinutes(text) {
  if (text.trim() === '') return { ok: true, value: null }
  const value = Number(text)
  return Number.isInteger(value) && value >= 0 ? { ok: true, value } : { ok: false }
}

// 「見た」に記録するダイアログ。保存に成功したときだけ onSaved を呼ぶ（失敗時は理由を出して閉じない）。
// initial を渡すと既存の記録の編集になる（視聴日・視聴時間の初期値を記録から取る）
export default function WatchDialog({ movie, initial, title = '見たに記録', canWrite, onSave, onSaved, onClose }) {
  const today = todayLocal()
  const [watchedOn, setWatchedOn] = useState(initial?.watched_on ?? today)
  const [minutesText, setMinutesText] = useState(() => {
    const value = initial ? initial.minutes : movie.runtime_min
    return value != null ? String(value) : ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const minutes = parseMinutes(minutesText)
  const dateError = !isValidDate(watchedOn) ? '日付を入力してください' : watchedOn > today ? '未来の日付は選べません' : ''
  const minutesError = minutes.ok ? '' : '0 以上の整数（分）で入力してください'
  const canSubmit = canWrite && !saving && !dateError && !minutesError

  const close = () => {
    if (!saving) onClose()
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    setError('')
    try {
      await onSave({
        type: 'watch',
        movie_id: movie.movie_id,
        title: movie.title,
        image: movie.image ?? '',
        watched_on: watchedOn,
        minutes: minutes.value,
      })
      onSaved()
    } catch (err) {
      setError(recordsErrorMessage(err))
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={close} fullWidth maxWidth="xs">
      <Box component="form" onSubmit={submit} noValidate>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2 }}>
          <Typography sx={{ fontWeight: 700 }}>{movie.title}</Typography>
          {canWrite ? (
            <>
              <TextField
                label="視聴日"
                type="date"
                size="small"
                value={watchedOn}
                onChange={(event) => setWatchedOn(event.target.value)}
                error={Boolean(dateError)}
                helperText={dateError || ' '}
                disabled={saving}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today } }}
              />
              <TextField
                label="視聴時間"
                type="number"
                size="small"
                value={minutesText}
                onChange={(event) => setMinutesText(event.target.value)}
                error={Boolean(minutesError)}
                helperText={minutesError || (!initial && movie.runtime_min ? '上映時間を入れています。途中までなら書き換えてください' : '分からなければ空欄のままで構いません')}
                disabled={saving}
                slotProps={{
                  htmlInput: { min: 0, step: 1, inputMode: 'numeric' },
                  input: { endAdornment: <InputAdornment position="end">分</InputAdornment> },
                }}
              />
            </>
          ) : (
            <Alert severity="info">
              記録を保存するには、設定で GitHub トークンを保存してください。
            </Alert>
          )}
          {error && (
            <Alert severity="error" role="alert">
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={close} disabled={saving}>
            キャンセル
          </Button>
          {canWrite ? (
            <Button type="submit" variant="contained" disableElevation disabled={!canSubmit}>
              {saving ? '保存中…' : '保存'}
            </Button>
          ) : (
            <Button variant="contained" disableElevation href="#/settings" onClick={onClose}>
              設定を開く
            </Button>
          )}
        </DialogActions>
      </Box>
    </Dialog>
  )
}
