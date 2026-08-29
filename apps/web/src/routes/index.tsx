import { HomePage } from '@hookfish/app'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  ssr: false,
  component: HomePage,
})
