import type { ReactNode } from 'react'
import { Box, Flex, Heading, Text } from '@radix-ui/themes'

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <Flex
      asChild
      justify="between"
      align={{ initial: 'start', sm: 'end' }}
      direction={{ initial: 'column', sm: 'row' }}
      gap={{ initial: '3', sm: '5' }}
      pb="0"
      mb="5"
    >
      <header>
        <Box minWidth="0" flexGrow="1">
          {eyebrow && (
            <Text
              as="div"
              size="1"
              color="gray"
              mb="2"
              style={{ textTransform: 'uppercase', letterSpacing: '0.18em' }}
            >
              {eyebrow}
            </Text>
          )}
          {/* Title: <em> inside the heading receives accent styling via global .page__title em rule */}
          <Heading as="h1" size="8" weight="regular" className="page__title">
            {title}
          </Heading>
          {subtitle && (
            <Text
              as="p"
              size="2"
              mt="2"
              style={{ maxWidth: 640, color: 'var(--gray-10)' }}
            >
              {subtitle}
            </Text>
          )}
        </Box>
        {actions && (
          <Flex gap="2" align="center" wrap="wrap">
            {actions}
          </Flex>
        )}
      </header>
    </Flex>
  )
}
