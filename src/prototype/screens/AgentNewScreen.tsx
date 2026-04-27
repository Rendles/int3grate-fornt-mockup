import { useState } from 'react'
import { Badge, Box, Button, Code, Flex, Grid, Separator, Text } from '@radix-ui/themes'

import { AppShell } from '../components/shell'
import { PageHeader, InfoHint } from '../components/common'
import { SelectField, TextAreaField, TextInput } from '../components/fields'
import { Banner, NoAccessState } from '../components/states'
import { useRouter } from '../router'
import { useAuth } from '../auth'
import { api } from '../lib/api'

const DOMAINS = [
  { id: 'dom_hq', name: 'HQ · Platform' },
  { id: 'dom_sales', name: 'Sales · Revenue' },
  { id: 'dom_support', name: 'Support · CX' },
]

export default function AgentNewScreen() {
  const { navigate } = useRouter()
  const { user } = useAuth()

  const isMember = user?.role === 'member'
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [domainId, setDomainId] = useState<string>(user?.domain_id ?? 'dom_hq')
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [success, setSuccess] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const nameError = !name.trim() ? 'Required' : name.trim().length < 3 ? 'Use at least 3 characters' : undefined
  const nameErrVisible = submitted && nameError ? nameError : undefined

  if (isMember) {
    return (
      <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'agents', to: '/agents' }, { label: 'new' }]}>
        <div className="page page--narrow">
          <PageHeader eyebrow="CREATE AGENT" title={<>Admins only</>} />
          <NoAccessState
            requiredRole="domain_admin or admin"
            body="Creating agents is restricted to admins."
          />
          <Flex justify="center" mt="3">
            <Button asChild variant="ghost"><a href="#/agents">Back to agents</a></Button>
          </Flex>
        </div>
      </AppShell>
    )
  }

  const submit = async () => {
    setSubmitted(true)
    if (nameError) return
    setBusy(true)
    setErr(null)
    try {
      const a = await api.createAgent({
        name: name.trim(),
        description: desc.trim() || undefined,
        domain_id: domainId,
      })
      setSuccess(true)
      setTimeout(() => navigate(`/agents/${a.id}`), 600)
    } catch (e) {
      setErr((e as Error).message ?? 'Could not create agent')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell crumbs={[{ label: 'home', to: '/' }, { label: 'agents', to: '/agents' }, { label: 'new' }]}>
      <div className="page page--narrow">
        <PageHeader
          eyebrow={
            <>
              CREATE AGENT{' '}
              <InfoHint>
                <Code variant="ghost">POST /agents</Code> accepts <Code variant="ghost">name</Code>, <Code variant="ghost">description</Code>, and <Code variant="ghost">domain_id</Code>. Owner is inferred from the caller.
              </InfoHint>
            </>
          }
          title={<>New <em>agent.</em></>}
          subtitle="Name, description, domain. Owner is inferred from you."
          actions={
            <>
              <Button asChild variant="soft" disabled={busy} color='gray'><a href="#/agents">Cancel</a></Button>
              <Button onClick={submit} disabled={busy || success}>
                {busy ? 'creating…' : success ? 'created ✓' : 'Create draft'}
              </Button>
            </>
          }
        />

        {success && (
          <Banner tone="info" title="Agent created · redirecting">
            The new agent is in <Badge color="gray" variant="soft" radius="full" size="1">draft</Badge>. Next step is creating its first version.
          </Banner>
        )}

        {err && (
          <Banner tone="warn" title="Couldn't create agent">
            {err}
          </Banner>
        )}

        <div style={{ height: 20 }} />

        <div className="card">
          <div className="card__body">
            <Grid columns={{ initial: '1', md: '240px 1fr' }} gap="5" py="5">
              <Box>
                <Text as="div" size="2" weight="medium">Name <Text as="span" color="red">*</Text></Text>
                <Text as="div" size="1" color="gray" mt="1">1–200 characters. Shown everywhere.</Text>
              </Box>
              <Box>
                <TextInput
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onBlur={() => setSubmitted(true)}
                  placeholder="Lead Qualifier"
                  maxLength={200}
                  error={nameErrVisible}
                />
              </Box>
            </Grid>
            <Separator size="4" />
            <Grid columns={{ initial: '1', md: '240px 1fr' }} gap="5" py="5">
              <Box>
                <Text as="div" size="2" weight="medium">Description</Text>
                <Text as="div" size="1" color="gray" mt="1">Optional. One-line summary.</Text>
              </Box>
              <Box>
                <TextAreaField
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  placeholder="Triages inbound leads and drafts personalised outreach."
                />
              </Box>
            </Grid>
            <Separator size="4" />
            <Grid columns={{ initial: '1', md: '240px 1fr' }} gap="5" py="5">
              <Box>
                <Text as="div" size="2" weight="medium">Domain</Text>
                <Text as="div" size="1" color="gray" mt="1">
                  Scope to a domain (nullable for tenant-wide).
                </Text>
              </Box>
              <Box>
                <SelectField
                  value={domainId}
                  onChange={setDomainId}
                  options={DOMAINS.map(d => ({ value: d.id, label: d.name }))}
                />
              </Box>
            </Grid>
          </div>
        </div>

      </div>
    </AppShell>
  )
}
