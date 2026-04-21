import { Code, Flex, Text } from '@radix-ui/themes'

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
    <Flex
      gap="5"
      wrap="wrap"
      style={{
        background: 'var(--gray-3)',
        border: '1px solid var(--gray-6)',
        borderRadius: 'var(--radius)',
        padding: '10px 14px',
      }}
    >
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
  )
}
