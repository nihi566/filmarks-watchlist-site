import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import { recordsErrorMessage } from '../records/github.js'

// 視聴記録の一覧・サマリーは次の段階で作る。いまは読み込めているかだけを示す
export default function RecordsPage({ records }) {
  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', px: 2, pt: 2, pb: 4 }}>
      {records.status === 'error' && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={records.reload}>
              再試行
            </Button>
          }
          sx={{ mb: 2 }}
        >
          {recordsErrorMessage(records.error)}
        </Alert>
      )}
      <Paper variant="outlined" sx={{ borderRadius: 3, p: 3, textAlign: 'center' }}>
        <Typography sx={{ fontWeight: 700, mb: 1 }}>準備中</Typography>
        {records.status === 'loading' ? (
          <CircularProgress size={24} aria-label="視聴記録を読み込み中" />
        ) : (
          records.file && (
            <Typography variant="body2" color="text.secondary">
              保存されている視聴記録: {Object.keys(records.file.records).length}件
            </Typography>
          )
        )}
      </Paper>
    </Box>
  )
}
