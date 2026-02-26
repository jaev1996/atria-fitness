"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { StudentStatus, PaymentMethod, User } from "@prisma/client"
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

export async function getStudentsSummary() {
    const students = await prisma.user.findMany({
        where: { role: 'STUDENT' },
        select: {
            id: true,
            name: true,
            email: true
        },
        orderBy: { name: 'asc' }
    })
    return students.map(s => ({
        ...s,
        email: s.email ?? undefined
    }))
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
    email?: string,
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

    // Generate placeholder email if not provided
    const email = data.email || `${data.phone.replace(/\s/g, '')}@atria-user.com`

    // 1. Create User in Supabase Auth (Auto-confirm)
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: 'atria-fitness-2026', // Initial default password
        email_confirm: true,
        user_metadata: { name: data.name, role: 'STUDENT' }
    })

    if (authError) {
        // If user already exists in Auth, we might want to just link it or throw error
        // For now, let's throw if it's not a "user already exists" error
        if (!authError.message.includes('already registered')) {
            throw new Error(`Error creating student auth: ${authError.message}`)
        }
    }

    // 2. Create Profile in Prisma
    const student = await prisma.user.upsert({
        where: { email: email },
        update: {
            ...studentData,
            role: 'STUDENT',
            status: data.status || 'ACTIVE',
        },
        create: {
            ...studentData,
            id: authUser?.user?.id || `temp_${Date.now()}`,
            email: email,
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
        if (planType === 'Pack 8 Clases') credits = 8

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

export async function updateStudent(id: string, data: Partial<User>) {
    const updated = await prisma.user.update({
        where: { id },
        data
    })

    // If name or email changed, update Supabase metadata
    if (data.name || data.email) {
        await supabaseAdmin.auth.admin.updateUserById(id, {
            email: data.email,
            user_metadata: { name: data.name }
        })
    }

    revalidatePath('/dashboard/students')
    revalidatePath(`/dashboard/students/${id}`)
    return updated
}

export async function deleteStudent(id: string) {
    try {
        // 1. Delete from Supabase Auth
        await supabaseAdmin.auth.admin.deleteUser(id)
    } catch (e) {
        console.error("Error deleting from auth:", e)
    }

    // 2. Delete from Prisma (Cascades to plans, payments, history)
    await prisma.user.delete({ where: { id } })

    revalidatePath('/dashboard/students')
}

export async function deleteStudentPlan(planId: string, studentId: string) {
    await prisma.studentPlan.delete({ where: { id: planId } })
    revalidatePath(`/dashboard/students/${studentId}`)
}

export async function deleteHistoryEntry(entryId: string, studentId: string) {
    await prisma.studentHistory.delete({ where: { id: entryId } })
    revalidatePath(`/dashboard/students/${studentId}`)
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
