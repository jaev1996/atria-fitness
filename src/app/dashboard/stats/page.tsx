"use client"

import { useState, useEffect, useCallback } from "react"
import { getMonthlyStats } from "@/actions/metrics"
import { Sidebar } from "@/components/shared/sidebar"
import { MobileNav } from "@/components/shared/mobile-nav"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
    ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend
} from "recharts"
import { Users, CalendarDays, TrendingUp, Percent, Award, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import { ShieldAlert, Loader2 } from "lucide-react"
import Link from "next/link"

const COLORS = ["#e11d48", "#2563eb", "#16a34a", "#d97706", "#9333ea", "#0891b2", "#4f46e5", "#db2777"]

type Stats = Awaited<ReturnType<typeof getMonthlyStats>>

// Skeleton Card helper
function SkeletonCard() {
    return <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
}

function SkeletonChart() {
    return <div className="h-[280px] bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
}

export default function StatsPage() {
    const { role, loading: authLoading } = useAuth(true)
    const [stats, setStats] = useState<Stats | null>(null)
    const [loading, setLoading] = useState(true)
    const [selectedDate, setSelectedDate] = useState(() => new Date())

    const loadStats = useCallback(async () => {
        setLoading(true)
        try {
            const year = selectedDate.getFullYear()
            const month = selectedDate.getMonth() + 1
            const result = await getMonthlyStats(year, month)
            setStats(result)
        } catch (e) {
            console.error("Error loading stats:", e)
        } finally {
            setLoading(false)
        }
    }, [selectedDate])

    useEffect(() => {
        if (role === 'admin') {
            loadStats()
        }
    }, [loadStats, role])

    if (authLoading) return (
        <div className="flex h-screen flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 gap-4 text-slate-500">
            <Loader2 className="h-10 w-10 animate-spin text-brand-primary" />
            <p className="italic text-sm animate-pulse">Verificando permisos...</p>
        </div>
    );

    if (role !== 'admin') {
        return (
            <div className="flex h-screen items-center justify-center p-4 bg-slate-50 dark:bg-slate-900">
                <div className="text-center bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg border max-w-md w-full">
                    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
                        <ShieldAlert className="h-10 w-10 text-destructive" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2 italic">Acceso Denegado</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-8">Lo sentimos, esta sección es exclusiva para la administración de Atria Fitness.</p>
                    <Link href="/dashboard">
                        <Button className="w-full h-12 text-lg">Volver al Dashboard</Button>
                    </Link>
                </div>
            </div>
        )
    }

    const navigateMonth = (direction: "prev" | "next") => {
        const newDate = new Date(selectedDate)
        newDate.setMonth(newDate.getMonth() + (direction === "next" ? 1 : -1))
        setSelectedDate(newDate)
    }

    const monthLabel = selectedDate.toLocaleDateString("es-ES", { month: "long", year: "numeric" })

    const kpis = [
        {
            label: "Clases Totales",
            value: stats?.totalClasses,
            sub: "sesiones del mes (sin canceladas)",
            icon: CalendarDays,
        },
        {
            label: "Asistencias Totales",
            value: stats?.totalAttendances,
            sub: "cupos ocupados en clases",
            icon: Users,
        },
        {
            label: "Ocupación Promedio",
            value: stats ? `${stats.occupancyPct}%` : undefined,
            sub: "de capacidad utilizada",
            icon: Percent,
        },
        {
            label: "Disciplina Top",
            value: stats?.topDiscipline,
            sub: "más reservas este mes",
            icon: Award,
        },
    ]

    return (
        <div className="flex flex-col md:flex-row h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
            <Sidebar />
            <MobileNav />
            <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
                {/* Header */}
                <header className="bg-white dark:bg-slate-800 border-b p-4 md:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <TrendingUp className="h-6 w-6 text-brand-primary" />
                        Reportes y Métricas
                    </h1>

                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border rounded-full px-3 py-1.5 shadow-sm">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => navigateMonth("prev")}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-semibold capitalize min-w-[130px] text-center">{monthLabel}</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => navigateMonth("next")}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {kpis.map((kpi) => (
                            <Card key={kpi.label}>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">{kpi.label}</CardTitle>
                                    <kpi.icon className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    {loading ? (
                                        <SkeletonCard />
                                    ) : (
                                        <>
                                            <div className="text-2xl font-bold tabular-nums truncate">
                                                {kpi.value ?? "—"}
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Row 1: Clases por día + Instructor */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Clases por día del mes */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Clases por Día</CardTitle>
                                <CardDescription>Distribución de sesiones a lo largo del mes</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[280px]">
                                {loading ? <SkeletonChart /> : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={stats?.dailyData} margin={{ left: 0, right: 8 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                                            <RechartsTooltip
                                                contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                formatter={(v: any) => [`${v} clases`, "Sesiones"]}
                                                labelFormatter={(l) => `Día ${l}`}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="value"
                                                name="Clases"
                                                stroke="#f43f5e"
                                                strokeWidth={2.5}
                                                dot={{ r: 3, fill: "#f43f5e" }}
                                                activeDot={{ r: 5 }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                )}
                            </CardContent>
                        </Card>

                        {/* Clases por Instructor */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Clases por Instructora</CardTitle>
                                <CardDescription>Sesiones impartidas este mes</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[280px]">
                                {loading ? <SkeletonChart /> : (
                                    stats?.instructorData.length === 0 ? (
                                        <div className="h-full flex items-center justify-center text-sm text-slate-400">
                                            Sin datos para este mes
                                        </div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={stats?.instructorData} layout="vertical" margin={{ left: 10 }}>
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                                                <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11 }} />
                                                <RechartsTooltip
                                                    contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                                                    cursor={{ fill: "#f1f5f9" }}
                                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                    formatter={(v: any) => [`${v} clases`, "Clases"]}
                                                />
                                                <Bar dataKey="value" name="Clases" fill="#f43f5e" radius={[0, 4, 4, 0]} barSize={18} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Row 2: Popularidad disciplinas + Top alumnas */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Popularity pie */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Popularidad de Disciplinas</CardTitle>
                                <CardDescription>Basado en número total de reservas</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[280px]">
                                {loading ? <SkeletonChart /> : (
                                    stats?.popularityData.length === 0 ? (
                                        <div className="h-full flex items-center justify-center text-sm text-slate-400">
                                            Sin datos para este mes
                                        </div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={stats?.popularityData}
                                                    cx="50%"
                                                    cy="50%"
                                                    labelLine={false}
                                                    outerRadius={90}
                                                    dataKey="value"
                                                    nameKey="name"
                                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                    label={({ name, percent }: any) =>
                                                        (percent ?? 0) > 0.05 ? `${name} ${Math.round((percent ?? 0) * 100)}%` : ""
                                                    }
                                                >
                                                    {stats?.popularityData.map((_, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <RechartsTooltip
                                                    contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                    formatter={(v: any) => [`${v} reservas`, ""]}
                                                />
                                                <Legend formatter={(value) => <span className="text-xs">{value}</span>} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    )
                                )}
                            </CardContent>
                        </Card>

                        {/* Top Alumnas */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Top Alumnas Asistentes</CardTitle>
                                <CardDescription>Mayor participación en clases este mes</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[280px]">
                                {loading ? <SkeletonChart /> : (
                                    stats?.topStudents.length === 0 ? (
                                        <div className="h-full flex items-center justify-center text-sm text-slate-400">
                                            Sin datos para este mes
                                        </div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={stats?.topStudents} margin={{ top: 8, right: 8, left: 0, bottom: 32 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                <XAxis
                                                    dataKey="name"
                                                    tick={{ fontSize: 10 }}
                                                    interval={0}
                                                    angle={-30}
                                                    textAnchor="end"
                                                />
                                                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                                                <RechartsTooltip
                                                    cursor={{ fill: "#f1f5f9" }}
                                                    contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                    formatter={(v: any) => [`${v} clases`, "Asistencias"]}
                                                />
                                                <Bar dataKey="clases" name="Clases Asistidas" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={32} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    )
}
