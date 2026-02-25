"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X, Dumbbell, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import { menuItems } from "./sidebar"
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from "@/components/ui/dialog"

export function MobileNav() {
    const [open, setOpen] = useState(false)
    const pathname = usePathname()
    const { logout, role } = useAuth(false)

    const filteredItems = menuItems.filter(item => {
        if (role === 'instructor') {
            return item.href === '/dashboard' || item.href === '/dashboard/calendar' || item.href === '/dashboard/profile';
        }
        if (role === 'admin') {
            return true;
        }
        return false;
    });

    return (
        <div className="md:hidden flex h-16 items-center justify-between border-b bg-white dark:bg-slate-900 px-6 dark:border-slate-800 sticky top-0 z-40 w-full shrink-0">
            <Link href="/dashboard" className="flex items-center gap-2 font-bold text-primary">
                <Dumbbell className="h-6 w-6" />
                <span className="text-xl">Atria</span>
            </Link>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="md:hidden">
                        <Menu className="h-6 w-6" />
                    </Button>
                </DialogTrigger>
                <DialogContent className="h-full w-[280px] p-0 left-0 translate-x-0 top-0 translate-y-0 rounded-none border-r sm:max-w-none [&>button]:hidden overflow-y-auto">
                    <DialogTitle className="sr-only">Menú de Navegación</DialogTitle>
                    <DialogDescription className="sr-only">Accede a las diferentes secciones de la aplicación.</DialogDescription>
                    <div className="flex h-full flex-col bg-white dark:bg-slate-900">
                        <div className="flex h-16 items-center justify-between border-b px-6 dark:border-slate-800">
                            <div className="flex items-center gap-2 font-bold text-primary">
                                <Dumbbell className="h-6 w-6" />
                                <span className="text-xl">Atria Fitness</span>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                                <X className="h-6 w-6" />
                            </Button>
                        </div>
                        <nav className="flex-1 space-y-1 p-4">
                            {filteredItems.map((item) => (
                                <Link
                                    key={item.label}
                                    href={item.href}
                                    onClick={() => setOpen(false)}
                                    className={`flex items-center gap-3 rounded-lg px-3 py-3 transition-colors ${pathname === item.href
                                            ? "bg-primary text-white"
                                            : "text-slate-600 dark:text-slate-400 hover:bg-primary/10 hover:text-primary"
                                        }`}
                                >
                                    <item.icon className="h-5 w-5" />
                                    {item.label}
                                </Link>
                            ))}
                        </nav>
                        <div className="border-t p-4 dark:border-slate-800">
                            <button
                                onClick={() => {
                                    setOpen(false);
                                    logout();
                                }}
                                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                                <LogOut className="h-5 w-5" />
                                Cerrar Sesión
                            </button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
