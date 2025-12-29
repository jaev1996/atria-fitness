"use client"
import Link from "next/link"
import { LayoutDashboard, Users, Calendar, Settings, LogOut } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"

const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
    { icon: Users, label: "Pacientes", href: "/dashboard/patients" },
    { icon: Calendar, label: "Agenda", href: "/dashboard/calendar" },
    { icon: Settings, label: "Configuración", href: "/dashboard/settings" },
]

export function Sidebar() {
    const { logout } = useAuth(false) // Don't redirect if checking auth failure here, just need logout fn

    return (
        <div className="flex h-screen w-64 flex-col border-r bg-white">
            <div className="flex h-16 items-center border-b px-6">
                <Link href="/dashboard" className="flex items-center gap-2 font-bold text-blue-600">
                    <span className="text-xl italic">DentalCloud</span>
                </Link>
            </div>
            <nav className="flex-1 space-y-1 p-4">
                {menuItems.map((item) => (
                    <Link
                        key={item.label}
                        href={item.href}
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-600"
                    >
                        <item.icon className="h-5 w-5" />
                        {item.label}
                    </Link>
                ))}
            </nav>
            <div className="border-t p-4">
                <button
                    onClick={logout}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-red-500 hover:bg-red-50"
                >
                    <LogOut className="h-5 w-5" />
                    Cerrar Sesión
                </button>
            </div>
        </div>
    )
}
