import { useEffect, useMemo, useState } from 'react'
import { Badge, Box, Button, Code, Flex, Text } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { Caption, PageHeader, InfoHint } from '../components/common'
import { TextInput } from '../components/fields'
import { EmptyState, ErrorState, LoadingList } from '../components/states'
import { IconArrowRight, IconTool } from '../components/icons'
import { api } from '../lib/api'
import { humanKey, policyModeLabel, toolLabel } from '../lib/format'
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

        <Flex align="center" gap="2" mb="4" wrap="wrap">
          <Flex align="center" gap="2" wrap="wrap">
            <Caption mr="1">policy</Caption>
            {MODES.map(m => {
              const isActive = mode === m
              const activeColor = m === 'requires_approval' ? 'amber' : 'blue'
              const label = m === 'all' ? 'All' : policyModeLabel(m)
              return (
                <Button
                  key={m}
                  type="button"
                  size="2"
                  variant="soft"
                  color={isActive ? activeColor : 'gray'}
                  onClick={() => setMode(m)}
                >
                  <span>{label}</span>
                  <Code variant="ghost" size="1" color="gray">{counts[m] ?? 0}</Code>
                </Button>
              )
            })}
          </Flex>
          <Box flexGrow="1" />
          <Box width="260px">
            <TextInput
              size="2"
              placeholder="Filter by name or description..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </Box>
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
              <Text as="span" size="1" color="gray">default policy</Text>
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
                        {policyModeLabel(t.default_mode)}
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
                        Parameters
                      </Caption>
                      <ToolParameters schema={t.input_schema} />
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

// ─────────────────────────────────────────────────────────────────
// ToolParameters — renders the tool's JSON Schema as a readable list of
// fields instead of dumping raw JSON. For each property we surface:
//   • Name (humanized snake_case → Sentence case)
//   • Required / Optional pill
//   • Type pill (with array item type appended for arrays)
//   • Description (when the schema author provided one)
//   • Constraints rendered in human terms — minimum/maximum, length range,
//     enum values, format (email / uuid / date-time), default
// ─────────────────────────────────────────────────────────────────

interface JsonSchemaProperty {
  type?: string
  description?: string
  format?: string
  enum?: unknown[]
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  items?: JsonSchemaProperty
  default?: unknown
}

function ToolParameters({ schema }: { schema: Record<string, unknown> }) {
  const properties = (schema.properties as Record<string, JsonSchemaProperty> | undefined) ?? {}
  const required = (schema.required as string[] | undefined) ?? []
  const entries = Object.entries(properties)

  if (entries.length === 0) {
    return <Text size="2" color="gray">This tool takes no parameters.</Text>
  }

  return (
    <Flex direction="column" gap="2">
      {entries.map(([name, prop]) => (
        <ParameterRow
          key={name}
          name={name}
          prop={prop}
          required={required.includes(name)}
        />
      ))}
    </Flex>
  )
}

function ParameterRow({
  name, prop, required,
}: {
  name: string
  prop: JsonSchemaProperty
  required: boolean
}) {
  const constraints = formatConstraints(prop)
  return (
    <Box
      style={{
        padding: '10px 12px',
        background: 'var(--gray-a2)',
        borderRadius: 8,
      }}
    >
      <Flex align="center" gap="2" wrap="wrap">
        <Text as="span" size="2" weight="medium">{humanKey(name)}</Text>
        {required ? (
          <Badge color="amber" variant="soft" radius="full" size="1">Required</Badge>
        ) : (
          <Badge color="gray" variant="outline" radius="full" size="1">Optional</Badge>
        )}
        <Badge color="gray" variant="soft" radius="full" size="1">{typeLabel(prop)}</Badge>
      </Flex>
      {prop.description && (
        <Text as="div" size="1" color="gray" mt="1" style={{ lineHeight: 1.5 }}>
          {prop.description}
        </Text>
      )}
      {constraints.length > 0 && (
        <Flex gap="3" wrap="wrap" mt="2">
          {constraints.map((c, i) => (
            <Text key={i} as="span" size="1" color="gray">{c}</Text>
          ))}
        </Flex>
      )}
    </Box>
  )
}

function typeLabel(prop: JsonSchemaProperty): string {
  const t = prop.type
  if (!t) return 'any'
  if (t === 'integer') return 'Integer'
  if (t === 'number') return 'Number'
  if (t === 'string') return 'Text'
  if (t === 'boolean') return 'Yes / No'
  if (t === 'array') {
    const item = prop.items?.type
    if (item) return `Array of ${item === 'string' ? 'text' : item}`
    return 'Array'
  }
  if (t === 'object') return 'Object'
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function formatConstraints(prop: JsonSchemaProperty): string[] {
  const out: string[] = []
  if (prop.format) {
    out.push(`Format: ${prop.format}`)
  }
  if (Array.isArray(prop.enum) && prop.enum.length > 0) {
    out.push(`One of: ${prop.enum.map(v => String(v)).join(', ')}`)
  }
  if (typeof prop.minimum === 'number' && typeof prop.maximum === 'number') {
    out.push(`Between ${prop.minimum} and ${prop.maximum}`)
  } else if (typeof prop.minimum === 'number') {
    out.push(`Min: ${prop.minimum}`)
  } else if (typeof prop.maximum === 'number') {
    out.push(`Max: ${prop.maximum}`)
  }
  if (typeof prop.minLength === 'number' && typeof prop.maxLength === 'number') {
    out.push(`${prop.minLength}–${prop.maxLength} characters`)
  } else if (typeof prop.minLength === 'number') {
    out.push(`At least ${prop.minLength} characters`)
  } else if (typeof prop.maxLength === 'number') {
    out.push(`Up to ${prop.maxLength} characters`)
  }
  if (prop.default !== undefined) {
    out.push(`Default: ${typeof prop.default === 'string' ? prop.default : JSON.stringify(prop.default)}`)
  }
  return out
}
