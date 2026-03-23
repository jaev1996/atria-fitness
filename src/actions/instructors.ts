"use server"

// Force recompile
import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { Prisma } from "@prisma/client"
import { ensureRole } from "@/lib/auth-utils"
import { AddInstructorSchema, AddInstructorPaymentSchema } from "@/lib/schemas"

export async function getInstructors() {
    console.log("Action: getInstructors called")
    try {
        const instructors = await prisma.user.findMany({
            where: { role: 'INSTRUCTOR' },
            orderBy: { name: 'asc' }
        })
        console.log(`Found ${instructors.length} instructors`)
        return instructors
    } catch (error) {
        console.error("Error fetching instructors:", error)
        throw error
    }
}

export async function addInstructor(data: { name: string, email: string, phone?: string, specialties: string[], bio?: string }) {
    await ensureRole(['admin'])
    AddInstructorSchema.parse(data)

    // 0. Explicit duplicate checks
    const existing = await prisma.user.findFirst({
        where: {
            OR: [
                { email: data.email },
                data.phone ? { phone: data.phone } : {},
                { name: { equals: data.name, mode: 'insensitive' as Prisma.QueryMode } }
            ].filter(c => Object.keys(c).length > 0),
            role: 'INSTRUCTOR'
        }
    })

    if (existing) {
        if (existing.email === data.email) throw new Error("Ya existe un instructor registrado con este correo electrónico.")
        if (data.phone && existing.phone === data.phone) throw new Error(`Este número de teléfono ya está registrado con otro instructor (${existing.name}).`)
        if (existing.name.toLowerCase() === data.name.toLowerCase()) throw new Error(`Ya existe un instructor registrado con el nombre "${data.name}".`)
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
                email: data.email,
                phone: data.phone,
                specialties: data.specialties,
                bio: data.bio,
                role: 'INSTRUCTOR'
            }
        })
        revalidatePath('/dashboard/instructors')
        return instructor
    } catch (error) {
        console.error("Prisma error adding instructor:", error)
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new Error("Ya existe un instructor con este correo electrónico o teléfono.")
        }
        throw new Error("Error inesperado al guardar los datos del instructor.")
    }
}

export async function updateInstructor(id: string, data: Prisma.UserUpdateInput) {
    await ensureRole(['admin'])

    // Check for duplicates excluding self
    if (data.email || data.phone || data.name) {
        const existing = await prisma.user.findFirst({
            where: {
                OR: [
                    data.email ? { email: data.email as string } : {},
                    data.phone ? { phone: data.phone as string } : {},
                    data.name ? { name: { equals: data.name as string, mode: 'insensitive' as Prisma.QueryMode } } : {}
                ].filter(c => Object.keys(c).length > 0),
                id: { not: id },
                role: 'INSTRUCTOR'
            }
        })

        if (existing) {
            if (data.email && existing.email === data.email) throw new Error("Ya existe otro instructor con este correo electrónico.")
            if (data.phone && existing.phone === data.phone) throw new Error(`Este número de teléfono ya está registrado con otro instructor (${existing.name}).`)
            if (data.name && (data.name as string).toLowerCase() === existing.name.toLowerCase()) throw new Error(`Ya existe otro instructor con el nombre "${data.name}".`)
        }
    }

    try {
        const updated = await prisma.user.update({
            where: { id },
            data
        })
        // Sync with Supabase Auth
        await supabaseAdmin.auth.admin.updateUserById(id, {
            user_metadata: {
                name: typeof updated.name === 'string' ? updated.name : undefined,
                role: updated.role.toLowerCase()
            },
            app_metadata: {
                role: updated.role.toLowerCase()
            }
        })

        revalidatePath('/dashboard/instructors')
        revalidatePath(`/dashboard/instructors/${id}`)
        return updated
    } catch (error) {
        console.error("Prisma error updating instructor:", error)
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new Error("Ya existe otro instructor con los mismos datos (email/teléfono).")
        }
        throw new Error("Error al actualizar los datos del instructor.")
    }
}

export async function deleteInstructor(id: string) {
    await ensureRole(['admin'])
    await prisma.user.delete({ where: { id } })
    revalidatePath('/dashboard/instructors')
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
    notes?: string
}) {
    await ensureRole(['admin'])
    AddInstructorPaymentSchema.parse(data)

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

    // Create payment and link classes in a transaction
    const payment = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const p = await tx.instructorPayment.create({
            data: {
                instructorId: data.instructorId,
                amount: data.amount,
                startDate: new Date(data.startDate),
                endDate: new Date(data.endDate),
                notes: data.notes,
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
    return payment
}

export async function deleteInstructorPayment(paymentId: string) {
    await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
        // Free the classes linked to this payment
        await tx.classSession.updateMany({
            where: { paymentId },
            data: { paymentId: null }
        })
        await tx.instructorPayment.delete({ where: { id: paymentId } })
    })
    revalidatePath('/dashboard/instructors')
    revalidatePath('/dashboard/profile')
}
