import Drawer from '@mui/material/Drawer'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import { PAGES } from './navigation.js'

export default function AppMenu({ open, onClose, currentPage }) {
  return (
    <Drawer anchor="left" open={open} onClose={onClose}>
      <Box component="nav" aria-label="メインメニュー" sx={{ width: 260 }}>
        <Typography sx={{ px: 2, pt: 2, pb: 1, fontWeight: 900, fontSize: 16 }}>Filmarks 記録帳</Typography>
        <List>
          {PAGES.map(({ id, hash, label, Icon }) => (
            <ListItemButton
              key={id}
              component="a"
              href={hash}
              selected={id === currentPage}
              aria-current={id === currentPage ? 'page' : undefined}
              onClick={onClose}
            >
              <ListItemIcon>
                <Icon />
              </ListItemIcon>
              <ListItemText primary={label} />
            </ListItemButton>
          ))}
        </List>
      </Box>
    </Drawer>
  )
}
