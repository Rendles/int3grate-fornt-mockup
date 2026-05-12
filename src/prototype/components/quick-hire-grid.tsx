// Two-click agent hire surface. Renders a grid of starter-template cards;
// clicking one expands inline to show role / apps / sample tasks / approvals
// and a Hire button that goes through the same API chain as /agents/new.
//
// Used by src/prototype/screens/AgentsScreen.tsx as an inline empty-state.
//
// The hire chain (createAgent → createVersion → setGrants → activateVersion)
// is shared with AgentNewScreen.tsx; we don't deduplicate because the wizard
// also passes user-edited model/temperature/maxTokens which the template
// flow doesn't touch.

import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Badge, Box, Button, Card, Flex, Spinner, Text } from '@radix-ui/themes'

import { Avatar, Caption } from './common'
import { Banner, NoAccessState } from './states'
import { IconArrowLeft, IconArrowRight, IconCheck } from './icons'
import { Link, useRouter } from '../router'
import { useAuth } from '../auth'
import { useHireTemplate } from '../lib/use-hire-template'
import type { HireResult } from '../lib/use-hire-template'
import {
  QUICK_HIRE_TEMPLATES,
  appsFromGrants,
  extractSampleTasks,
} from '../lib/quick-hire'
import type { AssistantTemplate } from '../lib/templates'
import type { Workspace } from '../lib/types'

export type QuickHireGridMode = 'standalone' | 'embedded'

export interface QuickHireGridProps {
  mode: QuickHireGridMode
  // Called with the freshly-hired agent id after the chain completes. If
  // omitted, the component navigates to /agents/:id.
  onAfterHire?: (agentId: string) => void
}

export function QuickHireGrid({ mode, onAfterHire }: QuickHireGridProps) {
  const { user, activeWorkspaceId, myWorkspaces } = useAuth()
  const { navigate } = useRouter()
  const isMember = user?.role === 'member'
  const { hire: hireTemplate, busy, error: hireError, clearError } = useHireTemplate()

  const [expandedId, setExpandedId] = useState<string | null>(null)
  // Per-card success state. Keyed by template id so multiple expanded cards
  // (we don't allow that today, but defensive) wouldn't crosstalk. Cleared
  // on collapse / "Hire another".
  const [hireResultByTemplate, setHireResultByTemplate] = useState<Record<string, HireResult>>({})

  const hire = async (template: AssistantTemplate) => {
    if (busy) return
    try {
      const result = await hireTemplate(template)
      setHireResultByTemplate(prev => ({ ...prev, [template.id]: result }))
      // Note: we intentionally do NOT navigate or call onAfterHire here.
      // Maria sees the success state in the card with the workspace info,
      // then chooses to open the agent or hire another. That gives her time
      // to read where the agent landed before context-switching.
    } catch {
      // useHireTemplate already populated `error` state — banner will show.
    }
  }

  const onOpenAgent = (template: AssistantTemplate) => {
    const result = hireResultByTemplate[template.id]
    if (!result) return
    if (onAfterHire) {
      onAfterHire(result.agentId)
    } else {
      navigate(`/agents/${result.agentId}`)
    }
  }

  const onHireAnother = (templateId: string) => {
    setHireResultByTemplate(prev => {
      const next = { ...prev }
      delete next[templateId]
      return next
    })
    setExpandedId(null)
  }

  // Member-guard: in standalone, render a full NoAccessState. In embedded,
  // return null — caller is responsible for an alternative empty surface
  // (AgentsScreen renders a neutral EmptyState there).
  if (isMember) {
    if (mode === 'standalone') {
      return (
        <NoAccessState
          requiredRole="Team Admin or Workspace Admin"
          body="Only admins can hire new agents."
        />
      )
    }
    return null
  }

  return (
    <>
      {mode === 'standalone' && (
        <Box mt="3" mb="4">
          <Banner tone="info" title="This is a working preview">
            Hires created here are real and will appear on{' '}
            <Link to="/agents">/agents</Link>.
            Need a blank agent? Use the{' '}
            <Link to="/agents/new">full hire wizard</Link>.
          </Banner>
        </Box>
      )}

      <Box
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 12,
        }}
      >
        {QUICK_HIRE_TEMPLATES.map(t => {
          const isExpanded = expandedId === t.id
          // One-click hire always lands in the user's active workspace
          // (see lib/use-hire-template.ts). The card preview surfaces
          // that placement so there are no surprises.
          const targetWorkspace = activeWorkspaceId
            ? myWorkspaces.find(w => w.id === activeWorkspaceId)
            : undefined
          return (
            <Box
              key={t.id}
              style={isExpanded ? { gridColumn: '1 / -1' } : undefined}
            >
              <TemplateCard
                template={t}
                expanded={isExpanded}
                onToggle={() => {
                  if (busy) return
                  clearError()
                  setExpandedId(isExpanded ? null : t.id)
                }}
                busy={isExpanded && busy}
                error={isExpanded ? hireError : null}
                onHire={() => hire(t)}
                hireResult={hireResultByTemplate[t.id] ?? null}
                targetWorkspace={targetWorkspace ?? null}
                onOpenAgent={() => onOpenAgent(t)}
                onHireAnother={() => onHireAnother(t.id)}
              />
            </Box>
          )
        })}
      </Box>
    </>
  )
}

function TemplateCard({
  template,
  expanded,
  onToggle,
  busy,
  error,
  onHire,
  hireResult,
  targetWorkspace,
  onOpenAgent,
  onHireAnother,
}: {
  template: AssistantTemplate
  expanded: boolean
  onToggle: () => void
  busy: boolean
  error: string | null
  onHire: () => void
  hireResult: HireResult | null
  targetWorkspace: Workspace | null
  onOpenAgent: () => void
  onHireAnother: () => void
}) {
  const cardStyle: CSSProperties = expanded
    ? { borderColor: 'var(--accent-7)' }
    : { cursor: 'pointer' }

  return (
    <Card
      variant="surface"
      size="2"
      className={!expanded ? 'card--hover' : undefined}
      style={cardStyle}
      onClick={!expanded ? onToggle : undefined}
      role={!expanded ? 'button' : undefined}
      tabIndex={!expanded ? 0 : undefined}
      onKeyDown={
        !expanded
          ? e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onToggle()
              }
            }
          : undefined
      }
    >
      <Flex gap="3" align="start">
        <Avatar initials={template.initials} size={32} />
        <Box minWidth="0" style={{ flex: 1 }}>
          <Text as="div" size="3" weight="medium">{template.defaultName}</Text>
          <Text as="div" size="2" color="gray" mt="1">{template.shortPitch}</Text>
        </Box>
      </Flex>

      {expanded && hireResult && (
        <SuccessBody
          template={template}
          hireResult={hireResult}
          onOpenAgent={onOpenAgent}
          onHireAnother={onHireAnother}
        />
      )}
      {expanded && !hireResult && (
        <ExpandedBody
          template={template}
          onCancel={onToggle}
          onHire={onHire}
          busy={busy}
          error={error}
          targetWorkspace={targetWorkspace}
        />
      )}
    </Card>
  )
}

function ExpandedBody({
  template,
  onCancel,
  onHire,
  busy,
  error,
  targetWorkspace,
}: {
  template: AssistantTemplate
  onCancel: () => void
  onHire: () => void
  busy: boolean
  error: string | null
  targetWorkspace: Workspace | null
}) {
  const apps = appsFromGrants(template.defaultGrants)
  const sampleTasks = extractSampleTasks(template.defaultInstructions)
  // Quick-hire always lands in the user's active workspace — see
  // lib/use-hire-template.ts. The line tells the user where exactly
  // so there's no surprise after the click.
  const wsCopy = targetWorkspace
    ? { line: `In your ${targetWorkspace.name} workspace.` }
    : null

  return (
    <Box mt="4">
      <Text as="p" size="2" color="gray">
        {template.longPitch}
      </Text>

      {wsCopy && (
        <Box mt="4">
          <Caption>Where they'll work</Caption>
          <Box mt="2">
            <Text as="div" size="2">{wsCopy.line}</Text>
          </Box>
        </Box>
      )}

      {apps.length > 0 && (
        <Box mt="4">
          <Caption>Apps they'll use</Caption>
          <Flex gap="2" wrap="wrap" mt="2">
            {apps.map(a => (
              <Badge key={a} color="gray" variant="soft" radius="full">{a}</Badge>
            ))}
          </Flex>
        </Box>
      )}

      {sampleTasks.length > 0 && (
        <Box mt="4">
          <Caption>What they'll do</Caption>
          <Box asChild mt="2">
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {sampleTasks.map((t, i) => (
                <li key={i}>
                  <Text size="2">{t}</Text>
                </li>
              ))}
            </ul>
          </Box>
        </Box>
      )}

      {template.approvalCopy.length > 0 && (
        <Box mt="4">
          <Caption>They'll ask before</Caption>
          <Box asChild mt="2">
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {template.approvalCopy.map((c, i) => (
                <li key={i}>
                  <Text size="2">{c}</Text>
                </li>
              ))}
            </ul>
          </Box>
        </Box>
      )}

      {error && (
        <Box mt="4">
          <Banner tone="danger" title="Couldn't hire">{error}</Banner>
        </Box>
      )}

      <Flex justify="end" gap="2" mt="5">
        <Button variant="soft" color="gray" onClick={onCancel} disabled={busy}>
          <IconArrowLeft />
          Back
        </Button>
        <Button variant="solid" onClick={onHire} disabled={busy}>
          {busy ? (
            <>
              <Spinner size="1" />
              Hiring…
            </>
          ) : (
            <>
              <IconCheck />
              Hire {template.defaultName}
            </>
          )}
        </Button>
      </Flex>
    </Box>
  )
}

// Post-hire success state inside the expanded card. Shows where the
// agent landed and offers two next steps: open the agent or hire
// another from a fresh card.
function SuccessBody({
  template,
  hireResult,
  onOpenAgent,
  onHireAnother,
}: {
  template: AssistantTemplate
  hireResult: HireResult
  onOpenAgent: () => void
  onHireAnother: () => void
}) {
  const { workspace } = hireResult
  return (
    <Box mt="4">
      <Banner tone="success" title={`Hired ${template.defaultName}.`}>
        <Text as="span" size="2">
          They're on duty in your <strong>{workspace.name}</strong> workspace.
          {' '}You can switch to it from the sidebar at any time.
        </Text>
      </Banner>
      <Flex justify="end" gap="2" mt="4">
        <Button variant="soft" color="gray" onClick={onHireAnother}>
          Hire another
        </Button>
        <Button variant="solid" onClick={onOpenAgent}>
          Open {template.defaultName}
          <IconArrowRight />
        </Button>
      </Flex>
    </Box>
  )
}
