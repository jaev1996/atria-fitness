"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dumbbell, Loader2, Mail, Lock, ArrowRight, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { login } from "@/actions/auth"
import { useAuth } from "@/hooks/useAuth"
import Link from "next/link"

export default function LoginPage() {
    const router = useRouter()
    const { isAuthenticated, loading } = useAuth(false)
    const [isLoading, setIsLoading] = useState(false)
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")

    useEffect(() => {
        if (!loading && isAuthenticated) {
            router.push("/dashboard")
        }
    }, [isAuthenticated, loading, router])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        const formData = new FormData()
        formData.append("email", email)
        formData.append("password", password)
        try {
            const result = await login(formData)
            if (result?.error) {
                toast.error(result.error)
                setIsLoading(false)
            } else if (result?.success) {
                toast.success("Inicio de sesión exitoso")
                router.push("/dashboard")
                router.refresh()
            }
        } catch {
            toast.error("Ocurrió un error inesperado")
            setIsLoading(false)
        }
    }

    return (
        <div className="h-screen w-full bg-slate-950 text-white overflow-hidden flex">

            {/* ── Left panel: decorative ──────────────────────────────────── */}
            <div className="hidden lg:flex flex-col justify-between flex-1 relative p-12 overflow-hidden bg-linear-to-br from-slate-900 to-slate-950">

                {/* Blobs */}
                <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-primary/20 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-primary/10 blur-2xl pointer-events-none" />
                {/* Grid texture */}
                <div
                    className="absolute inset-0 opacity-[0.03] pointer-events-none"
                    style={{
                        backgroundImage: "repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)",
                        backgroundSize: "24px 24px",
                    }}
                />

                {/* Logo */}
                <div className="relative flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/40">
                        <Dumbbell className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-xl font-bold tracking-tight">Atria Fitness</span>
                </div>

                {/* Quote */}
                <div className="relative space-y-6 max-w-md">
                    <h2 className="text-4xl xl:text-5xl font-extrabold leading-tight tracking-tight">
                        Sistema de
                        <span className="text-transparent bg-clip-text bg-linear-to-r from-primary to-purple-400">
                            {" "}Gestión Interna.
                        </span>
                    </h2>
                    <p className="text-slate-400 text-base leading-relaxed">
                        Plataforma de administración operativa exclusiva para el personal
                        de Atria Fitness. Acceso restringido.
                    </p>

                    {/* Module list */}
                    <div className="flex flex-col gap-2 pt-2">
                        {[
                            "Registro y seguimiento de alumnas",
                            "Gestión de clases e instructores",
                            "Liquidaciones y comprobantes de pago",
                        ].map(item => (
                            <div key={item} className="flex items-center gap-2 text-sm text-slate-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-primary/70 shrink-0" />
                                {item}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom note */}
                <p className="relative text-slate-600 text-xs">
                    &copy; 2026 Atria Fitness. Todos los derechos reservados.{" "}
                    <Link href="/privacy" className="hover:text-slate-400 transition-colors underline underline-offset-2">
                        Política de Privacidad
                    </Link>
                </p>
            </div>

            {/* ── Right panel: login form ─────────────────────────────────── */}
            <div className="w-full lg:w-[440px] xl:w-[480px] flex flex-col justify-center px-8 md:px-12 bg-slate-900 border-l border-slate-800/60">

                {/* Mobile logo */}
                <div className="flex items-center gap-3 mb-10 lg:hidden">
                    <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/40">
                        <Dumbbell className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-xl font-bold tracking-tight">Atria Fitness</span>
                </div>

                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-2xl font-extrabold text-white tracking-tight">Acceso al sistema</h1>
                    <p className="text-slate-400 text-sm mt-1.5">Ingresa tus credenciales para continuar</p>
                </div>

                {/* Form */}
                <form onSubmit={handleLogin} className="space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="email" className="text-slate-300 text-sm font-medium">
                            Correo Electrónico
                        </Label>
                        <div className="relative">
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                            <Input
                                id="email"
                                type="email"
                                placeholder="tu@correo.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={isLoading}
                                className="pl-10 h-11 bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 focus:border-primary focus:ring-primary/20 transition-colors"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password" className="text-slate-300 text-sm font-medium">
                            Contraseña
                        </Label>
                        <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                disabled={isLoading}
                                className="pl-10 h-11 bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 focus:border-primary focus:ring-primary/20 transition-colors"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold h-11 rounded-xl transition-all duration-200 shadow-lg shadow-primary/25 hover:shadow-primary/40 mt-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Iniciando sesión...
                            </>
                        ) : (
                            <>
                                Iniciar Sesión
                                <ArrowRight className="h-4 w-4" />
                            </>
                        )}
                    </button>
                </form>

                {/* Security note */}
                <div className="flex items-center gap-2 mt-8 pt-6 border-t border-slate-800">
                    <ShieldCheck className="h-4 w-4 text-slate-600 shrink-0" />
                    <p className="text-xs text-slate-600 leading-relaxed">
                        Uso exclusivo para personal autorizado de Atria Fitness.{" "}
                        <Link href="/privacy" className="text-slate-500 hover:text-slate-300 underline underline-offset-2 transition-colors">
                            Política de Privacidad
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
