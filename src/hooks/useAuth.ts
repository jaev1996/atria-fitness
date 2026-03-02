"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { User } from "@supabase/supabase-js"
import { getRoleFromPrisma } from "@/actions/get-role"

export type UserRole = "admin" | "instructor" | "student"

export function useAuth(requireAuth: boolean = false) {
    const router = useRouter()
    const [user, setUser] = useState<User | null>(null)
    const [role, setRole] = useState<UserRole | null>(null)
    const [userId, setUserId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let isMounted = true
        async function fetchUser() {
            const supabase = createClient()
            const { data: { user }, error } = await supabase.auth.getUser()

            if (error || !user) {
                if (isMounted) {
                    setUser(null)
                    setRole(null)
                    setUserId(null)
                    setLoading(false)
                }
                if (requireAuth) router.push("/login")
                return
            }

            if (isMounted) {
                setUser(user)
                setUserId(user.id)

                // 1. Try metadata first
                const rawRole = user.app_metadata?.role || user.user_metadata?.role
                if (rawRole) {
                    setRole(String(rawRole).toLowerCase() as UserRole)
                    setLoading(false)
                } else {
                    // 2. Fallback to Prisma if metadata is missing
                    try {
                        const dbRole = await getRoleFromPrisma()
                        setRole(dbRole as UserRole)
                    } catch {
                        setRole('student')
                    } finally {
                        setLoading(false)
                    }
                }
            }
        }
        fetchUser()
        return () => { isMounted = false }
    }, [requireAuth, router])

    const logout = async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        router.push("/login")
        router.refresh()
    }

    return { user, role, userId, loading, isAuthenticated: !!user, logout }
}
