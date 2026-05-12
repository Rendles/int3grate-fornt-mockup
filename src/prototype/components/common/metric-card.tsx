import type { ReactNode } from 'react'
import { cloneElement, isValidElement } from 'react'
import { Card, Flex, Heading, Text } from '@radix-ui/themes'

export function MetricCard({
  label,
  value,
  unit,
  delta,
  icon,
  href,
  tone,
}: {
  label: string
  value: ReactNode
  unit?: ReactNode
  delta?: ReactNode
  icon?: ReactNode
  href?: string
  tone?: 'warn'
}) {
  const borderColor = tone === 'warn' ? 'var(--orange-6)' : undefined
  const grayTen: React.CSSProperties = { color: 'var(--gray-10)' }
  const iconWrap: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px',
    background: 'var(--accent-a2)',
    borderRadius: '8px',
    color: 'var(--accent-9)',
    lineHeight: 0,
  }
  const content = (
    <Flex direction="column" gap="2" style={{ position: 'relative' }}>
      {icon && (
        <span style={{ ...iconWrap, position: 'absolute', top: 0, right: 0 }}>
          {isValidElement(icon)
            ? cloneElement(icon as React.ReactElement<{ size?: number }>, { size: 24 })
            : icon}
        </span>
      )}
      <Text size="1" weight="medium" style={grayTen}>
        {label}
      </Text>
      <Flex align="baseline" gap="2">
        <Heading size="8" weight="medium">
          {value}
        </Heading>
        {unit && <Text size="1" style={grayTen}>{unit}</Text>}
      </Flex>
      {delta && <Text size="1" style={grayTen}>{delta}</Text>}
    </Flex>
  )

  if (href) {
    return (
      <Card asChild variant="surface" size="2" style={{ borderColor }}>
        <a href={`#${href}`} style={{ color: 'inherit', textDecoration: 'none', display: 'block' }}>
          {content}
        </a>
      </Card>
    )
  }
  return (
    <Card variant="surface" size="2" style={{ borderColor }}>
      {content}
    </Card>
  )
}
