// Header strip: eyebrow + caption on left, animated clock on right.
// Clock icon swaps moon ↔ sun by daypart; the time string snaps with a
// brief 240 ms cross-fade (CSS-driven via the `data-clock` attribute).

import { SCENE_HEADER } from '../scene-data'
import type { Daypart } from '../phases'

interface ClockStripProps {
  clock: string
  daypart: Daypart
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M 13 9.5 A 6 6 0 1 1 6.5 3 A 4.5 4.5 0 0 0 13 9.5 Z"
        fill="currentColor"
      />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <circle cx="8" cy="8" r="3.2" fill="currentColor" />
      <line x1="8" y1="1.4" x2="8" y2="3.2" />
      <line x1="8" y1="12.8" x2="8" y2="14.6" />
      <line x1="1.4" y1="8" x2="3.2" y2="8" />
      <line x1="12.8" y1="8" x2="14.6" y2="8" />
      <line x1="3.2" y1="3.2" x2="4.5" y2="4.5" />
      <line x1="11.5" y1="11.5" x2="12.8" y2="12.8" />
      <line x1="3.2" y1="12.8" x2="4.5" y2="11.5" />
      <line x1="11.5" y1="4.5" x2="12.8" y2="3.2" />
    </svg>
  )
}

export function ClockStrip({ clock, daypart }: ClockStripProps) {
  const isMorning = daypart === 'dawn' || daypart === 'morning'
  const pillCls = `ho-clock ho-clock--${daypart}`

  return (
    <div className="ho-header">
      <div className="ho-header__left">
        <div className="ho-header__eyebrow">{SCENE_HEADER.eyebrow}</div>
        <div className="ho-header__caption">{SCENE_HEADER.caption}</div>
      </div>
      <div className={pillCls} aria-hidden>
        <span className="ho-clock__icon">
          {isMorning ? <SunIcon /> : <MoonIcon />}
        </span>
        <span className="ho-clock__time" key={clock}>{clock}</span>
      </div>
    </div>
  )
}
