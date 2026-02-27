"use client"

import { useEffect, useState, useCallback } from "react"
import { getDashboardMetrics } from "@/actions/metrics"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Sidebar } from "@/components/shared/sidebar"
import { MobileNav } from "@/components/shared/mobile-nav"
import { Users, CalendarCheck, Activity, Clock, TrendingUp } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"

type DashboardData = Awaited<ReturnType<typeof getDashboardMetrics>>


const ROOM_LABELS: Record<string, string> = {
    "salon-alma": "Alma",
    "salon-armonia": "Armonía",
    "salon-sinergia": "Sinergia",
}

export default function DashboardPage() {
    const { isAuthenticated, role, userId, loading } = useAuth(true)
    const [data, setData] = useState<DashboardData | null>(null)
    const [dataLoading, setDataLoading] = useState(true)

    const loadData = useCallback(async () => {
        if (!role) return
        setDataLoading(true)
        try {
            const result = await getDashboardMetrics(role === "instructor" ? (userId ?? undefined) : undefined)
            setData(result)
        } catch (e) {
            console.error("Error loading dashboard metrics", e)
        } finally {
            setDataLoading(false)
        }
    }, [role, userId])

    useEffect(() => {
        if (isAuthenticated) loadData()
    }, [isAuthenticated, loadData])

    if (loading || !isAuthenticated) return null

    const greeting =
        role === "instructor" ? "Hola, Instructora 👋" : "Hola, Atria Fitness 👋"

    const kpis = [
        {
            label: role === "instructor" ? "Mis Clases Hoy" : "Clases del Centro Hoy",
            value: data?.todayCount ?? "—",
            sub: "sesiones activas",
            icon: CalendarCheck,
            color: "text-fuchsia-600",
            bg: "bg-fuchsia-50 dark:bg-fuchsia-900/20",
        },
        {
            label: role === "instructor" ? "Alumnas Hoy" : "Asistencias Hoy",
            value: data?.todayAttendances ?? "—",
            sub: "cupos reservados",
            icon: Users,
            color: "text-sky-600",
            bg: "bg-sky-50 dark:bg-sky-900/20",
        },
        {
            label: role === "instructor" ? "Clases Pendientes" : "Total Pendientes",
            value: data?.pendingCount ?? "—",
            sub: "clases activas en sistema",
            icon: Clock,
            color: "text-amber-600",
            bg: "bg-amber-50 dark:bg-amber-900/20",
        },
        role === "admin"
            ? {
                label: "Alumnas Activas",
                value: data?.totalStudents ?? "—",
                sub: "registradas en el sistema",
                icon: TrendingUp,
                color: "text-emerald-600",
                bg: "bg-emerald-50 dark:bg-emerald-900/20",
            }
            : {
                label: "Mis Clases Realizadas",
                value: data?.completedCount ?? "—",
                sub: "clases completadas",
                icon: Activity,
                color: "text-emerald-600",
                bg: "bg-emerald-50 dark:bg-emerald-900/20",
            },
    ]

    return (
        <div className="flex flex-col md:flex-row h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
            <Sidebar />
            <MobileNav />
            <main className="flex-1 p-4 md:p-8 overflow-y-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 italic">{greeting}</h1>
                    <p className="text-slate-500 mt-1">
                        {role === "instructor"
                            ? "Este es el resumen de tus clases y alumnas para hoy."
                            : "Resumen general de la actividad del centro."}
                    </p>
                </div>

                {/* KPI Cards */}
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                    {kpis.map((kpi) => (
                        <Card key={kpi.label} className="border-none shadow-sm overflow-hidden">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-slate-500">{kpi.label}</CardTitle>
                                <div className={cn("p-2 rounded-full", kpi.bg)}>
                                    <kpi.icon className={cn("h-4 w-4", kpi.color)} />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                                    {dataLoading ? (
                                        <span className="inline-block w-10 h-7 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                                    ) : (
                                        kpi.value
                                    )}
                                </div>
                                <p className="text-xs text-slate-500 mt-1">{kpi.sub}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Upcoming classes */}
                <div className="mt-8">
                    <Card className="p-6 border-none shadow-sm">
                        <h2 className="text-xl font-semibold mb-5 text-slate-800 dark:text-slate-100">
                            {role === "instructor" ? "Mis Próximas Clases" : "Próximas Clases del Centro"}
                        </h2>

                        {dataLoading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
                                ))}
                            </div>
                        ) : data?.upcoming.length === 0 ? (
                            <div className="py-12 text-center bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                                <CalendarCheck className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                                <p className="text-slate-500 text-sm">
                                    {role === "instructor"
                                        ? "No tienes clases programadas próximamente."
                                        : "No hay clases programadas en el centro."}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {data?.upcoming.map((c) => (
                                    <div
                                        key={c.id}
                                        className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 shadow-xs hover:shadow-sm transition-shadow"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="bg-primary/10 p-2 rounded-full shrink-0">
                                                <Clock className="h-5 w-5 text-primary" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                                                    {c.type}
                                                </p>
                                                <p className="text-sm text-slate-500 truncate">
                                                    {role === "admin" && (
                                                        <span className="text-primary font-medium">{c.instructorName} • </span>
                                                    )}
                                                    <span className="capitalize">
                                                        {ROOM_LABELS[c.room] ?? c.room}
                                                    </span>
                                                    {" • "}
                                                    {new Date(`${c.date}T12:00:00Z`).toLocaleDateString("es-ES", {
                                                        weekday: "short",
                                                        day: "numeric",
                                                        month: "short",
                                                    })}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0 ml-4">
                                            <p className="font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                                                {c.startTime}
                                            </p>
                                            <div className="flex items-center justify-end gap-1 text-xs text-slate-500 mt-0.5">
                                                <Users className="h-3 w-3" />
                                                <span className="tabular-nums">
                                                    {c.attendeesCount} / {c.maxCapacity}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>
            </main>
        </div>
    )
}
