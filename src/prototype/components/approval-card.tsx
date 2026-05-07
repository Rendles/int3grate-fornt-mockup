import { Box, Button, Flex, IconButton, Text } from '@radix-ui/themes'

import { Avatar, Caption, Status } from './common'
import { IconArrowRight, IconCheck, IconX } from './icons'
import { RejectInlineForm } from './reject-inline-form'
import type { ApprovalRequest } from '../lib/types'
import { ago } from '../lib/format'

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
          <Text as="div" size="3" weight="medium" className="truncate">{agentName}</Text>
          <Text as="div" size="1" color="gray" mt="1" className="truncate">
            {approval.requested_by_name
              ? `Triggered by ${approval.requested_by_name} · ${ago(approval.created_at)}`
              : ago(approval.created_at)}
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
                  color="green"
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
