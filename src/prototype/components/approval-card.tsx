import { Badge, Box, Button, Flex, IconButton, Text } from '@radix-ui/themes'

import { Avatar, Caption, Status, WorkspaceContextPill } from './common'
import { IconArrowRight, IconCheck, IconX } from './icons'
import { RejectInlineForm } from './reject-inline-form'
import type { ApprovalRequest } from '../lib/types'
import { ago } from '../lib/format'
import { useUser } from '../lib/user-lookup'

// Card-style preview of a single approval. Avatar + name in header,
// "wants to" + action verb in body, wide Details button + ✓/✕ icon
// buttons on the right. Reject expands the RejectInlineForm inside the
// card, replacing the footer buttons.
//
// Pure visual — owns no state. Parent wires handlers and the expanded
// flag. Used by /approvals (cards view).

export interface ApprovalCardProps {
  approval: ApprovalRequest
  agentName: string
  /** Resolved agent_id (via run.agent_id or chat.agent_id) so the card can
      render a WorkspaceContextPill when the parent screen's page filter is
      showing more than one workspace. Null when the chain can't be resolved
      (orphan run, etc.) — the pill is silently skipped. */
  agentId: string | null
  /** True for chat-source approvals (gateway 0.2.0 / ADR-0011). When set,
      the card shows a small "in chat" badge to distinguish the source. */
  isChatSource?: boolean
  /** Drives whether the WorkspaceContextPill renders. Parent passes
      true when its page-level workspace filter is broader than 1. */
  showWorkspacePill: boolean
  actionVerb: string
  isRejectExpanded: boolean
  rejectReason: string
  rejectTouched: boolean
  /** Minimum characters before Confirm becomes a valid action. */
  rejectMinChars: number
  onOpenDetail: () => void
  onApprove: () => void
  onRejectStart: () => void
  onChangeReason: (v: string) => void
  onBlurReason: () => void
  onRejectCancel: () => void
  onRejectConfirm: () => void
}

export function ApprovalCard(props: ApprovalCardProps) {
  const {
    approval,
    agentName,
    agentId,
    isChatSource,
    showWorkspacePill,
    actionVerb,
    isRejectExpanded,
    rejectReason,
    rejectTouched,
    rejectMinChars,
    onOpenDetail,
    onApprove,
    onRejectStart,
    onChangeReason,
    onBlurReason,
    onRejectCancel,
    onRejectConfirm,
  } = props
  const isPending = approval.status === 'pending'
  const requesterName = useUser(approval.requested_by)?.name

  return (
    <div
      className="card"
      data-tour="approval-row"
      style={{
        padding: 16,
        gap: 12,
        display: 'flex',
        flexDirection: 'column',
        borderColor: isRejectExpanded ? 'var(--red-a6)' : undefined,
      }}
    >
      <Flex align="center" gap="3" minWidth="0">
        <Avatar initials={agentName.slice(0, 2).toUpperCase()} size={36} />
        <Box minWidth="0" flexGrow="1">
          <Flex align="center" gap="2" wrap="wrap">
            <Text as="div" size="3" weight="medium" className="truncate">{agentName}</Text>
            {isChatSource && (
              <Badge color="cyan" variant="soft" radius="full" size="1">in chat</Badge>
            )}
            <WorkspaceContextPill agentId={agentId} show={showWorkspacePill} />
          </Flex>
          <Text as="div" size="1" color="gray" mt="1" className="truncate">
            {requesterName
              ? `Triggered by ${requesterName} · ${ago(approval.created_at)}`
              : `Triggered ${ago(approval.created_at)}`}
          </Text>
        </Box>
        <Status status={approval.status} />
      </Flex>
      <Box>
        <Caption mb="1">wants to</Caption>
        <Text as="div" size="2" weight="medium" style={{ lineHeight: 1.45 }}>
          {actionVerb}
        </Text>
      </Box>
      <Flex direction="column" gap="2" style={{ marginTop: 'auto' }}>
        {isRejectExpanded ? (
          <RejectInlineForm
            reason={rejectReason}
            touched={rejectTouched}
            minChars={rejectMinChars}
            onChangeReason={onChangeReason}
            onBlurReason={onBlurReason}
            onCancel={onRejectCancel}
            onConfirm={onRejectConfirm}
          />
        ) : (
          <Flex gap="2" align="center">
            <Button size="2" variant="soft" onClick={onOpenDetail} style={{ flex: 1, minWidth: 0 }}>
              View full details
              <IconArrowRight className="ic ic--sm" />
            </Button>
            {isPending && (
              <>
                <IconButton
                  size="2"
                  variant="soft"
                  color="jade"
                  onClick={onApprove}
                  title="Quick approve"
                  aria-label={`Quick approve — ${agentName} ${actionVerb}`}
                >
                  <IconCheck className="ic ic--sm" />
                </IconButton>
                <IconButton
                  size="2"
                  variant="soft"
                  color="red"
                  onClick={onRejectStart}
                  title="Quick reject"
                  aria-label={`Quick reject — ${agentName} ${actionVerb}`}
                >
                  <IconX className="ic ic--sm" />
                </IconButton>
              </>
            )}
          </Flex>
        )}
      </Flex>
    </div>
  )
}
