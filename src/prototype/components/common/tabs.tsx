import { TabNav, Tabs as RadixTabs, Text } from '@radix-ui/themes'

type Item = { key: string; label: string; count?: number | string; href?: string; dataTour?: string }

function Count({ value }: { value: number | string }) {
  return (
    <Text size="1" color="gray" ml="2">
      {value}
    </Text>
  )
}

export function Tabs({
  items,
  active,
  onSelect,
}: {
  items: Item[]
  active: string
  onSelect?: (key: string) => void
}) {
  const hasHref = items.some(t => t.href)

  if (hasHref) {
    return (
      <TabNav.Root>
        {items.map(t => (
          <TabNav.Link key={t.key} asChild active={active === t.key}>
            <a href={t.href ? `#${t.href}` : undefined} data-tour={t.dataTour}>
              <span>{t.label}</span>
              {t.count != null && <Count value={t.count} />}
            </a>
          </TabNav.Link>
        ))}
      </TabNav.Root>
    )
  }

  return (
    <RadixTabs.Root value={active} onValueChange={v => onSelect?.(v)}>
      <RadixTabs.List>
        {items.map(t => (
          <RadixTabs.Trigger key={t.key} value={t.key} data-tour={t.dataTour}>
            <span>{t.label}</span>
            {t.count != null && <Count value={t.count} />}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
    </RadixTabs.Root>
  )
}
