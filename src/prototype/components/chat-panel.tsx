import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Box, Button, Code, Flex, Text } from '@radix-ui/themes'

import { CommandBar, Caption } from './common'
import { statusLabel } from './common/status-label'
import { TextAreaField } from './fields'
import { Banner, LoadingList, NoAccessState } from './states'
import { IconAlert, IconChat, IconCheck, IconPlay, IconStop, IconX } from './icons'
import { RejectInlineForm } from './reject-inline-form'
import { useAuth } from '../auth'
import { api } from '../lib/api'
import { canDecideApproval } from '../lib/permissions'
import { useUser } from '../lib/user-lookup'
import type { Agent, AgentVersion, ApprovalRequest, Chat, ChatMessage, ChatStreamFrame, ChatToolCall } from '../lib/types'
import { absTime, ago, money, num, prettifyRequestedAction, toolLabel } from '../lib/format'

// Minimum characters required in the reject-reason textarea before Confirm
// becomes enabled. Matches the pattern used in ApprovalsScreen / ApprovalCard.
const REJECT_MIN_CHARS = 5

interface StreamingState {
  messageId: string
  content: string
  toolCalls: { id: string; tool: string; args: Record<string, unknown>; resultStatus?: 'ok' | 'error'; output?: Record<string, unknown> | null }[]
  cost?: number
  tokensIn?: number
  tokensOut?: number
}

/**
 * Self-contained chat experience: state, streaming, send, close, messages,
 * composer. Three modes:
 *
 * `mode='full'` — full-screen wrapper. Prints a CommandBar at the top with
 * full chat metadata. Owns its fetch (loads chat + messages by `chatId`).
 *
 * `mode='embed'` — embedded inside an agent tab. Skips the CommandBar (the
 * parent already shows agent context); shows a thin metadata badge instead.
 * Owns its fetch.
 *
 * `mode='draft'` — chat does not exist yet. Caller passes `agent` and
 * `agentVersion`; on first send the panel does `createChat → sendMessage`
 * back-to-back, then calls `onCreated(chatId)` so the parent can navigate
 * to the now-existing chat URL. No fetching, no closed/failed banners.
 */
type ChatPanelProps =
  | {
      mode: 'full' | 'embed'
      chatId: string
      emptyHint?: string
    }
  | {
      mode: 'draft'
      agent: Agent
      agentVersion: AgentVersion
      onCreated: (chatId: string) => void
      emptyHint?: string
    }

export function ChatPanel(props: ChatPanelProps) {
  const { user } = useAuth()
  const { mode, emptyHint } = props

  // For existing chats: undefined = loading, null = not found, Chat = loaded.
  // For draft: starts null (no chat yet), becomes a Chat after first send.
  const [chat, setChat] = useState<Chat | null | undefined>(
    mode === 'draft' ? null : undefined,
  )
  const [agent, setAgent] = useState<Agent | null>(
    mode === 'draft' ? props.agent : null,
  )
  const [messages, setMessages] = useState<ChatMessage[] | null>(
    mode === 'draft' ? [] : null,
  )
  const [draft, setDraft] = useState('')
  const [streaming, setStreaming] = useState<StreamingState | null>(null)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [closing, setClosing] = useState(false)
  // Chat-side approval state (gateway 0.2.0 / ADR-0011). `chatApprovals`
  // is all approvals tied to this chat (any status) — the pending one
  // gates the chat, resolved ones stay in the timeline as historical
  // cards showing "Approved/Rejected by X". Reject reason state is
  // single-instance (only one pending approval per chat at a time).
  const [chatApprovals, setChatApprovals] = useState<ApprovalRequest[]>([])
  const [rejectExpanded, setRejectExpanded] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectTouched, setRejectTouched] = useState(false)
  const [deciding, setDeciding] = useState(false)
  const [decisionError, setDecisionError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  // Fetch only runs for existing chats. Draft mode skips it entirely.
  const fetchChatId = mode === 'draft' ? null : props.chatId
  useEffect(() => {
    if (!fetchChatId) return
    let cancelled = false
    api.getChat(fetchChatId).then(c => {
      if (cancelled) return
      setChat(c ?? null)
      if (c) {
        api.listAgents().then(res => {
          if (cancelled) return
          setAgent(res.items.find(a => a.id === c.agent_id) ?? null)
        })
        api.listChatMessages(fetchChatId, { limit: 200 }).then(list => {
          if (cancelled) return
          setMessages([...list.items].reverse())
        })
      }
    })
    return () => { cancelled = true }
  }, [fetchChatId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, streaming])

  // Fetch all approvals for this chat (any status). Pending ones gate the
  // chat (status === 'awaiting_approval'); resolved ones stay in the
  // timeline as historical SuspendedCards showing the decision outcome.
  // Spec has no chat_id filter on /approvals so we fetch the tenant-wide
  // list and match client-side — same shape as future real-backend wiring.
  // Refetches when chat.status flips (new approval may have been created
  // or a pending one resolved).
  const chatStatus = mode === 'draft' ? null : chat?.status
  const currentChatId = mode === 'draft' ? null : chat?.id
  useEffect(() => {
    let cancelled = false
    if (!currentChatId) {
      queueMicrotask(() => {
        if (cancelled) return
        setChatApprovals([])
        setRejectExpanded(false)
        setRejectReason('')
        setRejectTouched(false)
      })
      return () => { cancelled = true }
    }
    api.listApprovals({ limit: 500 }).then(res => {
      if (cancelled) return
      const mine = res.items
        .filter(a => a.chat_id === currentChatId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
      setChatApprovals(mine)
    })
    return () => { cancelled = true }
  }, [chatStatus, currentChatId])

  // Loading / not-found gates only matter for existing chats.
  if (mode !== 'draft') {
    if (chat === null) {
      return <NoAccessState requiredRole="access to this chat" body="This chat could not be loaded. It may have been closed long ago or you may not have access." />
    }
    if (chat === undefined || messages === null) {
      return <LoadingList rows={4} />
    }
  }

  // After the guards above, in non-draft mode `chat` and `messages` are
  // guaranteed non-null. In draft mode `chat` is null until the first send
  // creates one; downstream consumers must guard accordingly.

  const isOwner = chat ? chat.created_by === user?.id : true
  const isAdmin = user?.role === 'admin' || user?.role === 'domain_admin'
  const canSend = mode === 'draft'
    ? !!user && !busy
    : !!chat && chat.status === 'active' && (isOwner || isAdmin)
  const canClose = mode !== 'draft' && !!chat && chat.status === 'active' && (isOwner || isAdmin)

  const send = async () => {
    const content = draft.trim()
    if (!content || busy || !canSend) return
    setBusy(true)
    setStreamError(null)
    setDraft('')

    let activeChat: Chat

    if (props.mode === 'draft') {
      // Optimistic user message — shown while createChat is in flight so
      // the user doesn't stare at an empty pane.
      const optimisticUser: ChatMessage = {
        id: `tmp_${Date.now()}`,
        chat_id: 'pending',
        role: 'user',
        content,
        tool_calls: null,
        tool_call_id: null,
        tool_name: null,
        cost_usd: null,
        tokens_in: null,
        tokens_out: null,
        created_at: new Date().toISOString(),
      }
      setMessages([optimisticUser])

      try {
        activeChat = await api.createChat(
          {
            agent_version_id: props.agentVersion.id,
            title: content.slice(0, 60).trim() || undefined,
          },
          user!,
        )
        setChat(activeChat)
      } catch (e) {
        setStreamError((e as Error).message ?? 'Could not start chat')
        setBusy(false)
        return
      }
    } else {
      // chat is guaranteed by the guards above + canSend gate.
      activeChat = chat!
      const optimisticUser: ChatMessage = {
        id: `tmp_${Date.now()}`,
        chat_id: activeChat.id,
        role: 'user',
        content,
        tool_calls: null,
        tool_call_id: null,
        tool_name: null,
        cost_usd: null,
        tokens_in: null,
        tokens_out: null,
        created_at: new Date().toISOString(),
      }
      setMessages(prev => (prev ? [...prev, optimisticUser] : [optimisticUser]))
    }

    try {
      const stream = api.sendChatMessage(activeChat.id, { content })
      for await (const frame of stream) {
        applyFrame(frame, setStreaming, setStreamError)
        if (frame.event === 'error') break
        if (frame.event === 'done') break
      }
    } catch (e) {
      setStreamError((e as Error).message ?? 'Stream interrupted')
    } finally {
      const fresh = await api.listChatMessages(activeChat.id, { limit: 200 })
      setMessages([...fresh.items].reverse())
      const updatedChat = await api.getChat(activeChat.id)
      if (updatedChat) setChat(updatedChat)
      setStreaming(null)
      setBusy(false)

      if (props.mode === 'draft') {
        // Hand off to the parent — typically a navigate(replace) onto the
        // real chat URL, which remounts this component in embed mode.
        props.onCreated(activeChat.id)
      }
    }
  }

  const close = async () => {
    if (mode === 'draft' || !canClose || closing) return
    if (!chat) return
    setClosing(true)
    try {
      await api.closeChat(chat.id)
      const fresh = await api.getChat(chat.id)
      if (fresh) setChat(fresh)
    } finally {
      setClosing(false)
    }
  }

  // Approve or reject the pending chat-source approval. Per spec, after
  // decideApproval the client polls `GET /chat/{id}/messages` until the
  // resumed turn lands. Here we poll `getChat` (cheaper) every ~300ms
  // until status flips back to 'active' (mock takes 1.5-3s), then refetch
  // messages + approvals once. 4.5s safety cap.
  const decideOnApproval = async (decision: 'approved' | 'rejected', reason: string | null) => {
    const pending = chatApprovals.find(a => a.status === 'pending')
    if (!pending || !user || !chat || deciding) return
    setDeciding(true)
    setDecisionError(null)
    try {
      await api.decideApproval(pending.id, decision, reason, user.id)
      // Poll until orchestrator-side resume completes.
      const targetChatId = chat.id
      const maxAttempts = 15  // 15 × 300ms = 4.5s upper bound
      let resumed = false
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(r => setTimeout(r, 300))
        const fresh = await api.getChat(targetChatId)
        if (fresh && fresh.status === 'active') {
          setChat(fresh)
          const [msgs, approvals] = await Promise.all([
            api.listChatMessages(targetChatId, { limit: 200 }),
            api.listApprovals({ limit: 500 }),
          ])
          setMessages([...msgs.items].reverse())
          setChatApprovals(
            approvals.items
              .filter(a => a.chat_id === targetChatId)
              .sort((a, b) => a.created_at.localeCompare(b.created_at)),
          )
          resumed = true
          break
        }
      }
      if (!resumed) {
        // Safety net: orchestrator-side resume didn't land within 4.5s
        // (mock should always be faster; real backend usually too). Pull
        // latest state anyway + show a non-fatal hint so the user knows
        // the decision IS recorded — just hasn't reached the chat yet.
        const [fresh, msgs, approvals] = await Promise.all([
          api.getChat(targetChatId),
          api.listChatMessages(targetChatId, { limit: 200 }),
          api.listApprovals({ limit: 500 }),
        ])
        if (fresh) setChat(fresh)
        setMessages([...msgs.items].reverse())
        setChatApprovals(
          approvals.items
            .filter(a => a.chat_id === targetChatId)
            .sort((a, b) => a.created_at.localeCompare(b.created_at)),
        )
        setDecisionError('Decision recorded — the agent is taking longer than usual to resume. Reload if the chat doesn\'t catch up.')
      }
    } catch (e) {
      setDecisionError((e as Error).message ?? 'Could not record decision')
    } finally {
      setDeciding(false)
      setRejectExpanded(false)
      setRejectReason('')
      setRejectTouched(false)
    }
  }

  return (
    <>
      <div className="chat-detail__head">
        {mode === 'full' && chat && (
          <CommandBar
            parts={[
              { label: 'AGENT', value: agent?.name ?? '—' },
              { label: 'MODEL', value: chat.model, tone: 'accent' },
              { label: 'STATUS', value: statusLabel(chat.status), tone: chat.status === 'active' ? 'accent' : chat.status === 'failed' ? 'warn' : undefined },
              { label: 'STARTED', value: ago(chat.started_at) },
              { label: 'COST', value: money(chat.total_cost_usd, { cents: chat.total_cost_usd < 100 }) },
              { label: 'TOKENS', value: `${num(chat.total_tokens_in)} in · ${num(chat.total_tokens_out)} out` },
              ...(chat.ended_at ? [{ label: 'CLOSED', value: absTime(chat.ended_at), tone: 'muted' as const }] : []),
            ]}
          />
        )}

        {mode === 'embed' && chat && (
          <Flex align="center" justify="between" gap="2" wrap="wrap" mb="3">
            <Flex align="center" gap="2" wrap="wrap">
              <Badge color="gray" variant="soft" radius="full" size="1" style={{ fontFamily: 'var(--font-mono)' }}>
                {chat.model}
              </Badge>
              <Text size="1" color="gray">started {ago(chat.started_at)}</Text>
              <Text size="1" color="gray">·</Text>
              <Text size="1" color="gray">{money(chat.total_cost_usd, { cents: chat.total_cost_usd < 100 })}</Text>
            </Flex>
            {canClose && (
              <Button color="red" variant="soft" size="1" onClick={close} disabled={closing}>
                <IconStop /> {closing ? 'closing…' : 'Close chat'}
              </Button>
            )}
          </Flex>
        )}

        {/* draft mode renders no head content — composer is the focus */}

        {chat?.status === 'closed' && (
          <Box mt={mode === 'embed' ? '2' : '4'}>
            <Banner
              tone="info"
              title="This chat is closed"
              action={agent ? (
                <Button asChild size="1">
                  <a href={`#/agents/${agent.id}/talk`}><IconChat />Start a new chat</a>
                </Button>
              ) : undefined}
            >
              Messages are read-only. Open a new chat to keep talking with this agent.
            </Banner>
          </Box>
        )}

        {chat?.status === 'failed' && (
          <Box mt={mode === 'embed' ? '2' : '4'}>
            <Banner tone="danger" title="This chat ended in a failed state">
              Something went wrong on the agent's side. Open the activity log to see what happened on the last turn.
            </Banner>
          </Box>
        )}
      </div>

      <div className="chat-detail__body">
        <div className="chat-detail__messages">
          {(messages?.length ?? 0) === 0 && !streaming && (
            <Text as="div" size="2" color="gray" align="center" style={{ padding: '40px 0' }}>
              {emptyHint ?? `No messages yet — say something to ${agent?.name ?? 'the agent'}.`}
            </Text>
          )}
          {buildTimeline(messages, chatApprovals).map(item => (
            item.kind === 'message' ? (
              <MessageBubble
                key={`msg-${item.data.id}`}
                message={item.data}
                modelLabel={item.data.role === 'assistant' ? (chat?.model ?? null) : null}
              />
            ) : (
              <SuspendedCard
                key={`apv-${item.data.id}`}
                approval={item.data}
                agentName={agent?.name ?? 'The agent'}
                currentUserId={user?.id ?? null}
                canDecide={canDecideApproval(user, item.data)}
                deciding={deciding && item.data.status === 'pending'}
                rejectExpanded={rejectExpanded && item.data.status === 'pending'}
                rejectReason={rejectReason}
                rejectTouched={rejectTouched}
                decisionError={item.data.status === 'pending' ? decisionError : null}
                onApprove={() => decideOnApproval('approved', null)}
                onRejectStart={() => setRejectExpanded(true)}
                onRejectReason={v => setRejectReason(v)}
                onRejectBlur={() => setRejectTouched(true)}
                onRejectCancel={() => {
                  setRejectExpanded(false)
                  setRejectReason('')
                  setRejectTouched(false)
                }}
                onRejectConfirm={() => decideOnApproval('rejected', rejectReason.trim())}
              />
            )
          ))}
          {streaming && (
            <StreamingBubble streaming={streaming} modelLabel={chat?.model ?? ''} />
          )}
          {streamError && (
            <Banner tone="danger" title="Stream error">
              {streamError}
            </Banner>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {canSend ? (
        <div className="chat-detail__composer">
          <Composer
            value={draft}
            onChange={setDraft}
            onSend={send}
            busy={busy}
          />
        </div>
      ) : mode !== 'draft' && chat?.status === 'awaiting_approval' ? (
        <div className="chat-detail__composer chat-detail__composer--readonly">
          <Text as="div" size="1" color="gray">
            {chatApprovals.some(a => a.status === 'pending' && canDecideApproval(user, a))
              ? 'Chat is paused — waiting for your decision on the action above.'
              : 'Chat is paused — an admin needs to approve the action above.'}
          </Text>
        </div>
      ) : mode !== 'draft' && chat?.status === 'active' ? (
        <div className="chat-detail__composer chat-detail__composer--readonly">
          <Text as="div" size="1" color="gray">
            Read-only — only the chat owner ({chat.created_by === user?.id ? 'you' : 'someone else'}) and admins can send messages.
          </Text>
        </div>
      ) : null}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────
// Frame application
// ─────────────────────────────────────────────────────────────────

function applyFrame(
  frame: ChatStreamFrame,
  setStreaming: React.Dispatch<React.SetStateAction<StreamingState | null>>,
  setError: (msg: string) => void,
) {
  if (frame.event === 'turn_start') {
    setStreaming({ messageId: frame.message_id, content: '', toolCalls: [] })
    return
  }
  if (frame.event === 'text_delta') {
    setStreaming(prev => prev ? { ...prev, content: prev.content + frame.delta } : prev)
    return
  }
  if (frame.event === 'tool_call') {
    setStreaming(prev =>
      prev
        ? {
            ...prev,
            toolCalls: [...prev.toolCalls, { id: frame.tool_call_id, tool: frame.tool, args: frame.args }],
          }
        : prev,
    )
    return
  }
  if (frame.event === 'tool_result') {
    setStreaming(prev =>
      prev
        ? {
            ...prev,
            toolCalls: prev.toolCalls.map(tc =>
              tc.id === frame.tool_call_id
                ? { ...tc, resultStatus: frame.status, output: frame.output_ref }
                : tc,
            ),
          }
        : prev,
    )
    return
  }
  if (frame.event === 'turn_end') {
    setStreaming(prev =>
      prev
        ? { ...prev, cost: frame.cost_usd, tokensIn: frame.tokens_in, tokensOut: frame.tokens_out }
        : prev,
    )
    return
  }
  if (frame.event === 'suspended') {
    // gateway 0.2.0 / ADR-0011: a tool inside the turn hit an approval gate.
    // The chat is now in `awaiting_approval` status; `POST /chat/{id}/message`
    // returns 409 until the approval is decided and the resumed turn replays
    // via `GET /chat/{id}/messages?after=<last_seen>`. Tier 3 will turn this
    // into a proper inline-card UX; for now keep it on the existing error
    // surface so the user at least knows what happened.
    setError('This action needs approval. Approve it from the Approvals queue — the conversation will resume after.')
    return
  }
  if (frame.event === 'error') {
    setError(frame.message)
  }
}

// ─────────────────────────────────────────────────────────────────
// Bubbles
// ─────────────────────────────────────────────────────────────────

function MessageBubble({ message, modelLabel }: { message: ChatMessage; modelLabel: string | null }) {
  if (message.role === 'tool') {
    return <ToolResultCard message={message} />
  }
  const isUser = message.role === 'user'
  return (
    <Flex justify={isUser ? 'end' : 'start'} gap="2">
      <Box
        style={{
          maxWidth: '78%',
          padding: '10px 14px',
          borderRadius: 12,
          background: isUser ? 'var(--accent-a3)' : 'var(--gray-3)',
        }}
      >
        {!isUser && modelLabel && (
          <Flex align="center" gap="2" mb="2">
            <Badge color="gray" variant="soft" radius="full" size="1" style={{ fontFamily: 'var(--font-mono)' }}>
              {modelLabel}
            </Badge>
            <Text size="1" color="gray">{ago(message.created_at)}</Text>
          </Flex>
        )}
        {message.content && (
          <Text as="div" size="2" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
            {message.content}
          </Text>
        )}
        {message.tool_calls && message.tool_calls.length > 0 && (
          <Box mt="2">
            {message.tool_calls.map(tc => (
              <ToolCallChip key={tc.id} tc={tc} />
            ))}
          </Box>
        )}
        {!isUser && (message.cost_usd != null || message.tokens_in != null) && (
          <Flex gap="3" mt="3" wrap="wrap">
            {message.tokens_in != null && (
              <Text size="1" color="gray">{num(message.tokens_in)}/{num(message.tokens_out ?? 0)} tokens</Text>
            )}
            {message.cost_usd != null && (
              <Text size="1" color="gray">{money(message.cost_usd, { cents: true })}</Text>
            )}
          </Flex>
        )}
        {isUser && (
          <Text as="div" size="1" color="gray" mt="2" style={{ textAlign: 'right' }}>
            {ago(message.created_at)}
          </Text>
        )}
      </Box>
    </Flex>
  )
}

function StreamingBubble({ streaming, modelLabel }: { streaming: StreamingState; modelLabel: string }) {
  return (
    <Flex justify="start" gap="2">
      <Box
        style={{
          maxWidth: '78%',
          padding: '10px 14px',
          borderRadius: 12,
          background: 'var(--gray-3)',
        }}
      >
        <Flex align="center" gap="2" mb="2">
          <Badge color="cyan" variant="soft" radius="full" size="1" style={{ fontFamily: 'var(--font-mono)' }} className="status-pulse">
            {modelLabel}
          </Badge>
          <Text size="1" color="cyan">streaming…</Text>
        </Flex>
        {streaming.content && (
          <Text as="div" size="2" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
            {streaming.content}
            <span style={{ display: 'inline-block', width: 8, height: 14, background: 'var(--accent-9)', marginLeft: 2, verticalAlign: 'middle', animation: 'caret-blink 1.1s steps(2) infinite' }} />
          </Text>
        )}
        {streaming.toolCalls.length > 0 && (
          <Box mt="2">
            {streaming.toolCalls.map(tc => (
              <ToolCallInflight key={tc.id} tc={tc} />
            ))}
          </Box>
        )}
        {streaming.cost != null && (
          <Flex gap="3" mt="3" wrap="wrap">
            <Text size="1" color="gray">{num(streaming.tokensIn ?? 0)}/{num(streaming.tokensOut ?? 0)} tokens</Text>
            <Text size="1" color="gray">{money(streaming.cost, { cents: true })}</Text>
          </Flex>
        )}
      </Box>
    </Flex>
  )
}

function ToolCallChip({ tc }: { tc: ChatToolCall }) {
  const argsPreview = JSON.stringify(tc.args)
  return (
    <div
      style={{
        padding: '8px 10px',
        background: 'var(--gray-a2)',
        borderRadius: 8,
        marginTop: 6,
      }}
    >
      <Flex align="center" gap="2" mb="1">
        <IconPlay className="ic ic--sm" style={{ color: 'var(--accent-9)' }} />
        <Caption>tool call</Caption>
        <Code variant="ghost" size="1">{toolLabel(tc.name)}</Code>
      </Flex>
      <Text as="div" size="1" color="gray" className="truncate" style={{ fontFamily: 'var(--font-mono)' }}>
        {argsPreview.length > 120 ? argsPreview.slice(0, 117) + '…' : argsPreview}
      </Text>
    </div>
  )
}

function ToolCallInflight({ tc }: { tc: { id: string; tool: string; args: Record<string, unknown>; resultStatus?: 'ok' | 'error'; output?: Record<string, unknown> | null } }) {
  const status = tc.resultStatus
  const color = status === 'ok' ? 'var(--jade-11)' : status === 'error' ? 'var(--red-11)' : 'var(--accent-9)'
  const bg = status === 'error'
    ? 'var(--red-a3)'
    : status === 'ok'
      ? 'var(--jade-a3)'
      : 'var(--accent-a3)'
  return (
    <div
      style={{
        padding: '8px 10px',
        background: bg,
        borderRadius: 8,
        marginTop: 6,
      }}
    >
      <Flex align="center" gap="2" mb="1">
        {status === 'ok' ? <IconCheck className="ic ic--sm" style={{ color }} />
          : status === 'error' ? <IconX className="ic ic--sm" style={{ color }} />
          : <IconPlay className="ic ic--sm" style={{ color }} />}
        <Caption>tool call</Caption>
        <Code variant="ghost" size="1">{toolLabel(tc.tool)}</Code>
        {!status && <Text size="1" color="cyan" className="status-pulse">running…</Text>}
      </Flex>
      <Text as="div" size="1" color="gray" style={{ fontFamily: 'var(--font-mono)' }}>
        {JSON.stringify(tc.args).slice(0, 140)}
      </Text>
      {tc.output && (
        <Text as="div" size="1" color="gray" mt="1" style={{ fontFamily: 'var(--font-mono)' }}>
          → {JSON.stringify(tc.output).slice(0, 140)}
        </Text>
      )}
    </div>
  )
}

function ToolResultCard({ message }: { message: ChatMessage }) {
  return (
    <Flex justify="start" gap="2">
      <Box
        style={{
          maxWidth: '78%',
          padding: '8px 12px',
          borderRadius: 8,
          background: 'var(--gray-a2)',
        }}
      >
        <Flex align="center" gap="2" mb="1">
          <IconCheck className="ic ic--sm" style={{ color: 'var(--jade-11)' }} />
          <Caption>tool result</Caption>
          {message.tool_name && <Code variant="ghost" size="1">{toolLabel(message.tool_name)}</Code>}
          <Text size="1" color="gray">{ago(message.created_at)}</Text>
        </Flex>
        <Code asChild size="1" variant="soft">
          <pre style={{ padding: 8, margin: 0, whiteSpace: 'pre-wrap', maxHeight: 180, overflow: 'auto', lineHeight: 1.45 }}>
            {prettyJson(message.content)}
          </pre>
        </Code>
      </Box>
    </Flex>
  )
}

function prettyJson(raw: string | null): string {
  if (!raw) return ''
  try { return JSON.stringify(JSON.parse(raw), null, 2) }
  catch { return raw }
}

// ─────────────────────────────────────────────────────────────────
// Composer
// ─────────────────────────────────────────────────────────────────

function Composer({
  value, onChange, onSend, busy,
}: {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  busy: boolean
}) {
  const trimmed = useMemo(() => value.trim(), [value])
  const canSend = trimmed.length > 0 && !busy

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      if (canSend) onSend()
    }
  }

  return (
    <div
      style={{
        padding: 12,
        background: 'var(--gray-3)',
        borderRadius: 12,
      }}
    >
      <TextAreaField
        autoFocus
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKey}
        placeholder="Type a message — ⌘+Enter (Ctrl+Enter) to send"
        style={{ minHeight: 90 }}
      />
      <Flex align="center" justify="between" gap="2" mt="2">
        <Text size="1" color="gray">
          Replies stream in token-by-token.
        </Text>
        <Button onClick={onSend} disabled={!canSend}>
          <IconPlay /> {busy ? 'streaming…' : 'Send'}
        </Button>
      </Flex>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// SuspendedCard — approval gate rendered inline in the chat timeline.
// Positioned by approval.created_at relative to chat messages. Three
// visual states:
//   - pending: Approve / Reject buttons (Reject expands the inline
//     reason form). Orange border, "Waiting for your approval".
//   - approved: jade border, "Approved by {who} · {ago}".
//   - rejected: red border, "Rejected by {who} · {ago}" + reason.
// ─────────────────────────────────────────────────────────────────

interface TimelineItem {
  kind: 'message' | 'approval'
  data: ChatMessage | ApprovalRequest
  sortKey: string
}

// Build the interleaved chat timeline — messages + approvals sorted by
// created_at. Stable when timestamps tie (insertion order preserved).
function buildTimeline(
  messages: ChatMessage[] | null,
  approvals: ApprovalRequest[],
): ({ kind: 'message'; data: ChatMessage } | { kind: 'approval'; data: ApprovalRequest })[] {
  const items: TimelineItem[] = []
  messages?.forEach(m => items.push({ kind: 'message', data: m, sortKey: m.created_at }))
  approvals.forEach(a => items.push({ kind: 'approval', data: a, sortKey: a.created_at }))
  items.sort((x, y) => x.sortKey.localeCompare(y.sortKey))
  return items.map(it =>
    it.kind === 'message'
      ? { kind: 'message' as const, data: it.data as ChatMessage }
      : { kind: 'approval' as const, data: it.data as ApprovalRequest },
  )
}

function SuspendedCard({
  approval,
  agentName,
  currentUserId,
  canDecide,
  deciding,
  rejectExpanded,
  rejectReason,
  rejectTouched,
  decisionError,
  onApprove,
  onRejectStart,
  onRejectReason,
  onRejectBlur,
  onRejectCancel,
  onRejectConfirm,
}: {
  approval: ApprovalRequest
  agentName: string
  currentUserId: string | null
  /** False when the current user's role can't decide this approval — gateway
      would 403 on submit. Hide Approve / Reject buttons and show a small
      "waiting for an admin" hint instead. */
  canDecide: boolean
  deciding: boolean
  rejectExpanded: boolean
  rejectReason: string
  rejectTouched: boolean
  decisionError: string | null
  onApprove: () => void
  onRejectStart: () => void
  onRejectReason: (v: string) => void
  onRejectBlur: () => void
  onRejectCancel: () => void
  onRejectConfirm: () => void
}) {
  const actionVerb = prettifyRequestedAction(approval.requested_action)
  const approverName = useUser(approval.approver_user_id)?.name
  const isPending = approval.status === 'pending'
  const isApproved = approval.status === 'approved'
  const isRejected = approval.status === 'rejected'

  const borderColor = isApproved
    ? 'var(--jade-a6)'
    : isRejected
      ? 'var(--red-a6)'
      : rejectExpanded
        ? 'var(--red-a6)'
        : 'var(--orange-a6)'

  const headerLabel = isApproved
    ? `Approved${approverName ? ` by ${approval.approver_user_id === currentUserId ? 'you' : approverName}` : ''}${approval.resolved_at ? ` · ${ago(approval.resolved_at)}` : ''}`
    : isRejected
      ? `Rejected${approverName ? ` by ${approval.approver_user_id === currentUserId ? 'you' : approverName}` : ''}${approval.resolved_at ? ` · ${ago(approval.resolved_at)}` : ''}`
      : 'Waiting for your approval'

  const headerColor = isApproved
    ? 'var(--jade-11)'
    : isRejected
      ? 'var(--red-11)'
      : 'var(--orange-11)'

  return (
    <div
      className="card"
      style={{
        padding: 16,
        gap: 12,
        display: 'flex',
        flexDirection: 'column',
        borderColor,
      }}
    >
      <Flex align="center" gap="2">
        <Box style={{ color: headerColor, display: 'flex' }}>
          {isApproved
            ? <IconCheck className="ic ic--sm" />
            : isRejected
              ? <IconX className="ic ic--sm" />
              : <IconAlert className="ic ic--sm" />}
        </Box>
        <Text as="span" size="2" weight="medium">{headerLabel}</Text>
      </Flex>
      <Box>
        <Caption mb="1">{agentName} {isPending ? 'wants to' : 'wanted to'}</Caption>
        <Text as="div" size="2" weight="medium" style={{ lineHeight: 1.45 }}>
          {actionVerb}
        </Text>
      </Box>

      {isRejected && approval.reason && (
        <Box>
          <Caption mb="1">Reason</Caption>
          <Text as="div" size="2" color="gray">{approval.reason}</Text>
        </Box>
      )}

      {isPending && (
        deciding ? (
          <Text as="div" size="1" color="gray">
            Recording your decision — the agent will continue in a moment.
          </Text>
        ) : !canDecide ? (
          <Text as="div" size="1" color="gray">
            An admin needs to decide before {agentName} can continue.
          </Text>
        ) : rejectExpanded ? (
          <RejectInlineForm
            reason={rejectReason}
            touched={rejectTouched}
            minChars={REJECT_MIN_CHARS}
            onChangeReason={onRejectReason}
            onBlurReason={onRejectBlur}
            onCancel={onRejectCancel}
            onConfirm={onRejectConfirm}
          />
        ) : (
          <Flex gap="2" wrap="wrap">
            <Button color="jade" onClick={onApprove} disabled={deciding} style={{ flex: '1 1 140px' }}>
              <IconCheck /> Approve
            </Button>
            <Button color="red" variant="soft" onClick={onRejectStart} disabled={deciding} style={{ flex: '1 1 140px' }}>
              <IconX /> Reject
            </Button>
          </Flex>
        )
      )}

      {decisionError && (
        <Text as="div" size="1" color="red">{decisionError}</Text>
      )}
    </div>
  )
}
