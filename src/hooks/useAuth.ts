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
                router.push('/login');
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
        router.push('/login');
    };

    return { isAuthenticated, loading, login, logout };
}
