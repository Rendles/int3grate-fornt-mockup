import type { ComponentProps, ReactNode } from 'react'
import { Text } from '@radix-ui/themes'

// Kept intentionally: Radix Themes Text has no textTransform / letterSpacing props,
// so this is the one legitimate typography extension on top of Radix.
type CaptionAs = 'span' | 'div' | 'p' | 'label'
type TextProps = ComponentProps<typeof Text>

export function Caption({
  children,
  as = 'span',
  ...rest
}: {
  children: ReactNode
  as?: CaptionAs
} & Pick<TextProps, 'm' | 'mt' | 'mr' | 'mb' | 'ml' | 'mx' | 'my' | 'style'>) {
  const base = { textTransform: 'uppercase' as const, letterSpacing: '0.08em' }
  const merged = rest.style ? { ...base, ...rest.style } : base
  return (
    <Text as={as} color="gray" size="1" {...rest} style={merged}>
      {children}
    </Text>
  )
}
