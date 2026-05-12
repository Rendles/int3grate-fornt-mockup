// Hardcoded mini-fixtures for the hero-chat-loop scene.
// Intentionally NOT importing from lib/fixtures.ts — this folder must be
// portable. When the scene is copied to the landing repo, only the files
// in this directory should travel with it.
//
// Names match canonical agents/templates in the real product so the
// marketing surface stays in sync with what a real user would see.

// ─── Picker (Phase 4 creation beat) ──────────────────────────────────

export interface SceneTemplate {
  id: string
  initials: string
  name: string
  pitch: string
}

// 4 templates rendered as a vertical list. "Sales Agent" is the one the
// synthetic cursor clicks — it's also what hires Lead Qualifier in the
// chat view, so the story lines up.
export const SCENE_TEMPLATES: SceneTemplate[] = [
  { id: 'sales',     initials: 'SA', name: 'Sales Agent',      pitch: 'Finds leads, sends intros, follows up' },
  { id: 'marketing', initials: 'MA', name: 'Marketing Agent',  pitch: 'Drafts campaigns, schedules posts' },
  { id: 'support',   initials: 'CS', name: 'Customer Support', pitch: 'Answers FAQs, escalates the rest' },
  { id: 'custom',    initials: '+',  name: 'Custom Agent',     pitch: 'Start blank and brief everything yourself' },
]

export const PICKER_CLICKED_ID = 'sales'

// ─── Chat ─────────────────────────────────────────────────────────────

export const SCENE_AGENT = {
  name: 'Lead Qualifier',
  initials: 'LQ',
  caption: 'just hired · ready to work',
}

export const SCENE_WELCOME =
  "Hi! I'm Lead Qualifier. Tell me what you need."

// What the user "types" in the input during the typing phase.
// Length tuned for 2s typing at ~13 chars/s (26 chars including spaces).
export const SCENE_USER_MESSAGE = 'Find 5 leads in US fintech'

// Agent's response, rendered as an intro line + bullet list.
export const SCENE_RESPONSE = {
  intro: 'Found 5 matches in US fintech:',
  bullets: [
    'Acme Pay — VP Sales',
    'Globex Finance — Head of Growth',
    'Stark Capital — CRO',
    '+2 more',
  ],
}

// Independent of Scene 1 by design — does not reference approvals.
export const SCENE_CTA = '8 personalised drafts ready for you'

export const SCENE_INPUT_PLACEHOLDER = 'Type a message…'
