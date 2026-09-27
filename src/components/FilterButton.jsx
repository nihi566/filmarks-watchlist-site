import Button from '@mui/material/Button'

// 絞り込み・並び替えの丸いボタン。選択中は塗りつぶし、それ以外は白地の枠線にする
export default function FilterButton({ selected, children, ...props }) {
  return (
    <Button
      size="small"
      variant={selected ? 'contained' : 'outlined'}
      disableElevation
      sx={{
        borderRadius: 999,
        px: 1.75,
        height: 32,
        fontWeight: 700,
        ...(selected ? {} : { bgcolor: 'background.paper', color: 'text.primary', borderColor: 'divider' }),
      }}
      {...props}
    >
      {children}
    </Button>
  )
}
