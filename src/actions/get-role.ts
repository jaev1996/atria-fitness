'use server'

import { createClient } from '@/lib/supabase/server'

export async function getRoleFromPrisma() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return 'student'

    const { default: prisma } = await import('@/lib/prisma')
    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { role: true }
    })

    return (dbUser?.role || 'STUDENT').toLowerCase()
}
