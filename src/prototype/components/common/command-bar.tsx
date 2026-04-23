import { Card, Code, Flex, Text } from '@radix-ui/themes'

type Tone = 'accent' | 'warn' | 'muted'

const VALUE_COLOR: Partial<Record<Tone, 'blue' | 'amber' | 'gray'>> = {
  accent: 'blue',
  warn: 'amber',
  muted: 'gray',
}

export function CommandBar({
  parts,
}: {
  parts: { label: string; value: string; tone?: Tone }[]
}) {
  return (
    <Card size="1">
      <Flex gap="5" wrap="wrap" px="1" py="1">
        {parts.map((p, i) => (
          <Flex key={i} gap="2" align="baseline">
            <Text
              size="1"
              color="gray"
              style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}
            >
              {p.label}
            </Text>
            <Code variant="ghost" color={p.tone ? VALUE_COLOR[p.tone] : undefined}>
              {p.value}
            </Code>
          </Flex>
        ))}
      </Flex>
    </Card>
  )
}
