import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Link from '@mui/material/Link'
import { fetchRecords, OWNER, REPO, recordsErrorMessage } from '../records/github.js'

const NEW_TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new'

export default function SettingsPage({ token, onSaveToken, onClearToken }) {
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
    </Box>
  )
}
