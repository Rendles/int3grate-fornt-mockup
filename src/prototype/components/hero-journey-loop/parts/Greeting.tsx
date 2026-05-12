// Time-of-day greeting strip. Name-free per landing-handoff direction:
// don't bind to a fictional persona on marketing surfaces.

import { SCENE_GREETING } from '../scene-data'

export function Greeting() {
  const g = SCENE_GREETING
  return (
    <div className="hjl-greeting">
      <span className="hjl-greeting__primary">{g.primary}</span>
      <span className="hjl-greeting__divider" aria-hidden>·</span>
      <span className="hjl-greeting__secondary">{g.secondary}</span>
    </div>
  )
}
