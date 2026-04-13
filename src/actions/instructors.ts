"use server"

// Force recompile
import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { Prisma, UserRole } from "@prisma/client"
import { ensureRole } from "@/lib/auth-utils"
import { AddInstructorSchema, AddInstructorPaymentSchema } from "@/lib/schemas"
import { formatZodError } from "@/lib/utils"
import { handleActionError } from "@/lib/error-utils"

export async function getInstructors() {
    console.log("Action: getInstructors called")
    try {
        const instructors = await prisma.user.findMany({
            where: { roles: { has: 'INSTRUCTOR' } },
            orderBy: { name: 'asc' }
        })
        console.log(`Found ${instructors.length} instructors`)
        return instructors
    } catch (error) {
        console.error("Error fetching instructors:", error)
        throw error
    }
}

export async function addInstructor(data: { name: string, cedula: string, email: string, phone?: string, specialties: string[], bio?: string }) {
    await ensureRole(['admin'])
    
    try {
        AddInstructorSchema.parse(data)
    } catch (e) {
        throw new Error(formatZodError(e))
    }

    // 0. Explicit duplicate checks
    const existing = await prisma.user.findFirst({
        where: {
            OR: [
                { email: data.email },
                { cedula: data.cedula },
                data.phone ? { phone: data.phone } : {},
                { name: { equals: data.name, mode: 'insensitive' as Prisma.QueryMode } }
            ].filter(c => Object.keys(c).length > 0)
        }
    })

    if (existing) {
        const isInstructor = existing.roles.includes('INSTRUCTOR')
        if (isInstructor) {
            if (existing.email === data.email) throw new Error("Ya existe un instructor registrado con este correo electrónico.")
            if (existing.cedula === data.cedula) throw new Error(`Esta cédula ya está registrada para otro instructor (${existing.name}).`)
            if (data.phone && existing.phone === data.phone) throw new Error(`Este número de teléfono ya está registrado con otro instructor (${existing.name}).`)
            if (existing.name.toLowerCase() === data.name.toLowerCase()) throw new Error(`Ya existe un instructor registrado con el nombre "${data.name}".`)
        }

        // Si es alumno, habilitar perfil de instructor
        // NOTA: El usuario indicó que alumnos -> instructores no es prioridad, 
        // pero para evitar errores de base de datos lo manejamos de forma segura.
        const updated = await prisma.user.update({
            where: { id: existing.id },
            data: {
                roles: { set: [...existing.roles, 'INSTRUCTOR'] },
                specialties: data.specialties,
                bio: data.bio
            }
        })

        // Sincronizar metadatos
        await supabaseAdmin.auth.admin.updateUserById(existing.id, {
            user_metadata: {
                role: 'INSTRUCTOR', // Preferimos instructor como rol principal si lo es
                roles: updated.roles.map(r => r.toLowerCase())
            },
            app_metadata: {
                role: 'instructor',
                roles: updated.roles.map(r => r.toLowerCase())
            }
        })

        revalidatePath('/dashboard/instructors')
        return updated
    }

    // 1. Create User in Supabase Auth via Admin API
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: 'atria2026', // Initial default password
        email_confirm: true,
        user_metadata: { name: data.name, role: 'INSTRUCTOR' },
        app_metadata: { role: 'instructor' }
    })

    if (authError) {
        if (authError.message.includes('already registered')) {
            throw new Error("Este correo electrónico ya está registrado en el sistema de autenticación.")
        }
        throw new Error(`Error al crear la cuenta del instructor: ${authError.message}`)
    }

    // 2. Create Profile in Prisma
    try {
        const instructor = await prisma.user.create({
            data: {
                id: authUser.user.id,
                name: data.name,
                cedula: data.cedula,
                email: data.email,
                phone: data.phone,
                specialties: data.specialties,
                bio: data.bio,
                role: 'INSTRUCTOR',
                roles: ['INSTRUCTOR']
            }
        })
        revalidatePath('/dashboard/instructors')
        return instructor
    } catch (error) {
        handleActionError(error, "Error inesperado al guardar los datos del instructor.")
    }
}

export async function updateInstructor(id: string, data: Prisma.UserUpdateInput) {
    await ensureRole(['admin'])

    // Check for duplicates excluding self
    if (data.email || data.phone || data.name) {
        let existing
        try {
            existing = await prisma.user.findFirst({
                where: {
                    OR: [
                        data.email ? { email: data.email as string } : {},
                        data.cedula ? { cedula: data.cedula as string } : {},
                        data.phone ? { phone: data.phone as string } : {},
                        data.name ? { name: { equals: data.name as string, mode: 'insensitive' as Prisma.QueryMode } } : {}
                    ].filter(c => Object.keys(c).length > 0),
                    id: { not: id }
                }
            })
        } catch (e) {
            console.error("Error checking duplicates:", e)
        }

        if (existing) {
            if (data.email && existing.email === data.email) throw new Error("Ya existe otro usuario con este correo electrónico.")
            if (data.cedula && existing.cedula === data.cedula) throw new Error(`Esta cédula ya está registrada para otro usuario (${existing.name}).`)
            if (data.phone && existing.phone === data.phone) throw new Error(`Este número de teléfono ya está registrado con otro usuario (${existing.name}).`)
            if (data.name && (data.name as string).toLowerCase() === existing.name.toLowerCase() && existing.role === 'INSTRUCTOR') {
                throw new Error(`Ya existe otro instructor con el nombre "${data.name}".`)
            }
        }
    }

    try {
        const updated = await prisma.user.update({
            where: { id },
            data: {
                ...data,
                // Sincronizar roles si se cambia el role singular
                roles: data.role ? { set: [data.role as UserRole] } : undefined
            }
        })
        // Sync with Supabase Auth
        await supabaseAdmin.auth.admin.updateUserById(id, {
            user_metadata: {
                name: typeof updated.name === 'string' ? updated.name : undefined,
                role: updated.role.toLowerCase(),
                roles: updated.roles.map(r => r.toLowerCase())
            },
            app_metadata: {
                role: updated.role.toLowerCase(),
                roles: updated.roles.map(r => r.toLowerCase())
            }
        })

        revalidatePath('/dashboard/instructors')
        revalidatePath(`/dashboard/instructors/${id}`)
        return updated
    } catch (error) {
        handleActionError(error, "No se pudieron actualizar los datos del instructor.")
    }
}

export async function deleteInstructor(id: string) {
    await ensureRole(['admin'])
    try {
        // Validation: Prevent deletion of instructors with historical data
        const [classes, payments] = await Promise.all([
            prisma.classSession.count({ where: { instructorId: id } }),
            prisma.instructorPayment.count({ where: { instructorId: id } }),
        ])

        if (classes > 0 || payments > 0) {
            throw new Error(
                "No se puede eliminar el instructor porque tiene clases dictadas o pagos registrados. " +
                "Para preservar la integridad de los datos, considera mantener su perfil sin eliminarlo o contacta a soporte si es un error."
            )
        }

        // 1. Delete from Supabase Auth
        try {
            await supabaseAdmin.auth.admin.deleteUser(id)
        } catch (e) {
            console.error("Error deleting from auth (continuing with DB deletion):", e)
        }

        // 2. Delete from Prisma
        await prisma.user.delete({ where: { id } })

        revalidatePath('/dashboard/instructors')
    } catch (error) {
        handleActionError(error, "No se pudo eliminar el instructor de la base de datos.")
    }
}

// INSTRUCTOR PAYMENTS ACTIONS

export async function getInstructorPayments(instructorId?: string) {
    return await prisma.instructorPayment.findMany({
        where: instructorId ? { instructorId } : {},
        include: {
            classes: {
                include: {
                    attendees: {
                        include: { student: true }
                    }
                },
                orderBy: { date: 'asc' }
            }
        },
        orderBy: { date: 'desc' }
    })
}

export async function addInstructorPayment(data: {
    instructorId: string,
    amount: number,
    startDate: string,
    endDate: string,
    classIds: string[],
    notes?: string,
    exchangeRateUsed?: number,
    currencyUsed?: string
}) {
    await ensureRole(['admin'])
    try {
        AddInstructorPaymentSchema.parse(data)
    } catch (e) {
        throw new Error(formatZodError(e))
    }

    // ── Idempotency guard: reject duplicate payments within 30 seconds ──────
    const thirtySecondsAgo = new Date(Date.now() - 30_000)
    const recentDuplicate = await prisma.instructorPayment.findFirst({
        where: {
            instructorId: data.instructorId,
            amount: data.amount,
            startDate: new Date(data.startDate),
            date: { gte: thirtySecondsAgo }
        }
    })
    if (recentDuplicate) {
        throw new Error('Pago duplicado detectado. Este pago ya fue registrado recientemente.')
    }
    // ────────────────────────────────────────────────────────────────────────

    try {
        const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const p = await tx.instructorPayment.create({
                data: {
                    instructorId: data.instructorId,
                    amount: data.amount,
                    startDate: new Date(data.startDate),
                    endDate: new Date(data.endDate),
                    notes: data.notes,
                    exchangeRateUsed: data.exchangeRateUsed,
                    currencyUsed: data.currencyUsed,
                }
            })

            // Update classes to link them to this payment
            await tx.classSession.updateMany({
                where: {
                    id: { in: data.classIds }
                },
                data: {
                    paymentId: p.id
                }
            })

            return p
        })

        revalidatePath('/dashboard/profile')
        revalidatePath(`/dashboard/instructors/${data.instructorId}`)
        return result
    } catch (error) {
        handleActionError(error, "No se pudo registrar el pago al instructor.")
    }
}

export async function deleteInstructorPayment(paymentId: string) {
    try {
        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            // Free the classes linked to this payment
            await tx.classSession.updateMany({
                where: { paymentId },
                data: { paymentId: null }
            })
            await tx.instructorPayment.delete({ where: { id: paymentId } })
        })
        revalidatePath('/dashboard/instructors')
        revalidatePath('/dashboard/profile')
    } catch (error) {
        handleActionError(error, "No se pudo eliminar el pago del instructor.")
    }
}

export async function enableStudentProfile(instructorId: string) {
    await ensureRole(['admin'])
    
    const instructor = await prisma.user.findUnique({
        where: { id: instructorId }
    })

    if (!instructor) throw new Error("Instructor no encontrado")
    
    if (instructor.roles.includes('STUDENT')) {
        return instructor
    }

    try {
        const updated = await prisma.user.update({
            where: { id: instructorId },
            data: {
                roles: { set: [...instructor.roles, 'STUDENT'] }
            }
        })

        // Sincronizar metadatos
        await supabaseAdmin.auth.admin.updateUserById(instructorId, {
            user_metadata: {
                roles: updated.roles.map(r => r.toLowerCase())
            },
            app_metadata: {
                roles: updated.roles.map(r => r.toLowerCase())
            }
        })

        revalidatePath('/dashboard/instructors')
        revalidatePath(`/dashboard/instructors/${instructorId}`)
        revalidatePath('/dashboard/students')
        
        return updated
    } catch (error) {
        handleActionError(error, "No se pudo habilitar el perfil de alumna para este instructor.")
    }
}
