// Scripted "chat scene" hero-loop variant.
//
// Phase 4 of docs/agent-plans/2026-05-12-2148-hero-loop-embed.md § 9d:
// added the creation beat. Two-view stack — picker (template list) and
// chat (agent header + bubbles + input) — absolutely positioned over
// each other, cross-fading at the hire-transition phase.
//
// PORTABILITY CONTRACT: this folder has zero dependencies on the rest of
// src/prototype. Brand tokens are inlined as CSS variables. To hand off
// to the landing repo, copy src/prototype/components/hero-chat-loop/ verbatim.

import { useEffect, useState } from 'react'

import './HeroChatLoop.css'
import { ActionCta } from './parts/ActionCta'
import { AgentHeader } from './parts/AgentHeader'
import { Cursor } from './parts/Cursor'
import { InputBar, type InputState } from './parts/InputBar'
import { MessageBubble } from './parts/MessageBubble'
import { TemplatePicker } from './parts/TemplatePicker'
import { TypingIndicator } from './parts/TypingIndicator'
import { PHASES, type PhaseName } from './phases'
import {
  PICKER_CLICKED_ID,
  SCENE_AGENT,
  SCENE_RESPONSE,
  SCENE_USER_MESSAGE,
  SCENE_WELCOME,
} from './scene-data'

// Cursor target positions in stage-local px. Layout math:
//   PICKER VIEW (phases 0–3):
//     view inset 20 from stage edges → content at stage (20,20)–(480,580)
//     header (60 tall) + gap 14 → list starts at stage y=94
//     each card 64 tall + gap 8
//     card 1 (Sales) centre: stage (250, 126)
//   CHAT VIEW (phases 4–11):
//     header (52 tall) ends at stage y=72
//     input bar (48 tall) ends at stage y=580; centre y=556
//     send button centre x=456
const CURSOR_POSITIONS: Record<PhaseName, { x: number; y: number }> = {
  'idle':               { x: 440, y: 30 },
  'cursor-to-template': { x: 250, y: 126 },
  'template-click':     { x: 250, y: 126 },
  'hire-transition':    { x: 250, y: 126 },  // stays during cross-fade
  'cursor-to-input':    { x: 120, y: 556 },
  'typing':             { x: 120, y: 556 },
  'cursor-to-send':     { x: 456, y: 556 },
  'send-click':         { x: 456, y: 556 },
  'thinking':           { x: 440, y: 92 },
  'agent-responds':     { x: 440, y: 92 },
  'action-cta':         { x: 440, y: 92 },
  'outro':              { x: 440, y: 92 },
}

// ─── View state per phase ───────────────────────────────────────────────

interface ViewState {
  pickerVisible: boolean
  templatePressedId: string | null
  chatVisible: boolean
  welcomeVisible: boolean
  userMsgVisible: boolean
  thinkingVisible: boolean
  responseVisible: boolean
  ctaVisible: boolean
  sendBtnPressed: boolean
}

const DEFAULT_VIEW_STATE: ViewState = {
  pickerVisible: false,
  templatePressedId: null,
  chatVisible: false,
  welcomeVisible: false,
  userMsgVisible: false,
  thinkingVisible: false,
  responseVisible: false,
  ctaVisible: false,
  sendBtnPressed: false,
}

function viewStateForPhase(name: PhaseName): ViewState {
  switch (name) {
    case 'idle':
    case 'cursor-to-template':
      return { ...DEFAULT_VIEW_STATE, pickerVisible: true }

    case 'template-click':
      return { ...DEFAULT_VIEW_STATE, pickerVisible: true, templatePressedId: PICKER_CLICKED_ID }

    case 'hire-transition':
      // Cross-fade: picker fades out, chat fades in. Welcome bubble already
      // marked visible so it appears together with the chat view.
      return { ...DEFAULT_VIEW_STATE, chatVisible: true, welcomeVisible: true }

    case 'cursor-to-input':
    case 'typing':
    case 'cursor-to-send':
      return { ...DEFAULT_VIEW_STATE, chatVisible: true, welcomeVisible: true }

    case 'send-click':
      return {
        ...DEFAULT_VIEW_STATE,
        chatVisible: true,
        welcomeVisible: true,
        userMsgVisible: true,
        sendBtnPressed: true,
      }

    case 'thinking':
      return {
        ...DEFAULT_VIEW_STATE,
        chatVisible: true,
        welcomeVisible: true,
        userMsgVisible: true,
        thinkingVisible: true,
      }

    case 'agent-responds':
      return {
        ...DEFAULT_VIEW_STATE,
        chatVisible: true,
        welcomeVisible: true,
        userMsgVisible: true,
        responseVisible: true,
      }

    case 'action-cta':
      return {
        ...DEFAULT_VIEW_STATE,
        chatVisible: true,
        welcomeVisible: true,
        userMsgVisible: true,
        responseVisible: true,
        ctaVisible: true,
      }

    case 'outro':
      // Both views fade out. Phase 0 next loop re-shows picker only.
      return DEFAULT_VIEW_STATE
  }
}

// Map phase → input bar visual state. The typing reveal itself is pure
// CSS (steps() animation on max-width).
function inputStateForPhase(name: PhaseName): InputState {
  if (name === 'typing') return 'typing'
  if (name === 'cursor-to-send') return 'full'
  return 'empty'
}

// ─── Phase loop ─────────────────────────────────────────────────────────
function usePhaseLoop() {
  const [phaseIndex, setPhaseIndex] = useState(0)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPhaseIndex(i => (i + 1) % PHASES.length)
    }, PHASES[phaseIndex].duration)
    return () => window.clearTimeout(timer)
  }, [phaseIndex])

  return phaseIndex
}

export function HeroChatLoop() {
  const phaseIndex = usePhaseLoop()
  const phase = PHASES[phaseIndex]
  const cursor = CURSOR_POSITIONS[phase.name]
  const view = viewStateForPhase(phase.name)
  const inputState = inputStateForPhase(phase.name)

  return (
    <div className="hero-chat-loop" aria-label="int3grate.ai live preview">
      <div className="hero-chat-loop__stage">

        {/* Picker view — first 4 phases */}
        <div
          className={`hcl-view hcl-view--picker${view.pickerVisible ? ' hcl-view--visible' : ''}`}
          aria-hidden={!view.pickerVisible}
        >
          <TemplatePicker pressedId={view.templatePressedId} />
        </div>

        {/* Chat view — phases 3+ (cross-fade overlap with picker on phase 3) */}
        <div
          className={`hcl-view hcl-view--chat${view.chatVisible ? ' hcl-view--visible' : ''}`}
          aria-hidden={!view.chatVisible}
        >
          <AgentHeader />

          <div className="hcl-chat">
            <MessageBubble speaker="agent" visible={view.welcomeVisible} initials={SCENE_AGENT.initials}>
              {SCENE_WELCOME}
            </MessageBubble>

            <MessageBubble speaker="user" visible={view.userMsgVisible}>
              {SCENE_USER_MESSAGE}
            </MessageBubble>

            <TypingIndicator visible={view.thinkingVisible} />

            <MessageBubble speaker="agent" visible={view.responseVisible} initials={SCENE_AGENT.initials}>
              <div className="hcl-resp">
                <div className="hcl-resp__intro">{SCENE_RESPONSE.intro}</div>
                <ul className="hcl-resp__list">
                  {SCENE_RESPONSE.bullets.map(b => <li key={b}>{b}</li>)}
                </ul>
              </div>
            </MessageBubble>

            <ActionCta visible={view.ctaVisible} />
          </div>

          <InputBar state={inputState} sendPressed={view.sendBtnPressed} />
        </div>

        <Cursor x={cursor.x} y={cursor.y} />
      </div>
    </div>
  )
}
