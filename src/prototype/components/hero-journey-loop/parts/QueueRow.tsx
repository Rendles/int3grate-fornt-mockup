// Single row of the pending-approvals queue. State-driven; the parent
// (HeroJourneyLoop) drives state from the current phase.
//
// States: idle | focal | expanded | success | dim | hidden
// (same vocabulary as hero-loop/parts/QueueRow.tsx).

import type { QueueItem } from '../scene-data'

export type RowState = 'idle' | 'focal' | 'expanded' | 'success' | 'dim' | 'hidden'

interface QueueRowProps {
  item: QueueItem
  state: RowState
  pressed?: boolean
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
    'hjl-row',
    `hjl-row--${state}`,
    pressed ? 'hjl-row--pressed' : '',
  ].filter(Boolean).join(' ')

  const isSuccess = state === 'success'

  return (
    <div className={cls} data-target={`row-${item.id}`} aria-hidden={state === 'hidden'}>
      <div className="hjl-row__head">
        <div className="hjl-row__avatar" aria-hidden>{item.initials}</div>

        <div className="hjl-row__head-text">
          <div className="hjl-row__caption">
            <span className="hjl-row__name">{item.agentName}</span>
            <span className="hjl-row__sep" aria-hidden>·</span>
            <span className="hjl-row__ago">{item.ago}</span>
          </div>
          <div className="hjl-row__action">
            {isSuccess ? (
              <>
                <span className="hjl-row__success-icon" aria-hidden><CheckIcon size={13} /></span>
                {item.successHeadline}
              </>
            ) : (
              item.actionVerb
            )}
          </div>
        </div>

        <div className="hjl-row__indicator">
          <span className="hjl-row__pill hjl-row__pill--pending" aria-hidden>pending</span>
          <span className="hjl-row__pill hjl-row__pill--done" aria-hidden>done</span>
          <span className="hjl-row__arrow" aria-hidden><ArrowIcon /></span>
        </div>
      </div>

      <div className="hjl-row__body">
        <div className="hjl-row__context">{item.context}</div>
      </div>

      <div className="hjl-row__footer">
        <button
          type="button"
          className={`hjl-btn hjl-btn--approve${approvePressed ? ' hjl-btn--pressed' : ''}`}
          data-target="approve-btn"
        >
          <CheckIcon />
          Approve
        </button>
        <button type="button" className="hjl-btn hjl-btn--reject" data-target="reject-btn">
          <XIcon />
          Reject
        </button>
      </div>
    </div>
  )
}
