"use client"

import { useState, useEffect, useMemo } from "react"
import { Sidebar } from "@/components/shared/sidebar"
import { db, ClassSession } from "@/lib/storage"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts"
import { Users, CalendarDays, TrendingUp, Percent, Award } from "lucide-react"

const COLORS = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#9333ea', '#0891b2', '#4f46e5'];

export default function StatsPage() {
    const [classes, setClasses] = useState<ClassSession[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Load data
        setClasses(db.getClasses())
        setLoading(false)
    }, [])

    // Filter for Current Month
    const currentMonthClasses = useMemo(() => {
        const now = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

        return classes.filter(c => {
            const d = new Date(c.date)
            return d >= monthStart && d <= monthEnd && c.status !== 'cancelled'
        })
    }, [classes])

    // 1. Instructor Metrics (Clases Impartidas)
    const instructorData = useMemo(() => {
        const counts: Record<string, number> = {}
        currentMonthClasses.forEach(c => {
            counts[c.instructorName] = (counts[c.instructorName] || 0) + 1
        })
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
    }, [currentMonthClasses])

    // 2. Average Occupancy (Ocupación Promedio)
    const occupancyData = useMemo(() => {
        if (currentMonthClasses.length === 0) return 0

        let totalCapacity = 0
        let totalAttendees = 0

        currentMonthClasses.forEach(c => {
            totalCapacity += c.maxCapacity
            totalAttendees += (c.attendees?.length || 0)
        })

        return totalCapacity > 0 ? Math.round((totalAttendees / totalCapacity) * 100) : 0
    }, [currentMonthClasses])

    // 3. Popularity (Disciplines by # of Attendees) "Más reservada"
    const popularityData = useMemo(() => {
        const counts: Record<string, number> = {}
        currentMonthClasses.forEach(c => {
            // Count total attendees per discipline type
            counts[c.type] = (counts[c.type] || 0) + (c.attendees?.length || 0)
        })

        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
    }, [currentMonthClasses])

    // 4. Student Attendance (Top 10 Students by attendance count)
    const studentAttendanceData = useMemo(() => {
        const counts: Record<string, number> = {}
        currentMonthClasses.forEach(c => {
            (c.attendees || []).forEach(a => {
                // Only count 'standard' or 'courtesy' ? Prompt says "asiste". Usually any attended class.
                // We use 'booked' status logic. If we had 'checked-in' we'd use that. 
                // Using all booked attendees for now.
                counts[a.studentName] = (counts[a.studentName] || 0) + 1
            })
        })

        return Object.entries(counts)
            .map(([name, clases]) => ({ name, clases }))
            .sort((a, b) => b.clases - a.clases)
            .slice(0, 10) // Top 10
    }, [currentMonthClasses])

    // KPIs
    const totalClasses = currentMonthClasses.length
    const totalAttendances = currentMonthClasses.reduce((acc, c) => acc + (c.attendees?.length || 0), 0)

    if (loading) {
        return <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">Cargando...</div>
    }

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
            <Sidebar />
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                <header className="bg-white dark:bg-slate-800 border-b p-6">
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <TrendingUp className="h-6 w-6 text-primary" />
                        Reportes y Métricas (Este Mes)
                    </h1>
                </header>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Clases Totales</CardTitle>
                                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{totalClasses}</div>
                                <p className="text-xs text-muted-foreground">Programadas este mes</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Asistencias Totales</CardTitle>
                                <Users className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{totalAttendances}</div>
                                <p className="text-xs text-muted-foreground">Cupos ocupados</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Ocupación Promedio</CardTitle>
                                <Percent className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{occupancyData}%</div>
                                <p className="text-xs text-muted-foreground">De capacidad utilizada</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Disciplina Top</CardTitle>
                                <Award className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold truncate">{popularityData[0]?.name || "N/A"}</div>
                                <p className="text-xs text-muted-foreground">Más solicitada</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Charts Row 1 */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="col-span-1">
                            <CardHeader>
                                <CardTitle>Clases por Instructor</CardTitle>
                                <CardDescription>Cantidad de sesiones impartidas este mes</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={instructorData} layout="vertical" margin={{ left: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                        <XAxis type="number" allowDecimals={false} />
                                        <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                                        <RechartsTooltip
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            cursor={{ fill: 'transparent' }}
                                        />
                                        <Bar dataKey="value" name="Clases" fill="#f43f5e" radius={[0, 4, 4, 0]} barSize={20} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card className="col-span-1">
                            <CardHeader>
                                <CardTitle>Popularidad de Disciplinas</CardTitle>
                                <CardDescription>Basado en número total de reservas</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={popularityData}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            outerRadius={100}
                                            fill="#8884d8"
                                            dataKey="value"
                                            nameKey="name"
                                            label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                        >
                                            {popularityData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Charts Row 2: Student Attendance */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Top Alumnas Asistentes</CardTitle>
                            <CardDescription>Alumnas con mayor participación este mes</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={studentAttendanceData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} />
                                    <YAxis allowDecimals={false} />
                                    <RechartsTooltip
                                        cursor={{ fill: '#f1f5f9' }}
                                        contentStyle={{ borderRadius: '8px' }}
                                    />
                                    <Bar dataKey="clases" name="Clases Asistidas" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                </div>
            </div>
        </div>
    )
}
