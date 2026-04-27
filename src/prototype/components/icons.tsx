import type { CSSProperties } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import type { IconSvgElement } from '@hugeicons/react'
import {
  Alert02Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Audit01Icon,
  BubbleChatIcon,
  Cancel01Icon,
  CheckmarkBadge01Icon,
  Clock01Icon,
  DollarCircleIcon,
  HelpCircleIcon,
  Home01Icon,
  InformationCircleIcon,
  LockIcon,
  Logout03Icon,
  Moon02Icon,
  PauseIcon,
  PlayIcon,
  PlusSignIcon,
  Robot02Icon,
  Search01Icon,
  StopCircleIcon,
  Sun03Icon,
  TaskDone01Icon,
  Tick02Icon,
  ToolsIcon,
  ViewIcon,
  ViewOffIcon,
} from '@hugeicons/core-free-icons'

/* =============================================================
   Legacy icon exports — these are now thin wrappers over Hugeicons
   so existing call sites (`<IconHome />`, `<IconHome className="ic ic--sm" />`,
   `<IconHome size={14} />`) keep working unchanged.

   For new code prefer the bare `<Icon icon={...} />` from './icon'
   together with a direct import from '@hugeicons/core-free-icons'.
   ============================================================= */

type P = { className?: string; size?: number; style?: CSSProperties }

const make = (icon: IconSvgElement) =>
  function LegacyIcon({ className = 'ic', size, style }: P) {
    const merged = size ? { width: size, height: size, ...style } : style
    return <HugeiconsIcon icon={icon} className={className} style={merged} />
  }

export const IconHome = make(Home01Icon)
export const IconAgent = make(Robot02Icon)
export const IconChat = make(BubbleChatIcon)
export const IconTask = make(TaskDone01Icon)
export const IconApproval = make(CheckmarkBadge01Icon)
export const IconRun = make(Clock01Icon)
export const IconTool = make(ToolsIcon)
export const IconSpend = make(DollarCircleIcon)
export const IconAudit = make(Audit01Icon)

export const IconPlus = make(PlusSignIcon)
export const IconArrowLeft = make(ArrowLeft01Icon)
export const IconArrowRight = make(ArrowRight01Icon)
export const IconCheck = make(Tick02Icon)
export const IconX = make(Cancel01Icon)
export const IconAlert = make(Alert02Icon)
export const IconInfo = make(InformationCircleIcon)

export const IconPlay = make(PlayIcon)
export const IconPause = make(PauseIcon)
export const IconStop = make(StopCircleIcon)

export const IconSearch = make(Search01Icon)
export const IconLock = make(LockIcon)
export const IconEye = make(ViewIcon)
export const IconEyeOff = make(ViewOffIcon)
export const IconLogout = make(Logout03Icon)

export const IconSun = make(Sun03Icon)
export const IconMoon = make(Moon02Icon)
export const IconHelp = make(HelpCircleIcon)
