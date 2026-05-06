// Shared constants + helpers for the quick-hire UI surfaces:
//   - components/quick-hire-grid.tsx (production /agents empty + sandbox)
//   - screens/sandbox/WelcomeChatScreen.tsx (onboarding sandbox)
//
// Lives outside the React component file because react-refresh requires
// component files to export only components.

import { appLabel, appPrefix } from './format'
import {
  FEATURED_TEMPLATES,
  NON_FEATURED_TEMPLATES,
  type AssistantTemplate,
  type TemplateGrant,
} from './templates'

// 'custom' is excluded — a blank agent has nothing to preview, so it
// doesn't fit the two-click flow. Custom hires stay in /agents/new.
export const QUICK_HIRE_TEMPLATES: AssistantTemplate[] = [
  ...FEATURED_TEMPLATES,
  ...NON_FEATURED_TEMPLATES,
].filter(t => t.id !== 'custom')

const SAMPLE_TASKS_LIMIT = 3

// Pick the first ~3 bullets out of `defaultInstructions`. Templates today
// follow a "Your job:\n- bullet\n- bullet" shape; this strips the leading
// dash and trims. Returns [] when the template doesn't follow that shape —
// callers should hide the section in that case.
export function extractSampleTasks(instructions: string): string[] {
  const bullets: string[] = []
  for (const line of instructions.split('\n')) {
    const m = line.match(/^\s*-\s+(.+?)\s*$/)
    if (m) bullets.push(m[1])
    if (bullets.length >= SAMPLE_TASKS_LIMIT) break
  }
  return bullets
}

// Group grants by app prefix, dedupe, return human-readable labels.
export function appsFromGrants(grants: TemplateGrant[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const g of grants) {
    const p = appPrefix(g.tool_name)
    if (seen.has(p)) continue
    seen.add(p)
    out.push(appLabel(p))
  }
  return out
}
