"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { StudentStatus, User, Prisma } from "@prisma/client"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { ensureRole } from "@/lib/auth-utils"
import { ProcessPaymentSchema, AddHistoryEntrySchema, AddStudentSchema, RenewPlanSchema } from "@/lib/schemas"
import { formatZodError } from "@/lib/utils"

export async function getStudents() {
    const user = await ensureRole(['admin', 'instructor'])
    const role = (user.app_metadata?.role || user.user_metadata?.role || '').toLowerCase()

    const where: Prisma.UserWhereInput = { role: 'STUDENT' }

    // Si es instructor, solo ver alumnas que asistan a sus clases
    if (role === 'instructor') {
        where.attendances = {
            some: {
                class: {
                    instructorId: user.id
                }
            }
        }
    }

    return await prisma.user.findMany({
        where,
        include: {
            plans: true,
            paymentsMade: true,
            history: true
        },
        orderBy: { name: 'asc' }
    })
}

export async function getStudentsSummary() {
    const user = await ensureRole(['admin', 'instructor'])
    const role = (user.app_metadata?.role || user.user_metadata?.role || '').toLowerCase()

    const where: Prisma.UserWhereInput = { role: 'STUDENT' }

    if (role === 'instructor') {
        where.attendances = { some: { class: { instructorId: user.id } } }
    }

    const students = await prisma.user.findMany({
        where,
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
    const user = await ensureRole(['admin', 'instructor'])
    const role = (user.app_metadata?.role || user.user_metadata?.role || '').toLowerCase()

    const student = await prisma.user.findUnique({
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

    if (!student) return null

    // Si es instructor, validar que la alumna asista a sus clases
    if (role === 'instructor') {
        const hasAttendedInstructorClass = student.attendances.some(
            a => a.class.instructorId === user.id
        )
        if (!hasAttendedInstructorClass) {
            throw new Error("No tienes permiso para ver esta alumna.")
        }
    }

    return student
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
    sportsInfo?: string,
    disciplines?: string[]
}) {
    await ensureRole(['admin'])
    let parsed
    try {
        parsed = AddStudentSchema.parse(data)
    } catch (e) {
        throw new Error(formatZodError(e))
    }
    const { planType, discipline, disciplines, ...studentData } = parsed

    // 1. Explicit duplicate checks
    const existingStudent = await prisma.user.findFirst({
        where: {
            OR: [
                { phone: data.phone },
                { name: { equals: data.name, mode: 'insensitive' as Prisma.QueryMode } }
            ],
            role: 'STUDENT'
        }
    })

    if (existingStudent) {
        if (existingStudent.phone === data.phone) {
            throw new Error(`Ese número de teléfono ya está registrado con otra alumna (${existingStudent.name}).`)
        }
        if (existingStudent.name.toLowerCase() === data.name.toLowerCase()) {
            throw new Error(`Ya existe una alumna registrada con el nombre "${data.name}".`)
        }
    }

    // Generate placeholder email if not provided
    const email = data.email || `${data.phone.replace(/\s/g, '')}@atria-user.com`

    // 2. Create User in Supabase Auth (Auto-confirm)
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: 'atria-fitness-2026', // Initial default password
        email_confirm: true,
        user_metadata: { name: data.name, role: 'STUDENT' },
        app_metadata: { role: 'student' }
    })

    if (authError) {
        if (authError.message.includes('already registered')) {
            throw new Error("Este correo electrónico o número de teléfono ya está registrado en el sistema de autenticación.")
        }
        throw new Error(`Error al crear la cuenta de la alumna: ${authError.message}`)
    }

    // 3. Create Profile in Prisma
    let student;
    try {
        student = await prisma.user.create({
            data: {
                ...studentData,
                id: authUser?.user?.id || `temp_${Date.now()}`,
                email: email,
                role: 'STUDENT',
                status: data.status || 'ACTIVE',
            }
        })
    } catch (error) {
        console.error("Prisma error adding student:", error)
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2002') {
                const targets = (error.meta?.target as string[]) || []
                if (targets.includes('email')) {
                    throw new Error("Ya existe una alumna con este correo electrónico (o el teléfono proporcionado ya está en uso).")
                }
                if (targets.includes('phone')) {
                    throw new Error("Ese número de teléfono ya está registrado.")
                }
            }
        }
        throw new Error("Ocurrió un error inesperado al guardar los datos de la alumna. Por favor intenta de nuevo.")
    }

    if (planType && planType !== 'Sin Plan') {
        let credits = 8
        if (planType === 'Ilimitado') credits = 999
        if (planType === 'Clase Suelta') credits = 1
        if (planType === 'Pack 12 Clases') credits = 12
        if (planType === 'Pack 4 Clases') credits = 4
        if (planType === 'Pack 24 Clases') credits = 24
        if (planType === 'Pack 8 Clases') credits = 8

        const finalDisciplines = disciplines || (discipline ? [discipline] : ['General'])
        let legacyDiscipline = discipline || 'General'
        if (finalDisciplines.length > 1) legacyDiscipline = 'Múltiples'
        if (finalDisciplines.includes('General')) legacyDiscipline = 'General'

        await prisma.studentPlan.create({
            data: {
                studentId: student.id,
                discipline: legacyDiscipline,
                disciplines: finalDisciplines,
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
    await ensureRole(['admin'])

    // Check if new phone/name belongs to another student
    if (data.phone || data.name) {
        const existingStudent = await prisma.user.findFirst({
            where: {
                OR: [
                    data.phone ? { phone: data.phone } : {},
                    data.name ? { name: { equals: data.name, mode: 'insensitive' as Prisma.QueryMode } } : {}
                ].filter(condition => Object.keys(condition).length > 0),
                id: { not: id },
                role: 'STUDENT'
            }
        })

        if (existingStudent) {
            if (data.phone && existingStudent.phone === data.phone) {
                throw new Error(`Este número de teléfono ya está registrado con otra alumna (${existingStudent.name}).`)
            }
            if (data.name && existingStudent.name?.toLowerCase() === data.name.toLowerCase()) {
                throw new Error(`Ya existe otra alumna registrada con el nombre "${data.name}".`)
            }
        }
    }

    const updated = await prisma.user.update({
        where: { id },
        data
    })

    // Sync to Supabase Auth metadata for performance (avoiding Prisma lookups)
    await supabaseAdmin.auth.admin.updateUserById(id, {
        email: data.email,
        user_metadata: {
            name: data.name,
            role: (data.role || 'STUDENT').toString().toLowerCase()
        },
        app_metadata: {
            role: (data.role || 'STUDENT').toString().toLowerCase()
        }
    })

    revalidatePath('/dashboard/students')
    revalidatePath(`/dashboard/students/${id}`)
    return updated
}

export async function deleteStudent(id: string) {
    await ensureRole(['admin'])
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
    await ensureRole(['admin'])
    await prisma.studentPlan.delete({ where: { id: planId } })
    revalidatePath('/dashboard/students')
    revalidatePath(`/dashboard/students/${studentId}`)
}

export async function deleteHistoryEntry(entryId: string, studentId: string) {
    await ensureRole(['admin'])
    await prisma.studentHistory.delete({ where: { id: entryId } })
    revalidatePath(`/dashboard/students/${studentId}`)
}

export async function updateStudentPlan(planId: string, studentId: string, disciplines: string[]) {
    await ensureRole(['admin'])

    // Validate input: at least one discipline must be selected
    if (!Array.isArray(disciplines) || disciplines.length === 0) {
        throw new Error('Debes seleccionar al menos una disciplina.')
    }

    let legacyDiscipline = disciplines.length > 1 ? 'Múltiples' : (disciplines[0] || 'General')
    if (disciplines.includes('General')) legacyDiscipline = 'General'

    const updated = await prisma.studentPlan.update({
        where: { id: planId },
        data: {
            disciplines,
            discipline: legacyDiscipline
        }
    })

    revalidatePath('/dashboard/students')
    revalidatePath(`/dashboard/students/${studentId}`)
    return updated
}

// Student Payments / History
export async function processPayment(data: {
    studentId: string,
    amount: number,
    method: 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA' | 'OTRO',
    planName: string,
    credits: number,
    discipline?: string,
    disciplines?: string[]
}) {
    await ensureRole(['admin'])
    try {
        ProcessPaymentSchema.parse(data)
    } catch (e) {
        throw new Error(formatZodError(e))
    }

    // ── Idempotency guard: reject duplicate payments within 30 seconds ──────
    const thirtySecondsAgo = new Date(Date.now() - 30_000)
    const recentDuplicate = await prisma.studentPayment.findFirst({
        where: {
            studentId: data.studentId,
            amount: data.amount,
            concept: data.planName,
            date: { gte: thirtySecondsAgo }
        }
    })
    if (recentDuplicate) {
        throw new Error('Pago duplicado detectado. Este pago ya fue registrado recientemente.')
    }
    // ────────────────────────────────────────────────────────────────────────

    // Check if student already has an active plan
    const existingActivePlan = await prisma.studentPlan.findFirst({
        where: { studentId: data.studentId, isActive: true }
    })
    
    if (existingActivePlan) {
        throw new Error(`La alumna ya tiene un plan activo (${existingActivePlan.originalName}). Utiliza la opción de "Renovar Plan" si deseas agregar créditos.`)
    }

    return await prisma.$transaction(async (tx) => {
        // Enforce single active plan: deactivate ALL existing plans for this student
        await tx.studentPlan.updateMany({
            where: { studentId: data.studentId, isActive: true },
            data: { isActive: false }
        })

        const payment = await tx.studentPayment.create({
            data: {
                studentId: data.studentId,
                amount: data.amount,
                method: data.method,
                concept: `Nuevo Plan: ${data.planName}`
            }
        })

        const plan = await tx.studentPlan.create({
            data: {
                studentId: data.studentId,
                discipline: data.disciplines && data.disciplines.length > 1 
                    ? 'Múltiples' 
                    : (data.disciplines?.[0] || data.discipline || 'General'),
                disciplines: data.disciplines || (data.discipline ? [data.discipline] : ['General']),
                credits: data.credits,
                originalName: data.planName,
                isActive: true
            }
        })

        // Add history entry for the new plan
        await tx.studentHistory.create({
            data: {
                studentId: data.studentId,
                activity: `Nuevo Plan: ${data.planName}`,
                notes: `Créditos iniciales: ${data.credits > 900 ? 'Ilimitados' : data.credits}`,
                cost: data.amount
            }
        })

        return { payment, plan }
    })

    revalidatePath(`/dashboard/students/${data.studentId}`)
    revalidatePath('/dashboard/students')
}

export async function renewPlan(data: {
    studentId: string,
    planId: string,
    amount: number,
    method: 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA' | 'OTRO',
    planName: string,
    credits: number,
    disciplines: string[]
}) {
    await ensureRole(['admin'])
    try {
        RenewPlanSchema.parse(data)
    } catch (e) {
        throw new Error(formatZodError(e))
    }

    return await prisma.$transaction(async (tx) => {
        // Find the active plan
        const existingPlan = await tx.studentPlan.findUnique({
            where: { id: data.planId }
        })

        if (!existingPlan) throw new Error("No se encontró el plan a renovar.")
        if (existingPlan.studentId !== data.studentId) throw new Error("El plan no pertenece a esta alumna.")
        if (existingPlan.credits > 1) {
            throw new Error(`No es necesario renovar todavía. El plan actual aún tiene ${existingPlan.credits} créditos disponibles. Solo se permite renovar con 0 o 1 crédito restante.`)
        }

        // 1. Create Payment
        await tx.studentPayment.create({
            data: {
                studentId: data.studentId,
                amount: data.amount,
                method: data.method,
                concept: `Renovación: ${data.planName}`
            }
        })

        // 2. Update existing plan (Top-up credits and reconfigure disciplines)
        const updatedPlan = await tx.studentPlan.update({
            where: { id: data.planId },
            data: {
                credits: { increment: data.credits },
                disciplines: data.disciplines,
                discipline: data.disciplines.length > 1 ? 'Múltiples' : data.disciplines[0],
                originalName: data.planName,
                isActive: true // Ensure it stays active
            }
        })

        // 3. Create History Entry
        await tx.studentHistory.create({
            data: {
                studentId: data.studentId,
                activity: `Renovación: ${data.planName}`,
                notes: `+${data.credits} créditos agregados. Disciplinas: ${data.disciplines.join(", ")}`,
                cost: data.amount
            }
        })

        return updatedPlan
    })

    revalidatePath(`/dashboard/students/${data.studentId}`)
}

export async function addHistoryEntry(
    studentId: string,
    data: { activity: string, notes?: string, cost?: number, classDate?: string }
) {
    await ensureRole(['admin'])
    try {
        AddHistoryEntrySchema.parse(data)
    } catch (e) {
        throw new Error(formatZodError(e))
    }
    const entry = await prisma.studentHistory.create({
        data: {
            studentId,
            activity: data.activity,
            notes: data.notes,
            cost: data.cost || 0,
            classDate: data.classDate ? new Date(`${data.classDate}T00:00:00.000Z`) : null
        }
    })
    revalidatePath(`/dashboard/students/${studentId}`)
    return entry
}
