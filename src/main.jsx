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
    // 狭い画面では既定の左右 32px の余白を 16px にして、ダイアログの中を広く取る
    MuiDialog: {
      styleOverrides: {
        paper: ({ theme }) => ({ [theme.breakpoints.down('sm')]: { margin: 16, maxWidth: 'calc(100% - 32px)' } }),
        paperFullWidth: ({ theme }) => ({ [theme.breakpoints.down('sm')]: { width: 'calc(100% - 32px)' } }),
      },
    },
    // 広い画面の下の通知は既定だと画面の半分の幅に押し込まれて縦に長くなるので、560px まで広げる
    MuiSnackbar: {
      styleOverrides: {
        anchorOriginBottomCenter: ({ theme }) => ({
          [theme.breakpoints.up('sm')]: { left: 24, right: 24, transform: 'none', '& > .MuiPaper-root': { maxWidth: 560 } },
        }),
      },
    },
    // 区切りの無い長い英数字（URL や英題）が画面の横にはみ出さないよう、はみ出すときだけ途中で折り返す
    // 段落の最後の 1 文字だけが次の行に残る（「ありませ / ん」）のも避け、日本語は文節の切れ目で改行する（「一 / 致」「オンデマ / ンド」を避ける）
    MuiCssBaseline: { styleOverrides: { body: { overflowWrap: 'break-word', textWrap: 'pretty', wordBreak: 'auto-phrase' } } },
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
