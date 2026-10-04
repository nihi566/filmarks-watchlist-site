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
import Rating from '@mui/material/Rating'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import FormControl from '@mui/material/FormControl'
import FormLabel from '@mui/material/FormLabel'
import FormHelperText from '@mui/material/FormHelperText'
import { recordsErrorMessage } from '../records/github.js'
import { animeMinutes, initialEpisodeFields, isValidDate, todayLocal } from '../records/records.js'
import { KINDS, RATING_LABELS } from '../records/kinds.js'
import { formatMinutes } from '../records/summary.js'

// 空欄は「不明」として null で保存する
function parseCount(text, min) {
  if (text.trim() === '') return { ok: true, value: null }
  const value = Number(text)
  return Number.isInteger(value) && value >= min ? { ok: true, value } : { ok: false }
}

function numberText(value) {
  return value != null ? String(value) : ''
}

function ratingText(value) {
  return value ? `★${value}（${RATING_LABELS[value]}）` : '未評価'
}

const numberInput = (unit) => ({
  htmlInput: { min: 0, step: 1, inputMode: 'numeric' },
  input: { endAdornment: <InputAdornment position="end">{unit}</InputAdornment> },
})

// 「見た」に記録するダイアログ。保存に成功したときだけ onSaved を呼ぶ（失敗時は理由を出して閉じない）。
// initial を渡すと既存の記録の編集になる（各欄の初期値を記録から取る）。
// editableTitle はウォッチリストに無い作品（テレビアニメなど）を手で追加するときに使い、タイトルも入力させる。
// defaultKind は最初に選んでおく種類、kindNote はその種類のまま変えていないときに出す補足
export default function WatchDialog({
  movie,
  initial,
  title = '見たに記録',
  editableTitle = false,
  defaultKind = null,
  kindNote = '',
  canWrite,
  onSave,
  onSaved,
  onClose,
}) {
  const today = todayLocal()
  // 映画は上映時間、記録の編集は記録した時間を初期値にする（アニメへ切り替えたときは 1 話ぶんとして使う）
  const baseMinutes = initial ? initial.minutes : movie.runtime_min
  const [titleText, setTitleText] = useState(movie.title ?? '')
  const [kind, setKind] = useState(initial?.kind ?? defaultKind)
  const [rating, setRating] = useState(initial?.rating ?? null)
  const [hoverRating, setHoverRating] = useState(-1)
  const [watchedOn, setWatchedOn] = useState(initial?.watched_on ?? today)
  const [minutesText, setMinutesText] = useState(numberText(baseMinutes))
  // テレビアニメは 1 クール（12 話・1 話 24 分）を初期値にする。上映時間が分かる劇場アニメは 1 話ぶんとして扱う。
  // アニメの記録の編集は記録の値のまま（空欄は空欄）
  const [episodesText, setEpisodesText] = useState(() => numberText(initialEpisodeFields(initial, baseMinutes).episodes))
  const [episodeMinutesText, setEpisodeMinutesText] = useState(() =>
    numberText(initialEpisodeFields(initial, baseMinutes).episode_minutes),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isAnime = kind === 'anime'
  const trimmedTitle = titleText.trim()
  const minutes = parseCount(minutesText, 0)
  const episodes = parseCount(episodesText, 1)
  const episodeMinutes = parseCount(episodeMinutesText, 0)
  const totalMinutes = isAnime ? animeMinutes(episodes.value, episodeMinutes.value) : minutes.value

  const titleError = editableTitle && !trimmedTitle ? 'タイトルを入力してください' : ''
  const dateError = !isValidDate(watchedOn) ? '日付を入力してください' : watchedOn > today ? '未来の日付は選べません' : ''
  const minutesError = !isAnime && !minutes.ok ? '0 以上の整数（分）で入力してください' : ''
  const episodesError = isAnime && !episodes.ok ? '1 以上の整数で入力してください' : ''
  const episodeMinutesError = isAnime && !episodeMinutes.ok ? '0 以上の整数（分）で入力してください' : ''
  const canSubmit =
    canWrite && !saving && kind && !titleError && !dateError && !minutesError && !episodesError && !episodeMinutesError

  const close = () => {
    if (!saving) onClose()
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    setError('')
    const change = {
      type: 'watch',
      movie_id: movie.movie_id,
      title: editableTitle ? trimmedTitle : movie.title,
      image: movie.image ?? '',
      watched_on: watchedOn,
      minutes: totalMinutes,
      rating,
      kind,
      episodes: isAnime ? episodes.value : null,
      episode_minutes: isAnime ? episodeMinutes.value : null,
    }
    try {
      await onSave(change)
      onSaved(change)
    } catch (err) {
      setError(recordsErrorMessage(err))
      setSaving(false)
    }
  }

  const shownRating = hoverRating > 0 ? hoverRating : rating

  return (
    <Dialog
      open
      onClose={close}
      fullWidth
      maxWidth="xs"
      // 狭い画面では既定の左右 32px の余白を 16px にして、入力欄を広く取る
      slotProps={{ paper: { sx: { mx: { xs: 2, sm: 4 }, width: { xs: 'calc(100% - 32px)', sm: 'calc(100% - 64px)' } } } }}
    >
      {/* form が Paper と DialogContent の間に入るので、縦に flex にしないと高さが足りないときに本文だけでなく保存ボタンまで画面外へ流れる */}
      <Box component="form" onSubmit={submit} noValidate sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 2 }}>
          {editableTitle ? (
            <TextField
              label="タイトル"
              size="small"
              required
              value={titleText}
              onChange={(event) => setTitleText(event.target.value)}
              helperText="ウォッチリストに無い作品（テレビアニメなど）を記録できます"
              disabled={saving || !canWrite}
              sx={{ mt: 1 }}
            />
          ) : (
            <Typography sx={{ fontWeight: 700 }}>{movie.title}</Typography>
          )}
          {canWrite ? (
            <>
              <FormControl>
                <FormLabel id="watch-kind-label" sx={{ fontSize: 13, mb: 0.5 }}>
                  種類
                </FormLabel>
                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  size="small"
                  color="primary"
                  value={kind}
                  onChange={(_, value) => {
                    if (value) setKind(value)
                  }}
                  aria-labelledby="watch-kind-label"
                  disabled={saving}
                >
                  {KINDS.map((item) => (
                    <ToggleButton key={item.value} value={item.value} sx={{ fontWeight: 700 }}>
                      {item.label}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
                <FormHelperText sx={{ mx: 0 }}>
                  {!kind
                    ? 'アニメ・邦画・洋画から選んでください'
                    : kindNote && !initial && kind === defaultKind
                      ? kindNote
                      : 'アニメは話数で、邦画・洋画は時間で記録します'}
                </FormHelperText>
              </FormControl>

              <FormControl>
                <FormLabel id="watch-rating-label" sx={{ fontSize: 13, mb: 0.5 }}>
                  評価
                </FormLabel>
                {/* ★にカーソルを乗せると説明の長さが変わるので、説明は下の行に分けて行の高さを変えない */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Rating
                    name="watch-rating"
                    size="large"
                    value={rating}
                    onChange={(_, value) => setRating(value)}
                    onChangeActive={(_, value) => setHoverRating(value)}
                    getLabelText={(value) => `${value}つ星（${RATING_LABELS[value]}）`}
                    disabled={saving}
                    role="radiogroup"
                    aria-labelledby="watch-rating-label"
                  />
                  {rating && (
                    <Button size="small" onClick={() => setRating(null)} disabled={saving} sx={{ minWidth: 0, whiteSpace: 'nowrap' }}>
                      評価を外す
                    </Button>
                  )}
                </Box>
                <Typography variant="body2" color={shownRating ? 'text.primary' : 'text.secondary'} aria-hidden="true">
                  {ratingText(shownRating)}
                </Typography>
              </FormControl>

              <TextField
                label="視聴日"
                type="date"
                size="small"
                value={watchedOn}
                onChange={(event) => setWatchedOn(event.target.value)}
                error={Boolean(dateError)}
                helperText={dateError || (isAnime ? '見終わった日（シリーズは最終話を見た日）' : ' ')}
                disabled={saving}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today } }}
              />

              {isAnime ? (
                <Box>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 1.5 }}>
                    <TextField
                      label="見た話数"
                      type="number"
                      size="small"
                      value={episodesText}
                      onChange={(event) => setEpisodesText(event.target.value)}
                      error={Boolean(episodesError)}
                      helperText={episodesError || '1クールは12話前後'}
                      disabled={saving}
                      slotProps={numberInput('話')}
                    />
                    <TextField
                      label="1話の長さ"
                      type="number"
                      size="small"
                      value={episodeMinutesText}
                      onChange={(event) => setEpisodeMinutesText(event.target.value)}
                      error={Boolean(episodeMinutesError)}
                      helperText={episodeMinutesError || 'テレビアニメは24分前後'}
                      disabled={saving}
                      slotProps={numberInput('分')}
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary" aria-live="polite" sx={{ mt: 0.5 }}>
                    視聴時間: {totalMinutes != null ? formatMinutes(totalMinutes) : '不明'}
                  </Typography>
                </Box>
              ) : (
                <TextField
                  label="視聴時間"
                  type="number"
                  size="small"
                  value={minutesText}
                  onChange={(event) => setMinutesText(event.target.value)}
                  error={Boolean(minutesError)}
                  helperText={
                    minutesError ||
                    (!initial && movie.runtime_min ? '上映時間を入れています。途中までなら書き換えてください' : '分からなければ空欄のままで構いません')
                  }
                  disabled={saving}
                  slotProps={numberInput('分')}
                />
              )}
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
