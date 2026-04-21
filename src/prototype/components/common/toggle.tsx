import { Switch, Text } from '@radix-ui/themes'

export function Toggle({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean
  onChange?: (v: boolean) => void
  label?: string
  disabled?: boolean
}) {
  const control = (
    <Switch
      checked={on}
      disabled={disabled}
      onCheckedChange={v => onChange?.(v)}
      size="1"
    />
  )
  if (!label) return control
  return (
    <Text as="label" size="2" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: disabled ? 'not-allowed' : 'pointer' }}>
      {control}
      <span>{label}</span>
    </Text>
  )
}
