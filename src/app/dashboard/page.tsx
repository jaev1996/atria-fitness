"use client"
import { useEffect, useMemo, useSyncExternalStore } from "react"
import { db, ClassSession, Instructor } from "@/lib/storage"
import { isToday, parseISO } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Sidebar } from "@/components/shared/sidebar"
import { MobileNav } from "@/components/shared/mobile-nav"
import { Users, CalendarCheck, Activity, Clock } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"

export default function DashboardPage() {
    const { isAuthenticated, role, userId, loading } = useAuth(true)

    // Use useSyncExternalStore with a stable string snapshot to avoid infinite loops
    const storageString = useSyncExternalStore(
        (callback) => {
            window.addEventListener("storage-update", callback)
            return () => window.removeEventListener("storage-update", callback)
        },
        () => typeof window !== 'undefined' ? localStorage.getItem('atria_fitness_data_v3') : null,
        () => null
    )

    // Trigger initial load logic once
    useEffect(() => {
        if (isAuthenticated && typeof window !== 'undefined') {
            db.getAll()
        }
    }, [isAuthenticated])

    // Parse data and derive metrics based on role
    const { metrics, upcomingClasses, instructorName } = useMemo(() => {
        let classes: ClassSession[] = []
        let instructors: Instructor[] = []

        if (storageString) {
            try {
                const parsed = JSON.parse(storageString)
                classes = parsed.classes || []
                instructors = parsed.instructors || []
            } catch (e) {
                console.error("Error parsing storage data in dashboard", e)
            }
        }

        // Filter classes by instructor if relevant
        const filteredClasses = role === 'instructor'
            ? classes.filter(c => c.instructorId === userId)
            : classes

        const currentInstructor = role === 'instructor'
            ? instructors.find(i => i.id === userId)
            : null

        // Filter today
        const classesToday = filteredClasses.filter(c => {
            try {
                return c.date && isToday(parseISO(c.date)) && c.status !== 'cancelled'
            } catch { return false }
        })
        const countToday = classesToday.length

        // Count total students today (sum of attendees)
        const todayStudentsFactor = classesToday.reduce((acc, curr) => acc + (curr.attendees ? curr.attendees.length : 0), 0)

        // Pending
        const pendingStatuses = ['scheduled', 'confirmed', 'rescheduled']
        const countPending = filteredClasses.filter(c => pendingStatuses.includes(c.status)).length

        // Completed
        const countCompleted = filteredClasses.filter(c => c.status === 'completed').length

        const metricsData = {
            todayCount: countToday,
            pendingCount: countPending,
            completedCount: countCompleted,
            todayStudentsFactor
        }

        // Upcoming
        const now = new Date()
        const upcoming = filteredClasses
            .filter(c => pendingStatuses.includes(c.status))
            .sort((a, b) => {
                const dateA = new Date(`${a.date}T${a.startTime}`)
                const dateB = new Date(`${b.date}T${b.startTime}`)
                return dateA.getTime() - dateB.getTime()
            })
            .filter(c => {
                try {
                    const appDate = new Date(`${c.date}T${c.startTime}`)
                    return appDate >= now || isToday(appDate)
                } catch { return false }
            })
            .slice(0, 5)

        return {
            metrics: metricsData,
            upcomingClasses: upcoming,
            instructorName: currentInstructor?.name
        }
    }, [storageString, role, userId])

    if (loading || !isAuthenticated) return null

    const greeting = role === 'instructor' && instructorName
        ? `Hola, ${instructorName}`
        : "Hola, Atria Fitness"

    return (
        <div className="flex flex-col md:flex-row h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
            <Sidebar />
            <MobileNav />
            <main className="flex-1 p-4 md:p-8 overflow-y-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 italic">{greeting} 👋</h1>
                    <p className="text-slate-500">
                        {role === 'instructor'
                            ? "Este es el resumen de tus clases y alumnas para hoy."
                            : "Resumen general de la actividad del centro."
                        }
                    </p>
                </div>

                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                    <Card className="border-none shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-slate-500">
                                {role === 'instructor' ? "Mis Clases Hoy" : "Clases del Centro Hoy"}
                            </CardTitle>
                            <CalendarCheck className="h-4 w-4 text-primary" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{metrics.todayCount}</div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-slate-500">
                                {role === 'instructor' ? "Alumnas Hoy" : "Asistencias Hoy"}
                            </CardTitle>
                            <Users className="h-4 w-4 text-primary" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{metrics.todayStudentsFactor}</div>
                            <p className="text-xs text-slate-500">
                                {role === 'instructor' ? "inscritas en tus clases" : "cupos reservados para hoy"}
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-slate-500">
                                {role === 'instructor' ? "Clases Pendientes" : "Total Pendientes"}
                            </CardTitle>
                            <Clock className="h-4 w-4 text-primary" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{metrics.pendingCount}</div>
                            <p className="text-xs text-slate-500">
                                {role === 'instructor' ? "en tu agenda total" : "clases activas en sistema"}
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-slate-500">
                                {role === 'instructor' ? "Mis Clases Realizadas" : "Total Realizadas"}
                            </CardTitle>
                            <Activity className="h-4 w-4 text-primary" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{metrics.completedCount}</div>
                        </CardContent>
                    </Card>
                </div>

                <div className="mt-8">
                    <Card className="p-6 border-none shadow-sm">
                        <h2 className="text-xl font-semibold mb-4">
                            {role === 'instructor' ? "Mis Próximas Clases" : "Próximas Clases del Centro"}
                        </h2>
                        {upcomingClasses.length === 0 ? (
                            <div className="py-8 text-center bg-slate-50 rounded-lg border border-dashed">
                                <p className="text-slate-500 text-sm">
                                    {role === 'instructor' ? "No tienes clases programadas próximamente." : "No hay clases programadas en el centro."}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {upcomingClasses.map(c => (
                                    <div key={c.id} className="flex items-center justify-between border-b dark:border-slate-800 pb-4 last:border-0 last:pb-0">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-primary/10 p-2 rounded-full">
                                                <Clock className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="font-medium">{c.type}</p>
                                                <p className="text-sm text-slate-500">
                                                    {role === 'admin' && <span className="text-primary font-medium">{c.instructorName} • </span>}
                                                    Salón: {c.room} • {c.date}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-medium text-slate-700 dark:text-slate-300">{c.startTime}</p>
                                            <div className="flex items-center justify-end gap-1 text-xs text-slate-500">
                                                <Users className="h-3 w-3" />
                                                <span>{c.attendees?.length || 0} / {c.maxCapacity}</span>
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
