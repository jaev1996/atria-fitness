"use server"

import prisma from "@/lib/prisma"
import { ensureRole } from "@/lib/auth-utils"

// ── Helpers ────────────────────────────────────────────
const toUTCDateStr = (d: Date) =>
    `${d.getUTCFullYear()}-${(d.getUTCMonth() + 1).toString().padStart(2, "0")}-${d.getUTCDate().toString().padStart(2, "0")}`

// ── Dashboard Summary ──────────────────────────────────
export async function getDashboardMetrics(instructorId?: string) {
    await ensureRole(['admin', 'instructor'])
    const now = new Date()

    // Today UTC range
    const todayStart = new Date(`${toUTCDateStr(now)}T00:00:00.000Z`)
    const todayEnd = new Date(`${toUTCDateStr(now)}T23:59:59.999Z`)

    const whereBase = instructorId ? { instructorId } : {}

    // Classes today (non-cancelled)
    const classesToday = await prisma.classSession.findMany({
        where: {
            ...whereBase,
            date: { gte: todayStart, lte: todayEnd },
            status: { not: "CANCELLED" },
        },
        include: {
            attendees: { where: { status: "BOOKED" } },
            instructor: { select: { name: true } },
        },
    })

    // Pending
    const countPending = await prisma.classSession.count({
        where: {
            ...whereBase,
            status: { in: ["SCHEDULED", "CONFIRMED", "RESCHEDULED"] },
        },
    })

    // Completed all-time
    const countCompleted = await prisma.classSession.count({
        where: { ...whereBase, status: "COMPLETED" },
    })

    // Total students (only for admin)
    const totalStudents = instructorId
        ? null
        : await prisma.user.count({ where: { role: "STUDENT", status: "ACTIVE" } })

    // Upcoming (next 5)
    const upcoming = await prisma.classSession.findMany({
        where: {
            ...whereBase,
            date: { gte: todayStart },
            status: { in: ["SCHEDULED", "CONFIRMED", "RESCHEDULED"] },
        },
        include: {
            instructor: { select: { name: true } },
            attendees: { where: { status: "BOOKED" } },
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        take: 5,
    })

    return {
        todayCount: classesToday.length,
        todayAttendances: classesToday.reduce((acc, c) => acc + c.attendees.length, 0),
        pendingCount: countPending,
        completedCount: countCompleted,
        totalStudents,
        upcoming: upcoming.map((c) => ({
            id: c.id,
            type: c.type,
            room: c.room,
            date: toUTCDateStr(c.date),
            startTime: c.startTime,
            instructorName: c.instructor.name,
            attendeesCount: c.attendees.length,
            maxCapacity: c.maxCapacity,
        })),
    }
}

// ── Stats / Reports ─────────────────────────────────────
export async function getMonthlyStats(year: number, month: number) {
    await ensureRole(['admin'])
    const startDate = new Date(Date.UTC(year, month - 1, 1))
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))

    const classes = await prisma.classSession.findMany({
        where: {
            date: { gte: startDate, lte: endDate },
            status: { not: "CANCELLED" },
        },
        include: {
            instructor: { select: { id: true, name: true } },
            attendees: { where: { status: "BOOKED" } },
        },
        orderBy: { date: "asc" },
    })

    const totalClasses = classes.length
    const totalAttendances = classes.reduce((acc, c) => acc + c.attendees.length, 0)
    const totalCapacity = classes.reduce((acc, c) => acc + c.maxCapacity, 0)
    const occupancyPct = totalCapacity > 0 ? Math.round((totalAttendances / totalCapacity) * 100) : 0

    // Classes per instructor
    const instructorMap: Record<string, { name: string; count: number }> = {}
    classes.forEach((c) => {
        const key = c.instructor.id
        if (!instructorMap[key]) instructorMap[key] = { name: c.instructor.name, count: 0 }
        instructorMap[key].count += 1
    })
    const instructorData = Object.values(instructorMap)
        .map(({ name, count }) => ({ name, value: count }))
        .sort((a, b) => b.value - a.value)

    // Discipline popularity (by # attendees)
    const disciplineMap: Record<string, number> = {}
    classes.forEach((c) => {
        disciplineMap[c.type] = (disciplineMap[c.type] || 0) + c.attendees.length
    })
    const popularityData = Object.entries(disciplineMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
    const topDiscipline = popularityData[0]?.name || "N/A"

    // Top students by attendance (join on studentId)
    const studentMap: Record<string, { name: string; count: number }> = {}
    const allAttendeeIds = classes.flatMap((c) => c.attendees.map((a) => a.studentId))
    const uniqueIds = [...new Set(allAttendeeIds)]

    const studentNames = await prisma.user.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true, name: true },
    })
    const nameById: Record<string, string> = {}
    studentNames.forEach((s) => { nameById[s.id] = s.name })

    classes.forEach((c) => {
        c.attendees.forEach((a) => {
            const name = nameById[a.studentId] || "Desconocida"
            if (!studentMap[a.studentId]) studentMap[a.studentId] = { name, count: 0 }
            studentMap[a.studentId].count += 1
        })
    })
    const topStudents = Object.values(studentMap)
        .map(({ name, count }) => ({ name, clases: count }))
        .sort((a, b) => b.clases - a.clases)
        .slice(0, 10)

    // Classes per day of month (for bar chart)
    const dailyMap: Record<string, number> = {}
    classes.forEach((c) => {
        const day = toUTCDateStr(c.date).split("-")[2] // "01" .. "31"
        dailyMap[day] = (dailyMap[day] || 0) + 1
    })
    const dailyData = Object.entries(dailyMap)
        .map(([day, count]) => ({ day: `${parseInt(day)}`, value: count }))
        .sort((a, b) => parseInt(a.day) - parseInt(b.day))

    return {
        totalClasses,
        totalAttendances,
        occupancyPct,
        topDiscipline,
        instructorData,
        popularityData,
        topStudents,
        dailyData,
    }
}
