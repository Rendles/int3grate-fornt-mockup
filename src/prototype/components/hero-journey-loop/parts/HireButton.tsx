// Primary CTA button in the top-right of the dashboard. The synthetic
// cursor clicks this in the post-approve phase to pivot the scene from
// "managing existing agents" → "creating a new one".

import { SCENE_HIRE_LABEL } from '../scene-data'

interface HireButtonProps {
  /** 200ms press feedback during the hire-click phase. */
  pressed: boolean
}

function PlusIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="8" y1="3" x2="8" y2="13" />
      <line x1="3" y1="8" x2="13" y2="8" />
    </svg>
  )
}

export function HireButton({ pressed }: HireButtonProps) {
  return (
    <button
      type="button"
      className={`hjl-hire${pressed ? ' hjl-hire--pressed' : ''}`}
      data-target="hire-btn"
    >
      <PlusIcon />
      {SCENE_HIRE_LABEL}
    </button>
  )
}
