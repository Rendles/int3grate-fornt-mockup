// Top strip of the scene: time-of-day greeting + day/time. Mirrors the
// pattern from HomeScreen / AdminView ("Good morning, {name} · ...") but
// without binding to a fictional persona — the landing shouldn't promise
// a specific user name.

import { SCENE_GREETING } from '../scene-data'

export function Greeting() {
  const g = SCENE_GREETING
  return (
    <div className="hl-greeting">
      <span className="hl-greeting__primary">{g.primary}</span>
      <span className="hl-greeting__divider" aria-hidden>·</span>
      <span className="hl-greeting__secondary">{g.secondary}</span>
    </div>
  )
}
