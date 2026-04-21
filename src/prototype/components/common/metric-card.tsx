import type { ReactNode } from 'react'
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
  const borderColor = tone === 'warn' ? 'var(--amber-6)' : undefined
  const content = (
    <Flex direction="column" gap="2">
      <Flex justify="between" align="center">
        <Text size="1" color="gray" weight="medium" style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {label}
        </Text>
        {icon && <Text size="1" color="gray">{icon}</Text>}
      </Flex>
      <Flex align="baseline" gap="2">
        <Heading size="7" weight="regular" style={{ letterSpacing: '-0.02em' }}>
          {value}
        </Heading>
        {unit && <Text size="1" color="gray">{unit}</Text>}
      </Flex>
      {delta && <Text size="1" color="gray">{delta}</Text>}
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
