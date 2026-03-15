import { getSettings } from "@/actions/settings"
import { CurrencyProvider } from "@/components/providers/CurrencyProvider"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const settings = await getSettings()
  const currency = settings?.currency || "$"

  return (
    <CurrencyProvider currency={currency}>
      {children}
    </CurrencyProvider>
  )
}
