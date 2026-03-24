import { Shield, Lock, Eye, Cookie, ArrowLeft } from "lucide-react"
import Link from "next/link"

export const metadata = {
    title: "Política de Privacidad y Cookies | Atria Fitness",
    description: "Conoce cómo Atria Fitness gestiona tus datos personales y el uso de cookies en nuestra plataforma.",
}

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
            {/* Top bar */}
            <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-brand-primary/10 flex items-center justify-center">
                            <Shield className="h-4 w-4 text-brand-primary" />
                        </div>
                        <span className="font-bold text-slate-800 dark:text-slate-100 text-lg tracking-tight">
                            Atria <span className="text-brand-primary">Fitness</span>
                        </span>
                    </div>
                    <Link
                        href="/login"
                        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-primary transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Volver
                    </Link>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 py-12">
                {/* Hero */}
                <div className="mb-10">
                    <h1 className="text-4xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight">
                        Política de Privacidad
                        <span className="block text-brand-primary text-2xl font-semibold mt-1">y Cookies</span>
                    </h1>
                    <p className="text-slate-500 mt-3 text-sm">Última actualización: Marzo 2026</p>
                </div>

                <div className="grid gap-6">
                    {/* Protection */}
                    <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="flex items-center gap-3 mb-4 text-brand-primary">
                            <Shield className="h-6 w-6 shrink-0" />
                            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Protección de Datos</h2>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                            En Atria Fitness, la seguridad de tu información es nuestra prioridad. Recopilamos únicamente los datos
                            mínimos necesarios para el funcionamiento del estudio: nombre, correo electrónico y datos de contacto
                            para la gestión de clases, asistencia y cobros. No vendemos ni compartimos tu información con terceros.
                        </p>
                    </section>

                    {/* Cookies */}
                    <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="flex items-center gap-3 mb-4 text-brand-primary">
                            <Cookie className="h-6 w-6 shrink-0" />
                            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Uso de Cookies</h2>
                        </div>
                        <div className="space-y-4 text-slate-600 dark:text-slate-400">
                            <p>Utilizamos cookies técnicas esenciales para el funcionamiento de la plataforma:</p>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li>Mantener tu sesión activa de forma segura mediante JWT.</li>
                                <li>Recordar tus preferencias de interfaz (tema, idioma).</li>
                                <li>Garantizar la seguridad de cada solicitud autenticada.</li>
                            </ul>
                            <p className="text-sm border-l-4 border-brand-primary/30 pl-4 py-1 italic text-slate-500 bg-brand-primary/5 rounded-r-lg">
                                Las cookies de sesión son <strong>estrictamente necesarias</strong> — el sistema no puede verificar
                                tu identidad sin ellas. No usamos cookies de seguimiento o publicidad de terceros.
                            </p>
                        </div>
                    </section>

                    {/* JWT */}
                    <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="flex items-center gap-3 mb-4 text-brand-primary">
                            <Lock className="h-6 w-6 shrink-0" />
                            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Seguridad JWT</h2>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                            Utilizamos JSON Web Tokens (JWT) cifrados para el manejo de sesiones. Estos tokens residen en
                            cookies seguras de tipo{" "}
                            <code className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs font-mono text-brand-primary">HttpOnly</code>
                            , lo que impide que sean accesibles o robados por scripts maliciosos en el navegador (XSS).
                        </p>
                    </section>

                    {/* Rights */}
                    <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="flex items-center gap-3 mb-4 text-brand-primary">
                            <Eye className="h-6 w-6 shrink-0" />
                            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Tus Derechos</h2>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                            Tienes derecho a acceder, rectificar o solicitar la eliminación de tus datos personales en cualquier
                            momento. Para cualquier consulta sobre privacidad o protección de datos, contacta con la administración
                            de Atria Fitness directamente.
                        </p>
                    </section>
                </div>

                <footer className="mt-16 text-center text-slate-400 text-sm pb-8 border-t border-slate-200 dark:border-slate-700 pt-8">
                    &copy; 2026 Atria Fitness &mdash; Todos los derechos reservados.
                </footer>
            </main>
        </div>
    )
}
