import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { User } from "@prisma/client"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function getInstructors() {
    return await prisma.user.findMany({
        where: { role: 'INSTRUCTOR' },
        orderBy: { name: 'asc' }
    })
}

export async function addInstructor(data: { name: string, email: string, phone?: string, specialties: string[], bio?: string }) {
    // 1. Create User in Supabase Auth via Admin API (bypassing email confirmation)
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: 'atria2026', // Initial default password
        email_confirm: true,  // Auto-confirm email
        user_metadata: { name: data.name, role: 'INSTRUCTOR' }
    })

    if (authError) throw new Error(`Error creating auth user: ${authError.message}`)

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

export async function updateInstructor(id: string, data: Partial<User>) {
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
            classes: true // Important: Detail of classes paid
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
    const payment = await prisma.$transaction(async (tx) => {
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
    return payment
}
