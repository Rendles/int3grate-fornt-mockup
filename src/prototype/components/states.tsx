import type { ComponentProps, ReactNode } from 'react'
import { Box, Button, Callout, Card, Flex, Heading, Skeleton, Text } from '@radix-ui/themes'
import { IconAlert, IconCheck, IconInfo, IconLock, IconTask } from './icons'

type BannerTone = 'info' | 'warn' | 'danger' | 'success' | 'ghost'
type CalloutColor = NonNullable<ComponentProps<typeof Callout.Root>['color']>

const BANNER_COLOR: Record<BannerTone, CalloutColor> = {
  info: 'cyan',
  warn: 'orange',
  danger: 'red',
  success: 'jade',
  ghost: 'gray',
}

type StateTone = 'neutral' | 'danger' | 'warn'

function StateIcon({ tone, children }: { tone: StateTone; children: ReactNode }) {
  const color = tone === 'danger' ? 'var(--red-11)' : tone === 'warn' ? 'var(--orange-11)' : 'var(--gray-11)'
  const border = tone === 'danger' ? 'var(--red-6)' : tone === 'warn' ? 'var(--orange-6)' : 'var(--gray-6)'
  const bg = tone === 'danger' ? 'var(--red-a3)' : tone === 'warn' ? 'var(--orange-a3)' : 'var(--gray-a3)'
  return (
    <Box
      style={{
        width: 36,
        height: 36,
        display: 'grid',
        placeItems: 'center',
        border: `1px solid ${border}`,
        borderRadius: 8,
        background: bg,
        color,
      }}
    >
      {children}
    </Box>
  )
}

function StateShell({
  tone = 'neutral',
  icon,
  title,
  body,
  action,
}: {
  tone?: StateTone
  icon: ReactNode
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <Card size="4" variant="surface">
      <Flex direction="column" align="center" gap="3" py="6" px="4">
        <StateIcon tone={tone}>{icon}</StateIcon>
        <Heading size="5" align="center" weight="medium">{title}</Heading>
        {body && (
          <Text size="2" color="gray" align="center" style={{ maxWidth: 420 }}>
            {body}
          </Text>
        )}
        {action && <Flex gap="2">{action}</Flex>}
      </Flex>
    </Card>
  )
}

export function EmptyState({
  title,
  body,
  icon,
  action,
}: {
  title: string
  body?: string
  icon?: ReactNode
  action?: { label: string; href?: string; onClick?: () => void }
}) {
  return (
    <StateShell
      tone="neutral"
      icon={icon ?? <IconTask />}
      title={title}
      body={body}
      action={
        action && (
          action.href
            ? (
              <Button asChild>
                <a href={`#${action.href}`} onClick={action.onClick}>{action.label}</a>
              </Button>
            )
            : (
              <Button onClick={action.onClick}>{action.label}</Button>
            )
        )
      }
    />
  )
}

export function LoadingList({ rows = 6 }: { rows?: number }) {
  return (
    <Flex direction="column" gap="2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height="48px" />
      ))}
    </Flex>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  body = 'The request could not be completed. Try again, or contact your workspace admin.',
  onRetry,
}: {
  title?: string
  body?: string
  onRetry?: () => void
}) {
  return (
    <StateShell
      tone="danger"
      icon={<IconAlert />}
      title={title}
      body={body}
      action={onRetry && <Button onClick={onRetry}>Retry</Button>}
    />
  )
}

export function NoAccessState({
  requiredRole = 'Admin',
  body,
}: {
  requiredRole?: string
  body?: string
}) {
  return (
    <StateShell
      tone="warn"
      icon={<IconLock />}
      title={`You need ${requiredRole} access`}
      body={body ?? 'This view is restricted by role. Ask a workspace admin to grant access or switch roles.'}
    />
  )
}

function defaultBannerIcon(tone: BannerTone): ReactNode {
  if (tone === 'success') return <IconCheck className="ic" />
  if (tone === 'warn' || tone === 'danger') return <IconAlert className="ic" />
  return <IconInfo className="ic" />
}

export function Banner({
  tone = 'info',
  title,
  children,
  action,
  icon,
}: {
  tone?: BannerTone
  title: ReactNode
  children?: ReactNode
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <Callout.Root color={BANNER_COLOR[tone]} variant="surface" size="1">
      <Callout.Icon>{icon ?? defaultBannerIcon(tone)}</Callout.Icon>
      <Text size="2" weight="medium">{title}</Text>
      {children && <Callout.Text size="2" color="gray">{children}</Callout.Text>}
      {action}
    </Callout.Root>
  )
}
