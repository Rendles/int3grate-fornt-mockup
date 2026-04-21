import { useState, type ReactNode } from 'react'
import { AppShell } from '../components/shell'
import {
  Avatar,
  Btn,
  Chip,
  CommandBar,
  InfoHint,
  PageHeader,
  Pagination,
  Status,
  Tabs,
  Toggle,
} from '../components/common'
import { Banner, EmptyState, ErrorState, LoadingList, NoAccessState } from '../components/states'
import {
  IconAlert,
  IconArrowRight,
  IconCheck,
  IconPlus,
  IconTask,
} from '../components/icons'

const COLOR_TOKENS = [
  { token: '--bg', dark: '#0a0b0c', light: '#ffffff', usage: 'App background' },
  { token: '--surface', dark: '#0e1012', light: '#f8f9fb', usage: 'Shell and cards' },
  { token: '--surface-2', dark: '#13161a', light: '#f2f3f6', usage: 'Raised panels' },
  { token: '--surface-3', dark: '#181c21', light: '#eaecf0', usage: 'Hover and tiles' },
  { token: '--border', dark: '#20242b', light: '#e3e5ea', usage: 'Default border' },
  { token: '--border-strong', dark: '#373d47', light: '#b8bcc4', usage: 'Inputs and focus base' },
  { token: '--text', dark: '#e5e6e9', light: '#0a0b0c', usage: 'Primary text' },
  { token: '--text-muted', dark: '#9a9ea6', light: '#4a4f56', usage: 'Secondary text' },
  { token: '--text-dim', dark: '#60646c', light: '#7b7f86', usage: 'Labels and metadata' },
  { token: '--accent', dark: '#0F62FE', light: '#0F62FE', usage: 'Primary action' },
  { token: '--warn', dark: '#ffb347', light: '#b45309', usage: 'Needs attention' },
  { token: '--danger', dark: '#ff5a4d', light: '#b42318', usage: 'Destructive or failed' },
  { token: '--success', dark: '#55d991', light: '#107c41', usage: 'Positive result' },
  { token: '--info', dark: '#6aa6ff', light: '#0043ce', usage: 'Informational accent' },
]

const TYPE_SPECS = [
  { name: 'Hero title', sample: 'Fleet control', spec: '44px / 1 line-height / -0.02em', usage: 'PageHeader title' },
  { name: 'Form title', sample: 'Create account.', spec: '32px / 1.1 line-height / -0.02em', usage: 'Login and auth forms' },
  { name: 'Body', sample: 'Operators review evidence before approving risky actions.', spec: '14px / 1.5 line-height', usage: 'Default copy' },
  { name: 'Small body', sample: 'Loaded via GET /agents', spec: '12.5px / 1.55 line-height', usage: 'Hints and metadata' },
  { name: 'Eyebrow', sample: 'CONTROL PLANE', spec: '10.5px / uppercase / 0.18em', usage: 'Section labels' },
]

const RADIX_MAP = [
  { current: 'Btn', radix: 'Button / Slot', figma: 'Variants: default, primary, ghost, danger; sizes: sm, md, lg; states: hover, disabled, icon-only.' },
  { current: 'Chip', radix: 'Badge', figma: 'Variants: accent, warn, danger, success, info, ghost, square. Use for tags and compact metadata.' },
  { current: 'Tabs', radix: 'Tabs.Root / Tabs.List / Tabs.Trigger', figma: 'Active trigger uses accent underline. Count is a nested badge text token.' },
  { current: 'Toggle', radix: 'Switch', figma: 'Use on/off variants plus disabled state. Current thumb movement is 14px.' },
  { current: 'Input / Select / Textarea', radix: 'TextField / Select / TextArea', figma: 'Use one field shell: bg, border-strong, 4px radius, accent focus ring.' },
  { current: 'Banner', radix: 'Callout', figma: 'Variants: info and warn. Icon slot at left, optional action at right.' },
  { current: 'Avatar', radix: 'Avatar', figma: 'Initials in 4px radius square. Tone controls text, border, and soft fill.' },
  { current: 'InfoHint', radix: 'Tooltip / Popover', figma: 'Small help trigger with floating content. Use for API and contract notes.' },
  { current: 'LoadingList', radix: 'Skeleton', figma: 'Skeleton rows use surface-2 to surface-3 shimmer.' },
  { current: 'AppShell', radix: 'Layout shell', figma: 'Sidebar 240px, topbar 48px, content page padding 32px desktop.' },
]

const CHIP_TONES = ['accent', 'warn', 'danger', 'success', 'info', 'ghost'] as const
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
              <Btn href="/agents" variant="ghost">Back to product</Btn>
              <Btn href="/tasks/new" variant="primary" icon={<IconArrowRight />}>See task form</Btn>
            </>
          }
        />

        <CommandBar
          parts={[
            { label: 'Route', value: '#/components', tone: 'accent' },
            { label: 'Library target', value: 'Radix UI / Radix Themes' },
            { label: 'Theme', value: 'dark + light tokens' },
            { label: 'Density', value: 'operator console' },
          ]}
        />

        <div style={{ height: 20 }} />

        <Section
          eyebrow="handoff"
          title="How to use this page in Figma"
          body="Create Figma pages for Foundations, Components, Patterns, and States. Keep Radix components as the base structure, then apply these product tokens and variants."
        >
          <div className="grid grid--3">
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
          </div>
        </Section>

        <Section
          eyebrow="foundations"
          title="Color tokens"
          body="The UI is token driven. In Figma, keep semantic names instead of raw color names so dark and light themes can share the same components."
        >
          <div className="grid grid--4">
            {COLOR_TOKENS.map(token => <ColorToken key={token.token} {...token} />)}
          </div>
        </Section>

        <Section
          eyebrow="foundations"
          title="Typography, radius, and spacing"
          body="The visual language is dense and technical. Inter is used everywhere, including mono-like labels, to keep the mock consistent."
        >
          <div className="grid grid--2">
            <div className="card">
              <div className="card__head"><div className="card__title">Type scale</div></div>
              <div className="card__body stack">
                {TYPE_SPECS.map(t => (
                  <div key={t.name} style={{ borderBottom: '1px dashed var(--border)', paddingBottom: 12 }}>
                    <div className="mono uppercase muted" style={{ marginBottom: 6 }}>{t.name}</div>
                    <div style={{ fontFamily: t.name.includes('Hero') || t.name.includes('Form') ? 'var(--font-serif)' : 'var(--font-sans)', fontSize: t.name.includes('Hero') ? 32 : t.name.includes('Form') ? 26 : t.name.includes('Eyebrow') ? 11 : 14, color: 'var(--text)' }}>
                      {t.sample}
                    </div>
                    <div className="mono" style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 6 }}>{t.spec}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>{t.usage}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card__head"><div className="card__title">Shape and spacing</div></div>
              <div className="card__body stack">
                <TokenRow name="Default radius" value="6px" note="Cards, banners, states." />
                <TokenRow name="Control radius" value="4px" note="Buttons, inputs, chips, nav items." />
                <TokenRow name="Large radius" value="10px" note="Reserved for larger panels." />
                <TokenRow name="Shell sidebar" value="240px" note="Desktop AppShell navigation width." />
                <TokenRow name="Topbar" value="48px" note="Sticky shell header height." />
                <TokenRow name="Page padding" value="32px / 20px mobile" note="Content area spacing." />
                <TokenRow name="Common gaps" value="6, 8, 12, 16, 20, 24" note="Use these as Figma spacing variables." />
              </div>
            </div>
          </div>
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
                gridTemplateColumns: '180px 220px minmax(0, 1fr)',
                gap: 14,
                padding: '10px 16px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--surface-2)',
              }}
              className="mono uppercase muted"
            >
              <span>Current</span>
              <span>Radix target</span>
              <span>Figma notes</span>
            </div>
            {RADIX_MAP.map(row => (
              <div
                key={row.current}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '180px 220px minmax(0, 1fr)',
                  gap: 14,
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border)',
                  alignItems: 'start',
                }}
              >
                <span className="mono" style={{ color: 'var(--text)' }}>{row.current}</span>
                <span style={{ color: 'var(--accent)' }}>{row.radix}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 12.5, lineHeight: 1.55 }}>{row.figma}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section
          eyebrow="components"
          title="Actions and badges"
          body="Buttons carry most operator actions. Chips and status rows carry compact state. In Figma, model these as variants, not separate components."
        >
          <div className="grid grid--2">
            <ComponentCard title="Buttons" radix="Radix target: Button / Slot">
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <Btn>Default</Btn>
                <Btn variant="primary" icon={<IconPlus />}>Primary</Btn>
                <Btn variant="ghost">Ghost</Btn>
                <Btn variant="danger" icon={<IconAlert />}>Danger</Btn>
                <Btn size="sm">Small</Btn>
                <Btn size="lg" variant="primary">Large</Btn>
                <Btn icon={<IconCheck />} title="Icon only" />
                <Btn disabled>Disabled</Btn>
              </div>
            </ComponentCard>
            <ComponentCard title="Chips and status" radix="Radix target: Badge + custom status row">
              <div className="stack stack--sm">
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  {CHIP_TONES.map(tone => <Chip key={tone} tone={tone}>{tone}</Chip>)}
                  <Chip square>square</Chip>
                </div>
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  {STATUS_SAMPLES.map(status => <Status key={status} status={status} />)}
                </div>
              </div>
            </ComponentCard>
          </div>
        </Section>

        <Section
          eyebrow="components"
          title="Forms and selection"
          body="Inputs are compact and high contrast. Use Radix TextField, TextArea, Select, Switch, and Tabs with these product tokens."
        >
          <div className="grid grid--2">
            <ComponentCard title="Inputs" radix="Radix target: TextField, Select, TextArea">
              <div className="stack">
                <label>
                  <div className="mono uppercase muted" style={{ marginBottom: 6 }}>Email</div>
                  <input className="input" defaultValue="frontend@int3grate.ai" />
                </label>
                <label>
                  <div className="mono uppercase muted" style={{ marginBottom: 6 }}>Domain</div>
                  <select className="select" defaultValue="dom_sales">
                    <option value="dom_hq">HQ / Platform</option>
                    <option value="dom_sales">Sales / Revenue</option>
                    <option value="dom_support">Support / CX</option>
                  </select>
                </label>
                <label>
                  <div className="mono uppercase muted" style={{ marginBottom: 6 }}>Instruction</div>
                  <textarea className="input textarea" defaultValue="Never take tool actions that require approval without a granted ApprovalRequest." />
                </label>
              </div>
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
              <div className="stack">
                <Toggle
                  on={approvalRequired}
                  onChange={setApprovalRequired}
                  label={approvalRequired ? 'Approval required' : 'No approval required'}
                />
                <div className="row row--sm">
                  <span className="mono uppercase muted">Policy helper</span>
                  <InfoHint>
                    In Figma, build this as a Tooltip or Popover trigger. Use it for API contract notes and risky states.
                  </InfoHint>
                </div>
                <Banner tone={approvalRequired ? 'info' : 'warn'} title={approvalRequired ? 'Safe write action' : 'Risky write action'}>
                  {approvalRequired
                    ? 'The agent must pause at an approval gate before this tool action.'
                    : 'Write tools without approval should be reviewed by an admin.'}
                </Banner>
              </div>
            </ComponentCard>
          </div>
        </Section>

        <Section
          eyebrow="patterns"
          title="Cards, command bars, and metadata"
          body="These patterns are reused across agent detail, approval detail, run detail, profile, and spend screens."
        >
          <div className="grid grid--3" style={{ marginBottom: 16 }}>
            <MetricCard label="Active agents" value="5" unit="agents" delta="fleet overview" />
            <MetricCard label="Pending approvals" value="3" unit="items" delta="needs decision" tone="warn" />
            <MetricCard label="Spend" value="$1.2k" unit="USD" delta="last 7 days" />
          </div>
          <div className="grid grid--2">
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
            <ComponentCard title="Metadata row" radix="Radix target: Card + Text">
              <div className="card" style={{ background: 'var(--surface-2)' }}>
                <div className="card__body">
                  <MetaRow label="agent_id" value="agt_lead_qualifier" />
                  <MetaRow label="model" value="gpt-5-mini" />
                  <MetaRow label="approval_level" value="L4" />
                </div>
              </div>
            </ComponentCard>
          </div>
        </Section>

        <Section
          eyebrow="states"
          title="System states"
          body="Every screen should have loading, empty, error, and restricted states in Figma. These are part of the product story, not edge cases."
        >
          <div className="grid grid--2">
            <ComponentCard title="Banners" radix="Radix target: Callout">
              <div className="stack">
                <Banner tone="info" title="Only active version is exposed">
                  Version history is not listable in this build.
                </Banner>
                <Banner tone="warn" title="Approval required">
                  This action pauses the run until a human decides.
                </Banner>
              </div>
            </ComponentCard>
            <ComponentCard title="Loading" radix="Radix target: Skeleton">
              <LoadingList rows={3} />
            </ComponentCard>
            <ComponentCard title="Empty" radix="Radix target: Empty custom pattern">
              <EmptyState icon={<IconTask />} title="No tasks match these filters" action={{ label: 'Create task', href: '/tasks/new' }} />
            </ComponentCard>
            <ComponentCard title="Error and no access" radix="Radix target: Callout / custom empty state">
              <div className="stack">
                <ErrorState title="Could not load spend" body="The request could not be completed." />
                <NoAccessState requiredRole="Admin or Domain Admin" body="Spend analytics are scoped to admins." />
              </div>
            </ComponentCard>
          </div>
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
                background: 'var(--surface-2)',
                borderBottom: '1px solid var(--border)',
              }}
              className="mono uppercase muted"
            >
              <span>name / description</span>
              <span>status</span>
              <span>owner / domain</span>
              <span>updated</span>
              <span />
            </div>
            {['Lead Qualifier', 'Refund Resolver', 'Access Provisioner'].map((name, i) => (
              <div
                key={name}
                className="agent-row"
                style={{ gridTemplateColumns: 'minmax(0, 1fr) 120px 140px 120px 32px' }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, color: 'var(--text)' }}>{name}</div>
                  <div className="agent-row__desc truncate" style={{ marginTop: 2 }}>
                    {i === 0 ? 'Scores inbound leads and drafts outreach.' : i === 1 ? 'Reviews charges and prepares refunds.' : 'Onboards and offboards SaaS access.'}
                  </div>
                  <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 4 }}>
                    agt_{name.toLowerCase().replace(/\s+/g, '_')}
                  </div>
                </div>
                <Status status={i === 2 ? 'paused' : 'active'} />
                <div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text)' }}>{i === 0 ? 'usr_marcelo' : 'usr_priya'}</div>
                  <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 4 }}>{i === 0 ? 'dom_sales' : 'dom_support'}</div>
                </div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{i + 1}d ago</div>
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
          <div className="grid grid--2">
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
          </div>
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
        <div className="page__eyebrow">{eyebrow}</div>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, lineHeight: 1.1, marginBottom: 6 }}>{title}</h2>
        <p className="muted" style={{ maxWidth: 760, fontSize: 13.5 }}>{body}</p>
      </div>
      {children}
    </section>
  )
}

function GuidanceCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="card">
      <div className="card__body">
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--text)', marginBottom: 8 }}>{title}</div>
        <p style={{ color: 'var(--text-muted)', fontSize: 12.5, lineHeight: 1.55 }}>{body}</p>
      </div>
    </div>
  )
}

function ColorToken({
  token,
  dark,
  light,
  usage,
}: {
  token: string
  dark: string
  light: string
  usage: string
}) {
  return (
    <div className="card">
      <div
        style={{
          height: 54,
          borderRadius: 4,
          border: '1px solid var(--border-strong)',
          background: `var(${token})`,
          marginBottom: 12,
        }}
      />
      <div className="card__body" style={{ padding: 0 }}>
        <div className="mono" style={{ fontSize: 12, color: 'var(--text)' }}>{token}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{usage}</div>
        <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 8 }}>
          dark {dark}<br />
          light {light}
        </div>
      </div>
    </div>
  )
}

function TokenRow({ name, value, note }: { name: string; value: string; note: string }) {
  return (
    <div className="row row--between" style={{ alignItems: 'flex-start', borderBottom: '1px dashed var(--border)', paddingBottom: 10 }}>
      <div>
        <div style={{ color: 'var(--text)', fontSize: 13 }}>{name}</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>{note}</div>
      </div>
      <Chip>{value}</Chip>
    </div>
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
        <div className="card__title">{title}</div>
        <Chip tone="info">{radix}</Chip>
      </div>
      <div className="card__body">
        {children}
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  unit,
  delta,
  tone,
}: {
  label: string
  value: string
  unit: string
  delta: string
  tone?: 'warn'
}) {
  return (
    <div className="card card--metric">
      <div className="card__body">
        <div className="metric__label">{label}</div>
        <div className="row" style={{ alignItems: 'baseline', gap: 6 }}>
          <div className="metric__value" style={tone === 'warn' ? { color: 'var(--warn)' } : undefined}>{value}</div>
          <span className="metric__unit">{unit}</span>
        </div>
        <div className="metric__delta">{delta}</div>
      </div>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="row row--between" style={{ padding: '6px 0', borderBottom: '1px dashed var(--border)' }}>
      <span className="mono uppercase muted" style={{ fontSize: 10.5 }}>{label}</span>
      <span className="mono" style={{ fontSize: 12 }}>{value}</span>
    </div>
  )
}

function ChecklistCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="card">
      <div className="card__head">
        <div className="card__title">{title}</div>
        <Avatar initials={title.slice(0, 2).toUpperCase()} size={26} />
      </div>
      <div className="card__body stack stack--sm">
        {items.map(item => (
          <div key={item} className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
            <span style={{ color: 'var(--success)', marginTop: 2 }}><IconCheck className="ic ic--sm" /></span>
            <span style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
