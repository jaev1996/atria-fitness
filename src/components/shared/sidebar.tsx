import Link from "next/link"
import { LayoutDashboard, Users, UserCog, Calendar, Settings, LogOut, Dumbbell, BarChart3, User } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"

export const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
    { icon: BarChart3, label: "Métricas", href: "/dashboard/stats" },
    { icon: Users, label: "Alumnas", href: "/dashboard/students" },
    { icon: UserCog, label: "Instructores", href: "/dashboard/instructors" },
    { icon: Calendar, label: "Clases", href: "/dashboard/calendar" },
    { icon: User, label: "Mi Perfil", href: "/dashboard/profile" },
    { icon: Settings, label: "Configuración", href: "/dashboard/settings" },
]

export function Sidebar() {
    const { logout, role, user } = useAuth(false)

    const filteredItems = menuItems.filter(item => {
        if (role === 'instructor') {
            return item.href === '/dashboard' ||
                item.href === '/dashboard/calendar' ||
                item.href === '/dashboard/profile' ||
                item.href === '/dashboard/students';
        }
        if (role === 'admin') {
            return true;
        }
        return false;
    });

    return (
        <div className="hidden md:flex h-screen w-64 flex-col border-r bg-white dark:bg-slate-900 dark:border-slate-800 shrink-0">
            <div className="flex h-16 items-center border-b px-6 dark:border-slate-800">
                <Link href="/dashboard" className="flex items-center gap-2 font-bold text-primary">
                    <Dumbbell className="h-6 w-6" />
                    <span className="text-xl">Atria Fitness</span>
                </Link>
            </div>
            <nav className="flex-1 space-y-1 p-4">
                {filteredItems.map((item) => (
                    <Link
                        key={item.label}
                        href={item.href}
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-600 dark:text-slate-400 transition-colors hover:bg-primary/10 hover:text-primary dark:hover:text-primary"
                    >
                        <item.icon className="h-5 w-5" />
                        {item.label}
                    </Link>
                ))}
            </nav>
            <div className="border-t p-4 dark:border-slate-800">
                {user && (
                    <div className="mb-4 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                {user.user_metadata?.name?.charAt(0) || user.email?.charAt(0) || 'U'}
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-sm font-semibold truncate text-slate-700 dark:text-slate-200">
                                    {user.user_metadata?.name || 'Usuario'}
                                </span>
                                <span className="text-[10px] text-slate-500 truncate">
                                    {user.email}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
                <button
                    onClick={logout}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                    <LogOut className="h-5 w-5" />
                    Cerrar Sesión
                </button>
            </div>
        </div>
    )
}
