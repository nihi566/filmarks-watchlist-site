import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Link from '@mui/material/Link'
import MenuItem from '@mui/material/MenuItem'
import Autocomplete from '@mui/material/Autocomplete'
import { fetchRecords, OWNER, REPO, recordsErrorMessage } from '../records/github.js'
import { PROVIDERS, defaultBaseUrl, isValidBaseUrl } from '../llm/settings.js'
import { listModels, llmErrorMessage } from '../llm/client.js'

const NEW_TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new'
const OLLAMA_URL = 'https://ollama.com/download'
const LM_STUDIO_URL = 'https://lmstudio.ai/'

function Code({ children }) {
  return (
    <Box component="code" sx={{ px: 0.5, py: 0.25, borderRadius: 0.5, bgcolor: 'grey.100', fontSize: 12.5, wordBreak: 'break-all' }}>
      {children}
    </Box>
  )
}

// おすすめ機能で使うローカル LLM の接続先とモデル。保存はこの端末のブラウザにだけ
function LlmSettingsSection({ settings, onSave }) {
  const [provider, setProvider] = useState(settings.provider)
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl)
  const [model, setModel] = useState(settings.model)
  const [models, setModels] = useState([])
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState(null)
  const origin = window.location.origin

  const urlError = isValidBaseUrl(baseUrl.trim()) ? '' : 'http:// か https:// で始まる URL を入力してください'
  const draft = { provider, baseUrl: baseUrl.trim(), model: model.trim() }

  const changeProvider = (value) => {
    // 既定の URL のままなら、選んだ種類の既定の URL に入れ替える
    if (baseUrl.trim() === defaultBaseUrl(provider)) setBaseUrl(defaultBaseUrl(value))
    setProvider(value)
    setModels([])
  }

  const check = async () => {
    setChecking(true)
    setResult(null)
    try {
      const names = await listModels(draft)
      setModels(names)
      if (!draft.model && names.length > 0) setModel(names[0])
      setResult(
        names.length > 0
          ? { severity: 'success', text: `接続できました（モデル ${names.length} 個）。使うモデルを選んで保存してください。` }
          : { severity: 'warning', text: '接続できましたが、モデルが入っていません。LLM 側でモデルを追加してください。' },
      )
    } catch (err) {
      setResult({ severity: 'error', text: llmErrorMessage(err, draft) })
    } finally {
      setChecking(false)
    }
  }

  const save = (event) => {
    event.preventDefault()
    if (urlError) return
    setResult(
      onSave(draft)
        ? { severity: 'success', text: draft.model ? '保存しました。「おすすめ」画面から使えます。' : '保存しました。おすすめを使うにはモデルも選んでください。' }
        : { severity: 'error', text: 'このブラウザでは設定を保存できませんでした（プライベートブラウズ等では保存できません）。' },
    )
  }

  return (
    <Paper variant="outlined" component="section" aria-labelledby="llm-settings-heading" sx={{ borderRadius: 3, p: 2 }}>
      <Typography id="llm-settings-heading" component="h2" sx={{ fontWeight: 700, fontSize: 16, mb: 1 }}>
        ローカル LLM（おすすめ機能）
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        「おすすめ」画面では、見た作品と★評価をこの PC で動くローカル LLM に渡して、次に見る作品を選んでもらいます。
        視聴記録は設定した LLM にだけ送られます。設定はこの端末のブラウザにだけ保存されます。
      </Typography>

      <Box component="form" onSubmit={save} sx={{ display: 'grid', gap: 2 }}>
        <TextField select label="LLM の種類" size="small" value={provider} onChange={(event) => changeProvider(event.target.value)}>
          {PROVIDERS.map((item) => (
            <MenuItem key={item.value} value={item.value}>
              {item.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="接続先 URL"
          size="small"
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          error={Boolean(urlError)}
          helperText={urlError || `既定: ${defaultBaseUrl(provider)}`}
          slotProps={{ htmlInput: { inputMode: 'url', autoComplete: 'off', spellCheck: false } }}
        />
        <Autocomplete
          freeSolo
          options={models}
          inputValue={model}
          onInputChange={(_, value) => setModel(value)}
          renderInput={(params) => (
            <TextField {...params} label="モデル" size="small" helperText="「接続を確認」で入っているモデルの一覧を取得できます（例: qwen2.5:7b）" />
          )}
        />
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'flex-end' }}>
          <Button variant="outlined" onClick={check} disabled={checking || Boolean(urlError)}>
            {checking ? '確認中…' : '接続を確認'}
          </Button>
          <Button type="submit" variant="contained" disableElevation disabled={Boolean(urlError)}>
            保存
          </Button>
        </Box>
      </Box>

      {result && (
        <Alert severity={result.severity} role="status" sx={{ mt: 2 }}>
          {result.text}
        </Alert>
      )}

      <Typography component="h3" sx={{ fontWeight: 700, fontSize: 14, mt: 2, mb: 1 }}>
        準備のしかた
      </Typography>
      <Box component="ol" sx={{ m: 0, pl: 2.5, typography: 'body2', display: 'grid', gap: 0.75 }}>
        <li>
          <Link href={OLLAMA_URL} target="_blank" rel="noopener">
            Ollama
          </Link>
          （または{' '}
          <Link href={LM_STUDIO_URL} target="_blank" rel="noopener">
            LM Studio
          </Link>
          ）を PC に入れ、モデルを追加する（例: <Code>ollama pull qwen2.5:7b</Code>）。日本語に強い 7B 以上のモデルほど提案が的確になります
        </li>
        <li>
          このサイトからの接続を許可する。Ollama は環境変数 <Code>OLLAMA_ORIGINS</Code> に <Code>{origin}</Code> を設定して Ollama
          を起動し直す（Mac: <Code>launchctl setenv OLLAMA_ORIGINS &quot;{origin}&quot;</Code>、Windows:
          「環境変数を編集」でユーザー環境変数を追加）。LM Studio はサーバー設定の「Enable CORS」をオンにする
        </li>
        <li>上の「接続を確認」でモデルの一覧が出たら、モデルを選んで保存する</li>
      </Box>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
        LLM を動かしている PC のブラウザ（Chrome・Edge など）から使ってください。スマホからは PC の localhost に届きません。
        ブラウザに「ローカル ネットワークへのアクセス」の確認が出たら許可してください。
      </Typography>
    </Paper>
  )
}

export default function SettingsPage({ token, onSaveToken, onClearToken, llmSettings, onSaveLlmSettings }) {
  const [input, setInput] = useState('')
  const [result, setResult] = useState(null)
  const [checking, setChecking] = useState(false)

  const save = (event) => {
    event.preventDefault()
    const value = input.trim()
    if (!value) return
    // 全角文字などが混じると通信時に例外になり「接続できない」と誤って表示されるため、保存前に弾く
    if (!/^[\x21-\x7E]+$/.test(value)) {
      setResult({ severity: 'error', text: 'トークンに使えない文字（全角文字や空白）が含まれています。貼り付け直してください。' })
      return
    }
    if (onSaveToken(value)) {
      setInput('')
      setResult({ severity: 'success', text: 'トークンを保存しました。「接続を確認」で使えるか確かめられます。' })
    } else {
      setResult({ severity: 'error', text: 'このブラウザではトークンを保存できませんでした（プライベートブラウズ等では保存できません）。' })
    }
  }

  const check = async () => {
    setChecking(true)
    setResult(null)
    try {
      const file = await fetchRecords(token)
      setResult({
        severity: 'success',
        text: `接続できました（視聴記録 ${Object.keys(file.records).length}件）。書き込みの権限は最初に記録を保存したときに確認されます。`,
      })
    } catch (err) {
      setResult({ severity: 'error', text: recordsErrorMessage(err) })
    } finally {
      setChecking(false)
    }
  }

  const clear = () => {
    if (onClearToken()) setResult({ severity: 'info', text: 'トークンを削除しました。記録の閲覧はできますが、保存はできません。' })
    else setResult({ severity: 'error', text: 'トークンを削除できませんでした。' })
  }

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', px: 2, pt: 2, pb: 4, display: 'grid', gap: 2 }}>
      <Paper variant="outlined" sx={{ borderRadius: 3, p: 2 }}>
        <Typography component="h2" sx={{ fontWeight: 700, fontSize: 16, mb: 1 }}>
          GitHub トークン
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          「見た」の記録は GitHub の {OWNER}/{REPO}（records ブランチ）に保存し、スマホと PC で共有します。
          保存するにはトークンが必要です。トークンはこの端末のブラウザにだけ保存され、GitHub 以外へは送信されません。
        </Typography>

        {token ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ flexGrow: 1 }}>
              保存済み（末尾 {token.slice(-4)}）
            </Typography>
            <Button variant="contained" disableElevation onClick={check} disabled={checking}>
              {checking ? '確認中…' : '接続を確認'}
            </Button>
            <Button variant="outlined" color="error" onClick={clear}>
              削除
            </Button>
          </Box>
        ) : (
          <Box component="form" onSubmit={save} sx={{ display: 'flex', gap: 1 }}>
            <TextField
              type="password"
              label="トークン"
              size="small"
              fullWidth
              autoComplete="off"
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
            <Button type="submit" variant="contained" disableElevation disabled={!input.trim()}>
              保存
            </Button>
          </Box>
        )}

        {result && (
          <Alert severity={result.severity} role="status" sx={{ mt: 2 }}>
            {result.text}
          </Alert>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ borderRadius: 3, p: 2 }}>
        <Typography component="h2" sx={{ fontWeight: 700, fontSize: 16, mb: 1 }}>
          トークンの発行手順
        </Typography>
        <Box component="ol" sx={{ m: 0, pl: 2.5, typography: 'body2', display: 'grid', gap: 0.5 }}>
          <li>
            GitHub の{' '}
            <Link href={NEW_TOKEN_URL} target="_blank" rel="noopener">
              Fine-grained トークン作成画面
            </Link>
            を開く
          </li>
          <li>Expiration（有効期限）を設定する（期限切れになったらここで入れ直す）</li>
          <li>
            Repository access で「Only select repositories」を選び、{REPO} だけを選ぶ
          </li>
          <li>Permissions の Repository permissions で「Contents」を「Read and write」にする（他は触らない）</li>
          <li>「Generate token」を押し、表示されたトークンを上の欄に貼り付けて保存する</li>
        </Box>
      </Paper>

      <LlmSettingsSection settings={llmSettings} onSave={onSaveLlmSettings} />
    </Box>
  )
}
