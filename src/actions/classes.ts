"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { ClassSession, Prisma } from "@prisma/client"
import { ensureRole } from "@/lib/auth-utils"
import { AddClassSchema, EnrollStudentSchema, RemoveAttendeeSchema } from "@/lib/schemas"

export async function getClasses(startDateStr?: string, endDateStr?: string, instructorId?: string) {
    const where: Prisma.ClassSessionWhereInput = {}
    if (startDateStr && endDateStr) {
        where.date = {
            gte: new Date(`${startDateStr}T00:00:00.000Z`),
            lte: new Date(`${endDateStr}T23:59:59.999Z`)
        }
    }
    if (instructorId) {
        where.instructorId = instructorId
    }

    return await prisma.classSession.findMany({
        where,
        include: {
            attendees: {
                include: { student: true }
            },
            instructor: true
        },
        orderBy: { date: 'asc' }
    })
}

export async function addClass(data: {
    instructorId: string,
    date: string,
    startTime: string,
    type: string,
    room: string,
    maxCapacity: number,
    notes?: string,
    isPrivate?: boolean
}) {
    await ensureRole(['admin'])
    const parsed = AddClassSchema.parse(data)
    // Use a robust UTC midnight constructor: "YYYY-MM-DD" -> "YYYY-MM-DDT00:00:00.000Z"
    const classDate = new Date(`${parsed.date}T00:00:00.000Z`)

    const [h, m] = parsed.startTime.split(':').map(Number)
    const endH = h + 1
    const endTime = `${endH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`

    // Unified Collision Check: Instructor and Room
    const dayClasses = await prisma.classSession.findMany({
        where: {
            date: classDate,
            status: { not: 'CANCELLED' },
            OR: [
                { instructorId: parsed.instructorId },
                { room: parsed.room }
            ]
        }
    })

    const [sh, sm] = parsed.startTime.split(':').map(Number)
    const newStart = sh * 60 + sm
    const newEnd = newStart + 60

    for (const c of dayClasses) {
        const [ch, cm] = c.startTime.split(':').map(Number)
        const cStart = ch * 60 + cm
        const cEnd = cStart + 60

        const overlaps = Math.max(newStart, cStart) < Math.min(newEnd, cEnd)
        if (overlaps) {
            if (c.instructorId === parsed.instructorId) {
                throw new Error(`El instructor ya tiene una clase de ${c.startTime} a ${c.endTime}.`)
            }
            if (c.room === parsed.room) {
                throw new Error(`La sala ya está ocupada de ${c.startTime} a ${c.endTime}.`)
            }
        }
    }

    const newClass = await prisma.classSession.create({
        data: {
            ...parsed,
            date: classDate,
            endTime,
            status: 'SCHEDULED'
        }
    })

    revalidatePath('/dashboard/calendar')
    return newClass
}

export async function updateClass(id: string, data: Partial<ClassSession>) {
    const user = await ensureRole(['admin'])
    const classId = id
    const existing = await prisma.classSession.findUnique({ where: { id } })
    if (!existing) throw new Error("Clase no encontrada")

    const role = (user.app_metadata?.role || user.user_metadata?.role || 'student').toLowerCase()
    if (role === 'instructor' && existing.instructorId !== user.id) {
        throw new Error("No tienes permiso para modificar clases de otros instructores")
    }

    const classDate = data.date ? new Date(`${data.date}T00:00:00.000Z`) : undefined

    // Check for collisions if time/instructor/room changed
    if (data.startTime || data.instructorId || data.room || classDate) {
        const checkDate = classDate || existing.date
        const checkTime = data.startTime || existing.startTime
        const checkInstructor = data.instructorId || existing.instructorId
        const checkRoom = data.room || existing.room

        const dayClasses = await prisma.classSession.findMany({
            where: {
                id: { not: classId },
                date: checkDate,
                status: { not: 'CANCELLED' },
                OR: [
                    { instructorId: checkInstructor },
                    { room: checkRoom }
                ]
            }
        })

        const [uh, um] = checkTime.split(':').map(Number)
        const newStart = uh * 60 + um
        const newEnd = newStart + 60

        for (const c of dayClasses) {
            const [ch, cm] = c.startTime.split(':').map(Number)
            const cStart = ch * 60 + cm
            const cEnd = cStart + 60

            const overlaps = Math.max(newStart, cStart) < Math.min(newEnd, cEnd)
            if (overlaps) {
                if (c.instructorId === checkInstructor) {
                    throw new Error(`El instructor ya tiene una clase de ${c.startTime} a ${c.endTime}.`)
                }
                if (c.room === checkRoom) {
                    throw new Error(`La sala ya está ocupada de ${c.startTime} a ${c.endTime}.`)
                }
            }
        }
    }

    const updated = await prisma.classSession.update({
        where: { id },
        data: {
            ...data,
            date: classDate
        }
    })

    // Check for completion logic (deduct credits)
    if (data.status === 'COMPLETED' && existing?.status !== 'COMPLETED') {
        await handleClassCompletion(id)
    }

    revalidatePath('/dashboard/calendar')
    return updated
}

async function handleClassCompletion(classId: string) {
    const classData = await prisma.classSession.findUnique({
        where: { id: classId },
        include: {
            attendees: {
                where: { status: 'BOOKED', creditDeducted: false, attendanceType: 'STANDARD' }
            },
            instructor: true
        }
    })

    if (!classData || !classData.instructor) return

    for (const attendee of classData.attendees) {
        const student = await prisma.user.findUnique({
            where: { id: attendee.studentId },
            include: { plans: { where: { isActive: true } } }
        })

        if (!student) continue

        // Find valid plan
        const plan = student.plans.find(p =>
            p.discipline === classData.type || p.discipline === 'General'
        )

        if (plan && plan.credits > 0) {
            await prisma.$transaction([
                prisma.studentPlan.update({
                    where: { id: plan.id },
                    data: {
                        credits: plan.originalName === 'Ilimitado' ? plan.credits : plan.credits - 1,
                        isActive: plan.originalName !== 'Ilimitado' && plan.credits - 1 <= 0 ? false : true
                    }
                }),
                prisma.attendee.update({
                    where: { id: attendee.id },
                    data: { creditDeducted: true }
                }),
                prisma.studentHistory.create({
                    data: {
                        studentId: student.id,
                        activity: `Clase Completada: ${classData.type}`,
                        notes: `Instructor: ${classData.instructor.name}`,
                        cost: 0
                    }
                })
            ])
        }
    }
}

export async function deleteClass(id: string) {
    await ensureRole(['admin'])
    await prisma.classSession.delete({ where: { id } })
    revalidatePath('/dashboard/calendar')
}

// Enrollment
export async function enrollStudent(classId: string, studentId: string, type: 'STANDARD' | 'COURTESY' = 'STANDARD') {
    const user = await ensureRole(['admin'])
    EnrollStudentSchema.parse({ classId, studentId, type })

    const classData = await prisma.classSession.findUnique({
        where: { id: classId },
        include: { attendees: { where: { status: 'BOOKED' } } }
    })

    if (!classData) throw new Error("Clase no encontrada")

    const role = (user.app_metadata?.role || user.user_metadata?.role || 'student').toLowerCase()
    if (role === 'instructor' && classData.instructorId !== user.id) {
        throw new Error("No puedes inscribir alumnos en clases de otros instructores")
    }
    if (classData.attendees.length >= classData.maxCapacity) throw new Error("Clase llena")

    // Check if student is already enrolled in THIS class
    if (classData.attendees.some(a => a.studentId === studentId)) {
        throw new Error("La alumna ya está inscrita en esta clase")
    }

    // ── Business rule 1: Student schedule collision ────────────────────────
    // A student cannot be in two classes at the same date/time (even in different rooms)
    const concurrentClasses = await prisma.classSession.findMany({
        where: {
            id: { not: classId },
            date: classData.date,
            startTime: classData.startTime,
            status: { not: 'CANCELLED' }
        },
        select: { id: true }
    })
    if (concurrentClasses.length > 0) {
        const conflict = await prisma.attendee.findFirst({
            where: {
                classId: { in: concurrentClasses.map(c => c.id) },
                studentId,
                status: 'BOOKED'
            }
        })
        if (conflict) {
            throw new Error("La alumna ya tiene una clase programada a esta misma hora en otro salón")
        }
    }
    // ────────────────────────────────────────────────────────────────────────

    // ── Business rule 2: Active plan with available credits ─────────────────
    // COURTESY enrollments bypass this check intentionally
    if (type === 'STANDARD') {
        const student = await prisma.user.findUnique({
            where: { id: studentId },
            include: {
                plans: {
                    where: { isActive: true, credits: { gt: 0 } }
                }
            }
        })
        if (!student) throw new Error("Alumna no encontrada")

        const hasValidPlan = student.plans.some(p =>
            p.discipline === classData.type || p.discipline === 'General'
        )
        if (!hasValidPlan) {
            throw new Error(
                `La alumna no tiene un plan activo con créditos disponibles para "${classData.type}". Usa la inscripción de Cortesía si corresponde.`
            )
        }
    }
    // ────────────────────────────────────────────────────────────────────────

    try {
        const enrollment = await prisma.attendee.create({
            data: {
                classId,
                studentId,
                attendanceType: type,
                status: 'BOOKED'
            },
            include: { student: true }
        })
        revalidatePath('/dashboard/calendar')
        return enrollment
    } catch (err) {
        // Catch DB-level unique constraint violation (last resort)
        if (err instanceof Error && 'code' in err && (err as { code: string }).code === 'P2002') {
            throw new Error("La alumna ya está inscrita en esta clase")
        }
        throw err
    }
}

export async function removeAttendee(classId: string, studentId: string) {
    const user = await ensureRole(['admin'])
    RemoveAttendeeSchema.parse({ classId, studentId })

    const classData = await prisma.classSession.findUnique({
        where: { id: classId }
    })

    if (!classData) throw new Error("Clase no encontrada")

    const role = (user.app_metadata?.role || user.user_metadata?.role || 'student').toLowerCase()
    if (role === 'instructor' && classData.instructorId !== user.id) {
        throw new Error("No puedes remover alumnos de clases de otros instructores")
    }
    await prisma.attendee.deleteMany({
        where: {
            classId,
            studentId
        }
    })
    revalidatePath('/dashboard/calendar')
}
