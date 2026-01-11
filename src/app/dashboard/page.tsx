"use client"
import { useEffect, useState } from "react"
import { db, ClassSession } from "@/lib/storage"
import { isToday, parseISO } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Sidebar } from "@/components/shared/sidebar"
import { Users, CalendarCheck, Activity, Clock } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"

export default function DashboardPage() {
    const { isAuthenticated, loading } = useAuth(true)
    const [metrics, setMetrics] = useState({
        todayCount: 0,
        pendingCount: 0,
        completedCount: 0,
        todayStudentsFactor: 0
    })
    const [upcomingClasses, setUpcomingClasses] = useState<ClassSession[]>([])

    const loadData = () => {
        const rawClasses = db.getClasses()
        const classes = rawClasses || []

        // Filter today
        const classesToday = classes.filter(c => {
            try {
                return c.date && isToday(parseISO(c.date)) && c.status !== 'cancelled'
            } catch (e) { return false }
        })
        const countToday = classesToday.length

        // Count total students today (sum of attendees)
        const todayStudentsFactor = classesToday.reduce((acc, curr) => acc + (curr.attendees ? curr.attendees.length : 0), 0)

        // Pending
        const countPending = classes.filter(c => c.status === 'scheduled').length

        // Completed
        const countCompleted = classes.filter(c => c.status === 'completed').length

        setMetrics({
            todayCount: countToday,
            pendingCount: countPending,
            completedCount: countCompleted,
            todayStudentsFactor
        })

        // Upcoming: scheduled and today onwards, sort by date/time
        const now = new Date()
        const upcoming = classes
            .filter(c => c.status === 'scheduled')
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

        setUpcomingClasses(upcoming)
    }

    useEffect(() => {
        if (isAuthenticated) {
            db.getAll(); // Trigger seed if needed
            loadData()

            const handleStorageUpdate = () => loadData()
            window.addEventListener("storage-update", handleStorageUpdate)
            return () => window.removeEventListener("storage-update", handleStorageUpdate)
        }
    }, [isAuthenticated])

    if (loading || !isAuthenticated) return null

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
            <Sidebar />
            <main className="flex-1 p-8 overflow-y-auto">
                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-8">Hola, Atria Fitness</h1>

                <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-slate-500">Clases Hoy</CardTitle>
                            <CalendarCheck className="h-4 w-4 text-primary" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{metrics.todayCount}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-slate-500">Alumnas Esperadas</CardTitle>
                            <Users className="h-4 w-4 text-primary" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{metrics.todayStudentsFactor}</div>
                            <p className="text-xs text-slate-500">inscritas para hoy</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-slate-500">Clases Pendientes</CardTitle>
                            <Clock className="h-4 w-4 text-primary" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{metrics.pendingCount}</div>
                            <p className="text-xs text-slate-500">total en agenda</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-slate-500">Completadas Total</CardTitle>
                            <Activity className="h-4 w-4 text-primary" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{metrics.completedCount}</div>
                        </CardContent>
                    </Card>
                </div>

                <div className="mt-8">
                    <Card className="p-6">
                        <h2 className="text-xl font-semibold mb-4">Próximas Clases</h2>
                        {upcomingClasses.length === 0 ? (
                            <p className="text-slate-500 text-sm">No hay clases programadas próximamente.</p>
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
                                                    {c.instructorName} • {c.room}
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
