// Chat input bar at the bottom of the stage.
//
// State machine: 'empty' | 'typing' | 'full' drives visibility of the
// placeholder vs the typed-text + caret. The typing reveal is pure CSS
// (steps() animation on max-width) — no React state, no setState dance.

import { SCENE_INPUT_PLACEHOLDER, SCENE_USER_MESSAGE } from '../scene-data'

export type InputState = 'empty' | 'typing' | 'full'

interface InputBarProps {
  state: InputState
  /** Send button press feedback (240ms during send-click phase). */
  sendPressed: boolean
}

function SendIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="8" y1="13" x2="8" y2="3" />
      <polyline points="4 7 8 3 12 7" />
    </svg>
  )
}

export function InputBar({ state, sendPressed }: InputBarProps) {
  const ready = state !== 'empty'
  return (
    <div
      className={`hjl-input hjl-input--${state}`}
      data-target="input"
    >
      <div className="hjl-input__field">
        <span className="hjl-input__placeholder">{SCENE_INPUT_PLACEHOLDER}</span>
        <span className="hjl-input__text">{SCENE_USER_MESSAGE}</span>
        <span className="hjl-input__caret" aria-hidden />
      </div>
      <button
        type="button"
        className={[
          'hjl-input__send',
          ready ? 'hjl-input__send--ready' : '',
          sendPressed ? 'hjl-input__send--pressed' : '',
        ].filter(Boolean).join(' ')}
        data-target="send"
        aria-label="Send"
      >
        <SendIcon />
      </button>
    </div>
  )
}
