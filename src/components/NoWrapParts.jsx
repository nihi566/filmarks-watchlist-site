import { Fragment } from 'react'
import Box from '@mui/material/Box'

// 「84時間」「49分」や「アニメ 10本」「邦画 8本」のような区切りの中では改行させず、区切りの間でだけ折り返す
// （狭い画面で「洋 / 画」「84時間49 / 分」のように語や数と単位が割れないようにする）
export default function NoWrapParts({ parts, separator = '' }) {
  return parts.map((part, index) => (
    <Fragment key={index}>
      {index > 0 && separator}
      <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
        {part}
      </Box>
    </Fragment>
  ))
}
