import { useMemo } from 'react'
import { Button, Flex, Text } from '@radix-ui/themes'
import { IconArrowRight, IconSpend } from '../../components/icons'
import type { SpendDashboard } from '../../lib/types'
import { money } from '../../lib/format'

export function SpendByAgentCard({ spend }: { spend: SpendDashboard }) {
  const top = useMemo(
    () => [...spend.items].sort((a, b) => b.total_usd - a.total_usd).slice(0, 5),
    [spend],
  )
  const max = Math.max(...top.map(t => t.total_usd), 1)
  return (
    <div className="card">
      <div className="card__head">
        <Text as="div" size="2" weight="medium" className="card__title">
          <IconSpend className="ic" />
          Spend by agent · 7d
        </Text>
        <Button asChild variant="ghost" color='gray' size="1">
          <a href="#/spend"><IconArrowRight className="ic ic--sm" />All</a>
        </Button>
      </div>
      <div className="card__body" style={{ padding: '14px 18px', flex: 1 }}>
        {top.length === 0 ? (
          <Text as="div" size="2" color="gray" align="center" style={{ padding: '20px 0' }}>
            No spend recorded.
          </Text>
        ) : (
          <Flex direction="column" gap="2">
            {top.map(item => (
              <div key={item.id} className="hbar">
                <Text size="1" className="hbar__label truncate">{item.label}</Text>
                <div className="hbar__track">
                  <div className="hbar__fill" style={{ width: `${(item.total_usd / max) * 100}%` }} />
                </div>
                <Text size="1" color="gray" className="hbar__value">
                  {money(item.total_usd, { compact: true })}
                </Text>
              </div>
            ))}
          </Flex>
        )}
      </div>
      {top.length > 0 && (
        <div className="card__foot" style={{ borderTop: '1px solid var(--gray-a3)' }}>
          <Text size="1" color="gray">Total · {spend.items.length} agents</Text>
          <Text size="2" weight="medium">{money(spend.total_usd, { compact: true })}</Text>
        </div>
      )}
    </div>
  )
}
