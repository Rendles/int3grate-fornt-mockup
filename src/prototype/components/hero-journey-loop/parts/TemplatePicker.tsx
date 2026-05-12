// Wizard view — second surface of the journey scene.
// Vertical list of 4 starter templates. In later phases the synthetic
// cursor clicks the first card (Sales) → press feedback → cross-fade
// into the chat view via the hire-transition phase.
//
// Step P5.2: static only — no press state driven yet. The `pressedId`
// prop is plumbed through for P5.7 when the template-click phase wires
// up its 240ms press feedback.

import { SCENE_TEMPLATES } from '../scene-data'

interface TemplatePickerProps {
  /** Id of the template currently in click-press state (240ms). */
  pressedId: string | null
}

export function TemplatePicker({ pressedId }: TemplatePickerProps) {
  return (
    <div className="hjl-picker">
      <div className="hjl-picker__header">
        <div className="hjl-picker__eyebrow">START HERE</div>
        <h2 className="hjl-picker__title">Who needs to join the team?</h2>
      </div>

      <div className="hjl-picker__list">
        {SCENE_TEMPLATES.map(t => (
          <div
            key={t.id}
            className={`hjl-tpl${pressedId === t.id ? ' hjl-tpl--pressed' : ''}`}
            data-target={`tpl-${t.id}`}
          >
            <div className="hjl-tpl__avatar" aria-hidden>{t.initials}</div>
            <div className="hjl-tpl__body">
              <div className="hjl-tpl__name">{t.name}</div>
              <div className="hjl-tpl__pitch">{t.pitch}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
