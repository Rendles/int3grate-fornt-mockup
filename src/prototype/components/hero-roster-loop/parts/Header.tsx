// Header strip of the roster scene: title + time on the left, "needs you"
// pill on the right. The pill is orange-tinted when count > 0 and muted
// when 0; a brief 420 ms scale-flash fires whenever the count changes.

import { SCENE_HEADER } from '../scene-data'

interface HeaderProps {
  pendingCount: number
  flash: boolean
}

export function Header({ pendingCount, flash }: HeaderProps) {
  const cls = [
    'hr-header__pill',
    pendingCount > 0 ? 'hr-header__pill--active' : 'hr-header__pill--muted',
    flash ? 'hr-header__pill--flash' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className="hr-header">
      <div className="hr-header__left">
        <div className="hr-header__title">{SCENE_HEADER.title}</div>
        <div className="hr-header__time">{SCENE_HEADER.time}</div>
      </div>
      <div className={cls} aria-hidden>
        <span className="hr-header__pill-count">{pendingCount}</span>
        <span className="hr-header__pill-label">needs you</span>
      </div>
    </div>
  )
}
