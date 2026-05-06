import { Box, Button, Code, Flex, Text } from '@radix-ui/themes'

import { Caption } from './common'
import { TextAreaField } from './fields'
import { IconArrowLeft, IconX } from './icons'

// Inline reject reason form. Used wherever we want a "drop a reason then
// confirm" flow without yanking the user out of context (no modal). Two
// callsites today: ApprovalCard's expanded footer (cards view) and the
// row-expanded panel under each approvals row (table view). Pure visual,
// owns no state — the parent passes reason / touched / handlers in.

export interface RejectInlineFormProps {
  reason: string
  touched: boolean
  /** Minimum characters before Confirm becomes a valid action. */
  minChars: number
  onChangeReason: (v: string) => void
  onBlurReason: () => void
  onCancel: () => void
  onConfirm: () => void
}

export function RejectInlineForm({
  reason,
  touched,
  minChars,
  onChangeReason,
  onBlurReason,
  onCancel,
  onConfirm,
}: RejectInlineFormProps) {
  const reasonInvalid = touched && reason.trim().length < minChars
  return (
    <Box
      style={{
        padding: 12,
        background: 'var(--red-a2)',
        border: '1px solid var(--red-a4)',
        borderRadius: 6,
      }}
    >
      <Flex align="center" justify="between" mb="2">
        <Caption>
          reason for rejecting <Text as="span" color="red">*</Text>
        </Caption>
        <Code variant="ghost" size="1" color="gray">≥ {minChars} chars</Code>
      </Flex>
      <TextAreaField
        autoFocus
        style={{ minHeight: 72 }}
        placeholder="Why are we rejecting?"
        value={reason}
        onChange={e => onChangeReason(e.target.value)}
        onBlur={onBlurReason}
        error={reasonInvalid ? `At least ${minChars} characters.` : undefined}
      />
      <Flex justify="end" gap="2" mt="3">
        <Button variant="soft" color="gray" size="2" onClick={onCancel}>
          <IconArrowLeft className="ic ic--sm" />
          Cancel
        </Button>
        <Button color="red" size="2" onClick={onConfirm}>
          <IconX className="ic ic--sm" />
          Confirm reject
        </Button>
      </Flex>
    </Box>
  )
}
