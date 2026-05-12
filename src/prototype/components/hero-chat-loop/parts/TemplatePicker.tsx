// Template picker view — first half of the scene. Mirrors the hire
// wizard's welcome step but as a static, scripted picker. The synthetic
// cursor clicks the first card (Sales Agent), which morphs the scene
// into the chat view via the hire-transition phase.

import { SCENE_TEMPLATES } from '../scene-data'

interface TemplatePickerProps {
  /** Id of the template currently in click-press state (200ms). */
  pressedId: string | null
}

export function TemplatePicker({ pressedId }: TemplatePickerProps) {
  return (
    <div className="hcl-picker">
      <div className="hcl-picker__header">
        <div className="hcl-picker__eyebrow">START HERE</div>
        <h2 className="hcl-picker__title">Who needs to join the team?</h2>
      </div>

      <div className="hcl-picker__list">
        {SCENE_TEMPLATES.map(t => (
          <div
            key={t.id}
            className={`hcl-tpl${pressedId === t.id ? ' hcl-tpl--pressed' : ''}`}
            data-target={`tpl-${t.id}`}
          >
            <div className="hcl-tpl__avatar" aria-hidden>{t.initials}</div>
            <div className="hcl-tpl__body">
              <div className="hcl-tpl__name">{t.name}</div>
              <div className="hcl-tpl__pitch">{t.pitch}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
