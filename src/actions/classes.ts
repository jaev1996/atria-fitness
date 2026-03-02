"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { ClassSession, Prisma } from "@prisma/client"

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
    // Use a robust UTC midnight constructor: "YYYY-MM-DD" -> "YYYY-MM-DDT00:00:00.000Z"
    const classDate = new Date(`${data.date}T00:00:00.000Z`)

    const [h, m] = data.startTime.split(':').map(Number)
    const endH = h + 1
    const endTime = `${endH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`

    // Collision Check: Instructor
    const instructorCollision = await prisma.classSession.findFirst({
        where: {
            instructorId: data.instructorId,
            date: classDate,
            startTime: data.startTime,
            status: { not: 'CANCELLED' }
        }
    })
    if (instructorCollision) throw new Error("El instructor ya tiene una clase a esta hora.")

    // Collision Check: Room
    const roomCollision = await prisma.classSession.findFirst({
        where: {
            room: data.room,
            date: classDate,
            startTime: data.startTime,
            status: { not: 'CANCELLED' }
        }
    })
    if (roomCollision) throw new Error("La sala ya está ocupada a esta hora.")

    const newClass = await prisma.classSession.create({
        data: {
            ...data,
            date: classDate,
            endTime,
            status: 'SCHEDULED'
        }
    })

    revalidatePath('/dashboard/calendar')
    return newClass
}

export async function updateClass(id: string, data: Partial<ClassSession>) {
    const classId = id
    const existing = await prisma.classSession.findUnique({ where: { id } })
    if (!existing) throw new Error("Clase no encontrada")

    const classDate = data.date ? new Date(`${data.date}T00:00:00.000Z`) : undefined

    // Check for collisions if time/instructor/room changed
    if (data.startTime || data.instructorId || data.room || classDate) {
        const checkDate = classDate || existing.date
        const checkTime = data.startTime || existing.startTime
        const checkInstructor = data.instructorId || existing.instructorId
        const checkRoom = data.room || existing.room

        // Instructor collision
        const instructorCollision = await prisma.classSession.findFirst({
            where: {
                id: { not: classId },
                instructorId: checkInstructor,
                date: checkDate,
                startTime: checkTime,
                status: { not: 'CANCELLED' }
            }
        })
        if (instructorCollision) throw new Error("El instructor ya tiene una clase a esta hora.")

        // Room collision
        const roomCollision = await prisma.classSession.findFirst({
            where: {
                id: { not: classId },
                room: checkRoom,
                date: checkDate,
                startTime: checkTime,
                status: { not: 'CANCELLED' }
            }
        })
        if (roomCollision) throw new Error("La sala ya está ocupada a esta hora.")
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
            }
        }
    })

    if (!classData) return

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
                        notes: `Instructor: (ID: ${classData.instructorId})`,
                        cost: 0
                    }
                })
            ])
        }
    }
}

export async function deleteClass(id: string) {
    await prisma.classSession.delete({ where: { id } })
    revalidatePath('/dashboard/calendar')
}

// Enrollment
export async function enrollStudent(classId: string, studentId: string, type: 'STANDARD' | 'COURTESY' = 'STANDARD') {
    const classData = await prisma.classSession.findUnique({
        where: { id: classId },
        include: { attendees: { where: { status: 'BOOKED' } } }
    })

    if (!classData) throw new Error("Clase no encontrada")
    if (classData.attendees.length >= classData.maxCapacity) throw new Error("Clase llena")

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
}

export async function removeAttendee(classId: string, studentId: string) {
    await prisma.attendee.deleteMany({
        where: {
            classId,
            studentId
        }
    })
    revalidatePath('/dashboard/calendar')
}
