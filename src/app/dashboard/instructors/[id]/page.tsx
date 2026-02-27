// Server Component — pre-fetches instructor data, classes, payments and settings
import { notFound } from "next/navigation"
import prisma from "@/lib/prisma"
import { getInstructorPayments } from "@/actions/instructors"
import { getSettings } from "@/actions/settings"
import { InstructorDetailClient } from "./InstructorDetailClient"
import { Tier } from "@/constants/config"

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function InstructorDetailPage({ params }: PageProps) {
    const { id } = await params

    // Fetch in parallel
    const [instructor, classes, payments, settings] = await Promise.all([
        prisma.user.findUnique({ where: { id, role: 'INSTRUCTOR' } }),
        prisma.classSession.findMany({
            where: { instructorId: id },
            include: { attendees: true },
            orderBy: { date: 'asc' }
        }),
        getInstructorPayments(id),
        getSettings(),
    ])

    if (!instructor) notFound()

    return (
        <InstructorDetailClient
            instructor={{
                id: instructor.id,
                name: instructor.name,
                email: instructor.email ?? "",
                phone: instructor.phone ?? "",
                bio: instructor.bio ?? "",
                specialties: instructor.specialties ?? [],
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            classes={classes as any[]}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            payments={payments as any[]}
            disciplineRates={settings?.disciplineRates as Record<string, { privateRate: number; rates: Tier[] }> | null}
        />
    )
}
