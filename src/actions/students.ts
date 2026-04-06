"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { StudentStatus, User, Prisma } from "@prisma/client"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { ensureRole } from "@/lib/auth-utils"
import { ProcessPaymentSchema, AddHistoryEntrySchema, AddStudentSchema, RenewPlanSchema } from "@/lib/schemas"
import { formatZodError } from "@/lib/utils"
import { handleActionError } from "@/lib/error-utils"

export async function getStudents() {
    const user = await ensureRole(['admin', 'instructor'])
    const role = (user.app_metadata?.role || user.user_metadata?.role || '').toLowerCase()

    const where: Prisma.UserWhereInput = { roles: { has: 'STUDENT' } }

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

    const where: Prisma.UserWhereInput = { roles: { has: 'STUDENT' } }

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
    disciplines?: string[],
    cedula: string,
    registrationDate?: string
}) {
    await ensureRole(['admin'])
    let parsed
    try {
        parsed = AddStudentSchema.parse(data)
    } catch (e) {
        throw new Error(formatZodError(e))
    }
    const { ...studentData } = parsed

    // 1. Explicit duplicate checks
    const existingUser = await prisma.user.findFirst({
        where: {
            OR: [
                { phone: data.phone },
                { name: { equals: data.name, mode: 'insensitive' as Prisma.QueryMode } },
                { cedula: data.cedula }
            ]
        }
    })

    if (existingUser) {
        const isStudent = existingUser.roles.includes('STUDENT')
        
        if (isStudent) {
            if (existingUser.cedula === data.cedula) {
                throw new Error(`Esta cédula ya está registrada para otra alumna (${existingUser.name}).`)
            }
            if (existingUser.phone === data.phone) {
                throw new Error(`Ese número de teléfono ya está registrado con otra alumna (${existingUser.name}).`)
            }
            if (existingUser.name.toLowerCase() === data.name.toLowerCase()) {
                throw new Error(`Ya existe una alumna registrada con el nombre "${data.name}".`)
            }
        }

        // Si es instructor, habilitar perfil de alumna
        if (existingUser.roles.includes('INSTRUCTOR')) {
            const updated = await prisma.user.update({
                where: { id: existingUser.id },
                data: {
                    roles: { set: [...existingUser.roles, 'STUDENT'] },
                    // Sincronizamos otros campos opcionales si vienen en el registro
                    medicalInfo: data.medicalInfo || existingUser.medicalInfo,
                    allergies: data.allergies || existingUser.allergies,
                    injuries: data.injuries || existingUser.injuries,
                    conditions: data.conditions || existingUser.conditions,
                    emergencyContact: data.emergencyContact || existingUser.emergencyContact,
                    sportsInfo: data.sportsInfo || existingUser.sportsInfo,
                }
            })
            
            // Revalidar y retornar
            revalidatePath('/dashboard/students')
            return updated
        }

        throw new Error(`Ya existe un usuario registrado con estos datos (${existingUser.name}).`)
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
                roles: ['STUDENT'],
                status: data.status || 'ACTIVE',
            }
        })
    } catch (error) {
        handleActionError(error, "No se pudieron guardar los datos de la alumna.")
    }


    revalidatePath('/dashboard/students')
    return student
}

export async function updateStudent(id: string, data: Partial<User>) {
    await ensureRole(['admin'])

    // Check if new phone/name belongs to another student
    if (data.phone || data.name || data.cedula) {
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    data.phone ? { phone: data.phone } : {},
                    data.name ? { name: { equals: data.name, mode: 'insensitive' as Prisma.QueryMode } } : {},
                    data.cedula ? { cedula: data.cedula } : {}
                ].filter(condition => Object.keys(condition).length > 0),
                id: { not: id }
            }
        })

        if (existingUser) {
            if (data.cedula && existingUser.cedula === data.cedula) {
                throw new Error(`Esta cédula ya está registrada para otro usuario (${existingUser.name}).`)
            }
            if (data.phone && existingUser.phone === data.phone) {
                throw new Error(`Este número de teléfono ya está registrado con otro usuario (${existingUser.name}).`)
            }
            if (data.name && existingUser.name?.toLowerCase() === data.name.toLowerCase()) {
                throw new Error(`Ya existe otro usuario registrado con el nombre "${data.name}".`)
            }
        }
    }

    try {
        const updated = await prisma.user.update({
            where: { id },
            data: {
                ...data,
                // Si por alguna razón se cambia el role singular, sincronizamos el array roles
                // (esto es poco común en updateStudent pero por seguridad)
                roles: data.role ? { set: [data.role] } : undefined
            }
        })

        // Sync to Supabase Auth metadata for performance (avoiding Prisma lookups)
        await supabaseAdmin.auth.admin.updateUserById(id, {
            email: data.email,
            user_metadata: {
                name: data.name || updated.name,
                role: (data.role || updated.role).toLowerCase(),
                roles: updated.roles.map(r => r.toLowerCase())
            },
            app_metadata: {
                role: (data.role || updated.role).toLowerCase(),
                roles: updated.roles.map(r => r.toLowerCase())
            }
        })

        revalidatePath('/dashboard/students')
        revalidatePath(`/dashboard/students/${id}`)
        return updated
    } catch (error) {
        handleActionError(error, "No se pudieron actualizar los datos de la alumna.")
    }
}

export async function deleteStudent(id: string) {
    await ensureRole(['admin'])
    try {
        // Validation: Prevent deletion of students with historical data
        const [payments, history, attendances, plans] = await Promise.all([
            prisma.studentPayment.count({ where: { studentId: id } }),
            prisma.studentHistory.count({ where: { studentId: id } }),
            prisma.attendee.count({ where: { studentId: id } }),
            prisma.studentPlan.count({ where: { studentId: id } }),
        ])

        if (payments > 0 || history > 0 || attendances > 0 || plans > 0) {
            throw new Error(
                "No se puede eliminar la alumna porque tiene un historial activo de pagos, asistencia o planes registrados. " +
                "Para preservar la integridad de los reportes, te sugerimos cambiar su estado a 'Inactivo' en su perfil en lugar de eliminarla."
            )
        }

        // 1. Delete from Supabase Auth
        try {
            await supabaseAdmin.auth.admin.deleteUser(id)
        } catch (e) {
            console.error("Error deleting from auth (continuing with DB deletion):", e)
        }

        // 2. Delete from Prisma (Only if no records found above)
        await prisma.user.delete({ where: { id } })

        revalidatePath('/dashboard/students')
    } catch (error) {
        handleActionError(error, "No se pudo eliminar a la alumna de la base de datos.")
    }
}

export async function deleteStudentPlan(planId: string, studentId: string) {
    await ensureRole(['admin'])
    try {
        await prisma.studentPlan.delete({ where: { id: planId } })
        revalidatePath('/dashboard/students')
        revalidatePath(`/dashboard/students/${studentId}`)
    } catch (error) {
        handleActionError(error, "No se pudo eliminar el plan de la alumna.")
    }
}

export async function deleteHistoryEntry(entryId: string, studentId: string) {
    await ensureRole(['admin'])
    try {
        await prisma.studentHistory.delete({ where: { id: entryId } })
        revalidatePath(`/dashboard/students/${studentId}`)
    } catch (error) {
        handleActionError(error, "No se pudo eliminar la entrada del historial.")
    }
}

export async function updateStudentPlan(planId: string, studentId: string, disciplines: string[], registrationDate?: string) {
    await ensureRole(['admin'])

    // Validate input: at least one discipline must be selected
    if (!Array.isArray(disciplines) || disciplines.length === 0) {
        throw new Error('Debes seleccionar al menos una disciplina.')
    }

    let legacyDiscipline = disciplines.length > 1 ? 'Múltiples' : (disciplines[0] || 'General')
    if (disciplines.includes('General')) legacyDiscipline = 'General'

    try {
        const updated = await prisma.studentPlan.update({
            where: { id: planId },
            data: {
                disciplines,
                discipline: legacyDiscipline,
                registrationDate: registrationDate ? new Date(`${registrationDate}T00:00:00.000Z`) : undefined
            }
        })

        revalidatePath('/dashboard/students')
        revalidatePath(`/dashboard/students/${studentId}`)
        return updated
    } catch (error) {
        handleActionError(error, "No se pudo actualizar el plan de la alumna.")
    }
}

// Student Payments / History
export async function processPayment(data: {
    studentId: string,
    amount: number,
    method: 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA' | 'OTRO',
    planName: string,
    credits: number,
    discipline?: string,
    disciplines?: string[],
    registrationDate?: string
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

    try {
        const result = await prisma.$transaction(async (tx) => {
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
                    isActive: true,
                    registrationDate: data.registrationDate ? new Date(`${data.registrationDate}T00:00:00.000Z`) : null
                }
            })

            // Add history entry for the new plan
            await tx.studentHistory.create({
                data: {
                    studentId: data.studentId,
                    activity: `Nuevo Plan: ${data.planName}`,
                    notes: `Créditos iniciales: ${data.credits}`,
                    cost: data.amount
                }
            })

            return { payment, plan }
        })

        revalidatePath(`/dashboard/students/${data.studentId}`)
        revalidatePath('/dashboard/students')
        return result
    } catch (error) {
        handleActionError(error, "No se pudo procesar el pago del nuevo plan.")
    }
}

export async function renewPlan(data: {
    studentId: string,
    planId: string,
    amount: number,
    method: 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA' | 'OTRO',
    planName: string,
    credits: number,
    disciplines: string[],
    registrationDate?: string
}) {
    await ensureRole(['admin'])
    try {
        RenewPlanSchema.parse(data)
    } catch (e) {
        throw new Error(formatZodError(e))
    }

    try {
        const updatedPlan = await prisma.$transaction(async (tx) => {
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
            const up = await tx.studentPlan.update({
                where: { id: data.planId },
                data: {
                    credits: { increment: data.credits },
                    disciplines: data.disciplines,
                    discipline: data.disciplines.length > 1 ? 'Múltiples' : data.disciplines[0],
                    originalName: data.planName,
                    isActive: true, // Ensure it stays active
                    registrationDate: data.registrationDate ? new Date(`${data.registrationDate}T00:00:00.000Z`) : undefined
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

            return up
        })

        revalidatePath(`/dashboard/students/${data.studentId}`)
        return updatedPlan
    } catch (error) {
        handleActionError(error, "No se pudo renovar el plan.")
    }
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
    try {
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
    } catch (error) {
        handleActionError(error, "No se pudo agregar la entrada al historial.")
    }
}
