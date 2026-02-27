"use server"

// Force recompile
import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { Prisma } from "@prisma/client"

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
    // 0. Check if instructor already exists in Prisma to avoid duplicates
    const existing = await prisma.user.findUnique({ where: { email: data.email } })
    if (existing) throw new Error("Ya existe un usuario registrado con este correo electrónico.")

    // 1. Create User in Supabase Auth via Admin API (bypassing email confirmation)
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: 'atria2026', // Initial default password
        email_confirm: true,  // Auto-confirm email
        user_metadata: { name: data.name, role: 'INSTRUCTOR' }
    })

    if (authError) throw new Error(`Error en Supabase Auth: ${authError.message}`)

    // 2. Create Profile in Prisma linked to Supabase ID
    const instructor = await prisma.user.create({
        data: {
            id: authUser.user.id, // Linking with Supabase Auth UUID
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
}

export async function updateInstructor(id: string, data: Prisma.UserUpdateInput) {
    const updated = await prisma.user.update({
        where: { id },
        data
    })
    revalidatePath('/dashboard/instructors')
    revalidatePath(`/dashboard/instructors/${id}`)
    return updated
}

export async function deleteInstructor(id: string) {
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
