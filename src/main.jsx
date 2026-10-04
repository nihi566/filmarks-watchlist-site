import React from 'react'
import ReactDOM from 'react-dom/client'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import App from './App.jsx'

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1a6fe0' },
    header: { main: '#1c2b4a', contrastText: '#fff' },
    background: { default: '#f5f7fa' },
  },
  shape: { borderRadius: 8 },
  components: {
    // 狭い画面で Alert の操作ボタン（「設定を開く」「再試行」）が「設定を開/く」と割れないようにする
    // 本文が細くなりすぎる狭い画面では、操作ボタンを本文の下の行へ回す
    MuiAlert: {
      styleOverrides: {
        root: { flexWrap: 'wrap' },
        message: { flex: '1 1 12em', minWidth: 0 },
        action: { '& .MuiButton-root': { whiteSpace: 'nowrap' } },
      },
    },
    // 区切りの無い長い英数字（URL や英題）が画面の横にはみ出さないよう、はみ出すときだけ途中で折り返す
    // 段落の最後の 1 文字だけが次の行に残る（「ありませ / ん」）のも避ける
    MuiCssBaseline: { styleOverrides: { body: { overflowWrap: 'break-word', textWrap: 'pretty' } } },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)
