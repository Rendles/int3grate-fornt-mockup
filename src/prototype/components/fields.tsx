import { useId, useState } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import { Flex, IconButton, Select, Text, TextArea, TextField } from '@radix-ui/themes'
import { IconAlert, IconEye, IconEyeOff } from './icons'

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

function FieldLabel({ htmlFor, required, children }: { htmlFor: string; required?: boolean; children: ReactNode }) {
  return (
    <Text as="label" htmlFor={htmlFor} size="1" weight="medium" color="gray">
      {children}
      {required && <Text as="span" color="red"> *</Text>}
    </Text>
  )
}

function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <Text id={id} as="div" size="1" color="red">
      <Flex align="center" gap="1">
        <IconAlert className="ic ic--sm" />
        <span>{children}</span>
      </Flex>
    </Text>
  )
}

function FieldHint({ id, children }: { id: string; children: ReactNode }) {
  return (
    <Text id={id} as="div" size="1" color="gray">
      {children}
    </Text>
  )
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
    <Flex direction="column" gap="1">
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
    </Flex>
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
    <Flex direction="column" gap="1">
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
    </Flex>
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
    <Flex direction="column" gap="1">
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
    </Flex>
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
}: FieldChromeProps & {
  value: string | undefined
  onChange: (value: string) => void
  placeholder?: string
  options: SelectOption[]
  disabled?: boolean
  size?: '1' | '2' | '3'
}) {
  const { id, errId, hintId } = useFieldIds(idProp)
  return (
    <Flex direction="column" gap="1">
      {label && <FieldLabel htmlFor={id} required={required}>{label}</FieldLabel>}
      <Select.Root value={value} onValueChange={onChange} disabled={disabled} size={size}>
        <Select.Trigger
          id={id}
          placeholder={placeholder}
          color={error ? 'red' : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : hint ? hintId : undefined}
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
    </Flex>
  )
}
