"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { StudentStatus, PaymentMethod } from "@prisma/client"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function getStudents() {
    return await prisma.user.findMany({
        where: { role: 'STUDENT' },
        include: {
            plans: true,
            paymentsMade: true,
            history: true
        },
        orderBy: { name: 'asc' }
    })
}

export async function getStudent(id: string) {
    return await prisma.user.findUnique({
        where: { id },
        include: {
            plans: true,
            paymentsMade: true,
            history: true,
            attendances: {
                include: { class: true }
            }
        }
    })
}

export async function addStudent(data: {
    name: string,
    email: string,
    phone: string,
    planType?: string,
    discipline?: string,
    status?: StudentStatus,
    medicalInfo?: string,
    allergies?: string,
    injuries?: string,
    conditions?: string,
    emergencyContact?: string,
    sportsInfo?: string
}) {
    const { planType, discipline, ...studentData } = data

    // 1. Create User in Supabase Auth (Auto-confirm)
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: 'atria2026', // Initial default password
        email_confirm: true,
        user_metadata: { name: data.name, role: 'STUDENT' }
    })

    if (authError) throw new Error(`Error creating student auth: ${authError.message}`)

    // 2. Create Profile in Prisma
    const student = await prisma.user.create({
        data: {
            ...studentData,
            id: authUser.user.id,
            role: 'STUDENT',
            status: data.status || 'ACTIVE',
        }
    })

    if (planType && planType !== 'Sin Plan') {
        let credits = 8
        if (planType === 'Ilimitado') credits = 999
        if (planType === 'Clase Suelta') credits = 1
        if (planType === 'Pack 12 Clases') credits = 12
        if (planType === 'Pack 4 Clases') credits = 4
        if (planType === 'Pack 24 Clases') credits = 24

        await prisma.studentPlan.create({
            data: {
                studentId: student.id,
                discipline: discipline || 'General',
                credits,
                originalName: planType,
                isActive: true
            }
        })
    }

    revalidatePath('/dashboard/students')
    return student
}

export async function updateStudent(id: string, data: any) {
    const updated = await prisma.student.update({
        where: { id },
        data
    })
    revalidatePath('/dashboard/students')
    revalidatePath(`/dashboard/students/${id}`)
    return updated
}

export async function deleteStudent(id: string) {
    await prisma.student.delete({ where: { id } })
    revalidatePath('/dashboard/students')
}

// Student Payments / History
export async function processStudentPayment(data: {
    studentId: string,
    amount: number,
    method: PaymentMethod,
    planName: string,
    credits: number,
    discipline?: string
}) {
    return await prisma.$transaction([
        prisma.studentPayment.create({
            data: {
                studentId: data.studentId,
                amount: data.amount,
                method: data.method,
                concept: data.planName
            }
        }),
        prisma.studentPlan.create({
            data: {
                studentId: data.studentId,
                discipline: data.discipline || 'General',
                credits: data.credits,
                originalName: data.planName,
                isActive: true
            }
        })
    ])
}

export async function addHistoryEntry(studentId: string, data: { activity: string, notes?: string, cost?: number }) {
    const entry = await prisma.studentHistory.create({
        data: {
            studentId,
            activity: data.activity,
            notes: data.notes,
            cost: data.cost || 0
        }
    })
    revalidatePath(`/dashboard/students/${studentId}`)
    return entry
}
