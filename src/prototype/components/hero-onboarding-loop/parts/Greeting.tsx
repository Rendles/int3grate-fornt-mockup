// Top strip: time-of-day greeting + day/time. Always visible — the only
// element that survives the empty → full transition unchanged. Anchors
// the stage so the empty-to-buzzing transition has a stable reference.

import { SCENE_GREETING } from '../scene-data'

export function Greeting() {
  return (
    <div className="ob-greeting">
      <span className="ob-greeting__primary">{SCENE_GREETING.primary}</span>
      <span className="ob-greeting__divider" aria-hidden>·</span>
      <span className="ob-greeting__secondary">{SCENE_GREETING.secondary}</span>
    </div>
  )
}
