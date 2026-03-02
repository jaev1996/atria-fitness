"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { Cookie, X, ChevronDown, CheckCircle2, ShieldCheck, BarChart2 } from "lucide-react"

export function CookieConsent() {
    const [isVisible, setIsVisible] = useState(false)
    const [showDetails, setShowDetails] = useState(false)

    useEffect(() => {
        const consent = localStorage.getItem("cookie-consent")
        if (!consent) {
            const timer = setTimeout(() => setIsVisible(true), 500)
            return () => clearTimeout(timer)
        }
    }, [])

    const handleAccept = () => {
        localStorage.setItem("cookie-consent", "true")
        setIsVisible(false)
    }

    const handleDecline = () => {
        localStorage.setItem("cookie-consent", "necessary")
        setIsVisible(false)
    }

    const categories = [
        {
            title: "Necesarias",
            description: "Esenciales para el inicio de sesión y seguridad (JWT, sesiones).",
            icon: ShieldCheck,
            required: true
        },
        {
            title: "Preferencias",
            description: "Recuerdan tus ajustes como el idioma o modo oscuro.",
            icon: CheckCircle2,
            required: false
        },
        {
            title: "Analíticas",
            description: "Nos ayudan a entender cómo usas la app para mejorarla.",
            icon: BarChart2,
            required: false
        },
    ]

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ y: 50, opacity: 0, scale: 0.95 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: 50, opacity: 0, scale: 0.95 }}
                    className="fixed bottom-6 left-6 right-6 md:left-auto md:right-8 md:max-w-md z-50"
                >
                    <div className="bg-white/95 dark:bg-slate-900/95 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-200/50 dark:border-slate-700/50 p-6 flex flex-col gap-5 backdrop-blur-xl">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-primary/10 rounded-xl">
                                    <Cookie className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-slate-900 dark:text-slate-50">Control de Cookies</h3>
                                    <p className="text-[10px] text-primary font-medium tracking-wider uppercase">Privacidad garantizada</p>
                                </div>
                            </div>
                            <button onClick={() => setIsVisible(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                Utilizamos cookies para optimizar tu experiencia, manejar sesiones seguras y analizar el uso de nuestra plataforma fitness.
                            </p>

                            <button
                                onClick={() => setShowDetails(!showDetails)}
                                className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                            >
                                {showDetails ? "Ocultar detalles" : "Ver detalles técnicos"}
                                <motion.div animate={{ rotate: showDetails ? 180 : 0 }}>
                                    <ChevronDown className="h-4 w-4" />
                                </motion.div>
                            </button>

                            <AnimatePresence>
                                {showDetails && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800"
                                    >
                                        <div className="p-3 space-y-3">
                                            {categories.map((cat, i) => (
                                                <div key={i} className="flex gap-3">
                                                    <cat.icon className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                                                            {cat.title}
                                                            {cat.required && <span className="text-[9px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded uppercase">Siempre activo</span>}
                                                        </span>
                                                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                                            {cat.description}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2">
                            <Button onClick={handleAccept} className="flex-1 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 h-11">
                                Aceptar todas
                            </Button>
                            <Button variant="outline" onClick={handleDecline} className="flex-1 border-slate-200 dark:border-slate-700 h-11 hover:bg-slate-50 dark:hover:bg-slate-800">
                                Solo necesarias
                            </Button>
                        </div>

                        <div className="text-[10px] text-center text-slate-400 pb-1">
                            Respetamos tu privacidad. Consulta nuestra <a href="/privacy" className="underline hover:text-primary transition-colors">Política de Datos</a>.
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
