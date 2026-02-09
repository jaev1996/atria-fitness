import Link from "next/link"
import { LayoutDashboard, Users, UserCog, Calendar, Settings, LogOut, Dumbbell, BarChart3 } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"

const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
    { icon: BarChart3, label: "Métricas", href: "/dashboard/stats" },
    { icon: Users, label: "Alumnas", href: "/dashboard/students" },
    { icon: UserCog, label: "Instructores", href: "/dashboard/instructors" },
    { icon: Calendar, label: "Clases", href: "/dashboard/calendar" },
    { icon: Settings, label: "Configuración", href: "/dashboard/settings" },
]

export function Sidebar() {
    const { logout, role } = useAuth(false)

    const filteredItems = menuItems.filter(item => {
        if (role === 'instructor') {
            return item.href === '/dashboard/calendar';
        }
        return true;
    });

    return (
        <div className="flex h-screen w-64 flex-col border-r bg-white dark:bg-slate-900 dark:border-slate-800">
            <div className="flex h-16 items-center border-b px-6 dark:border-slate-800">
                <Link href={role === 'instructor' ? "/dashboard/calendar" : "/dashboard"} className="flex items-center gap-2 font-bold text-primary">
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
