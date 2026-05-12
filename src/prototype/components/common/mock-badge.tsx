import { Tooltip } from '@radix-ui/themes'

type MockKind =
  // No backend endpoint exists at all — pure design surface.
  | 'design'
  // Endpoint exists in docs/gateway.yaml but marked x-mvp-deferred —
  // backend has not implemented it yet.
  | 'deferred'

interface MockBadgeProps {
  kind: MockKind
  /** Optional override for the explanation tooltip. */
  hint?: string
}

const COPY: Record<MockKind, { label: string; fg: string; border: string; defaultHint: string }> = {
  design: {
    label: 'mock',
    fg: 'var(--red-11)',
    border: 'var(--red-a7)',
    defaultHint:
      "No backend endpoint yet — values on this surface are synthesized in the prototype. Will need a real source before it ships.",
  },
  deferred: {
    label: 'deferred',
    fg: 'var(--orange-11)',
    border: 'var(--orange-a7)',
    defaultHint:
      "Endpoint exists in the gateway spec but is marked x-mvp-deferred — backend hasn't implemented it yet. UI is wired against the mock.",
  },
}

/**
 * Tiny dashed pill that flags any UI surface whose data does not yet come
 * from a real backend. Hover for context.
 */
export function MockBadge({ kind, hint }: MockBadgeProps) {
  const { label, fg, border, defaultHint } = COPY[kind]
  return (
    <Tooltip content={hint ?? defaultHint}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          height: 14,
          padding: '0 5px',
          fontSize: 9,
          lineHeight: 1,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontFamily: 'var(--font-mono)',
          color: fg,
          border: `1px dashed ${border}`,
          borderRadius: 3,
          whiteSpace: 'nowrap',
          verticalAlign: 'middle',
        }}
      >
        {label}
      </span>
    </Tooltip>
  )
}
