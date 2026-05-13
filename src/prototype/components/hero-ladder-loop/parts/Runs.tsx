// Three run cards stacked vertically. Each shows the same TASK TYPE
// (refund) with progressively less ceremony — the trust ladder visible
// purely through layout compression:
//   Run 1: 4 lines + 2 buttons (full approval card).
//   Run 2: 3 lines + rule chip (auto-approving).
//   Run 3: 2 lines (silent, arrives already done).
//
// All elements are always in the DOM; state-driven max-height/opacity
// transitions handle the expand/collapse. This keeps row heights smooth
// and avoids layout jumps.

import { RUN1, RUN2, RUN3 } from '../scene-data'
import type { Run1State, Run2State, Run3State } from '../phases'

function CheckIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
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
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="4.5" y1="4.5" x2="11.5" y2="11.5" />
      <line x1="11.5" y1="4.5" x2="4.5" y2="11.5" />
    </svg>
  )
}

export function Run1Card({ state, approvePressed }: { state: Run1State; approvePressed: boolean }) {
  const cls = `ld-run ld-run--1 ld-run--${state}`

  return (
    <div className={cls} aria-hidden={state === 'hidden'}>
      <div className="ld-run__top">
        <span className="ld-run__label">{RUN1.label}</span>
        <span className="ld-run__sep" aria-hidden>·</span>
        <span className="ld-run__time">{RUN1.time}</span>
        <div className="ld-run__indicator">
          <span className="ld-run__pill ld-run__pill--pending">pending</span>
          <span className="ld-run__pill ld-run__pill--done" aria-hidden>
            <CheckIcon size={11} />
          </span>
        </div>
      </div>

      <div className="ld-run__headline">{RUN1.headline}</div>

      <div className="ld-run__context">{RUN1.context}</div>

      <div className="ld-run__footer">
        <button
          type="button"
          className={`ld-btn ld-btn--approve${approvePressed ? ' ld-btn--pressed' : ''}`}
          data-target="approve-btn"
        >
          <CheckIcon /> Approve
        </button>
        <button type="button" className="ld-btn ld-btn--reject">
          <XIcon /> Reject
        </button>
      </div>

      <div className="ld-run__done-caption">{RUN1.doneCaption}</div>
    </div>
  )
}

export function Run2Card({ state }: { state: Run2State }) {
  const cls = `ld-run ld-run--2 ld-run--${state}`

  return (
    <div className={cls} aria-hidden={state === 'hidden'}>
      <div className="ld-run__top">
        <span className="ld-run__label">{RUN2.label}</span>
        <span className="ld-run__sep" aria-hidden>·</span>
        <span className="ld-run__time">{RUN2.time}</span>
        <div className="ld-run__indicator">
          <span className="ld-run__pill ld-run__pill--rule">
            <span className="ld-run__pill-dot" aria-hidden />
            rule applies
          </span>
          <span className="ld-run__pill ld-run__pill--done" aria-hidden>
            <CheckIcon size={11} />
          </span>
        </div>
      </div>

      <div className="ld-run__headline">{RUN2.headline}</div>

      <div className="ld-run__rule-caption">{RUN2.ruleCaption}</div>

      <div className="ld-run__done-caption">{RUN2.doneCaption}</div>
    </div>
  )
}

export function Run3Card({ state }: { state: Run3State }) {
  const cls = `ld-run ld-run--3 ld-run--${state}`

  return (
    <div className={cls} aria-hidden={state === 'hidden'}>
      <div className="ld-run__top">
        <span className="ld-run__label">{RUN3.label}</span>
        <span className="ld-run__sep" aria-hidden>·</span>
        <span className="ld-run__time">{RUN3.time}</span>
        <div className="ld-run__indicator">
          <span className="ld-run__pill ld-run__pill--done" aria-hidden>
            <CheckIcon size={11} />
          </span>
        </div>
      </div>

      <div className="ld-run__headline">{RUN3.headline}</div>

      <div className="ld-run__done-caption">{RUN3.doneCaption}</div>
    </div>
  )
}
