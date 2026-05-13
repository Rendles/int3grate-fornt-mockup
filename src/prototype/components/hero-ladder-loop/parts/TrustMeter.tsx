// Trust progression meter. Three chips horizontally:
//   Supervised → Assisted → Autonomous
// Each chip's tri-state colouring tells the story at a glance:
//   - 'pending' (not yet reached): muted outline, hollow dot.
//   - 'active'  (current level):   coloured fill + label
//     · supervised = orange (warn / your-OK-required)
//     · assisted   = cyan   (info / learning)
//     · autonomous = jade   (success / earned)
//   - 'passed'  (already past):    muted with ✓ in the dot slot.
//
// Smooth transitions between states; cells are stable in width to avoid
// horizontal jiggle as the chip palette shifts.

import { TRUST_LABELS, TRUST_LEVELS, type TrustLevel } from '../scene-data'

interface TrustMeterProps {
  level: TrustLevel
}

function CheckIcon() {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="3 8.5 6.5 12 13 5" />
    </svg>
  )
}

export function TrustMeter({ level }: TrustMeterProps) {
  const activeIdx = TRUST_LEVELS.indexOf(level)

  return (
    <div className="ld-meter">
      {TRUST_LEVELS.map((l, i) => {
        const state = i < activeIdx ? 'passed' : i === activeIdx ? 'active' : 'pending'
        const chipCls = `ld-meter__chip ld-meter__chip--${l} ld-meter__chip--${state}`
        return (
          <span key={l} className="ld-meter__cell">
            {i > 0 && <span className="ld-meter__arrow" aria-hidden>→</span>}
            <span className={chipCls}>
              <span className="ld-meter__dot" aria-hidden>
                {state === 'passed' && <CheckIcon />}
              </span>
              <span className="ld-meter__label">{TRUST_LABELS[l]}</span>
            </span>
          </span>
        )
      })}
    </div>
  )
}
