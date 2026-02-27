import { getSettings } from "@/actions/settings"
import { SettingsClient } from "./SettingsClient"
import { Tier } from "@/constants/config"

export default async function SettingsPage() {
    const settings = await getSettings()

    return <SettingsClient initialSettings={settings ? {
        disciplineRates: settings.disciplineRates as Record<string, { privateRate: number; rates: Tier[] }> | null,
        roomDisciplines: settings.roomDisciplines as Record<string, string[]> | null,
    } : null} />
}
