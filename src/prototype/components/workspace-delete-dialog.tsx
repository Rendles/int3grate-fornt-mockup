import { useEffect, useState } from 'react'
import { Button, Dialog, Flex, Text, TextField } from '@radix-ui/themes'

import type { Workspace } from '../lib/types'
import { Caption } from './common'

// Type-the-name confirmation dialog for deleting a workspace. Used by
// /workspaces (WorkspacesScreen). Cascade behavior is enforced in
// api.deleteWorkspace: hard-deletes agents in this workspace plus all
// membership rows. Body copy says "archived" because that's the term we
// use with the user — backend equivalent will be soft-archive when wired.
//
// Last-workspace block is enforced api-side (throws "Cannot delete your
// only workspace"); the caller can also disable the trigger button.

export interface WorkspaceDeleteDialogProps {
  workspace: Workspace | null
  agentCount: number
  memberCount: number
  onOpenChange: (open: boolean) => void
  onDelete: () => Promise<void>
}

export function WorkspaceDeleteDialog({ workspace, agentCount, memberCount, onOpenChange, onDelete }: WorkspaceDeleteDialogProps) {
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const open = !!workspace

  // Reset state when dialog (re)opens. set-state-in-effect snapshot pattern
  // — same workaround used in retrain-dialog and workspace-form-dialog.
  useEffect(() => {
    if (open) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setConfirmText('')
      setBusy(false)
      setError(null)
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [open])

  if (!workspace) return null

  const matches = confirmText.trim() === workspace.name
  const canDelete = matches && !busy

  const handleDelete = async () => {
    if (!canDelete) return
    setBusy(true)
    setError(null)
    try {
      await onDelete()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete workspace')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content style={{ maxWidth: 480 }}>
        <Dialog.Title>Delete {workspace.name}?</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="3">
          {agentCount > 0
            ? `${agentCount} ${agentCount === 1 ? 'agent' : 'agents'} in this workspace will be archived.`
            : 'No agents will be affected — this workspace is empty.'
          }
          {memberCount > 1 && (
            <> {memberCount - 1} other {memberCount - 1 === 1 ? 'member' : 'members'} will lose access.</>
          )}
        </Dialog.Description>
        <Text as="p" size="2" mb="3">
          This action cannot be undone.
        </Text>

        <Flex direction="column" gap="1" mb="4">
          <Caption>Type <b>{workspace.name}</b> to confirm</Caption>
          <TextField.Root
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder={workspace.name}
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter' && canDelete) {
                e.preventDefault()
                void handleDelete()
              }
            }}
          />
        </Flex>

        {error && (
          <Text size="2" color="red" mb="2">{error}</Text>
        )}

        <Flex gap="2" justify="end">
          <Dialog.Close>
            <Button type="button" variant="soft" color="gray" disabled={busy}>Cancel</Button>
          </Dialog.Close>
          <Button color="red" disabled={!canDelete} onClick={handleDelete}>
            {busy ? 'Deleting…' : 'Delete workspace'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
