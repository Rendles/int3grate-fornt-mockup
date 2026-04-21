import { useEffect, useMemo, useState } from 'react'
import { Code, Text } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { PageHeader, CommandBar, InfoHint, PolicyModeChip } from '../components/common'
import { TextInput } from '../components/fields'
import { EmptyState, ErrorState, LoadingList } from '../components/states'
import { IconArrowRight, IconTool } from '../components/icons'
import { api } from '../lib/api'
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
      return t.name.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q)
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

        <div className="row" style={{ gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 260px', maxWidth: 420 }}>
            <TextInput
              size="1"
              placeholder="filter by name or description…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <Text size="1" color="gray" className="uppercase" style={{ marginLeft: 4 }}>default_mode</Text>
          {MODES.map(m => (
            <button
              key={m}
              className={`chip${mode === m ? (m === 'requires_approval' ? ' chip--warn' : ' chip--accent') : ''}`}
              style={{ cursor: 'pointer' }}
              onClick={() => setMode(m)}
            >
              {m}{' '}
              <Code variant="ghost" style={{ color: 'var(--gray-10)' }}>{counts[m] ?? 0}</Code>
            </button>
          ))}
        </div>

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
          <div className="card" style={{ padding: 0 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '240px 140px minmax(0, 1fr) 28px',
                gap: 14,
                padding: '10px 16px',
                background: 'var(--gray-3)',
                borderBottom: '1px solid var(--gray-6)',
                fontFamily: 'var(--code-font-family)',
                fontSize: 10,
                color: 'var(--gray-10)',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
              }}
            >
              <span>name</span>
              <span>default_mode</span>
              <span>description</span>
              <span />
            </div>
            {filtered.map(t => {
              const open = expanded.has(t.name)
              return (
                <div key={t.name} style={{ borderBottom: '1px solid var(--gray-6)' }}>
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
                    <Code variant="ghost" style={{ fontSize: 12, color: 'var(--gray-12)' }}>{t.name}</Code>
                    <span><PolicyModeChip mode={t.default_mode} /></span>
                    <span style={{ fontSize: 12.5, color: 'var(--gray-11)', lineHeight: 1.5 }}>
                      {t.description ?? <span className="muted">—</span>}
                    </span>
                    <IconArrowRight
                      className="ic"
                      style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform 120ms' }}
                    />
                  </button>
                  {open && (
                    <div style={{ padding: '0 16px 16px' }}>
                      <Text as="div" size="1" color="gray" className="uppercase" style={{ fontSize: 9.5, marginBottom: 6 }}>
                        input_schema
                      </Text>
                      <pre
                        style={{
                          fontFamily: 'var(--code-font-family)',
                          fontSize: 11,
                          color: 'var(--gray-12)',
                          background: 'var(--gray-3)',
                          border: '1px solid var(--gray-6)',
                          padding: 12,
                          borderRadius: 4,
                          margin: 0,
                          whiteSpace: 'pre-wrap',
                          maxHeight: 280,
                          overflow: 'auto',
                        }}
                      >
                        {JSON.stringify(t.input_schema, null, 2)}
                      </pre>
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
