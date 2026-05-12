// Single row of the pending-approvals queue. State-driven; the parent
// (HeroLoop) drives state from the current phase.
//
// States:
//   idle       — compact, neutral. Just shows agent / action / ago.
//   focal      — top of queue. Orange ring, pulsing dot, "pending" pill.
//                Body + footer NOT visible (compact).
//   expanded   — focal + body context line + Approve/Reject buttons visible.
//   success    — jade-bordered, ✓ icon, success headline, audit-trail meta.
//   dim        — non-focal items during the approval phases.
//   hidden     — collapsed (max-height: 0); used during queue rotation.
//
// Body + footer are always in the DOM. They're shown/hidden via
// max-height + opacity transitions so the row expansion stays smooth.

import type { QueueItem } from '../scene-data'

export type RowState = 'idle' | 'focal' | 'expanded' | 'success' | 'dim' | 'hidden'

interface QueueRowProps {
  item: QueueItem
  state: RowState
  /** Brief 200ms row-press feedback during the tile-click phase. */
  pressed?: boolean
  /** Approve button shows 200ms press feedback during approve-click phase. */
  approvePressed?: boolean
}

function CheckIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="3 8.5 6.5 12 13 5" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="4.5" y1="4.5" x2="11.5" y2="11.5" />
      <line x1="11.5" y1="4.5" x2="4.5" y2="11.5" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="6 4 10 8 6 12" />
    </svg>
  )
}

export function QueueRow({ item, state, pressed = false, approvePressed = false }: QueueRowProps) {
  const cls = [
    'hl-row',
    `hl-row--${state}`,
    pressed ? 'hl-row--pressed' : '',
  ].filter(Boolean).join(' ')

  const isSuccess = state === 'success'

  return (
    <div className={cls} data-target={`row-${item.id}`} aria-hidden={state === 'hidden'}>
      <div className="hl-row__head">
        <div className="hl-row__avatar" aria-hidden>{item.initials}</div>

        <div className="hl-row__head-text">
          <div className="hl-row__caption">
            <span className="hl-row__name">{item.agentName}</span>
            <span className="hl-row__sep" aria-hidden>·</span>
            <span className="hl-row__ago">{item.ago}</span>
          </div>
          <div className="hl-row__action">
            {isSuccess ? (
              <>
                <span className="hl-row__success-icon" aria-hidden><CheckIcon size={13} /></span>
                {item.successHeadline}
              </>
            ) : (
              item.actionVerb
            )}
          </div>
        </div>

        <div className="hl-row__indicator">
          <span className="hl-row__pill hl-row__pill--pending" aria-hidden>pending</span>
          <span className="hl-row__pill hl-row__pill--done" aria-hidden>done</span>
          <span className="hl-row__arrow" aria-hidden><ArrowIcon /></span>
        </div>
      </div>

      <div className="hl-row__body">
        <div className="hl-row__context">{item.context}</div>
      </div>

      <div className="hl-row__footer">
        <button
          type="button"
          className={`hl-btn hl-btn--approve${approvePressed ? ' hl-btn--pressed' : ''}`}
          data-target="approve-btn"
        >
          <CheckIcon />
          Approve
        </button>
        <button type="button" className="hl-btn hl-btn--reject" data-target="reject-btn">
          <XIcon />
          Reject
        </button>
      </div>
    </div>
  )
}
