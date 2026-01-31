import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function useAuth(requireAuth = true) {
    const router = useRouter();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check for auth flag in localStorage
        const authStatus = localStorage.getItem('atria_auth');

        if (authStatus === 'true') {
            setIsAuthenticated(true);
        } else {
            setIsAuthenticated(false);
            if (requireAuth) {
                // Use a macrotask to avoid blocking the render cycle
                setTimeout(() => {
                    router.push('/login');
                }, 0);
            }
        }
        setLoading(false);
    }, [router, requireAuth]);

    const login = () => {
        localStorage.setItem('atria_auth', 'true');
        setIsAuthenticated(true);
        router.push('/dashboard');
    };

    const logout = () => {
        localStorage.removeItem('atria_auth');
        setIsAuthenticated(false);
        // Add a small delay for a smoother transition
        setTimeout(() => {
            router.push('/login');
        }, 500);
    };

    return { isAuthenticated, loading, login, logout };
}
