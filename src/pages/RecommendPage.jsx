import { useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Chip from '@mui/material/Chip'
import Link from '@mui/material/Link'
import Avatar from '@mui/material/Avatar'
import CircularProgress from '@mui/material/CircularProgress'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import MovieIcon from '@mui/icons-material/Movie'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { visuallyHidden } from '@mui/utils'
import FilterButton from '../components/FilterButton.jsx'
import { KIND_FILTERS, kindLabel } from '../records/kinds.js'
import { recordsErrorMessage } from '../records/github.js'
import { uniqueMovies } from '../watchlist.js'
import { filmarksMovieUrl, filmarksSearchUrl } from '../filmarks.js'
import { focusFirst } from '../focusFirst.js'
import { useRetryFocus } from '../useRetryFocus.js'
import { chatJson, llmErrorMessage } from '../llm/client.js'
import { RECOMMEND_MODES, buildRecommendationRequest, parseRecommendations, pickCandidates } from '../llm/recommend.js'
import NoWrapParts from '../components/NoWrapParts.jsx'

// 読み込み中は数字の代わりに 3 桁分の空きを取る（読み上げは「読み込み中」）
function StatNumber({ ready, value }) {
  if (ready) return value
  return (
    <>
      <Box component="span" aria-hidden="true" sx={{ visibility: 'hidden' }}>
        000
      </Box>
      <Box component="span" sx={visuallyHidden}>
        読み込み中
      </Box>
    </>
  )
}

function OptionGroup({ label, options, value, onChange, disabled }) {
  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
        {label}
      </Typography>
      <Box role="group" aria-label={label} sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {options.map((option) => (
          <FilterButton
            key={option.value}
            selected={value === option.value}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            disabled={disabled}
          >
            {option.label}
          </FilterButton>
        ))}
      </Box>
    </Box>
  )
}

function RecommendationCard({ item, rank }) {
  const { movie } = item
  const href = movie ? filmarksMovieUrl(movie.movie_id) : filmarksSearchUrl(item.title, item.kind)
  return (
    <Paper component="li" variant="outlined" sx={{ borderRadius: 3, p: 2, display: 'flex', gap: 1.5, listStyle: 'none' }}>
      <Avatar variant="rounded" src={movie?.image || undefined} alt="" sx={{ width: 48, height: 64, bgcolor: 'grey.200', color: 'grey.500' }}>
        <MovieIcon />
      </Avatar>
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Typography component="h3" sx={{ fontWeight: 700, fontSize: 15, lineHeight: 1.4, overflowWrap: 'anywhere', wordBreak: 'normal' }}>
          <Box component="span" sx={visuallyHidden}>
            {rank}位:{' '}
          </Box>
          {item.title}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, my: 0.75 }}>
          {item.kind && <Chip size="small" color="primary" variant="outlined" label={kindLabel(item.kind)} />}
          {item.country && (
            <Chip
              size="small"
              variant="outlined"
              label={<NoWrapParts parts={item.country.split('・')} separator="・" />}
              sx={{ height: 'auto', maxWidth: '100%', '& .MuiChip-label': { whiteSpace: 'normal', py: 0.25 } }}
            />
          )}
          {movie?.runtime_min ? <Chip size="small" label={`${movie.runtime_min}分`} /> : null}
          {movie && (
            // サービスが多いと 1 行に収まらないので、チップの中で折り返す（画面の横にはみ出さないように）
            <Chip
              size="small"
              // サービス名の途中（「Prime / Video」）では改行しない
              label={movie.services.length > 0 ? <NoWrapParts parts={movie.services} separator="・" /> : '未配信'}
              sx={{ height: 'auto', maxWidth: '100%', '& .MuiChip-label': { whiteSpace: 'normal', py: 0.25 } }}
            />
          )}
          {!movie && <Chip size="small" label="ウォッチリスト外" />}
        </Box>
        {item.reason && (
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {item.reason}
          </Typography>
        )}
        <Link href={href} target="_blank" rel="noopener" variant="body2" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
          {movie ? 'Filmarks で見る' : 'Filmarks で探す'}
          <OpenInNewIcon aria-hidden="true" sx={{ fontSize: 14 }} />
          <Box component="span" sx={visuallyHidden}>
            （新しいタブで開きます）
          </Box>
        </Link>
      </Box>
    </Paper>
  )
}

export default function RecommendPage({ records, watchlist, llmSettings }) {
  const [kind, setKind] = useState('all')
  const [mode, setMode] = useState('watchlist')
  const [wish, setWish] = useState('')
  const [run, setRun] = useState({ status: 'idle', results: [], error: '', prompt: '' })
  const [elapsed, setElapsed] = useState(0)
  const [received, setReceived] = useState(0)
  const controller = useRef(null)
  // 再試行で消えた Alert の代わりに、成功したら直前の条件（選択中の種類・選び方）へ、また失敗したら新しい「再試行」へ戻す
  const recordsRetry = useRetryFocus(records.status, () =>
    focusFirst(['[role="group"][aria-label="種類"] [aria-pressed="true"]']),
  )
  const watchlistRetry = useRetryFocus(watchlist.data ? 'ready' : watchlist.error ? 'error' : 'loading', () =>
    focusFirst(['[role="group"][aria-label="どこから選ぶか"] [aria-pressed="true"]']),
  )

  // 画面を離れたら問い合わせを止める（ローカル LLM の計算を無駄に続けさせない）
  useEffect(() => () => controller.current?.abort(), [])

  useEffect(() => {
    if (run.status !== 'running') return
    setElapsed(0)
    const started = Date.now()
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [run.status])

  const entries = records.file?.records
  const stats = useMemo(() => {
    const list = Object.values(entries ?? {})
    return {
      total: list.length,
      rated: list.filter((entry) => entry.rating).length,
      liked: list.filter((entry) => entry.rating >= 4).length,
    }
  }, [entries])

  const running = run.status === 'running'
  const needsWatchlist = mode === 'watchlist'
  const watchlistReady = Boolean(watchlist.data)
  const statsReady = records.status !== 'loading' || Boolean(records.file)
  const canRun = Boolean(llmSettings.model) && records.status !== 'loading' && (!needsWatchlist || watchlistReady) && !running

  const ask = async () => {
    const candidates = needsWatchlist ? pickCandidates(uniqueMovies(watchlist.data.tabs), entries, kind) : []
    if (needsWatchlist && candidates.length === 0) {
      setRun({
        status: 'error',
        results: [],
        error: 'ウォッチリストに、この種類のまだ見ていない作品がありません。「新しい作品も」を選んでください。',
        prompt: '',
      })
      return
    }
    const request = buildRecommendationRequest({ records: entries, candidates, kind, mode, wish })
    const prompt = request.messages.map((message) => message.content).join('\n\n')
    const current = new AbortController()
    controller.current?.abort()
    controller.current = current
    setRun({ status: 'running', results: [], error: '', prompt })
    setReceived(0)
    try {
      const json = await chatJson(llmSettings, request, { signal: current.signal, onProgress: setReceived })
      const results = parseRecommendations(json, { mode, candidates, records: entries, kind })
      setRun({
        status: 'done',
        results,
        error: results.length === 0 ? '条件に合う作品を選べませんでした。もう一度試すか、条件を変えてください。' : '',
        prompt,
      })
    } catch (err) {
      if (controller.current !== current) return
      setRun({ status: err.kind === 'abort' ? 'idle' : 'error', results: [], error: err.kind === 'abort' ? '' : llmErrorMessage(err, llmSettings), prompt })
    } finally {
      if (controller.current === current) controller.current = null
    }
  }

  const cancel = () => controller.current?.abort()

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', px: 2, pt: 1.5, pb: 4, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 2 }}>
      {!llmSettings.model && (
        <Alert
          severity="info"
          action={
            <Button color="inherit" size="small" href="#/settings">
              設定を開く
            </Button>
          }
        >
          おすすめを使うには、設定画面でローカル LLM（Ollama など）の接続先とモデルを選んでください。
        </Alert>
      )}
      {records.status === 'error' && (
        <Alert
          severity="warning"
          action={
            <Button ref={recordsRetry.buttonRef} color="inherit" size="small" onClick={recordsRetry.wrapRetry(records.reload)}>
              再試行
            </Button>
          }
        >
          視聴記録を読み込めなかったため、好みを踏まえた提案になりません。{recordsErrorMessage(records.error)}
        </Alert>
      )}

      <Paper variant="outlined" component="section" aria-label="おすすめの条件" sx={{ borderRadius: 3, p: 2, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 2 }}>
        <Typography variant="body2">
          {/* 読み込み中に 0 本と出して、読み込み後に数字だけ変わって行がずれないよう、最初の読み込みが終わるまでは 3 桁分の幅を空けておく */}
          見た作品 <StatNumber ready={statsReady} value={stats.total} /> 本（★評価あり <StatNumber ready={statsReady} value={stats.rated} /> 本・うち★4以上{' '}
          <StatNumber ready={statsReady} value={stats.liked} /> 本）をもとに、ローカル LLM が次に見る作品を選びます。
        </Typography>
        {records.status === 'ready' && stats.rated === 0 && (
          <Typography variant="body2" color="text.secondary">
            見た作品に★評価を付けると、好みに合った提案になります（
            {records.canWrite
              ? '視聴記録の「記録を編集」から付けられます'
              : '設定で GitHub トークンを保存すると、視聴記録の「記録を編集」から付けられます'}
            ）。
          </Typography>
        )}

        <OptionGroup label="種類" options={KIND_FILTERS} value={kind} onChange={setKind} disabled={running} />
        <OptionGroup label="どこから選ぶか" options={RECOMMEND_MODES} value={mode} onChange={setMode} disabled={running} />
        {kind === 'anime' && mode === 'watchlist' && (
          <Typography variant="body2" color="text.secondary">
            ウォッチリストは映画だけなので、選べるのは劇場アニメです。テレビアニメのシリーズを探すときは「新しい作品も」を選んでください。
          </Typography>
        )}
        {needsWatchlist && watchlist.error && (
          <Alert
            severity="error"
            action={
              <Button ref={watchlistRetry.buttonRef} color="inherit" size="small" onClick={watchlistRetry.wrapRetry(watchlist.retry)}>
                再試行
              </Button>
            }
          >
            {watchlist.error}
          </Alert>
        )}

        <TextField
          label="今日の希望（任意）"
          placeholder="例: 2時間以内で、泣ける作品"
          size="small"
          value={wish}
          onChange={(event) => setWish(event.target.value)}
          disabled={running}
          slotProps={{ htmlInput: { maxLength: 200 } }}
        />

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button variant="contained" disableElevation startIcon={<AutoAwesomeIcon />} onClick={ask} disabled={!canRun}>
            おすすめを聞く
          </Button>
          {running && (
            <>
              <Button onClick={cancel}>中止</Button>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }} role="status">
                <CircularProgress size={18} aria-hidden="true" />
                <Typography variant="body2" color="text.secondary">
                  {received > 0 ? `答えを受け取り中…（${elapsed}秒・${received}文字）` : `考え中…（${elapsed}秒）`}
                </Typography>
              </Box>
            </>
          )}
        </Box>
        {running && (
          <Typography variant="caption" color="text.secondary">
            PC の性能とモデルの大きさによっては、答えが出るまで数分かかります。
          </Typography>
        )}
      </Paper>

      {run.error && (
        <Alert severity={run.status === 'done' ? 'warning' : 'error'} role="alert">
          {run.error}
        </Alert>
      )}

      <Box component="p" aria-live="polite" sx={visuallyHidden}>
        {run.status === 'done' && run.results.length > 0 ? `おすすめを ${run.results.length} 件表示しました` : ''}
      </Box>

      {run.results.length > 0 && (
        <Box component="section" aria-label="おすすめの作品">
          <Typography component="h2" sx={{ fontWeight: 700, mb: 1 }}>
            おすすめの作品
          </Typography>
          <Box component="ol" sx={{ m: 0, p: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 1.5 }}>
            {run.results.map((item, index) => (
              <RecommendationCard key={item.movie?.movie_id ?? item.title} item={item} rank={index + 1} />
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
            LLM の答えには、実在しない作品や誤った説明が混じることがあります。
          </Typography>
        </Box>
      )}

      {run.prompt && (
        <Accordion disableGutters variant="outlined" sx={{ borderRadius: 3, '&::before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="body2">LLM に送った内容</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box
              component="pre"
              sx={{ m: 0, p: 1.5, bgcolor: 'grey.100', borderRadius: 1, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 360, overflow: 'auto' }}
            >
              {run.prompt}
            </Box>
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  )
}
