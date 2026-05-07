import { useEffect, useState } from 'react'
import { Box, Button, Dialog, Flex, Text } from '@radix-ui/themes'

import { TextAreaField } from './fields'
import { Banner } from './states'
import { api } from '../lib/api'
import type { Agent, AgentVersion } from '../lib/types'

// Compact "give the agent new instructions" dialog. Replaces the old
// VersionNewScreen page that exposed model / temperature / max_tokens —
// none of which the live OpenAPI guarantees on the version's *_config
// objects (those are `additionalProperties: true` opaque).
//
// The only field the user edits is the brief (`instruction_spec`).
// Other configs forward verbatim from the current active version, so the
// backend keeps whatever shape it already had — UI only updates one knob.
//
// On save: createAgentVersion → activateVersion in sequence. There's no
// draft mode; "Setup history is single-version" per the Advanced banner.

export function RetrainDialog({
  open,
  onOpenChange,
  agent,
  currentVersion,
  onRetrained,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
  agent: Agent
  currentVersion: AgentVersion | null
  onRetrained?: (newVersion: AgentVersion) => void
}) {
  const [brief, setBrief] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedPrev, setExpandedPrev] = useState(false)

  // Sync local state to the (re)opened dialog. We reset every time the
  // dialog opens so a previous canceled edit doesn't leak in. The
  // setState-in-effect lint rule fires on this pattern; it's the cleanest
  // way to express "snapshot props when the dialog opens" without a
  // controlled-from-parent state.
  useEffect(() => {
    if (open) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setBrief(currentVersion?.instruction_spec ?? '')
      setTouched(false)
      setBusy(false)
      setError(null)
      setExpandedPrev(false)
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [open, currentVersion])

  const hasCurrent = currentVersion != null
  const trimmed = brief.trim()
  const empty = trimmed.length === 0
  const showEmptyError = touched && empty

  // Block Esc / overlay-click while a save is in flight — losing the
  // pending request mid-air would leave the user wondering what happened.
  const handleOpenChange = (next: boolean) => {
    if (busy && !next) return
    onOpenChange(next)
  }

  const handleSubmit = async () => {
    setTouched(true)
    if (empty) return
    setBusy(true)
    setError(null)
    try {
      const newVersion = await api.createAgentVersion(agent.id, {
        instruction_spec: trimmed,
        // Forward existing opaque configs unchanged. We don't expose them
        // in the UI (vocab rule + spec doesn't fix their shape), but we
        // also don't want to silently reset them to {} on retrain.
        memory_scope_config: currentVersion?.memory_scope_config ?? {},
        tool_scope_config: currentVersion?.tool_scope_config ?? {},
        approval_rules: currentVersion?.approval_rules ?? {},
        model_chain_config: currentVersion?.model_chain_config ?? {},
      })
      await api.activateVersion(agent.id, newVersion.id)
      onRetrained?.(newVersion)
      onOpenChange(false)
    } catch (e) {
      setError((e as Error).message ?? 'Failed to save brief')
    } finally {
      setBusy(false)
    }
  }

  const firstName = agent.name.split(' ')[0] || agent.name
  const title = hasCurrent ? `Retrain ${agent.name}` : `Brief for ${agent.name}`
  const submitLabel = busy
    ? 'Saving…'
    : hasCurrent
      ? `Retrain ${firstName}`
      : 'Save brief'

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Content size="3" maxWidth="640px">
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="4">
          {hasCurrent
            ? `Save replaces ${firstName}'s current brief. The next chat will use the new one.`
            : `Tell ${firstName} what they're here to do. You can update this later.`}
        </Dialog.Description>

        {error && (
          <Box mb="3">
            <Banner tone="warn" title="Couldn't save brief">
              {error}
            </Banner>
          </Box>
        )}

        <TextAreaField
          autoFocus
          label="New brief"
          required
          style={{ minHeight: 240, lineHeight: 1.5 }}
          placeholder={`What should ${firstName} do? How should they decide what's in scope?`}
          value={brief}
          onChange={e => setBrief(e.target.value)}
          onBlur={() => setTouched(true)}
          error={showEmptyError ? 'Required' : undefined}
          disabled={busy}
        />

        {hasCurrent && (
          <Box mt="3">
            <Button
              type="button"
              variant="ghost"
              color="gray"
              size="1"
              onClick={() => setExpandedPrev(p => !p)}
              aria-expanded={expandedPrev}
            >
              {expandedPrev ? 'Hide' : 'See'} previous brief
            </Button>
            {expandedPrev && (
              <Box
                mt="2"
                p="3"
                style={{
                  background: 'var(--gray-a2)',
                  border: '1px solid var(--gray-a4)',
                  borderRadius: 6,
                  maxHeight: 180,
                  overflow: 'auto',
                }}
              >
                <Text
                  as="div"
                  size="1"
                  color="gray"
                  style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}
                >
                  {currentVersion!.instruction_spec}
                </Text>
              </Box>
            )}
          </Box>
        )}

        <Flex justify="end" gap="2" mt="5">
          <Button
            variant="soft"
            color="gray"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            color="blue"
            disabled={busy || empty}
            onClick={handleSubmit}
          >
            {submitLabel}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
