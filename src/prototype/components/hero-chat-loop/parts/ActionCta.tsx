// Inline action pill that slides up under the agent response in the
// final beat of the loop. Generic copy — does NOT cross-reference Scene 1
// (per user direction: chat scene stays an independent story).

import { SCENE_CTA } from '../scene-data'

interface ActionCtaProps {
  visible: boolean
}

export function ActionCta({ visible }: ActionCtaProps) {
  return (
    <div className={`hcl-cta${visible ? ' hcl-cta--visible' : ''}`} aria-hidden={!visible}>
      <div className="hcl-cta__pill">
        <span className="hcl-cta__dot" aria-hidden />
        {SCENE_CTA}
      </div>
    </div>
  )
}
