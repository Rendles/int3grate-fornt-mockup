import type { CSSProperties, ReactNode } from 'react'
import { Text } from '@radix-ui/themes'

type CaptionAs = 'span' | 'div' | 'p' | 'label'

export function Caption({
  children,
  as = 'span',
  style,
}: {
  children: ReactNode
  as?: CaptionAs
  style?: CSSProperties
}) {
  const base: CSSProperties = { textTransform: 'uppercase', letterSpacing: '0.08em' }
  const merged = style ? { ...base, ...style } : base
  if (as === 'span') return <Text as="span" color="gray" size="1" style={merged}>{children}</Text>
  if (as === 'div') return <Text as="div" color="gray" size="1" style={merged}>{children}</Text>
  if (as === 'p') return <Text as="p" color="gray" size="1" style={merged}>{children}</Text>
  return <Text as="label" color="gray" size="1" style={merged}>{children}</Text>
}
