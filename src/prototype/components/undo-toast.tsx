import { useEffect, useState } from 'react'
import { Box, Button, Flex, Text } from '@radix-ui/themes'

import { IconCheck, IconX } from './icons'
import type { UndoToast } from '../lib/undo-toast'

// Bottom-right pinned, 5s-countdown undo toasts. Used by the production
// /approvals quick-actions and by /sandbox/approvals-inline. The toast is
// pure UI — it doesn't know whether the underlying decision is sandbox-
// only or a deferred backend commit. Caller is responsible for:
//   - calling onUndo to actually revert the decision
//   - calling onDismiss when the toast expires (or otherwise wiring the
//     real "commit" on expiry)
//
// Companion non-component helpers (UndoToast type, makeToastId, nowMs)
// live in `lib/undo-toast.ts`.

export function ToastStack({
  toasts,
  onUndo,
  onDismiss,
}: {
  toasts: UndoToast[]
  onUndo: (toastId: string) => void
  onDismiss: (toastId: string) => void
}) {
  if (toasts.length === 0) return null
  return (
    <Box
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 80,
        pointerEvents: 'none',
      }}
    >
      <Flex direction="column" gap="2" align="end">
        {toasts.map(t => (
          <ToastItem
            key={t.id}
            toast={t}
            onUndo={() => onUndo(t.id)}
            onDismiss={() => onDismiss(t.id)}
          />
        ))}
      </Flex>
    </Box>
  )
}

function ToastItem({
  toast,
  onUndo,
  onDismiss,
}: {
  toast: UndoToast
  onUndo: () => void
  onDismiss: () => void
}) {
  const computeRemaining = () =>
    Math.max(0, Math.ceil((toast.expiresAt - Date.now()) / 1000))
  const [remaining, setRemaining] = useState(computeRemaining)

  useEffect(() => {
    const tick = setInterval(() => {
      const left = toast.expiresAt - Date.now()
      if (left <= 0) {
        clearInterval(tick)
        onDismiss()
        return
      }
      setRemaining(Math.ceil(left / 1000))
    }, 250)
    return () => clearInterval(tick)
  }, [toast.expiresAt, onDismiss])

  const isApprove = toast.decision === 'approved'
  const accentColor = isApprove ? 'var(--green-11)' : 'var(--red-11)'
  const accentBorder = isApprove ? 'var(--green-a6)' : 'var(--red-a6)'

  return (
    <Flex
      align="center"
      gap="3"
      role="status"
      aria-live="polite"
      style={{
        pointerEvents: 'auto',
        background: 'var(--gray-2)',
        border: `1px solid ${accentBorder}`,
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
        padding: '10px 14px',
        minWidth: 320,
        maxWidth: 420,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          border: `1px solid ${accentBorder}`,
          color: accentColor,
          background: 'var(--gray-3)',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        {isApprove ? <IconCheck className="ic ic--sm" /> : <IconX className="ic ic--sm" />}
      </span>
      <Box style={{ flex: '1 1 auto', minWidth: 0 }}>
        <Text as="div" size="2" weight="medium" className="truncate">
          <Text as="span" style={{ color: accentColor }}>
            {isApprove ? 'Approved' : 'Rejected'}
          </Text>
          <Text as="span" color="gray">{' · '}</Text>
          <Text as="span">{toast.agentName}</Text>
        </Text>
        <Text as="div" size="1" color="gray" className="truncate" mt="1">
          {toast.actionVerb}
        </Text>
      </Box>
      <Button
        variant="soft"
        color="gray"
        size="1"
        onClick={onUndo}
        aria-label={`Undo — ${toast.agentName} ${toast.actionVerb}`}
        style={{ flexShrink: 0 }}
      >
        Undo ({remaining}s)
      </Button>
    </Flex>
  )
}
