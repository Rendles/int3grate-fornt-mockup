import { useEffect, useState } from 'react'
import { Button, Dialog, Flex, Text, TextArea, TextField } from '@radix-ui/themes'

import type { Workspace } from '../lib/types'
import { Caption } from './common'

// Reusable dialog for both create and edit. Step 5 wires it from the
// WorkspaceSwitcher dropdown (`+ Create workspace`); Step 6 reuses it
// from /workspaces for both new + edit. Owns its own form state — the
// caller passes in mode and (for edit) the workspace, plus an async
// onSubmit that does the actual api call.

const NAME_MAX = 80
const DESC_MAX = 140

export interface WorkspaceFormValues {
  name: string
  description?: string
}

export interface WorkspaceFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  /** Required in edit mode, ignored in create. */
  workspace?: Workspace
  onSubmit: (values: WorkspaceFormValues) => Promise<void>
}

export function WorkspaceFormDialog({ open, onOpenChange, mode, workspace, onSubmit }: WorkspaceFormDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Snapshot props when the dialog opens. Same set-state-in-effect
  // workaround used in retrain-dialog.tsx — cleanest expression of
  // "reset form to props when (re)opened" without a controlled-state
  // contract with the parent.
  useEffect(() => {
    if (open) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setName(workspace?.name ?? '')
      setDescription(workspace?.description ?? '')
      setTouched(false)
      setBusy(false)
      setError(null)
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [open, workspace])

  const trimmed = name.trim()
  const nameError = (() => {
    if (!trimmed) return 'Name is required'
    if (trimmed.length > NAME_MAX) return `Name must be ${NAME_MAX} characters or fewer`
    return null
  })()
  const descError = description.length > DESC_MAX ? `Description must be ${DESC_MAX} characters or fewer` : null
  const canSubmit = !nameError && !descError && !busy

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      await onSubmit({
        name: trimmed,
        description: description.trim() || undefined,
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save workspace')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content style={{ maxWidth: 480 }}>
        <Dialog.Title>
          {mode === 'create' ? 'New workspace' : `Edit ${workspace?.name ?? 'workspace'}`}
        </Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="4">
          {mode === 'create'
            ? 'Workspaces are teams inside your company. Each holds its own agents, approvals, and spend.'
            : 'Update the name, description, or icon for this workspace.'}
        </Dialog.Description>

        <form onSubmit={handleSubmit}>
          <Flex direction="column" gap="3">
            <Flex direction="column" gap="1">
              <Caption>Name</Caption>
              <TextField.Root
                value={name}
                onChange={e => setName(e.target.value)}
                onBlur={() => setTouched(true)}
                placeholder="Growth, Operations, Finance…"
                autoFocus
                maxLength={NAME_MAX + 20}
              />
              {touched && nameError && (
                <Text size="1" color="red">{nameError}</Text>
              )}
            </Flex>

            <Flex direction="column" gap="1">
              <Flex justify="between" align="baseline">
                <Caption>Description</Caption>
                <Text size="1" color="gray">{description.length} / {DESC_MAX}</Text>
              </Flex>
              <TextArea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What does this team do?"
                rows={2}
              />
              {touched && descError && (
                <Text size="1" color="red">{descError}</Text>
              )}
            </Flex>

            {error && (
              <Text size="2" color="red">{error}</Text>
            )}

            <Flex gap="2" justify="end" mt="2">
              <Dialog.Close>
                <Button type="button" variant="soft" color="gray" disabled={busy}>Cancel</Button>
              </Dialog.Close>
              <Button type="submit" disabled={!canSubmit}>
                {busy
                  ? (mode === 'create' ? 'Creating…' : 'Saving…')
                  : (mode === 'create' ? 'Create workspace' : 'Save changes')}
              </Button>
            </Flex>
          </Flex>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  )
}
