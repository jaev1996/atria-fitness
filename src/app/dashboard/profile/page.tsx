// Server Component — fetches instructor profile & payments before render.
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import prisma from "@/lib/prisma"
import { getInstructorPayments } from "@/actions/instructors"
import { getSettings } from "@/actions/settings"
import { ProfileClient } from "./ProfileClient"

export default async function ProfilePage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect("/login")

    const rawRole = user.app_metadata?.role || user.user_metadata?.role
    const role = (rawRole ? String(rawRole).toLowerCase() : "admin") as "admin" | "instructor" | "student"

    // Fetch data in parallel
    const [dbUser, settings] = await Promise.all([
        prisma.user.findUnique({ where: { id: user.id } }),
        getSettings(),
    ])

    // Instructor-only: fetch classes + payments
    let instructorClasses: object[] = []
    let instructorPayments: object[] = []
    if (role === "instructor") {
        const [classes, payments] = await Promise.all([
            prisma.classSession.findMany({
                where: { instructorId: user.id },
                include: { attendees: true },
                orderBy: { date: 'asc' }
            }),
            getInstructorPayments(user.id)
        ])
        instructorClasses = classes
        instructorPayments = payments
    }

    return (
        <ProfileClient
            userId={user.id}
            role={role}
            profile={{
                name: dbUser?.name || user.user_metadata?.name || "Administrador",
                email: dbUser?.email || user.email || "",
                phone: dbUser?.phone || "",
                bio: dbUser?.bio || "",
                specialties: dbUser?.specialties || [],
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            instructorClasses={instructorClasses as any[]}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            instructorPayments={instructorPayments as any[]}
            disciplineRates={settings?.disciplineRates as Record<string, { privateRate: number; rates: { min: number; max: number | null; price: number }[] }> | null}
        />
    )
}
