import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'instructor' | 'student';

export function useAuth(requireAuth = true) {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<UserRole | null>(null);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                setUser(user);
                // Get role from app_metadata or user_metadata
                const rawRole = user.app_metadata?.role || user.user_metadata?.role;
                const userRole = (rawRole ? String(rawRole).toLowerCase() : null) as UserRole;
                setRole(userRole || 'admin');
            } else {
                setUser(null);
                setRole(null);
                if (requireAuth) {
                    router.push('/login');
                }
            }
            setLoading(false);
        };

        getUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                setUser(session.user);
                const rawRole = session.user.app_metadata?.role || session.user.user_metadata?.role;
                const userRole = (rawRole ? String(rawRole).toLowerCase() : null) as UserRole;
                setRole(userRole || 'admin');
            } else {
                setUser(null);
                setRole(null);
                if (requireAuth) {
                    router.push('/login');
                }
            }
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, [router, requireAuth, supabase.auth]);

    const logout = async () => {
        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.error("Logout error:", error);
        }
        window.location.href = '/login';
    };

    return {
        isAuthenticated: !!user,
        user,
        role,
        userId: user?.id || null,
        loading,
        logout
    };
}
