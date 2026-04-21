import { useId, useState } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import { Flex, IconButton, Select, Text, TextArea, TextField } from '@radix-ui/themes'
import { IconAlert, IconEye, IconEyeOff } from './icons'

export function FieldLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor?: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <Text
      as="label"
      htmlFor={htmlFor}
      size="1"
      weight="medium"
      color="gray"
      mb="1"
      style={{ display: 'block' }}
    >
      {children}
      {required && <span style={{ color: 'var(--red-11)' }}> *</span>}
    </Text>
  )
}

export function FieldHint({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <Text id={id} as="div" size="1" color="gray" mt="1">
      {children}
    </Text>
  )
}

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <Flex id={id} align="center" gap="1" mt="1">
      <IconAlert className="ic ic--sm" style={{ color: 'var(--red-11)' }} />
      <Text size="1" color="red">{children}</Text>
    </Flex>
  )
}

type FieldChromeProps = {
  id?: string
  label?: string
  hint?: ReactNode
  error?: string
  required?: boolean
}

function useFieldIds(idProp: string | undefined) {
  const autoId = useId()
  const id = idProp ?? autoId
  return { id, errId: `${id}-err`, hintId: `${id}-hint` }
}

type TextInputOwnProps = ComponentProps<typeof TextField.Root>

export function TextInput({
  label,
  hint,
  error,
  required,
  id: idProp,
  ...inputProps
}: FieldChromeProps & TextInputOwnProps) {
  const { id, errId, hintId } = useFieldIds(idProp)
  return (
    <div>
      {label && <FieldLabel htmlFor={id} required={required}>{label}</FieldLabel>}
      <TextField.Root
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errId : hint ? hintId : undefined}
        color={error ? 'red' : undefined}
        {...inputProps}
      />
      {error && <FieldError id={errId}>{error}</FieldError>}
      {!error && hint && <FieldHint id={hintId}>{hint}</FieldHint>}
    </div>
  )
}

type PasswordFieldOwnProps = Omit<ComponentProps<typeof TextField.Root>, 'type'>

export function PasswordField({
  label,
  hint,
  error,
  required,
  id: idProp,
  ...inputProps
}: FieldChromeProps & PasswordFieldOwnProps) {
  const { id, errId, hintId } = useFieldIds(idProp)
  const [visible, setVisible] = useState(false)
  return (
    <div>
      {label && <FieldLabel htmlFor={id} required={required}>{label}</FieldLabel>}
      <TextField.Root
        id={id}
        type={visible ? 'text' : 'password'}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errId : hint ? hintId : undefined}
        color={error ? 'red' : undefined}
        {...inputProps}
      >
        <TextField.Slot side="right">
          <IconButton
            type="button"
            size="1"
            variant="ghost"
            color="gray"
            onClick={() => setVisible(v => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
          >
            {visible ? <IconEyeOff className="ic" /> : <IconEye className="ic" />}
          </IconButton>
        </TextField.Slot>
      </TextField.Root>
      {error && <FieldError id={errId}>{error}</FieldError>}
      {!error && hint && <FieldHint id={hintId}>{hint}</FieldHint>}
    </div>
  )
}

type TextAreaFieldOwnProps = ComponentProps<typeof TextArea>

export function TextAreaField({
  label,
  hint,
  error,
  required,
  id: idProp,
  ...textareaProps
}: FieldChromeProps & TextAreaFieldOwnProps) {
  const { id, errId, hintId } = useFieldIds(idProp)
  return (
    <div>
      {label && <FieldLabel htmlFor={id} required={required}>{label}</FieldLabel>}
      <TextArea
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errId : hint ? hintId : undefined}
        color={error ? 'red' : undefined}
        {...textareaProps}
      />
      {error && <FieldError id={errId}>{error}</FieldError>}
      {!error && hint && <FieldHint id={hintId}>{hint}</FieldHint>}
    </div>
  )
}

export interface SelectOption {
  value: string
  label?: ReactNode
  disabled?: boolean
}

export function SelectField({
  label,
  hint,
  error,
  required,
  id: idProp,
  value,
  onChange,
  placeholder,
  options,
  disabled,
  size,
  triggerStyle,
}: FieldChromeProps & {
  value: string | undefined
  onChange: (value: string) => void
  placeholder?: string
  options: SelectOption[]
  disabled?: boolean
  size?: '1' | '2' | '3'
  triggerStyle?: React.CSSProperties
}) {
  const { id, errId, hintId } = useFieldIds(idProp)
  return (
    <div>
      {label && <FieldLabel htmlFor={id} required={required}>{label}</FieldLabel>}
      <Select.Root value={value} onValueChange={onChange} disabled={disabled} size={size}>
        <Select.Trigger
          id={id}
          placeholder={placeholder}
          color={error ? 'red' : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : hint ? hintId : undefined}
          style={triggerStyle}
        />
        <Select.Content>
          {options.map(opt => (
            <Select.Item key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label ?? opt.value}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
      {error && <FieldError id={errId}>{error}</FieldError>}
      {!error && hint && <FieldHint id={hintId}>{hint}</FieldHint>}
    </div>
  )
}
