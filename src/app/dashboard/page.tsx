"use client"
import { useEffect, useState } from "react"
import { db, Appointment } from "@/lib/storage"
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
        totalTreatments: 0
    })
    const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([])

    const loadData = () => {
        const rawAppointments = db.getAppointments()
        // Handle potential null/undefined from storage if seeded poorly or empty
        const appointments = rawAppointments || []

        // Filter today
        const countToday = appointments.filter(app => {
            try {
                return isToday(parseISO(app.date)) && app.status !== 'cancelled'
            } catch (e) { return false }
        }).length

        // Pending
        const countPending = appointments.filter(app => app.status === 'scheduled').length

        // Using total treatments as just total appointments for now or completed
        const countTreatments = appointments.filter(app => app.status === 'completed').length

        setMetrics({
            todayCount: countToday,
            pendingCount: countPending,
            totalTreatments: countTreatments
        })

        // Upcoming: scheduled and today onwards, sort by date/time
        const now = new Date()
        const upcoming = appointments
            .filter(app => app.status === 'scheduled')
            .sort((a, b) => {
                const dateA = new Date(`${a.date}T${a.startTime}`)
                const dateB = new Date(`${b.date}T${b.startTime}`)
                return dateA.getTime() - dateB.getTime()
            })
            .filter(app => {
                const appDate = new Date(`${app.date}T${app.startTime}`)
                return appDate >= now || isToday(appDate) // Include today's even if passed slightly or simplistic check
            })
            .slice(0, 5)

        setUpcomingAppointments(upcoming)
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

    if (loading || !isAuthenticated) return null // or simple loading spinner

    return (
        <div className="flex h-screen bg-slate-50">
            <Sidebar />
            <main className="flex-1 p-8 overflow-y-auto">
                <h1 className="text-3xl font-bold text-slate-800 mb-8">Bienvenido, Dr. García</h1>

                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-slate-500">Pacientes Hoy</CardTitle>
                            <Users className="h-4 w-4 text-blue-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{metrics.todayCount}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-slate-500">Citas Pendientes</CardTitle>
                            <CalendarCheck className="h-4 w-4 text-green-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{metrics.pendingCount}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-slate-500">Completadas Total</CardTitle>
                            <Activity className="h-4 w-4 text-orange-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{metrics.totalTreatments}</div>
                        </CardContent>
                    </Card>
                </div>

                <div className="mt-8">
                    <Card className="p-6">
                        <h2 className="text-xl font-semibold mb-4">Próximas Citas</h2>
                        {upcomingAppointments.length === 0 ? (
                            <p className="text-slate-500 text-sm">No hay citas registradas para las próximas horas.</p>
                        ) : (
                            <div className="space-y-4">
                                {upcomingAppointments.map(app => (
                                    <div key={app.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-blue-50 p-2 rounded-full">
                                                <Clock className="h-5 w-5 text-blue-600" />
                                            </div>
                                            <div>
                                                <p className="font-medium">{app.patientName}</p>
                                                <p className="text-sm text-slate-500">{app.treatmentType}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-medium text-slate-700">{app.startTime} - {app.endTime}</p>
                                            <p className="text-xs text-slate-400">{app.date}</p>
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
