// Server Component — fetches all data in parallel before rendering.
// The client sub-component receives it as initial props → zero loading flash.

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getClasses } from "@/actions/classes"
import { getStudentsSummary } from "@/actions/students"
import { getInstructors } from "@/actions/instructors"
import { getSettings } from "@/actions/settings"
import { CalendarClient } from "./CalendarClient"
import { User } from "@prisma/client"

const toYYYYMMDD = (date: Date) =>
    `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`

export default async function CalendarPage() {
    // ── Auth ──────────────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect("/login")

    const rawRole = user.app_metadata?.role || user.user_metadata?.role
    const role = (rawRole ? String(rawRole).toLowerCase() : "admin") as "admin" | "instructor" | "student"
    const userId = user.id

    // ── Current week range ────────────────────────────────────────────────
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1)
    const weekStart = new Date(today)
    weekStart.setDate(diff)
    weekStart.setHours(0, 0, 0, 0)

    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)

    const startStr = toYYYYMMDD(weekStart)
    const endStr = toYYYYMMDD(weekEnd)

    // ── Parallel data fetch ───────────────────────────────────────────────
    const [initialClasses, initialStudents, initialInstructors, initialSettings] = await Promise.all([
        getClasses(startStr, endStr, role === "instructor" ? userId : undefined),
        role === "admin" ? getStudentsSummary() : Promise.resolve([]),
        role === "admin" ? getInstructors() : Promise.resolve([]),
        getSettings(),
    ])

    return (
        <CalendarClient
            initialClasses={initialClasses as Parameters<typeof CalendarClient>[0]["initialClasses"]}
            initialStudents={initialStudents}
            initialInstructors={initialInstructors as User[]}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            initialSettings={initialSettings as any}
            initialRole={role}
            initialUserId={userId}
        />
    )
}
