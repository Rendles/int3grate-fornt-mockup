import type { ReactNode } from 'react'
import { Button, IconButton } from '@radix-ui/themes'

export function Btn({
  children,
  variant = 'default',
  size,
  disabled,
  onClick,
  href,
  icon,
  title,
  type = 'button',
}: {
  children?: ReactNode
  variant?: 'default' | 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'lg'
  disabled?: boolean
  onClick?: () => void
  href?: string
  icon?: ReactNode
  title?: string
  type?: 'button' | 'submit'
}) {
  const radixVariant = variant === 'primary' || variant === 'danger'
    ? 'solid'
    : variant === 'ghost'
      ? 'ghost'
      : 'surface'
  const radixSize = size === 'sm' ? '1' : size === 'lg' ? '3' : '2'
  const color = variant === 'danger' ? 'red' : undefined
  const isIconOnly = !children && icon
  const content = (
    <>
      {icon}
      {children}
    </>
  )
  if (href) {
    const anchor = (
      <a href={`#${href}`} title={title}>
        {content}
      </a>
    )
    if (isIconOnly) {
      return (
        <IconButton
          asChild
          variant={radixVariant}
          size={radixSize}
          color={color}
          disabled={disabled}
          title={title}
          aria-label={title}
        >
          {anchor}
        </IconButton>
      )
    }
    return (
      <Button
        asChild
        variant={radixVariant}
        size={radixSize}
        color={color}
        disabled={disabled}
        title={title}
      >
        {anchor}
      </Button>
    )
  }

  if (isIconOnly) {
    return (
      <IconButton
        variant={radixVariant}
        size={radixSize}
        color={color}
        type={type}
        onClick={onClick}
        disabled={disabled}
        title={title}
        aria-label={title}
      >
        {icon}
      </IconButton>
    )
  }

  return (
    <Button
      variant={radixVariant}
      size={radixSize}
      color={color}
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {content}
    </Button>
  )
}
