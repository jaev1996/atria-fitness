'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
    const supabase = await createClient()

    const email = formData.get('email') as string
    const password = formData.get('password') as string

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/', 'layout')
    return { success: true }
}

export async function logout() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    revalidatePath('/', 'layout')
    redirect('/login')
}

export async function getUser() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
        return null
    }
    return user
}

export async function changePassword(newPassword: string) {
    const supabase = await createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw new Error(error.message)
    return { success: true }
}

export async function updateProfile(name: string, email: string) {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) throw new Error("No autenticado")

    // Update Supabase Auth (email + display name in metadata)
    const { error: updateError } = await supabase.auth.updateUser({
        email,
        data: { name }
    })
    if (updateError) throw new Error(updateError.message)

    // Sync name/email in Prisma profile too
    const { default: prisma } = await import('@/lib/prisma')
    await prisma.user.updateMany({
        where: { id: user.id },
        data: { name, email }
    })

    revalidatePath('/dashboard/profile')
    return { success: true }
}
