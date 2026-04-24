import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Code, Flex, Text } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { Caption, PageHeader, CommandBar, InfoHint } from '../components/common'
import { TextInput } from '../components/fields'
import { EmptyState, ErrorState, LoadingList } from '../components/states'
import { IconArrowRight, IconTool } from '../components/icons'
import { api } from '../lib/api'
import { toolLabel } from '../lib/format'
import type { ToolDefinition, ToolPolicyMode } from '../lib/types'

type ModeFilter = ToolPolicyMode | 'all'
const MODES: ModeFilter[] = ['all', 'read_only', 'requires_approval', 'denied']

export default function ToolsScreen() {
  const [tools, setTools] = useState<ToolDefinition[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<ModeFilter>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    api.listTools()
      .then(list => {
        if (cancelled) return
        setTools(list)
        setError(null)
      })
      .catch(e => {
        if (cancelled) return
        setError((e as Error).message ?? 'Failed to load tool catalog')
      })
    return () => { cancelled = true }
  }, [reloadTick])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: tools?.length ?? 0 }
    ;(tools ?? []).forEach(t => { c[t.default_mode] = (c[t.default_mode] ?? 0) + 1 })
    return c
  }, [tools])

  const filtered = useMemo(() => {
    if (!tools) return []
    const q = query.trim().toLowerCase()
    return tools.filter(t => {
      if (mode !== 'all' && t.default_mode !== mode) return false
      if (!q) return true
      return t.name.toLowerCase().includes(q)
        || toolLabel(t.name).toLowerCase().includes(q)
        || (t.description ?? '').toLowerCase().includes(q)
    })
  }, [tools, query, mode])

  const toggle = (name: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'tools' }]}>
      <div className="page page--wide">
        <PageHeader
          eyebrow={
            <>
              TOOLS{' '}
              <InfoHint>
                Public catalog from <Code variant="ghost">GET /tools</Code> (gateway v0.2.0). Used by the UI tool-picker and for validating dispatch before the orchestrator runs.
              </InfoHint>
            </>
          }
          title={<>Tool <em>catalog.</em></>}
          subtitle="Every tool the gateway exposes, with its JSON Schema and the default policy mode agents inherit unless overridden."
        />

        <CommandBar
          parts={[
            { label: 'TOTAL', value: String(tools?.length ?? '—') },
            { label: 'READ_ONLY', value: String(counts.read_only ?? 0), tone: 'accent' },
            { label: 'REQUIRES_APPROVAL', value: String(counts.requires_approval ?? 0), tone: 'warn' },
            { label: 'DENIED', value: String(counts.denied ?? 0) },
          ]}
        />

        <div style={{ height: 16 }} />

        <Flex align="center" gap="2" mb="4" wrap="wrap">
          <div style={{ flex: '1 1 260px', maxWidth: 420 }}>
            <TextInput
              size="1"
              placeholder="filter by name or description…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <Caption ml="1">default_mode</Caption>
          {MODES.map(m => {
            const isActive = mode === m
            const activeColor = m === 'requires_approval' ? 'amber' : 'blue'
            return (
              <Button
                key={m}
                type="button"
                size="2"
                variant="soft"
                color={isActive ? activeColor : 'gray'}
                onClick={() => setMode(m)}
              >
                <span style={{ textTransform: 'capitalize' }}>{m}</span>
                <Code variant="ghost" size="1" color="gray">{counts[m] ?? 0}</Code>
              </Button>
            )
          })}
        </Flex>

        {error ? (
          <ErrorState
            title="Couldn't load tool catalog"
            body={error}
            onRetry={() => setReloadTick(t => t + 1)}
          />
        ) : !tools ? (
          <LoadingList rows={6} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<IconTool />} title="No tools match the current filters" />
        ) : (
          <div className="card card--table">
            <div className="table-head" style={{ gridTemplateColumns: '240px 140px minmax(0, 1fr) 28px' }}>
              <Text as="span" size="1" color="gray">name</Text>
              <Text as="span" size="1" color="gray">default_mode</Text>
              <Text as="span" size="1" color="gray">description</Text>
              <span />
            </div>
            {filtered.map(t => {
              const open = expanded.has(t.name)
              return (
                <div key={t.name} className="tool-row-wrap" style={{ borderBottom: '1px solid var(--gray-a3)' }}>
                  <button
                    onClick={() => toggle(t.name)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '240px 140px minmax(0, 1fr) 28px',
                      gap: 14,
                      padding: '12px 16px',
                      width: '100%',
                      textAlign: 'left',
                      alignItems: 'start',
                      background: 'transparent',
                      color: 'var(--gray-12)',
                    }}
                  >
                    <Text as="div" size="2">{toolLabel(t.name)}</Text>
                    <span>
                      <Badge
                        color={t.default_mode === 'read_only' ? 'cyan' : t.default_mode === 'requires_approval' ? 'amber' : 'red'}
                        variant="soft"
                        radius="small"
                        size="1"
                      >
                        {t.default_mode}
                      </Badge>
                    </span>
                    <Text as="span" size="1" color="gray" style={{ lineHeight: 1.5 }}>
                      {t.description ?? '—'}
                    </Text>
                    <IconArrowRight
                      className="ic"
                      style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform 120ms' }}
                    />
                  </button>
                  {open && (
                    <div style={{ padding: '0 16px 16px' }}>
                      <Caption as="div" mb="2">
                        input_schema
                      </Caption>
                      <Code asChild size="1" variant="soft">
                        <pre
                          style={{
                            padding: 12,
                            margin: 0,
                            whiteSpace: 'pre-wrap',
                            maxHeight: 280,
                            overflow: 'auto',
                          }}
                        >
                          {JSON.stringify(t.input_schema, null, 2)}
                        </pre>
                      </Code>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

      </div>
    </AppShell>
  )
}
