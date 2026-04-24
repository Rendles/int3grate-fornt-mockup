import { useMemo } from 'react'
import { Flex, Text } from '@radix-ui/themes'
import { IconTask } from '../../components/icons'
import type { Task, TaskStatus } from '../../lib/types'

const TASK_OUTCOME_COLORS: Record<TaskStatus, string> = {
  completed: 'var(--green-9)',
  running: 'var(--blue-9)',
  pending: 'var(--amber-9)',
  failed: 'var(--red-9)',
  cancelled: 'var(--gray-8)',
}

export function TaskOutcomesCard({ tasks }: { tasks: Task[] }) {
  const counts = useMemo(() => {
    const c: Record<TaskStatus, number> = {
      pending: 0, running: 0, completed: 0, failed: 0, cancelled: 0,
    }
    for (const t of tasks) c[t.status]++
    return c
  }, [tasks])
  const total = tasks.length
  const successRate = total > 0 ? Math.round((counts.completed / total) * 100) : 0

  const segments = (Object.keys(counts) as TaskStatus[])
    .map(k => ({ key: k, value: counts[k], color: TASK_OUTCOME_COLORS[k] }))
    .filter(s => s.value > 0)

  const r = 32
  const C = 2 * Math.PI * r
  let acc = 0

  return (
    <div className="card">
      <div className="card__head">
        <Text as="div" size="2" weight="medium" className="card__title">
          <IconTask className="ic" />
          Task outcomes
        </Text>
        <Text size="1" color="gray">{total} total</Text>
      </div>
      <div
        className="card__body"
        style={{ padding: '14px 18px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}
      >
        <div className="donut donut--lg">
          <svg viewBox="0 0 80 80" aria-hidden="true">
            <circle cx="40" cy="40" r={r} fill="none" stroke="var(--gray-a3)" strokeWidth="10" />
            {segments.map(s => {
              const dash = total > 0 ? (s.value / total) * C : 0
              const el = (
                <circle
                  key={s.key}
                  cx="40"
                  cy="40"
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="10"
                  strokeDasharray={`${dash} ${C}`}
                  strokeDashoffset={-acc}
                  transform="rotate(-90 40 40)"
                />
              )
              acc += dash
              return el
            })}
          </svg>
          <div className="donut__center">
            <Text size="7" weight="medium" style={{ lineHeight: 1, letterSpacing: '-0.02em' }}>{successRate}%</Text>
            <Text size="1" color="gray" style={{ lineHeight: 1 }}>success</Text>
          </div>
        </div>
        <Flex direction="column" gap="2" width="100%">
          {segments.map(s => (
            <Flex key={s.key} align="center" justify="between" gap="2">
              <Flex align="center" gap="2" minWidth="0">
                <span className="legend-dot" style={{ background: s.color }} />
                <Text size="1" style={{ textTransform: 'capitalize' }}>{s.key}</Text>
              </Flex>
              <Text size="1" color="gray">{s.value}</Text>
            </Flex>
          ))}
        </Flex>
      </div>
    </div>
  )
}
