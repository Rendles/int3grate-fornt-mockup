// Comprehensive scripted scene — walks through the full product journey
// in one ~21-second loop. Six surfaces in order:
//   dashboard idle → approve a pending request → hire a new agent (wizard
//   → chat) → see the agent respond → activity ticker → return to an
//   updated dashboard.
//
// Architecture: one phase state machine (`PHASES` in `phases.ts`) drives
// three lookup tables — `PHASE_TO_VIEW` (which view is opaque this beat),
// `CURSOR_POSITIONS` (where the synthetic cursor glides to), and
// `viewStateForPhase()` (every per-element flag: queue row state, KPI
// values + dim / pulse / flash, button press feedback, chat bubble
// visibility, typing reveal, response cascade, drafts CTA). All
// animations are pure CSS — no animation library.
//
// PORTABILITY CONTRACT: this folder has zero dependencies on the rest of
// src/prototype. Brand tokens are inlined as CSS variables. To hand off
// to the landing repo, copy src/prototype/components/hero-journey-loop/
// verbatim.

import { useEffect, useState } from 'react'

import './HeroJourneyLoop.css'
import { ActionCta } from './parts/ActionCta'
import { ActivityTicker } from './parts/ActivityTicker'
import { AgentHeader } from './parts/AgentHeader'
import { Cursor } from './parts/Cursor'
import { Greeting } from './parts/Greeting'
import { HireButton } from './parts/HireButton'
import { InputBar, type InputState } from './parts/InputBar'
import { KpiStrip } from './parts/KpiStrip'
import { MessageBubble } from './parts/MessageBubble'
import { QueueRow, type RowState } from './parts/QueueRow'
import { TemplatePicker } from './parts/TemplatePicker'
import { TypingIndicator } from './parts/TypingIndicator'
import { PHASES, type PhaseName } from './phases'
import {
  PICKER_CLICKED_ID,
  SCENE_AGENT,
  SCENE_KPI_INITIAL,
  SCENE_KPI_UPDATED,
  SCENE_QUEUE,
  SCENE_RESPONSE,
  SCENE_USER_MESSAGE,
  SCENE_WELCOME,
  type KpiValues,
} from './scene-data'

// ─── Phase → view mapping ───────────────────────────────────────────────
// `null` during the outro — every view fades out before the loop snaps
// back to dashboard. Transition phases commit to the incoming view; the
// outgoing view's opacity transition handles the cross-fade.

type ViewName = 'dashboard' | 'wizard' | 'chat' | 'activity'

const PHASE_TO_VIEW: Record<PhaseName, ViewName | null> = {
  'idle':                  'dashboard',
  'cursor-to-pending-row': 'dashboard',
  'expand-pending':        'dashboard',
  'cursor-to-approve':     'dashboard',
  'approve-click':         'dashboard',
  'success':               'dashboard',
  'post-approve':          'dashboard',
  'hire-click':            'dashboard',
  'wizard-enter':          'wizard',
  'cursor-to-template':    'wizard',
  'template-click':        'wizard',
  'hire-transition':       'chat',
  'chat-welcome-dwell':    'chat',
  'cursor-to-input':       'chat',
  'typing':                'chat',
  'cursor-to-send':        'chat',
  'send-click':            'chat',
  'thinking':              'chat',
  'agent-responds':        'chat',
  'drafts-cta':            'chat',
  'activity-flash':        'activity',
  'return-and-update':     'dashboard',
  'outro':                 null,
}

// ─── Cursor target positions ────────────────────────────────────────────
// Layout math verified against current CSS — see comment in P5.5 progress
// note for the derivation.

const CURSOR_POSITIONS: Record<PhaseName, { x: number; y: number }> = {
  'idle':                  { x: 440, y: 30 },
  'cursor-to-pending-row': { x: 250, y: 201 },
  'expand-pending':        { x: 250, y: 201 },
  'cursor-to-approve':     { x: 140, y: 261 },
  'approve-click':         { x: 140, y: 261 },
  'success':               { x: 440, y: 30 },
  'post-approve':          { x: 448, y: 35 },
  'hire-click':            { x: 448, y: 35 },
  'wizard-enter':          { x: 440, y: 30 },
  'cursor-to-template':    { x: 250, y: 126 },
  'template-click':        { x: 250, y: 126 },
  'hire-transition':       { x: 250, y: 126 },
  'chat-welcome-dwell':    { x: 440, y: 92 },
  'cursor-to-input':       { x: 120, y: 556 },
  'typing':                { x: 120, y: 556 },
  'cursor-to-send':        { x: 456, y: 556 },
  'send-click':            { x: 456, y: 556 },
  'thinking':              { x: 440, y: 92 },
  'agent-responds':        { x: 440, y: 92 },
  'drafts-cta':            { x: 440, y: 92 },
  'activity-flash':        { x: 440, y: 30 },
  'return-and-update':     { x: 440, y: 30 },
  'outro':                 { x: 440, y: 30 },
}

// ─── Per-phase view state ───────────────────────────────────────────────

interface RowVS {
  state: RowState
  approvePressed: boolean
}

interface ViewState {
  // Dashboard
  kpiValues: KpiValues
  kpiDim: boolean
  pendingPulse: boolean
  pendingFlash: boolean
  rows: [RowVS, RowVS, RowVS, RowVS]
  hirePressed: boolean

  // Wizard
  templatePressedId: string | null

  // Chat
  welcomeVisible: boolean
  userMsgVisible: boolean
  thinkingVisible: boolean
  responseVisible: boolean
  ctaVisible: boolean
  sendBtnPressed: boolean
  inputState: InputState
}

// Intermediate KPI after the approve click but before the hire completes:
// pending dropped to 4, active still 5. Used between `success` and
// `return-and-update`.
const KPI_AFTER_APPROVE: KpiValues = { ...SCENE_KPI_INITIAL, pendingCount: 4 }

const ROWS_INITIAL: [RowVS, RowVS, RowVS, RowVS] = [
  { state: 'focal',  approvePressed: false },
  { state: 'idle',   approvePressed: false },
  { state: 'idle',   approvePressed: false },
  { state: 'hidden', approvePressed: false },
]

const ROWS_EXPANDED: [RowVS, RowVS, RowVS, RowVS] = [
  { state: 'expanded', approvePressed: false },
  { state: 'dim',      approvePressed: false },
  { state: 'dim',      approvePressed: false },
  { state: 'hidden',   approvePressed: false },
]

const ROWS_ROTATED: [RowVS, RowVS, RowVS, RowVS] = [
  { state: 'hidden', approvePressed: false },
  { state: 'focal',  approvePressed: false },
  { state: 'idle',   approvePressed: false },
  { state: 'idle',   approvePressed: false },
]

const DEFAULTS: ViewState = {
  kpiValues: SCENE_KPI_INITIAL,
  kpiDim: false,
  pendingPulse: true,
  pendingFlash: false,
  rows: ROWS_INITIAL,
  hirePressed: false,
  templatePressedId: null,
  welcomeVisible: false,
  userMsgVisible: false,
  thinkingVisible: false,
  responseVisible: false,
  ctaVisible: false,
  sendBtnPressed: false,
  inputState: 'empty',
}

function viewStateForPhase(name: PhaseName): ViewState {
  switch (name) {
    case 'idle':
    case 'cursor-to-pending-row':
      return DEFAULTS

    case 'expand-pending':
    case 'cursor-to-approve':
      return { ...DEFAULTS, rows: ROWS_EXPANDED, kpiDim: true, pendingPulse: false }

    case 'approve-click':
      return {
        ...DEFAULTS,
        rows: [
          { state: 'expanded', approvePressed: true },
          ROWS_EXPANDED[1],
          ROWS_EXPANDED[2],
          ROWS_EXPANDED[3],
        ],
        kpiDim: true,
        pendingPulse: false,
      }

    case 'success':
      return {
        ...DEFAULTS,
        rows: [
          { state: 'success', approvePressed: false },
          { state: 'dim',     approvePressed: false },
          { state: 'dim',     approvePressed: false },
          { state: 'hidden',  approvePressed: false },
        ],
        kpiValues: KPI_AFTER_APPROVE,
        pendingPulse: false,
        pendingFlash: true,
      }

    case 'post-approve':
      return {
        ...DEFAULTS,
        rows: ROWS_ROTATED,
        kpiValues: KPI_AFTER_APPROVE,
      }

    case 'hire-click':
      return {
        ...DEFAULTS,
        rows: ROWS_ROTATED,
        kpiValues: KPI_AFTER_APPROVE,
        hirePressed: true,
      }

    case 'wizard-enter':
    case 'cursor-to-template':
      // Carry the rotated queue forward in the dashboard's now-hidden
      // state so the cross-fade back later doesn't snap rows around.
      return { ...DEFAULTS, rows: ROWS_ROTATED, kpiValues: KPI_AFTER_APPROVE }

    case 'template-click':
      return {
        ...DEFAULTS,
        rows: ROWS_ROTATED,
        kpiValues: KPI_AFTER_APPROVE,
        templatePressedId: PICKER_CLICKED_ID,
      }

    case 'hire-transition':
      // Wizard fades out (still pressed), chat fades in with welcome
      // bubble already visible so it lands together with the new view.
      return {
        ...DEFAULTS,
        rows: ROWS_ROTATED,
        kpiValues: KPI_AFTER_APPROVE,
        templatePressedId: PICKER_CLICKED_ID,
        welcomeVisible: true,
      }

    case 'chat-welcome-dwell':
    case 'cursor-to-input':
      return { ...DEFAULTS, rows: ROWS_ROTATED, kpiValues: KPI_AFTER_APPROVE, welcomeVisible: true }

    case 'typing':
      return {
        ...DEFAULTS,
        rows: ROWS_ROTATED,
        kpiValues: KPI_AFTER_APPROVE,
        welcomeVisible: true,
        inputState: 'typing',
      }

    case 'cursor-to-send':
      return {
        ...DEFAULTS,
        rows: ROWS_ROTATED,
        kpiValues: KPI_AFTER_APPROVE,
        welcomeVisible: true,
        inputState: 'full',
      }

    case 'send-click':
      return {
        ...DEFAULTS,
        rows: ROWS_ROTATED,
        kpiValues: KPI_AFTER_APPROVE,
        welcomeVisible: true,
        userMsgVisible: true,
        sendBtnPressed: true,
        inputState: 'empty',
      }

    case 'thinking':
      return {
        ...DEFAULTS,
        rows: ROWS_ROTATED,
        kpiValues: KPI_AFTER_APPROVE,
        welcomeVisible: true,
        userMsgVisible: true,
        thinkingVisible: true,
      }

    case 'agent-responds':
      return {
        ...DEFAULTS,
        rows: ROWS_ROTATED,
        kpiValues: KPI_AFTER_APPROVE,
        welcomeVisible: true,
        userMsgVisible: true,
        responseVisible: true,
      }

    case 'drafts-cta':
      return {
        ...DEFAULTS,
        rows: ROWS_ROTATED,
        kpiValues: KPI_AFTER_APPROVE,
        welcomeVisible: true,
        userMsgVisible: true,
        responseVisible: true,
        ctaVisible: true,
      }

    case 'activity-flash':
      // Chat fading out, activity fading in. Keep chat content visible
      // so its fadeout is the whole composed frame.
      return {
        ...DEFAULTS,
        rows: ROWS_ROTATED,
        kpiValues: KPI_AFTER_APPROVE,
        welcomeVisible: true,
        userMsgVisible: true,
        responseVisible: true,
        ctaVisible: true,
      }

    case 'return-and-update':
      // Activity fading out, dashboard fading in with UPDATED KPIs
      // (6 active / 4 pending). Pending tile pulses again on the new
      // focal queue item.
      return {
        ...DEFAULTS,
        rows: ROWS_ROTATED,
        kpiValues: SCENE_KPI_UPDATED,
        pendingFlash: true,
      }

    case 'outro':
      // All views fade out; snap-back to initial state happens behind
      // the curtain.
      return {
        ...DEFAULTS,
        rows: ROWS_ROTATED,
        kpiValues: SCENE_KPI_UPDATED,
      }
  }
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

export function HeroJourneyLoop() {
  const phaseIndex = usePhaseLoop()
  const phase = PHASES[phaseIndex]
  const cursor = CURSOR_POSITIONS[phase.name]
  const visibleView = PHASE_TO_VIEW[phase.name]
  const vs = viewStateForPhase(phase.name)

  return (
    <div className="hero-journey-loop" aria-label="int3grate.ai live preview">
      <div className="hero-journey-loop__stage">

        {/* Dashboard view */}
        <div className={`hjl-view hjl-view--dashboard${visibleView === 'dashboard' ? ' hjl-view--visible' : ''}`}>
          <div className="hjl-topbar">
            <Greeting />
            <HireButton pressed={vs.hirePressed} />
          </div>

          <KpiStrip
            values={vs.kpiValues}
            pendingPulse={vs.pendingPulse}
            dim={vs.kpiDim}
            pendingFlash={vs.pendingFlash}
          />

          <div className="hjl-queue">
            <div className="hjl-queue__head">
              <span className="hjl-queue__title">Needs you</span>
              <span className="hjl-queue__count">{vs.kpiValues.pendingCount}</span>
            </div>

            {SCENE_QUEUE.map((item, i) => (
              <QueueRow
                key={item.id}
                item={item}
                state={vs.rows[i].state}
                approvePressed={vs.rows[i].approvePressed}
              />
            ))}
          </div>
        </div>

        {/* Wizard view */}
        <div className={`hjl-view hjl-view--wizard${visibleView === 'wizard' ? ' hjl-view--visible' : ''}`}>
          <TemplatePicker pressedId={vs.templatePressedId} />
        </div>

        {/* Chat view */}
        <div className={`hjl-view hjl-view--chat${visibleView === 'chat' ? ' hjl-view--visible' : ''}`}>
          <AgentHeader />

          <div className="hjl-chat">
            <MessageBubble speaker="agent" visible={vs.welcomeVisible} initials={SCENE_AGENT.initials}>
              {SCENE_WELCOME}
            </MessageBubble>

            <MessageBubble speaker="user" visible={vs.userMsgVisible}>
              {SCENE_USER_MESSAGE}
            </MessageBubble>

            <TypingIndicator visible={vs.thinkingVisible} />

            <MessageBubble speaker="agent" visible={vs.responseVisible} initials={SCENE_AGENT.initials}>
              <div className="hjl-resp">
                <div className="hjl-resp__intro">{SCENE_RESPONSE.intro}</div>
                <ul className="hjl-resp__list">
                  {SCENE_RESPONSE.bullets.map(b => <li key={b}>{b}</li>)}
                </ul>
              </div>
            </MessageBubble>

            <ActionCta visible={vs.ctaVisible} />
          </div>

          <InputBar state={vs.inputState} sendPressed={vs.sendBtnPressed} />
        </div>

        {/* Activity view */}
        <div className={`hjl-view hjl-view--activity${visibleView === 'activity' ? ' hjl-view--visible' : ''}`}>
          <ActivityTicker />
        </div>

        <Cursor x={cursor.x} y={cursor.y} />
      </div>
    </div>
  )
}
