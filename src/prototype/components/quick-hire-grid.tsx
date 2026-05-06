// Two-click agent hire surface. Renders a grid of starter-template cards;
// clicking one expands inline to show role / apps / sample tasks / approvals
// and a Hire button that goes through the same API chain as /agents/new.
//
// Used in two places:
//   - src/prototype/screens/sandbox/QuickHireScreen.tsx (standalone preview)
//   - src/prototype/screens/AgentsScreen.tsx (inline empty-state)
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
import { IconArrowLeft, IconCheck } from './icons'
import { Link, useRouter } from '../router'
import { useAuth } from '../auth'
import { useHireTemplate } from '../lib/use-hire-template'
import {
  QUICK_HIRE_TEMPLATES,
  appsFromGrants,
  extractSampleTasks,
} from '../lib/quick-hire'
import type { AssistantTemplate } from '../lib/templates'

export type QuickHireGridMode = 'standalone' | 'embedded'

export interface QuickHireGridProps {
  mode: QuickHireGridMode
  // Called with the freshly-hired agent id after the chain completes. If
  // omitted, the component navigates to /agents/:id.
  onAfterHire?: (agentId: string) => void
}

export function QuickHireGrid({ mode, onAfterHire }: QuickHireGridProps) {
  const { user } = useAuth()
  const { navigate } = useRouter()
  const isMember = user?.role === 'member'
  const { hire: hireTemplate, busy, error: hireError, clearError } = useHireTemplate()

  const [expandedId, setExpandedId] = useState<string | null>(null)

  const hire = async (template: AssistantTemplate) => {
    if (busy) return
    try {
      const { agentId } = await hireTemplate(template)
      if (onAfterHire) {
        onAfterHire(agentId)
      } else {
        navigate(`/agents/${agentId}`)
      }
    } catch {
      // useHireTemplate already populated `error` state — banner will show.
    }
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
}: {
  template: AssistantTemplate
  expanded: boolean
  onToggle: () => void
  busy: boolean
  error: string | null
  onHire: () => void
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

      {expanded && (
        <ExpandedBody
          template={template}
          onCancel={onToggle}
          onHire={onHire}
          busy={busy}
          error={error}
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
}: {
  template: AssistantTemplate
  onCancel: () => void
  onHire: () => void
  busy: boolean
  error: string | null
}) {
  const apps = appsFromGrants(template.defaultGrants)
  const sampleTasks = extractSampleTasks(template.defaultInstructions)

  return (
    <Box mt="4">
      <Text as="p" size="2" color="gray">
        {template.longPitch}
      </Text>

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
