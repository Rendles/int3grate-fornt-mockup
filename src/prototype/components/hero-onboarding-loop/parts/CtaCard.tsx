// Empty-state card: caption + big violet "Hire your first agent" button
// + hint line. Centered in the main area when the dashboard is empty.

import { SCENE_CTA } from '../scene-data'

interface CtaCardProps {
  visible: boolean
  pressed: boolean
}

function PlusIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      aria-hidden
    >
      <line x1="8" y1="3" x2="8" y2="13" />
      <line x1="3" y1="8" x2="13" y2="8" />
    </svg>
  )
}

export function CtaCard({ visible, pressed }: CtaCardProps) {
  const cls = `ob-cta-wrap${visible ? ' ob-cta-wrap--visible' : ' ob-cta-wrap--hidden'}`
  const btnCls = `ob-cta__btn${pressed ? ' ob-cta__btn--pressed' : ''}`

  return (
    <div className={cls} aria-hidden={!visible}>
      <div className="ob-cta">
        <div className="ob-cta__caption">{SCENE_CTA.caption}</div>
        <button type="button" className={btnCls} data-target="cta-btn">
          <PlusIcon /> {SCENE_CTA.buttonLabel}
        </button>
        <div className="ob-cta__hint">{SCENE_CTA.hint}</div>
      </div>
    </div>
  )
}
