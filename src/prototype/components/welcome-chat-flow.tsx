// Chat-styled onboarding flow for empty workspaces. Used in two places:
//   - screens/sandbox/WelcomeChatScreen.tsx (standalone preview)
//   - screens/HomeScreen.tsx (empty-workspace dashboard)
//
// IMPORTANT: this LOOKS like a chat but it's a guided wizard. There is no
// textbox — only clickable chip replies. The user cannot type. Voice is
// neutral business-tone per docs/ux-spec.md § 8 / § 9-10 (no
// "Hey friend!", no robot mascots, no emoji). Avatars are flat
// initials-circles (Radix Avatar with `radius="full"`) — never robot
// icons or sparkles. The system speaker uses an "i" avatar; the user's
// echo bubble uses the current user's initials; the agent greeting uses
// the freshly-hired template's initials.
//
// Layout: a single card-like frame with a scrollable message area on top
// and a sticky picker strip on the bottom — same shape as a chat window.
// The picker (template chips) lives where a textbox would, so the user
// always knows where their next "reply" goes. Hover on a chip → preview
// (shortPitch + apps); click → bubbles append in the chat history.
//
// Bubble-accumulation: messages append below — they DON'T replace each
// other. Older interactive bubbles (action-row, tutorial) dim as soon as
// a newer interactive bubble appears. Auto-scroll keeps the latest at
// the bottom of the scrollable area. After hire, the chat doesn't morph
// into a real conversation — instead a final action-row offers "Open
// chat with Sales Agent →" which navigates to the proper
// /agents/:id/talk/:chatId surface (where the seeded greeting message
// appears). The picker hides once hire succeeds.
//
// See docs/agent-plans/2026-05-05-1635-welcome-chat-bubble-flow-and-promotion.md.

import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Avatar as RadixAvatar,
  Badge,
  Box,
  Button,
  DropdownMenu,
  Flex,
  HoverCard,
  Spinner,
  Text,
  Tooltip,
} from '@radix-ui/themes'

import { Caption } from './common'
import { TextAreaField, TextInput } from './fields'
import { Banner } from './states'
import { IconArrowRight, IconCheck, IconPlus, IconX } from './icons'
import { Link, useRouter } from '../router'
import { useAuth } from '../auth'
import { api } from '../lib/api'
import { appLabel, appPrefix, toolLabel } from '../lib/format'
import { useHireTemplate } from '../lib/use-hire-template'
import {
  QUICK_HIRE_TEMPLATES,
  appsFromGrants,
  extractSampleTasks,
} from '../lib/quick-hire'
import {
  getTemplate,
  type AssistantTemplate,
  type TemplateGrant,
} from '../lib/templates'
import type { ToolDefinition, ToolGrantMode } from '../lib/types'

// ─── Message model ───────────────────────────────────────────────────

type WelcomeMsg =
  | { kind: 'system-text'; id: string; content: ReactNode }
  | { kind: 'user-echo'; id: string; content: string }
  | { kind: 'tutorial-line'; id: string }
  | { kind: 'template-cards'; id: string }
  | { kind: 'template-details'; id: string; templateId: string }
  | { kind: 'action-row'; id: string; templateId: string; phase: 'select' }
  | {
      kind: 'open-chat-row'
      id: string
      templateId: string
      agentId: string
      chatId?: string
    }
  | { kind: 'hiring'; id: string; templateId: string }
  | { kind: 'hired'; id: string; templateId: string }
  | { kind: 'modify-form'; id: string; baseTemplateId: string }
  | { kind: 'error'; id: string; message: string }

// Interactive kinds — these get dimmed when frozenIdx passes them.
// open-chat-row is intentionally NOT included: once an agent is hired,
// the "Open chat with {name}" button stays clickable forever, even after
// the user goes back through "Add another agent" and hires more.
function isInteractive(msg: WelcomeMsg): boolean {
  return (
    msg.kind === 'tutorial-line' ||
    msg.kind === 'template-cards' ||
    msg.kind === 'action-row' ||
    msg.kind === 'modify-form'
  )
}

// Module-level monotonic id generator. The flow only mounts once per page,
// so collisions across instances aren't a concern.
let _msgCounter = 0
function makeId(prefix: string): string {
  _msgCounter += 1
  return `${prefix}_${_msgCounter}`
}

// ─── State machine ───────────────────────────────────────────────────

interface State {
  messages: WelcomeMsg[]
  // Messages with index < frozenIdx are "history" — interactive ones get
  // dimmed/disabled. New messages always go at end (>= frozenIdx).
  frozenIdx: number
}

type Action =
  | { type: 'pick-template'; template: AssistantTemplate }
  | { type: 'pick-custom' }
  | { type: 'open-modify-form'; template: AssistantTemplate }
  | { type: 'start-hire'; template: AssistantTemplate }
  | {
      type: 'hire-success'
      template: AssistantTemplate
      agentId: string
      chatId?: string
    }
  | { type: 'hire-error'; template: AssistantTemplate; message: string }
  | { type: 'add-another' }

function adminInitialState(): State {
  return {
    messages: [
      {
        kind: 'system-text',
        id: makeId('m'),
        content: (
          <>
            {/* The two emphasised lines (welcome headline + the "Pick a
                role" CTA) carry the message — most users skim the rest.
                The middle paragraph is intentionally tiny (size 1, gray)
                so it sits as fine-print context, not as a reading task. */}
            <Text as="p" size="5" weight="medium" mb="0">
              Welcome to int3grate.ai.
            </Text>
            <Text as="p" size="1" color="gray" mt="2" mb="0">
              int3grate.ai gives you a small digital team that works inside the
              apps you already use — reading your CRM, drafting emails, posting
              status updates. Every action that touches the outside world goes
              through your approval first, so you stay in control.
            </Text>
            <Text as="p" size="3" weight="medium" mt="3" mb="0">
              Pick a role below to hire your first agent.
            </Text>
          </>
        ),
      },
      // First-time picker: big inline cards with avatar + name +
      // shortPitch. After the user picks one, this grid dims and the
      // bottom chip-picker takes over for repeat picks.
      { kind: 'template-cards', id: makeId('m') },
      { kind: 'tutorial-line', id: makeId('m') },
    ],
    frozenIdx: 0,
  }
}

function memberInitialState(): State {
  return {
    messages: [
      {
        kind: 'system-text',
        id: makeId('m'),
        content: (
          <>
            <Text as="p" size="3" weight="medium" mb="0">
              Welcome to int3grate.ai.
            </Text>
            <Text as="p" size="2" color="gray" mt="2" mb="0">
              Your workspace doesn't have any agents yet. Ask an admin to hire
              the first one — once they do, you'll be able to chat with the
              agents and review their work here.
            </Text>
          </>
        ),
      },
      { kind: 'tutorial-line', id: makeId('m') },
    ],
    frozenIdx: 0,
  }
}

// Used when the flow is embedded as a "Hire another" modal on the
// /agents page — the user has already onboarded so we skip the welcome
// pitch and the tutorial line, jumping straight to "pick a role".
function compactAdminInitialState(): State {
  return {
    messages: [
      {
        kind: 'system-text',
        id: makeId('m'),
        content: (
          <>
            <Text as="p" size="3" weight="medium" mb="0">
              Hire another agent.
            </Text>
            <Text as="p" size="2" color="gray" mt="2" mb="0">
              Pick a role from the picker below — same flow as last time.
            </Text>
          </>
        ),
      },
    ],
    frozenIdx: 0,
  }
}

function reducer(state: State, action: Action): State {
  // Snapshot of "everything we've shown so far" — older items will dim.
  const messages = [...state.messages]
  const frozenIdx = messages.length

  switch (action.type) {
    case 'pick-template': {
      const t = action.template
      messages.push({ kind: 'user-echo', id: makeId('m'), content: t.defaultName })
      messages.push({ kind: 'template-details', id: makeId('m'), templateId: t.id })
      messages.push({
        kind: 'action-row',
        id: makeId('m'),
        templateId: t.id,
        phase: 'select',
      })
      return { messages, frozenIdx }
    }
    case 'pick-custom': {
      // Custom skips the template-details bubble (nothing to describe —
      // it's a blank slate) and goes straight to the modify form.
      const customT = getTemplate('custom')
      const echo = customT?.defaultName ?? 'Custom Agent'
      messages.push({ kind: 'user-echo', id: makeId('m'), content: echo })
      messages.push({
        kind: 'modify-form',
        id: makeId('m'),
        baseTemplateId: 'custom',
      })
      return { messages, frozenIdx }
    }
    case 'open-modify-form': {
      // User clicked "Modify" on the action-row — open an inline form
      // pre-filled with the template's defaults so they can tweak name
      // and brief without leaving the chat.
      messages.push({ kind: 'user-echo', id: makeId('m'), content: 'Modify' })
      messages.push({
        kind: 'modify-form',
        id: makeId('m'),
        baseTemplateId: action.template.id,
      })
      return { messages, frozenIdx }
    }
    case 'start-hire': {
      messages.push({
        kind: 'hiring',
        id: makeId('m'),
        templateId: action.template.id,
      })
      return { messages, frozenIdx }
    }
    case 'hire-success': {
      // Replace the still-spinning hiring bubble with a "hired" status
      // bubble (green check + ready-message). Same id keeps React's DOM
      // node stable so the swap is instant — no re-mount, no flicker.
      // The agent's own welcome message stays in the real chat (seeded
      // via createChat); we don't echo it here in the welcome overlay.
      const lastIdx = messages.length - 1
      const last = messages[lastIdx]
      if (last && last.kind === 'hiring') {
        messages[lastIdx] = {
          kind: 'hired',
          id: last.id,
          templateId: last.templateId,
        }
      }
      messages.push({
        kind: 'open-chat-row',
        id: makeId('m'),
        templateId: action.template.id,
        agentId: action.agentId,
        chatId: action.chatId,
      })
      return { messages, frozenIdx }
    }
    case 'hire-error': {
      messages.push({ kind: 'error', id: makeId('m'), message: action.message })
      messages.push({
        kind: 'action-row',
        id: makeId('m'),
        templateId: action.template.id,
        phase: 'select',
      })
      return { messages, frozenIdx }
    }
    case 'add-another': {
      // The user wants to hire another agent after a successful hire.
      // Push a user-echo bubble — this also flips `lastMsg.kind` away
      // from 'open-chat-row', so the picker becomes visible again
      // automatically. Previous open-chat-rows stay clickable (see
      // isInteractive — open-chat-row is excluded from dimming).
      messages.push({
        kind: 'user-echo',
        id: makeId('m'),
        content: 'Add another agent',
      })
      return { messages, frozenIdx }
    }
  }
}

// ─── Public component ────────────────────────────────────────────────

// const FLOW_MAX_WIDTH = 720

// `variant='intro'` (default) — full first-time welcome with the int3grate
// pitch + tutorial line. Used on Home empty-state and the standalone
// sandbox.
// `variant='compact'` — skips the welcome bubble + tutorial; opens with a
// short "Hire another agent" prompt + picker. Used inside the Hire dialog
// on /agents where the user has already onboarded.
//
// `onClose`, when provided, replaces the "See your team" button on the
// post-hire action-row with "Close" that calls this callback. Lets the
// caller (modal host) decide what "I'm done" means in its context.
type WelcomeChatVariant = 'intro' | 'compact'
export interface WelcomeChatFlowProps {
  variant?: WelcomeChatVariant
  onClose?: () => void
}

export function WelcomeChatFlow({
  variant = 'intro',
  onClose,
}: WelcomeChatFlowProps = {}) {
  const { user } = useAuth()
  const { navigate } = useRouter()
  const isMember = user?.role === 'member'

  const [state, dispatch] = useReducer(
    reducer,
    { isMember, variant },
    ({ isMember: m, variant: v }) =>
      m
        ? memberInitialState()
        : v === 'compact'
          ? compactAdminInitialState()
          : adminInitialState(),
  )

  const { hire, clearError } = useHireTemplate()
  const messagesRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll the messages box to its bottom whenever the list grows.
  // We set scrollTop = scrollHeight directly (instead of scrollIntoView
  // on a sentinel) — scrollHeight is layout-final regardless of any
  // in-progress fade-in transforms, so we land precisely at the bottom
  // without the few-pixel undershoot that scrollIntoView caused while
  // the welcome-fade-in animation was still running. The rAF wrap waits
  // one frame so layout is committed before we measure.
  useEffect(() => {
    const el = messagesRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    })
  }, [state.messages.length])

  const onPickTemplate = (template: AssistantTemplate) => {
    clearError()
    if (template.id === 'custom') {
      dispatch({ type: 'pick-custom' })
    } else {
      dispatch({ type: 'pick-template', template })
    }
  }

  const onModify = (template: AssistantTemplate) => {
    // Inline customize: open the modify-form bubble right here in chat
    // instead of navigating to /agents/new. User edits name + brief and
    // hires from the form. (Was navigate('/agents/new?template=…') before.)
    clearError()
    dispatch({ type: 'open-modify-form', template })
  }

  const onHire = async (template: AssistantTemplate) => {
    dispatch({ type: 'start-hire', template })
    try {
      const { agentId, chatId } = await hire(template, { withSeedChat: true })
      dispatch({ type: 'hire-success', template, agentId, chatId })
    } catch (e) {
      dispatch({
        type: 'hire-error',
        template,
        message: (e as Error).message ?? 'Could not hire agent',
      })
    }
  }

  const onOpenChat = (agentId: string, chatId?: string) => {
    if (chatId) {
      navigate(`/agents/${agentId}/talk/${chatId}`)
    } else {
      navigate(`/agents/${agentId}/talk`)
    }
  }

  const onAddAnother = () => {
    clearError()
    dispatch({ type: 'add-another' })
  }

  // Secondary CTA after hire-success — either "Close" (when caller is a
  // modal that wants to dismiss itself, e.g. Hire dialog on /agents) or
  // "See your team" (when on Home / sandbox, where /agents is a separate
  // route worth navigating to).
  const secondaryAction = onClose
    ? { label: 'Close', onClick: onClose }
    : { label: 'See your team', onClick: () => navigate('/agents') }

  // Picker visibility:
  // — hidden after hire-success (lastMsg is open-chat-row);
  // — hidden while an active inline template-cards bubble is the
  //   first-time picker (intro variant only — those cards live in
  //   chat history at frozenIdx ≥ current. Once user clicks one,
  //   they dim and the bottom picker takes over);
  // — disabled (chips greyed) while the hire chain is in flight.
  const lastMsg = state.messages[state.messages.length - 1]
  const hireDone = lastMsg?.kind === 'open-chat-row'
  const hireBusy = lastMsg?.kind === 'hiring'
  const hasActiveInlineCards = state.messages.some(
    (m, idx) => m.kind === 'template-cards' && idx >= state.frozenIdx,
  )
  const showPicker = !isMember && !hireDone && !hasActiveInlineCards

  // Picker shows the 6 ready-made templates plus a "Custom Agent" chip
  // at the end for users who want a blank slate.
  const customTemplate = getTemplate('custom')
  const pickerTemplates = customTemplate
    ? [...QUICK_HIRE_TEMPLATES, customTemplate]
    : QUICK_HIRE_TEMPLATES

  return (
    <Box
      className="welcome-frame"
      style={{ marginInline: 'auto' }}
    >
      <div className="welcome-frame__messages" ref={messagesRef}>
        <Flex direction="column" gap="3">
          {state.messages.map((msg, idx) => {
            const dimmed = isInteractive(msg) && idx < state.frozenIdx
            const isLast = idx === state.messages.length - 1
            return (
              <MessageRenderer
                key={msg.id}
                msg={msg}
                dimmed={dimmed}
                isLast={isLast}
                onPickTemplate={onPickTemplate}
                onModify={onModify}
                onHire={onHire}
                onOpenChat={onOpenChat}
                onAddAnother={onAddAnother}
                secondaryAction={secondaryAction}
              />
            )
          })}
        </Flex>
      </div>

      {showPicker && (
        <Box className="welcome-frame__picker">
          <Caption>Pick a role</Caption>
          <Flex gap="2" wrap="wrap" mt="2">
            {pickerTemplates.map(t => (
              <TemplateChip
                key={t.id}
                template={t}
                disabled={hireBusy}
                onClick={() => onPickTemplate(t)}
              />
            ))}
          </Flex>
        </Box>
      )}
    </Box>
  )
}

// ─── Message renderer ────────────────────────────────────────────────

interface RendererProps {
  msg: WelcomeMsg
  dimmed: boolean
  // True when this is the very last message — used to decide whether an
  // open-chat-row also renders the secondary "Add another agent" /
  // secondary-action buttons. Older open-chat-rows (after the user
  // already moved on) only show their own "Open chat" link.
  isLast: boolean
  // Used by the inline template-cards bubble — same handler as the
  // bottom picker chips, but rendered in chat history with bigger cards.
  onPickTemplate: (t: AssistantTemplate) => void
  onModify: (t: AssistantTemplate) => void
  onHire: (t: AssistantTemplate) => void
  onOpenChat: (agentId: string, chatId?: string) => void
  onAddAnother: () => void
  // Secondary action next to "Open chat with X" — context-dependent.
  // On Home/sandbox: "See your team" → /agents. Inside Hire modal:
  // "Close" → dismiss modal.
  secondaryAction: { label: string; onClick: () => void }
}

function MessageRenderer(props: RendererProps) {
  const { msg, dimmed } = props
  const dimClass = dimmed ? ' welcome-msg--dimmed' : ''
  const wrapperClass = `welcome-msg${dimClass}`

  switch (msg.kind) {
    case 'system-text':
      return (
        <div className={wrapperClass}>
          <SystemBubble>{msg.content}</SystemBubble>
        </div>
      )
    case 'user-echo':
      return (
        <div className={wrapperClass}>
          <UserBubble>{msg.content}</UserBubble>
        </div>
      )
    case 'tutorial-line':
      return (
        <div className={wrapperClass} aria-disabled={dimmed}>
          <TutorialLine disabled={dimmed} />
        </div>
      )
    case 'template-cards':
      return (
        <div className={wrapperClass} aria-disabled={dimmed}>
          <TemplateCardsGrid
            disabled={dimmed}
            onPick={props.onPickTemplate}
          />
        </div>
      )
    case 'template-details': {
      const t = getTemplate(msg.templateId)
      if (!t) return null
      return (
        <div className={wrapperClass}>
          <TemplateDetailsBubble template={t} />
        </div>
      )
    }
    case 'action-row': {
      const t = getTemplate(msg.templateId)
      if (!t) return null
      return (
        <div className={wrapperClass} aria-disabled={dimmed}>
          <SelectActionRow
            template={t}
            disabled={dimmed}
            onModify={() => props.onModify(t)}
            onHire={() => props.onHire(t)}
          />
        </div>
      )
    }
    case 'open-chat-row': {
      const t = getTemplate(msg.templateId)
      if (!t) return null
      return (
        <div className={wrapperClass} aria-disabled={dimmed}>
          <OpenChatActionRow
            templateName={t.defaultName}
            disabled={dimmed}
            isLatest={props.isLast}
            onOpenChat={() => props.onOpenChat(msg.agentId, msg.chatId)}
            onAddAnother={props.onAddAnother}
            secondaryAction={props.secondaryAction}
          />
        </div>
      )
    }
    case 'hiring': {
      const t = getTemplate(msg.templateId)
      if (!t) return null
      return (
        <div className={wrapperClass}>
          <HiringBubble templateName={t.defaultName} />
        </div>
      )
    }
    case 'hired': {
      const t = getTemplate(msg.templateId)
      if (!t) return null
      return (
        <div className={wrapperClass}>
          <HiredBubble templateName={t.defaultName} />
        </div>
      )
    }
    case 'modify-form': {
      const baseT = getTemplate(msg.baseTemplateId)
      if (!baseT) return null
      return (
        <div className={wrapperClass} aria-disabled={dimmed}>
          <ModifyFormBubble
            baseTemplate={baseT}
            disabled={dimmed}
            onHire={(name, instructions, grants) => {
              const synth: AssistantTemplate = {
                ...baseT,
                defaultName: name,
                defaultInstructions: instructions,
                defaultGrants: grants,
              }
              props.onHire(synth)
            }}
          />
        </div>
      )
    }
    case 'error':
      return (
        <div className={wrapperClass}>
          <Banner tone="danger" title="Couldn't hire">{msg.message}</Banner>
        </div>
      )
  }
}

// ─── Sub-components ──────────────────────────────────────────────────

// Suggestion-chip pattern (Telegram-bot inline-keyboard / WhatsApp
// quick-reply style). Lives in the bottom picker strip — always visible,
// always clickable. Hover/focus shows a HoverCard preview (shortPitch +
// apps); click pushes user-echo + details + action-row into the chat.
// Big inline card grid — shown once at the start of the intro flow, in
// chat history (not in the bottom picker strip). After the user picks
// one, this whole bubble dims (frozenIdx passes the cards) and the
// bottom chip picker takes over for repeat selections.
function TemplateCardsGrid({
  disabled,
  onPick,
}: {
  disabled: boolean
  onPick: (t: AssistantTemplate) => void
}) {
  const customTemplate = getTemplate('custom')
  const templates = customTemplate
    ? [...QUICK_HIRE_TEMPLATES, customTemplate]
    : QUICK_HIRE_TEMPLATES
  return (
    <Box
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 10,
      }}
    >
      {templates.map(t => (
        <BigTemplateCard
          key={t.id}
          template={t}
          disabled={disabled}
          onClick={() => onPick(t)}
        />
      ))}
    </Box>
  )
}

function BigTemplateCard({
  template,
  disabled,
  onClick,
}: {
  template: AssistantTemplate
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="welcome-card"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
    >
      <Flex align="start" gap="3">
        <RadixAvatar
          size="3"
          radius="full"
          variant="soft"
          color="indigo"
          fallback={template.initials}
        />
        <Box minWidth="0" style={{ flex: 1 }}>
          <Text as="div" size="2" weight="medium">{template.defaultName}</Text>
          <Text as="div" size="1" color="gray" mt="1">{template.shortPitch}</Text>
        </Box>
      </Flex>
    </button>
  )
}

function TemplateChip({
  template,
  disabled,
  onClick,
}: {
  template: AssistantTemplate
  disabled: boolean
  onClick: () => void
}) {
  const apps = appsFromGrants(template.defaultGrants).slice(0, 5)
  return (
    <HoverCard.Root openDelay={250} closeDelay={0}>
      <HoverCard.Trigger>
        <button
          type="button"
          className="welcome-chip"
          onClick={disabled ? undefined : onClick}
          disabled={disabled}
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
        >
          <RadixAvatar
            size="2"
            radius="full"
            variant="soft"
            color="indigo"
            fallback={template.initials}
          />
          <Text as="span" size="2" weight="medium">{template.defaultName}</Text>
        </button>
      </HoverCard.Trigger>
      {/* pointerEvents: 'none' — moving the cursor onto the preview no
          longer keeps it open. Combined with closeDelay={0} the preview
          disappears the instant the cursor leaves the chip. */}
      <HoverCard.Content
        size="1"
        side="top"
        style={{ maxWidth: 320, pointerEvents: 'none' }}
      >
        <Flex direction="column" gap="2">
          <Text size="2" weight="medium">{template.defaultName}</Text>
          <Text size="2" color="gray">{template.shortPitch}</Text>
          {apps.length > 0 && (
            <Flex gap="1" wrap="wrap" mt="1">
              {apps.map(a => (
                <Badge key={a} size="1" color="gray" variant="soft" radius="full">{a}</Badge>
              ))}
            </Flex>
          )}
        </Flex>
      </HoverCard.Content>
    </HoverCard.Root>
  )
}

function TemplateDetailsBubble({ template }: { template: AssistantTemplate }) {
  const apps = appsFromGrants(template.defaultGrants)
  const sampleTasks = extractSampleTasks(template.defaultInstructions)

  return (
    <SystemBubble>
      <Text as="p" size="3" weight="medium" mb="0">
        About {template.defaultName}
      </Text>

      <Text as="p" size="2" color="gray" mt="2" mb="0">
        {template.longPitch}
      </Text>

      {apps.length > 0 && (
        <Box mt="3">
          <Caption>Apps they'll use</Caption>
          <Flex gap="2" wrap="wrap" mt="2">
            {apps.map(a => (
              <Badge key={a} color="gray" variant="soft" radius="full">{a}</Badge>
            ))}
          </Flex>
        </Box>
      )}

      {sampleTasks.length > 0 && (
        <Box mt="3">
          <Caption>What they'll do</Caption>
          <Box asChild mt="2">
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {sampleTasks.map((t, i) => (
                <li key={i}><Text size="2">{t}</Text></li>
              ))}
            </ul>
          </Box>
        </Box>
      )}

      {template.approvalCopy.length > 0 && (
        <Box mt="3">
          <Caption>They'll ask before</Caption>
          <Box asChild mt="2">
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {template.approvalCopy.map((c, i) => (
                <li key={i}><Text size="2">{c}</Text></li>
              ))}
            </ul>
          </Box>
        </Box>
      )}
    </SystemBubble>
  )
}

function SelectActionRow({
  template,
  disabled,
  onModify,
  onHire,
}: {
  template: AssistantTemplate
  disabled: boolean
  onModify: () => void
  onHire: () => void
}) {
  return (
    <Flex justify="end" gap="2" wrap="wrap">
      <Button variant="soft" color="gray" onClick={onModify} disabled={disabled} tabIndex={disabled ? -1 : undefined}>
        Modify
      </Button>
      <Button variant="solid" onClick={onHire} disabled={disabled} tabIndex={disabled ? -1 : undefined}>
        <IconCheck />
        Hire {template.defaultName}
      </Button>
    </Flex>
  )
}

function OpenChatActionRow({
  templateName,
  disabled,
  isLatest,
  onOpenChat,
  onAddAnother,
  secondaryAction,
}: {
  templateName: string
  disabled: boolean
  // Only the latest open-chat-row offers the secondary actions
  // (secondaryAction / Add another agent). Older rows — already
  // superseded by another hire — keep just their own Open chat link.
  isLatest: boolean
  onOpenChat: () => void
  onAddAnother: () => void
  secondaryAction: { label: string; onClick: () => void }
}) {
  return (
    <Flex justify="end" gap="2" wrap="wrap">
      {isLatest && (
        <>
          <Button variant="soft" color="gray" onClick={secondaryAction.onClick} disabled={disabled} tabIndex={disabled ? -1 : undefined}>
            {secondaryAction.label}
          </Button>
          <Button variant="soft" color="gray" onClick={onAddAnother} disabled={disabled} tabIndex={disabled ? -1 : undefined}>
            Add another agent
          </Button>
        </>
      )}
      <Button variant="solid" onClick={onOpenChat} disabled={disabled} tabIndex={disabled ? -1 : undefined}>
        Open chat with {templateName}
        <IconArrowRight />
      </Button>
    </Flex>
  )
}

function HiringBubble({ templateName }: { templateName: string }) {
  return (
    <SystemBubble>
      <Flex align="center" gap="3">
        <Spinner size="3" />
        <Box>
          <Text as="div" size="3" weight="medium">
            Hiring {templateName}…
          </Text>
          <Text as="div" size="1" color="gray" mt="1">
            Creating profile · setting up access · activating
          </Text>
        </Box>
      </Flex>
    </SystemBubble>
  )
}

function HiredBubble({ templateName }: { templateName: string }) {
  return (
    <SystemBubble>
      <Flex align="center" gap="3">
        <Box
          style={{
            width: 28,
            height: 28,
            flexShrink: 0,
            borderRadius: '50%',
            background: 'var(--green-a4)',
            color: 'var(--green-11)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <IconCheck className="ic" />
        </Box>
        <Box>
          <Text as="div" size="3" weight="medium">
            {templateName} is hired and ready.
          </Text>
          <Text as="div" size="1" color="gray" mt="1">
            Open the chat to begin — or add another agent.
          </Text>
        </Box>
      </Flex>
    </SystemBubble>
  )
}

// ─── Apps editor helpers ─────────────────────────────────────────────
// Smart defaults heuristic: any tool whose action half (after the dot)
// looks like a write verb gets mode=read_write + approval_required=true.
// Read-only tools (lookups, enrich, etc.) auto-approve. This matches
// Maria's mental model — "ask me before they DO things, don't ask
// before they LOOK at things".
const WRITE_ACTION_PATTERN = /(write|send|create|update|delete|refund|post|charge)/i

function isWriteAction(toolName: string): boolean {
  const dot = toolName.indexOf('.')
  const action = dot >= 0 ? toolName.slice(dot + 1) : toolName
  return WRITE_ACTION_PATTERN.test(action)
}

function defaultGrantsForApp(
  prefix: string,
  catalog: ToolDefinition[],
): TemplateGrant[] {
  return catalog
    .filter(t => appPrefix(t.name) === prefix)
    .map(t => {
      const writes = isWriteAction(t.name)
      return {
        tool_name: t.name,
        mode: (writes ? 'read_write' : 'read') as ToolGrantMode,
        approval_required: writes,
      }
    })
}

interface AppGroup {
  prefix: string
  label: string
  grants: TemplateGrant[]
}

function groupGrantsByApp(grants: TemplateGrant[]): AppGroup[] {
  const map = new Map<string, TemplateGrant[]>()
  for (const g of grants) {
    const p = appPrefix(g.tool_name)
    const list = map.get(p) ?? []
    list.push(g)
    map.set(p, list)
  }
  return Array.from(map.entries())
    .map(([prefix, gs]) => ({ prefix, label: appLabel(prefix), grants: gs }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

// Plain-language summary of what an app lets the agent do — shown in
// the chip's hover tooltip. e.g. "Send (asks first) · Read Contact".
function describeAppGrants(grants: TemplateGrant[]): string {
  return grants
    .map(g => {
      const full = toolLabel(g.tool_name)
      const sep = full.indexOf(' · ')
      const action = sep >= 0 ? full.slice(sep + 3) : full
      return g.approval_required ? `${action} (asks first)` : action
    })
    .join(' · ')
}

// Inline form bubble for "Modify" of a chosen template OR for a "Custom
// agent" pick. Lets the user tweak name + brief + apps without leaving
// the chat. On Hire we pass a synthesised template (base + overrides)
// up to the parent's standard hire chain.
function ModifyFormBubble({
  baseTemplate,
  disabled,
  onHire,
}: {
  baseTemplate: AssistantTemplate
  disabled: boolean
  onHire: (name: string, instructions: string, grants: TemplateGrant[]) => void
}) {
  const isCustom = baseTemplate.id === 'custom'
  const [name, setName] = useState(isCustom ? '' : baseTemplate.defaultName)
  const [instructions, setInstructions] = useState(
    isCustom ? '' : baseTemplate.defaultInstructions,
  )
  const [grants, setGrants] = useState<TemplateGrant[]>(
    isCustom ? [] : baseTemplate.defaultGrants,
  )
  const [catalog, setCatalog] = useState<ToolDefinition[]>([])

  // Pull the tool catalog so the "+ Add app" menu knows which apps exist.
  // One-shot fetch on mount; the catalog is small and rarely changes
  // during an onboarding session.
  useEffect(() => {
    let cancelled = false
    api.listTools()
      .then(items => { if (!cancelled) setCatalog(items) })
      .catch(() => { /* leave empty — Add menu just won't have options */ })
    return () => { cancelled = true }
  }, [])

  const trimmedName = name.trim()
  const trimmedInstructions = instructions.trim()
  const canHire = !disabled && trimmedName.length > 0 && trimmedInstructions.length > 0

  return (
    <SystemBubble>
      <Flex direction="column" gap="3">
        <Box>
          <Text as="div" size="3" weight="medium">
            {isCustom ? 'Build a custom agent' : `Customise ${baseTemplate.defaultName}`}
          </Text>
          <Text as="div" size="2" color="gray" mt="1">
            {isCustom
              ? "Give your agent a name, describe what they should do, and add the apps they'll use."
              : 'Tweak the name, brief, or apps — defaults are pre-filled.'}
          </Text>
        </Box>

        <TextInput
          label="Name"
          placeholder={isCustom ? 'e.g., Sarah' : baseTemplate.defaultName}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={disabled}
        />

        <TextAreaField
          label="Brief"
          placeholder={
            isCustom
              ? "What should they do? E.g., 'Watch the support inbox and draft replies for my approval.'"
              : 'What should they do?'
          }
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          disabled={disabled}
          rows={6}
        />

        <AppsEditor
          grants={grants}
          catalog={catalog}
          disabled={disabled}
          onChange={setGrants}
        />

        <Flex justify="end">
          <Button
            variant="solid"
            onClick={() => onHire(trimmedName, trimmedInstructions, grants)}
            disabled={!canHire}
            tabIndex={disabled ? -1 : undefined}
          >
            <IconCheck />
            {trimmedName ? `Hire ${trimmedName}` : 'Hire agent'}
          </Button>
        </Flex>
      </Flex>
    </SystemBubble>
  )
}

function AppsEditor({
  grants,
  catalog,
  disabled,
  onChange,
}: {
  grants: TemplateGrant[]
  catalog: ToolDefinition[]
  disabled: boolean
  onChange: (grants: TemplateGrant[]) => void
}) {
  const groups = useMemo(() => groupGrantsByApp(grants), [grants])

  const availableApps = useMemo(() => {
    const used = new Set(groups.map(g => g.prefix))
    const all = new Set<string>()
    catalog.forEach(t => all.add(appPrefix(t.name)))
    return Array.from(all)
      .filter(p => !used.has(p))
      .map(p => ({ prefix: p, label: appLabel(p) }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [catalog, groups])

  const removeApp = (prefix: string) => {
    onChange(grants.filter(g => appPrefix(g.tool_name) !== prefix))
  }

  const addApp = (prefix: string) => {
    onChange([...grants, ...defaultGrantsForApp(prefix, catalog)])
  }

  return (
    <Box>
      <Caption>Apps</Caption>
      <Flex gap="2" wrap="wrap" mt="2" align="center">
        {groups.map(group => (
          <AppChip
            key={group.prefix}
            group={group}
            disabled={disabled}
            onRemove={() => removeApp(group.prefix)}
          />
        ))}
        {/* Always render the Add menu so the affordance is visible from
            the start (especially relevant for Custom agent — picker is
            empty otherwise). Disabled while the catalog is still loading
            or once every app is already added. */}
        <AddAppMenu
          apps={availableApps}
          disabled={disabled || availableApps.length === 0}
          onAdd={addApp}
        />
      </Flex>
    </Box>
  )
}

function AppChip({
  group,
  disabled,
  onRemove,
}: {
  group: AppGroup
  disabled: boolean
  onRemove: () => void
}) {
  return (
    <Tooltip content={describeAppGrants(group.grants)}>
      <span className="welcome-app-chip" tabIndex={0} aria-label={group.label}>
        <Text as="span" size="2">{group.label}</Text>
        <span
          className="welcome-app-chip__remove"
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label={`Remove ${group.label}`}
          onClick={(e) => {
            e.stopPropagation()
            if (!disabled) onRemove()
          }}
          onKeyDown={(e) => {
            if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              onRemove()
            }
          }}
        >
          <IconX className="ic ic--sm" />
        </span>
      </span>
    </Tooltip>
  )
}

function AddAppMenu({
  apps,
  disabled,
  onAdd,
}: {
  apps: { prefix: string; label: string }[]
  disabled: boolean
  onAdd: (prefix: string) => void
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <Button
          type="button"
          variant="soft"
          color="gray"
          size="1"
          disabled={disabled}
          radius="full"
        >
          <IconPlus className="ic ic--sm" />
          Add app
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content size="1">
        {apps.map(app => (
          <DropdownMenu.Item
            key={app.prefix}
            onSelect={() => onAdd(app.prefix)}
          >
            {app.label}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  )
}

// ─── Shared bubbles ──────────────────────────────────────────────────

// Asymmetric corners give bubbles a subtle "tail" on the speaker side —
// system left-bottom corner is sharper, user right-bottom corner is
// sharper. Matches iMessage / Telegram / Slack convention.
const SYSTEM_BUBBLE_RADIUS = '12px 12px 12px 4px'
const USER_BUBBLE_RADIUS = '12px 12px 4px 12px'

// Default "system" speaker — flat indigo circle with "i" initial. NOT a
// robot or sparkle icon (UX-spec § 9-10).
function SystemAvatar() {
  return (
    <RadixAvatar
      size="2"
      radius="full"
      variant="soft"
      color="indigo"
      fallback="i"
    />
  )
}

function UserAvatarFromAuth() {
  const { user } = useAuth()
  const initials = user ? user.name.slice(0, 2).toUpperCase() : '·'
  return (
    <RadixAvatar
      size="2"
      radius="full"
      variant="soft"
      color="gray"
      fallback={initials}
    />
  )
}

function SystemBubble({
  children,
  avatar,
}: {
  children: ReactNode
  avatar?: ReactNode
}) {
  return (
    <Flex justify="start" gap="2" align="start">
      {avatar ?? <SystemAvatar />}
      <Box
        style={{
          maxWidth: '78%',
          padding: '12px 16px',
          borderRadius: SYSTEM_BUBBLE_RADIUS,
          background: 'var(--gray-3)',
        }}
      >
        {children}
      </Box>
    </Flex>
  )
}

function UserBubble({ children }: { children: ReactNode }) {
  return (
    <Flex justify="end" gap="2" align="start">
      <Box
        style={{
          maxWidth: '78%',
          padding: '10px 14px',
          borderRadius: USER_BUBBLE_RADIUS,
          background: 'var(--accent-a3)',
        }}
      >
        <Text as="div" size="2">{children}</Text>
      </Box>
      <UserAvatarFromAuth />
    </Flex>
  )
}

function TutorialLine({ disabled }: { disabled: boolean }) {
  return (
    <Flex justify="start">
      <Box
        style={{
          maxWidth: '78%',
          padding: '10px 14px',
          borderRadius: 12,
          border: '1px dashed var(--gray-a5)',
        }}
      >
        <Text size="2" color="gray">
          Want a tour first?{' '}
          {disabled ? (
            <span>Take the tutorial →</span>
          ) : (
            <Link to="/learn">Take the tutorial →</Link>
          )}
        </Text>
      </Box>
    </Flex>
  )
}
