import { useCallback, useEffect, useState } from 'react'
import { Badge, Box, Button, Dialog, Flex, IconButton, Text } from '@radix-ui/themes'

import { api } from '../lib/api'
import { ago } from '../lib/format'
import { useUser } from '../lib/user-lookup'
import type { AgentVersion } from '../lib/types'
import { ErrorState, LoadingList } from './states'
import { IconArrowRight } from './icons'

// Version history block for AgentDetail → Advanced. Lists every version
// (active + past) newest-first, expands on chevron to show the brief.
// Admin / domain_admin can rollback to an inactive version via the
// Activate button — fires POST /agents/{id}/versions/{vid}/activate.

interface VersionHistoryProps {
  agentId: string
  agentName: string
  canEdit: boolean
  onRetrain: () => void
  onActivated: () => void
}

export function VersionHistory({
  agentId,
  agentName,
  canEdit,
  onRetrain,
  onActivated,
}: VersionHistoryProps) {
  const [versions, setVersions] = useState<AgentVersion[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [activateTarget, setActivateTarget] = useState<AgentVersion | null>(null)
  const [busy, setBusy] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    api.listAgentVersions(agentId, { limit: 50 })
      .then(({ items }) => { if (!cancelled) setVersions(items) })
      .catch(err => { if (!cancelled) setError(err.message || 'Failed to load version history') })
    return () => { cancelled = true }
  }, [agentId, reloadKey])

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleActivate = async () => {
    if (!activateTarget) return
    setBusy(true)
    try {
      await api.activateVersion(agentId, activateTarget.id)
      setActivateTarget(null)
      setReloadKey(k => k + 1)
      onActivated()
    } catch (err) {
      setError((err as Error).message || 'Failed to activate version')
    } finally {
      setBusy(false)
    }
  }

  const activeVersion = versions?.find(v => v.is_active) ?? null

  return (
    <div className="card">
      <div className="card__head">
        <Text as="div" size="2" weight="medium" className="card__title">Version history</Text>
        {canEdit && (
          <Button variant="ghost" size="1" onClick={onRetrain}>
            Retrain {agentName.split(' ')[0] || agentName}
          </Button>
        )}
      </div>
      <div className="card__body">
        {error ? (
          <ErrorState
            title="Couldn't load version history"
            body={error}
            onRetry={() => { setError(null); setReloadKey(k => k + 1) }}
          />
        ) : !versions ? (
          <LoadingList rows={3} />
        ) : versions.length <= 1 ? (
          <Text as="div" size="2" color="gray">
            No earlier versions yet — your first brief is the current one.
          </Text>
        ) : (
          <Flex direction="column" gap="0">
            {versions.map((v, i) => (
              <VersionRow
                key={v.id}
                version={v}
                isFirst={i === 0}
                isExpanded={expandedIds.has(v.id)}
                canActivate={canEdit && !v.is_active}
                onToggle={() => toggleExpand(v.id)}
                onActivate={() => setActivateTarget(v)}
              />
            ))}
          </Flex>
        )}
      </div>

      <Dialog.Root
        open={!!activateTarget}
        onOpenChange={open => { if (!open && !busy) setActivateTarget(null) }}
      >
        <Dialog.Content size="2" maxWidth="440px">
          <Dialog.Title>
            Activate version {activateTarget?.version}?
          </Dialog.Title>
          <Dialog.Description size="2" mb="3" color="gray">
            {activeVersion
              ? `Your current setup (v${activeVersion.version}) will move to history. You can come back to it any time — nothing is deleted.`
              : 'This version will become the active one.'}
          </Dialog.Description>
          <Flex gap="2" justify="end" mt="4">
            <Dialog.Close>
              <Button variant="soft" color="gray" disabled={busy}>
                Cancel
              </Button>
            </Dialog.Close>
            <Button onClick={handleActivate} disabled={busy}>
              {busy ? 'Activating…' : `Activate v${activateTarget?.version}`}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </div>
  )
}

function VersionRow({
  version,
  isFirst,
  isExpanded,
  canActivate,
  onToggle,
  onActivate,
}: {
  version: AgentVersion
  isFirst: boolean
  isExpanded: boolean
  canActivate: boolean
  onToggle: () => void
  onActivate: () => void
}) {
  const author = useUser(version.created_by)?.name
  return (
    <Box
      style={{
        borderTop: isFirst ? 'none' : '1px solid var(--gray-a3)',
        padding: '12px 0',
      }}
    >
      <Flex align="center" gap="3">
        <IconButton
          variant="ghost"
          color="gray"
          size="1"
          onClick={onToggle}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
          aria-expanded={isExpanded}
          style={{
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}
        >
          <IconArrowRight size={12} />
        </IconButton>
        <Flex align="center" gap="2" minWidth="0" flexGrow="1" wrap="wrap">
          <Text as="span" size="2" weight="medium">v{version.version}</Text>
          {version.is_active && (
            <Badge color="cyan" radius="full" size="1">Active</Badge>
          )}
          <Text as="span" size="1" color="gray" className="truncate">
            {author ? `${author} · ${ago(version.created_at)}` : ago(version.created_at)}
          </Text>
        </Flex>
        {canActivate && (
          <Button variant="soft" size="1" onClick={onActivate}>
            Activate
          </Button>
        )}
      </Flex>
      {isExpanded && (
        <Box mt="3" ml="6">
          <Text
            as="div"
            size="2"
            style={{
              whiteSpace: 'pre-wrap',
              lineHeight: 1.6,
              fontStyle: 'italic',
              borderLeft: '3px solid var(--accent-a6)',
              paddingLeft: 14,
              color: 'var(--gray-12)',
            }}
          >
            {version.instruction_spec}
          </Text>
        </Box>
      )}
    </Box>
  )
}
