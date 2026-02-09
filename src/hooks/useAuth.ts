import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export type UserRole = 'admin' | 'instructor';

export function useAuth(requireAuth = true) {
    const router = useRouter();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [role, setRole] = useState<UserRole | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAuth = () => {
            const authStatus = localStorage.getItem('atria_auth');
            const userRole = localStorage.getItem('atria_role') as UserRole;
            const uId = localStorage.getItem('atria_user_id');

            if (authStatus === 'true') {
                setIsAuthenticated(true);
                setRole(userRole || 'admin');
                setUserId(uId);
            } else {
                setIsAuthenticated(false);
                setRole(null);
                setUserId(null);
                if (requireAuth) {
                    router.push('/login');
                }
            }
            setLoading(false);
        };

        // Use a timer to avoid synchronous state updates during initial render if needed,
        // but since we want to avoid extra renders, we just run it once.
        checkAuth();
    }, [router, requireAuth]);

    const login = (userRole: UserRole = 'admin', uId: string | null = null) => {
        localStorage.setItem('atria_auth', 'true');
        localStorage.setItem('atria_role', userRole);
        if (uId) {
            localStorage.setItem('atria_user_id', uId);
        } else {
            localStorage.removeItem('atria_user_id');
        }

        setIsAuthenticated(true);
        setRole(userRole);
        setUserId(uId);

        if (userRole === 'instructor') {
            router.push('/dashboard/calendar');
        } else {
            router.push('/dashboard');
        }
    };

    const logout = () => {
        localStorage.removeItem('atria_auth');
        localStorage.removeItem('atria_role');
        localStorage.removeItem('atria_user_id');
        setIsAuthenticated(false);
        setRole(null);
        setUserId(null);
        setTimeout(() => {
            router.push('/login');
        }, 500);
    };

    return { isAuthenticated, role, userId, loading, login, logout };
}
