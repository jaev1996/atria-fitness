"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { ClassStatus } from "@prisma/client"

export async function getClasses() {
    return await prisma.classSession.findMany({
        include: {
            attendees: true,
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
    const [h, m] = data.startTime.split(':').map(Number)
    const endH = h + 1
    const endTime = `${endH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`

    const newClass = await prisma.classSession.create({
        data: {
            ...data,
            date: new Date(data.date),
            endTime,
            status: 'SCHEDULED'
        }
    })

    revalidatePath('/dashboard/calendar')
    return newClass
}

export async function updateClass(id: string, data: any) {
    // Logic for credit deduction when completed
    const existing = await prisma.classSession.findUnique({
        where: { id },
        include: { attendees: true }
    })

    const updated = await prisma.classSession.update({
        where: { id },
        data: {
            ...data,
            date: data.date ? new Date(data.date) : undefined
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
        const student = await prisma.student.findUnique({
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
        }
    })

    revalidatePath('/dashboard/calendar')
    return enrollment
}
