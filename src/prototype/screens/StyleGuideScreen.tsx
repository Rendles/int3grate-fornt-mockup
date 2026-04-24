import { useState, type ReactNode } from 'react'
import { Badge, Button, Code, DataList, Flex, Grid, Heading, IconButton, Switch, Text } from '@radix-ui/themes'
import { AppShell } from '../components/shell'
import {
  Avatar,
  CommandBar,
  InfoHint,
  MetaRow,
  MetricCard,
  PageHeader,
  Pagination,
  Status,
  Tabs,
} from '../components/common'
import { SelectField, TextAreaField, TextInput } from '../components/fields'
import { Caption } from '../components/common/caption'
import { Banner, EmptyState, ErrorState, LoadingList, NoAccessState } from '../components/states'
import {
  IconAlert,
  IconArrowRight,
  IconCheck,
  IconPlus,
  IconTask,
} from '../components/icons'

const COLOR_TOKENS = [
  { token: '--gray-1', scale: 'slate', usage: 'App background' },
  { token: '--gray-2', scale: 'slate', usage: 'Shell and cards' },
  { token: '--gray-3', scale: 'slate', usage: 'Raised panels · hover tiles' },
  { token: '--gray-4', scale: 'slate', usage: 'Secondary raised surfaces' },
  { token: '--gray-6', scale: 'slate', usage: 'Default border' },
  { token: '--gray-8', scale: 'slate', usage: 'Input border · strong border' },
  { token: '--gray-10', scale: 'slate', usage: 'Dim text · metadata labels' },
  { token: '--gray-11', scale: 'slate', usage: 'Secondary text' },
  { token: '--gray-12', scale: 'slate', usage: 'Primary text' },
  { token: '--accent-9', scale: 'blue', usage: 'Primary action (solid)' },
  { token: '--accent-a3', scale: 'blue', usage: 'Accent soft tint' },
  { token: '--accent-a7', scale: 'blue', usage: 'Accent border' },
  { token: '--amber-11', scale: 'amber', usage: 'Warn foreground' },
  { token: '--red-11', scale: 'red', usage: 'Danger foreground' },
  { token: '--green-11', scale: 'green', usage: 'Success foreground' },
  { token: '--cyan-11', scale: 'cyan', usage: 'Info foreground' },
]

const TYPE_SPECS = [
  { name: 'Hero title', sample: 'Fleet control', spec: '44px / 1 line-height / -0.02em', usage: 'PageHeader title' },
  { name: 'Form title', sample: 'Create account.', spec: '32px / 1.1 line-height / -0.02em', usage: 'Login and auth forms' },
  { name: 'Body', sample: 'Operators review evidence before approving risky actions.', spec: '14px / 1.5 line-height', usage: 'Default copy' },
  { name: 'Small body', sample: 'Loaded via GET /agents', spec: '12.5px / 1.55 line-height', usage: 'Hints and metadata' },
  { name: 'Eyebrow', sample: 'CONTROL PLANE', spec: '10.5px / uppercase / 0.18em', usage: 'Section labels' },
]

const RADIX_MAP = [
  { current: 'Btn', radix: '@radix-ui/themes · Button / IconButton', figma: 'Migrated: solid/ghost/surface variants via Button; color="red" for danger; IconButton when icon-only. Sizes map sm/md/lg в†’ 1/2/3.' },
  { current: 'Chip / PolicyModeChip', radix: '@radix-ui/themes · Badge', figma: 'Migrated: tone в†’ color (accentв†’blue, warnв†’amber, dangerв†’red, successв†’green, infoв†’cyan, ghostв†’gray/outline). square в†’ radius="small".' },
  { current: 'Tabs', radix: '@radix-ui/themes · Tabs / TabNav', figma: 'Migrated: navigation-mode (href) renders TabNav, controlled-mode (onSelect) renders Tabs.Root + Tabs.List + Tabs.Trigger.' },
  { current: 'Toggle', radix: '@radix-ui/themes · Switch', figma: 'Migrated: on в†’ checked, onChange в†’ onCheckedChange, size="1" for compact density, label via Text as="label".' },
  { current: 'TextInput / TextAreaField / SelectField / PasswordField', radix: '@radix-ui/themes · TextField / TextArea / Select', figma: 'Migrated. Error state via color="red", auto aria-invalid and aria-describedby. Password eye toggle via TextField.Slot + IconButton.' },
  { current: 'FieldLabel / FieldHint / FieldError', radix: '@radix-ui/themes · Text / Flex', figma: 'Shared chrome: Text as="label" for FieldLabel, Flex + IconAlert + Text color="red" for FieldError.' },
  { current: 'Banner', radix: '@radix-ui/themes · Callout', figma: 'Migrated: tone info в†’ color="blue", warn в†’ color="amber". Icon in Callout.Icon slot, title as Text weight="medium", body as Callout.Text color="gray".' },
  { current: 'Avatar', radix: '@radix-ui/themes · Avatar', figma: 'Migrated: tone в†’ color, pixel size в†’ nearest Radix size 1-9 (16/20/24/28/32/40/48/56/64), variant="soft", radius="small".' },
  { current: 'InfoHint', radix: '@radix-ui/themes · Tooltip', figma: 'Migrated: ~95 lines of custom portal/positioning/flip logic replaced with Radix Tooltip. Trigger is a <button class="info-hint">.' },
  { current: 'LoadingList', radix: '@radix-ui/themes · Skeleton + Flex', figma: 'Migrated: Flex direction="column" gap="2" + Skeleton height="48px" rows.' },
  { current: 'MetaRow', radix: '@radix-ui/themes · DataList', figma: 'Migrated: DataList.Item + DataList.Label minWidth="120px" + DataList.Value. Wrap rows in DataList.Root size="2".' },
  { current: 'MetricCard', radix: '@radix-ui/themes · Card + Heading/Text', figma: 'Migrated: Card variant="surface" size="2" + Heading size="7" for value + Text for label/delta. tone="warn" tints border via var(--amber-6).' },
  { current: 'EmptyState / ErrorState / NoAccessState', radix: '@radix-ui/themes · Card + Heading/Text', figma: 'Migrated: shared StateShell with Card + Flex column + Heading + Text. Icon in coloured Box with red-a3/amber-a3/gray-a3 bg.' },
  { current: 'AppShell', radix: 'custom layout', figma: 'Product shell. Sidebar 240px, topbar 48px, content page padding 32px desktop. Not migrated — keeps custom layout.' },
]

const CHIP_TONES: Array<{
  label: string
  color: 'blue' | 'amber' | 'red' | 'green' | 'cyan' | 'gray'
  variant: 'soft' | 'outline'
}> = [
  { label: 'accent', color: 'blue', variant: 'soft' },
  { label: 'warn', color: 'amber', variant: 'soft' },
  { label: 'danger', color: 'red', variant: 'soft' },
  { label: 'success', color: 'green', variant: 'soft' },
  { label: 'info', color: 'cyan', variant: 'soft' },
  { label: 'ghost', color: 'gray', variant: 'outline' },
]
const STATUS_SAMPLES = ['active', 'draft', 'paused', 'pending', 'running', 'suspended', 'completed', 'failed', 'approved', 'rejected'] as const

export default function StyleGuideScreen() {
  const [activeTab, setActiveTab] = useState('overview')
  const [approvalRequired, setApprovalRequired] = useState(true)
  const [page, setPage] = useState(0)

  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'components' }]}>
      <div className="page page--wide">
        <PageHeader
          eyebrow={
            <>
              DESIGN SYSTEM{' '}
              <InfoHint>
                Use this page as a live inventory for moving the prototype into Figma. Map the examples to Radix UI components and keep the token names as design variables.
              </InfoHint>
            </>
          }
          title={<>Components & <em>styles.</em></>}
          subtitle="A compact source of truth for tokens, reusable primitives, component states, and Radix/Figma handoff notes."
          actions={
            <>
              <Button asChild variant="ghost"><a href="#/agents">Back to product</a></Button>
              <Button asChild><a href="#/tasks/new"><IconArrowRight />See task form</a></Button>
            </>
          }
        />

        <CommandBar
          parts={[
            { label: 'Route', value: '#/components', tone: 'accent' },
            { label: 'Library', value: '@radix-ui/themes' },
            { label: 'Theme', value: 'appearance=dark|light · accentColor=blue · grayColor=slate' },
            { label: 'Density', value: 'scaling=90% · radius=small' },
          ]}
        />

        <div style={{ height: 20 }} />

        <Section
          eyebrow="handoff"
          title="How to use this page in Figma"
          body="Components below are built on @radix-ui/themes (not raw Primitives). Figma targets should mirror Radix Themes components and their standard props (size, color, variant, radius). Product layout chrome (AppShell, form-row, login, card head/body) remains custom."
        >
          <Grid columns="3" gap="4">
            <GuidanceCard
              title="1. Foundations"
              body="Start with color variables, type styles, radius, spacing, and elevation. Use the CSS variable names as Figma token names."
            />
            <GuidanceCard
              title="2. Components"
              body="Create Button, Badge, Tabs, Switch, TextField, Select, Card, Callout, Avatar, Tooltip, Skeleton, and Pagination variants."
            />
            <GuidanceCard
              title="3. Patterns"
              body="Build larger patterns: AppShell, PageHeader, CommandBar, form rows, metadata cards, data rows, approval panel, and spend rows."
            />
          </Grid>
        </Section>

        <Section
          eyebrow="foundations"
          title="Color tokens"
          body="The UI is token driven. In Figma, keep semantic names instead of raw color names so dark and light themes can share the same components."
        >
          <Grid columns="4" gap="4">
            {COLOR_TOKENS.map(token => <ColorToken key={token.token} {...token} />)}
          </Grid>
        </Section>

        <Section
          eyebrow="foundations"
          title="Typography, radius, and spacing"
          body="The visual language is dense and technical. Inter is used everywhere, including mono-like labels, to keep the mock consistent."
        >
          <Grid columns="2" gap="4">
            <div className="card">
              <div className="card__head"><Text as="div" size="2" weight="medium" className="card__title">Type scale</Text></div>
              <div className="card__body">
                <Flex direction="column" gap="4">
                  {TYPE_SPECS.map(t => {
                  const size: '1' | '2' | '3' | '5' | '7' =
                    t.name.includes('Hero') ? '7'
                      : t.name.includes('Form') ? '5'
                        : t.name.includes('Eyebrow') ? '1'
                          : '2'
                  return (
                    <div key={t.name} style={{ borderBottom: '1px dashed var(--gray-6)', paddingBottom: 12 }}>
                      <Caption as="div" mb="2">{t.name}</Caption>
                      <Text as="div" size={size}>
                        {t.sample}
                      </Text>
                      <Text as="div" size="1" color="gray" mt="2">{t.spec}</Text>
                      <Text as="div" size="1" color="gray" mt="1">{t.usage}</Text>
                    </div>
                    )
                  })}
                </Flex>
              </div>
            </div>
            <div className="card">
              <div className="card__head"><Text as="div" size="2" weight="medium" className="card__title">Shape and spacing</Text></div>
              <div className="card__body">
                <Flex direction="column" gap="4">
                  <TokenRow name="Default radius" value="6px" note="Cards, banners, states." />
                  <TokenRow name="Control radius" value="4px" note="Buttons, inputs, chips, nav items." />
                  <TokenRow name="Shell sidebar" value="240px" note="Desktop AppShell navigation width." />
                  <TokenRow name="Topbar" value="48px" note="Sticky shell header height." />
                  <TokenRow name="Page padding" value="32px / 20px mobile" note="Content area spacing." />
                  <TokenRow name="Common gaps" value="6, 8, 12, 16, 20, 24" note="Use these as Figma spacing variables." />
                </Flex>
              </div>
            </div>
          </Grid>
        </Section>

        <Section
          eyebrow="radix mapping"
          title="Component map for Figma"
          body="Use Radix UI or Radix Themes as the structural base. The visual styling comes from this prototype's tokens and variants."
        >
          <div className="card" style={{ padding: 0 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(180px, 240px) minmax(200px, 260px) minmax(0, 1fr)',
                gap: 14,
                padding: '10px 16px',
                borderBottom: '1px solid var(--gray-a3)',
                background: 'var(--gray-a2)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              <Text as="span" size="1" color="gray">Current</Text>
              <Text as="span" size="1" color="gray">Radix target</Text>
              <Text as="span" size="1" color="gray">Figma notes</Text>
            </div>
            {RADIX_MAP.map(row => (
              <div
                key={row.current}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(180px, 240px) minmax(200px, 260px) minmax(0, 1fr)',
                  gap: 14,
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--gray-a3)',
                  alignItems: 'start',
                }}
              >
                <Code variant="ghost" size="1">{row.current}</Code>
                <Text as="span" size="1" color="blue">{row.radix}</Text>
                <Text as="span" size="1" color="gray" style={{ lineHeight: 1.55 }}>{row.figma}</Text>
              </div>
            ))}
          </div>
        </Section>

        <Section
          eyebrow="components"
          title="Actions and badges"
          body="Buttons carry most operator actions. Chips and status rows carry compact state. In Figma, model these as variants, not separate components."
        >
          <Grid columns="2" gap="4">
            <ComponentCard title="Buttons" radix="Radix target: Button / Slot">
              <Flex wrap="wrap" align="center" gap="3">
                <Button variant="surface">Default</Button>
                <Button><IconPlus />Primary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button color="red"><IconAlert />Danger</Button>
                <Button size="1">Small</Button>
                <Button size="3">Large</Button>
                <IconButton title="Icon only" aria-label="Icon only"><IconCheck /></IconButton>
                <Button disabled>Disabled</Button>
              </Flex>
            </ComponentCard>
            <ComponentCard title="Chips and status" radix="Radix target: Badge + custom status row">
              <Flex direction="column" gap="2">
                <Flex wrap="wrap" align="center" gap="3">
                  {CHIP_TONES.map(t => (
                    <Badge key={t.label} color={t.color} variant={t.variant} radius="full" size="1">{t.label}</Badge>
                  ))}
                  <Badge color="gray" variant="soft" radius="small" size="1">square</Badge>
                </Flex>
                <Flex wrap="wrap" align="center" gap="3">
                  {STATUS_SAMPLES.map(status => <Status key={status} status={status} />)}
                </Flex>
              </Flex>
            </ComponentCard>
          </Grid>
        </Section>

        <Section
          eyebrow="components"
          title="Forms and selection"
          body="Inputs are compact and high contrast. Use Radix TextField, TextArea, Select, Switch, and Tabs with these product tokens."
        >
          <Grid columns="2" gap="4">
            <ComponentCard title="Inputs" radix="Radix target: TextField, Select, TextArea">
              <Flex direction="column" gap="4">
                <TextInput label="Email" defaultValue="frontend@int3grate.ai" />
                <StyleGuideSelectDemo />
                <TextAreaField
                  label="Instruction"
                  defaultValue="Never take tool actions that require approval without a granted ApprovalRequest."
                />
              </Flex>
            </ComponentCard>
            <ComponentCard title="Tabs, switch, hint" radix="Radix target: Tabs, Switch, Tooltip">
              <Tabs
                active={activeTab}
                onSelect={setActiveTab}
                items={[
                  { key: 'overview', label: 'Overview' },
                  { key: 'grants', label: 'Tool grants', count: 5 },
                  { key: 'settings', label: 'Settings' },
                ]}
              />
              <Flex direction="column" gap="4">
                <Flex align="center" gap="2" asChild>
                  <label>
                    <Switch
                      size="1"
                      checked={approvalRequired}
                      onCheckedChange={setApprovalRequired}
                    />
                    <Text size="2">{approvalRequired ? 'Approval required' : 'No approval required'}</Text>
                  </label>
                </Flex>
                <Flex align="center" gap="2">
                  <Caption>Policy helper</Caption>
                  <InfoHint>
                    In Figma, build this as a Tooltip or Popover trigger. Use it for API contract notes and risky states.
                  </InfoHint>
                </Flex>
                <Banner tone={approvalRequired ? 'info' : 'warn'} title={approvalRequired ? 'Safe write action' : 'Risky write action'}>
                  {approvalRequired
                    ? 'The agent must pause at an approval gate before this tool action.'
                    : 'Write tools without approval should be reviewed by an admin.'}
                </Banner>
              </Flex>
            </ComponentCard>
          </Grid>
        </Section>

        <Section
          eyebrow="patterns"
          title="Cards, command bars, and metadata"
          body="These patterns are reused across agent detail, approval detail, run detail, profile, and spend screens."
        >
          <Grid columns="3" gap="4" mb="4">
            <MetricCard label="Active agents" value="5" unit="agents" delta="fleet overview" />
            <MetricCard label="Pending approvals" value="3" unit="items" delta="needs decision" tone="warn" />
            <MetricCard label="Spend" value="$1.2k" unit="USD" delta="last 7 days" />
          </Grid>
          <Grid columns="2" gap="4">
            <ComponentCard title="Command bar" radix="Radix target: custom data bar">
              <CommandBar
                parts={[
                  { label: 'ID', value: 'agt_lead_qualifier' },
                  { label: 'TENANT', value: 'ten_acme' },
                  { label: 'ACTIVE VER', value: 'v14', tone: 'accent' },
                  { label: 'UPDATED', value: '2h ago' },
                ]}
              />
            </ComponentCard>
            <ComponentCard title="Metadata row" radix="Radix target: DataList">
              <div className="card" style={{ background: 'var(--gray-3)' }}>
                <div className="card__body">
                  <DataList.Root size="2">
                    <MetaRow label="agent_id" value={<Code variant="ghost">agt_lead_qualifier</Code>} />
                    <MetaRow label="model" value={<Code variant="ghost">gpt-5-mini</Code>} />
                    <MetaRow label="approval_level" value={<Code variant="ghost">L4</Code>} />
                  </DataList.Root>
                </div>
              </div>
            </ComponentCard>
          </Grid>
        </Section>

        <Section
          eyebrow="states"
          title="System states"
          body="Every screen should have loading, empty, error, and restricted states in Figma. These are part of the product story, not edge cases."
        >
          <Grid columns="2" gap="4">
            <ComponentCard title="Banners" radix="Radix target: Callout">
              <Flex direction="column" gap="4">
                <Banner tone="info" title="Only active version is exposed">
                  Version history is not listable in this build.
                </Banner>
                <Banner tone="warn" title="Approval required">
                  This action pauses the run until a human decides.
                </Banner>
              </Flex>
            </ComponentCard>
            <ComponentCard title="Loading" radix="Radix target: Skeleton">
              <LoadingList rows={3} />
            </ComponentCard>
            <ComponentCard title="Empty" radix="Radix target: Empty custom pattern">
              <EmptyState icon={<IconTask />} title="No tasks match these filters" action={{ label: 'Create task', href: '/tasks/new' }} />
            </ComponentCard>
            <ComponentCard title="Error and no access" radix="Radix target: Callout / custom empty state">
              <Flex direction="column" gap="4">
                <ErrorState title="Could not load spend" body="The request could not be completed." />
                <NoAccessState requiredRole="Admin or Domain Admin" body="Spend analytics are scoped to admins." />
              </Flex>
            </ComponentCard>
          </Grid>
        </Section>

        <Section
          eyebrow="patterns"
          title="Data rows and pagination"
          body="Rows are dense, clickable, and metadata-heavy. Keep the same row rhythm when building Figma table components."
        >
          <div className="card" style={{ padding: 0 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 120px 140px 120px 32px',
                gap: 14,
                padding: '10px 16px',
                background: 'var(--gray-a2)',
                borderBottom: '1px solid var(--gray-a3)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              <Text as="span" size="1" color="gray">name / description</Text>
              <Text as="span" size="1" color="gray">status</Text>
              <Text as="span" size="1" color="gray">owner / domain</Text>
              <Text as="span" size="1" color="gray">updated</Text>
              <span />
            </div>
            {['Lead Qualifier', 'Refund Resolver', 'Access Provisioner'].map((name, i) => (
              <div
                key={name}
                className="agent-row"
                style={{ gridTemplateColumns: 'minmax(0, 1fr) 120px 140px 120px 32px' }}
              >
                <div style={{ minWidth: 0 }}>
                  <Text as="div" size="2">{name}</Text>
                  <Text as="div" size="1" color="gray" mt="1" className="truncate">
                    {i === 0 ? 'Scores inbound leads and drafts outreach.' : i === 1 ? 'Reviews charges and prepares refunds.' : 'Onboards and offboards SaaS access.'}
                  </Text>
                  <Text as="div" size="1" color="gray" mt="1">
                    agt_{name.toLowerCase().replace(/\s+/g, '_')}
                  </Text>
                </div>
                <Status status={i === 2 ? 'paused' : 'active'} />
                <div>
                  <Text as="div" size="1">{i === 0 ? 'usr_marcelo' : 'usr_priya'}</Text>
                  <Text as="div" size="1" color="gray" mt="1">{i === 0 ? 'dom_sales' : 'dom_support'}</Text>
                </div>
                <Text as="div" size="1" color="gray">{i + 1}d ago</Text>
                <IconArrowRight className="ic" />
              </div>
            ))}
            <Pagination page={page} pageSize={10} total={42} onPageChange={setPage} label="rows" />
          </div>
        </Section>

        <Section
          eyebrow="figma checklist"
          title="Transfer checklist"
          body="Use this list when recreating the system in Figma with Radix UI components."
        >
          <Grid columns="2" gap="4">
            <ChecklistCard
              title="Foundations"
              items={[
                'Create dark and light semantic color variables.',
                'Create text styles for page title, form title, body, small body, eyebrow, and mono metadata.',
                'Create radius variables: 4px, 6px, 10px.',
                'Create spacing variables: 6, 8, 12, 16, 20, 24, 32.',
              ]}
            />
            <ChecklistCard
              title="Components"
              items={[
                'Map Button, Badge, Tabs, Switch, TextField, Select, TextArea, Tooltip, Callout, Avatar, Skeleton, Card, and Pagination.',
                'Add variants for tone, size, disabled, active, hover, and loading where needed.',
                'Keep compact density. Avoid large default Radix spacing.',
                'Build AppShell, PageHeader, CommandBar, MetadataRow, AgentRow, ApprovalPanel, and SpendRow as product patterns.',
              ]}
            />
          </Grid>
        </Section>
      </div>
    </AppShell>
  )
}

function Section({
  eyebrow,
  title,
  body,
  children,
}: {
  eyebrow: string
  title: string
  body: string
  children: ReactNode
}) {
  return (
    <section style={{ marginTop: 34 }}>
      <div style={{ marginBottom: 14 }}>
        <Text as="div" size="1" color="gray" className="page__eyebrow">{eyebrow}</Text>
        <Heading as="h2" size="7" weight="regular" mb="2" style={{ lineHeight: 1.1 }}>{title}</Heading>
        <Text as="p" size="2" color="gray" style={{ maxWidth: 760 }}>{body}</Text>
      </div>
      {children}
    </section>
  )
}

function GuidanceCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="card">
      <div className="card__body">
        <Heading as="h3" size="5" weight="regular" mb="2">{title}</Heading>
        <Text as="p" size="1" color="gray" style={{ lineHeight: 1.55 }}>{body}</Text>
      </div>
    </div>
  )
}

function ColorToken({
  token,
  scale,
  usage,
}: {
  token: string
  scale: string
  usage: string
}) {
  return (
    <div className="card">
      <div
        style={{
          height: 54,
          borderRadius: 4,
          border: '1px solid var(--gray-8)',
          background: `var(${token})`,
          marginBottom: 12,
        }}
      />
      <div className="card__body" style={{ padding: 0 }}>
        <Code variant="ghost" size="1">{token}</Code>
        <Text as="div" size="1" color="gray" mt="1">{usage}</Text>
        <Text as="div" size="1" color="gray" mt="2">
          Radix scale: <Code variant="ghost">{scale}</Code> · appearance follows Theme
        </Text>
      </div>
    </div>
  )
}

function TokenRow({ name, value, note }: { name: string; value: string; note: string }) {
  return (
    <Flex align="start" justify="between" gap="3" pb="3" style={{ borderBottom: '1px dashed var(--gray-6)' }}>
      <div>
        <Text as="div" size="2">{name}</Text>
        <Text as="div" size="1" color="gray" mt="1">{note}</Text>
      </div>
      <Badge color="gray" variant="soft" radius="full" size="1">{value}</Badge>
    </Flex>
  )
}

function StyleGuideSelectDemo() {
  const [value, setValue] = useState('dom_sales')
  return (
    <SelectField
      label="Domain"
      value={value}
      onChange={setValue}
      options={[
        { value: 'dom_hq', label: 'HQ / Platform' },
        { value: 'dom_sales', label: 'Sales / Revenue' },
        { value: 'dom_support', label: 'Support / CX' },
      ]}
    />
  )
}

function ComponentCard({
  title,
  radix,
  children,
}: {
  title: string
  radix: string
  children: ReactNode
}) {
  return (
    <div className="card">
      <div className="card__head">
        <Text as="div" size="2" weight="medium" className="card__title">{title}</Text>
        <Badge color="cyan" variant="soft" radius="full" size="1">{radix}</Badge>
      </div>
      <div className="card__body">
        {children}
      </div>
    </div>
  )
}


function ChecklistCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="card">
      <div className="card__head">
        <Text as="div" size="2" weight="medium" className="card__title">{title}</Text>
        <Avatar initials={title.slice(0, 2).toUpperCase()} size={26} />
      </div>
      <div className="card__body">
        <Flex direction="column" gap="2">
          {items.map(item => (
            <Flex key={item} align="start" gap="3">
              <span style={{ color: 'var(--green-11)', marginTop: 2 }}><IconCheck className="ic ic--sm" /></span>
              <Text as="span" size="1" color="gray" style={{ lineHeight: 1.5 }}>{item}</Text>
            </Flex>
          ))}
        </Flex>
      </div>
    </div>
  )
}
