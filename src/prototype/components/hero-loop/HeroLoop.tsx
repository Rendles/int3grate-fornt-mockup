// Scripted scene for the marketing landing-page hero.
//
// Phase 2 layout: greeting + 3 KPIs + pending-approvals queue (4 rows in
// DOM; visibility per row drives a "queue keeps moving" rotation).
// State machine is the same 9 phases × 9s loop from Phase 1.
//
// PORTABILITY CONTRACT: this folder has zero dependencies on the rest of
// src/prototype. Brand tokens are inlined as CSS variables. To hand off
// to the landing repo, copy src/prototype/components/hero-loop/ verbatim.

import { useEffect, useState } from 'react'

import './HeroLoop.css'
import { Cursor } from './parts/Cursor'
import { Greeting } from './parts/Greeting'
import { KpiStrip } from './parts/KpiStrip'
import { QueueRow, type RowState } from './parts/QueueRow'
import { PHASES, type PhaseName } from './phases'
import { SCENE_KPI, SCENE_QUEUE } from './scene-data'

// Cursor target positions in stage-local px. Stage is 500×600 with 20px
// padding; layout is deterministic, so coords are hardcoded.
// Anchored to the actual rendered layout (verify in DevTools if it drifts):
//   - rest         (440, 30)  : right of the greeting line
//   - focal row    (250, 205) : centred over the top queue row (compact)
//   - approve btn  (140, 272) : Approve button centre in expanded footer
//
// Layout math for approve-btn y (assuming default font / Inter):
//   greeting (~22) + 14 + kpi (~78) + 14 + queue-head (~18) + 6
//     → row top ≈ 172
//   row padding 12 + head 37 + body margin 8 + body 17 + footer margin 10
//     → footer top ≈ 256; button h 32 → centre ≈ 272.
const CURSOR_POSITIONS: Record<PhaseName, { x: number; y: number }> = {
  'idle':              { x: 440, y: 30 },
  'cursor-to-tile':    { x: 250, y: 205 },
  'tile-click':        { x: 250, y: 205 },
  'approval-enter':    { x: 250, y: 205 },
  'cursor-to-approve': { x: 140, y: 272 },
  'approve-click':     { x: 140, y: 272 },
  'success':           { x: 440, y: 30 },
  'next-incoming':     { x: 440, y: 30 },
  'outro':             { x: 440, y: 30 },
}

// ─── View state ─────────────────────────────────────────────────────────
// Each queue row carries its OWN state — we don't track "the focal index"
// because in next-incoming RR is hidden + LQ promotes simultaneously on
// independent timelines. Per-row state is the cleanest representation.

interface ViewState {
  rrState: RowState
  lqState: RowState
  apState: RowState
  nextState: RowState
  rrPressed: boolean
  approveBtnPressed: boolean
  kpiDim: boolean
  kpiPendingCount: number
  kpiPendingPulse: boolean
  kpiPendingFlash: boolean
}

const DEFAULT_VIEW_STATE: ViewState = {
  rrState: 'idle',
  lqState: 'idle',
  apState: 'idle',
  nextState: 'hidden',
  rrPressed: false,
  approveBtnPressed: false,
  kpiDim: false,
  kpiPendingCount: SCENE_KPI.pendingInitial,
  kpiPendingPulse: false,
  kpiPendingFlash: false,
}

function viewStateForPhase(name: PhaseName): ViewState {
  switch (name) {
    case 'idle':
    case 'cursor-to-tile':
      return {
        ...DEFAULT_VIEW_STATE,
        rrState: 'focal',
        kpiPendingPulse: true,
      }

    case 'tile-click':
      return {
        ...DEFAULT_VIEW_STATE,
        rrState: 'focal',
        rrPressed: true,
        kpiPendingPulse: true,
      }

    case 'approval-enter':
    case 'cursor-to-approve':
      return {
        ...DEFAULT_VIEW_STATE,
        rrState: 'expanded',
        lqState: 'dim',
        apState: 'dim',
        kpiDim: true,
      }

    case 'approve-click':
      return {
        ...DEFAULT_VIEW_STATE,
        rrState: 'expanded',
        lqState: 'dim',
        apState: 'dim',
        kpiDim: true,
        approveBtnPressed: true,
      }

    case 'success':
      return {
        ...DEFAULT_VIEW_STATE,
        rrState: 'success',
        lqState: 'dim',
        apState: 'dim',
        kpiDim: true,
        kpiPendingCount: SCENE_KPI.pendingAfterApprove,
        kpiPendingFlash: true,
      }

    case 'next-incoming':
      // RR collapses out, LQ promotes to focal, 4th row reveals.
      return {
        ...DEFAULT_VIEW_STATE,
        rrState: 'hidden',
        lqState: 'focal',
        apState: 'idle',
        nextState: 'idle',
        kpiPendingCount: SCENE_KPI.pendingAfterApprove,
        kpiPendingPulse: true,
      }

    case 'outro':
      // Hold the post-approve queue while everything fades. The loop reset
      // (phase 0) snaps back to RR-as-focal + pendingInitial — visually a
      // clean restart.
      return {
        ...DEFAULT_VIEW_STATE,
        rrState: 'hidden',
        lqState: 'focal',
        apState: 'idle',
        nextState: 'idle',
        kpiPendingCount: SCENE_KPI.pendingAfterApprove,
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

export function HeroLoop() {
  const phaseIndex = usePhaseLoop()
  const phase = PHASES[phaseIndex]
  const cursor = CURSOR_POSITIONS[phase.name]
  const view = viewStateForPhase(phase.name)

  return (
    <div className="hero-loop" aria-label="int3grate.ai live preview">
      <div className="hero-loop__stage">
        <Greeting />

        <KpiStrip
          pendingCount={view.kpiPendingCount}
          pendingPulse={view.kpiPendingPulse}
          dim={view.kpiDim}
          pendingFlash={view.kpiPendingFlash}
        />

        <div className="hl-queue">
          <div className="hl-queue__head">
            <span className="hl-queue__title">Needs you</span>
            <span className="hl-queue__count">{view.kpiPendingCount}</span>
          </div>

          {/* 4 rows are always in the DOM. Visibility per row drives the
              queue rotation in next-incoming. */}
          <QueueRow
            item={SCENE_QUEUE[0]}
            state={view.rrState}
            pressed={view.rrPressed}
            approvePressed={view.approveBtnPressed}
          />
          <QueueRow item={SCENE_QUEUE[1]} state={view.lqState} />
          <QueueRow item={SCENE_QUEUE[2]} state={view.apState} />
          <QueueRow item={SCENE_QUEUE[3]} state={view.nextState} />
        </div>

        <Cursor x={cursor.x} y={cursor.y} />
      </div>
    </div>
  )
}
