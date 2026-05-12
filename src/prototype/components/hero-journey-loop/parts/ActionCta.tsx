// Inline action pill that slides up under the agent response in the
// "drafts-ready" beat. Generic copy — the response from the just-hired
// Sales Agent produces draft outreach for the user to review.

import { SCENE_CTA } from '../scene-data'

interface ActionCtaProps {
  visible: boolean
}

export function ActionCta({ visible }: ActionCtaProps) {
  return (
    <div className={`hjl-cta${visible ? ' hjl-cta--visible' : ''}`} aria-hidden={!visible}>
      <div className="hjl-cta__pill">
        <span className="hjl-cta__dot" aria-hidden />
        {SCENE_CTA}
      </div>
    </div>
  )
}
