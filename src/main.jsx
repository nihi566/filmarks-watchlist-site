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
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)
