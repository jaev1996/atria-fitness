"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { db, Instructor, ClassSession, calculateClassPayment, InstructorPayment } from "@/lib/storage"
import { Sidebar } from "@/components/shared/sidebar"
import { MobileNav } from "@/components/shared/mobile-nav"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Users, Mail, Phone, History, Calendar as CalendarIcon, Wallet, User, Lock, Save, LogOut } from "lucide-react"
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns"
import { useAuth } from "@/hooks/useAuth"
import { toast } from "sonner"

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' }).format(amount);
}

export default function ProfilePage() {
    const { userId, role, loading: authLoading, logout } = useAuth()
    const router = useRouter()
    const [mounted, setMounted] = useState(false)

    // Admin Profile State
    const [adminProfile, setAdminProfile] = useState({
        name: "Administrador Atria",
        email: "master@atriafit.com"
    })
    const [passwords, setPasswords] = useState({
        current: "",
        new: "",
        confirm: ""
    })

    useEffect(() => {
        const timer = setTimeout(() => {
            setMounted(true)
            // Load admin data from localStorage if exists
            const savedAdmin = localStorage.getItem('atria_admin_data')
            if (savedAdmin) {
                setAdminProfile(JSON.parse(savedAdmin))
            }
        }, 0)
        return () => clearTimeout(timer)
    }, [])

    const handleSaveAdminProfile = () => {
        localStorage.setItem('atria_admin_data', JSON.stringify(adminProfile))
        toast.success("Perfil actualizado correctamente")
    }

    const handleChangePassword = (e: React.FormEvent) => {
        e.preventDefault()
        if (passwords.new !== passwords.confirm) {
            toast.error("Las contraseñas no coinciden")
            return
        }
        if (passwords.new.length < 6) {
            toast.error("La contraseña debe tener al menos 6 caracteres")
            return
        }
        // Simulated password change
        toast.success("Contraseña actualizada (Simulado)")
        setPasswords({ current: "", new: "", confirm: "" })
    }

    const instructor = useMemo<Instructor | null>(() => {
        if (!mounted || !userId || role !== 'instructor') return null
        const allInstructors = db.getInstructors()
        return allInstructors.find(i => i.id === userId) || null
    }, [userId, mounted, role])

    const classes = useMemo<ClassSession[]>(() => {
        if (!mounted) return []
        return db.getClasses()
    }, [mounted])

    const [dateRange, setDateRange] = useState<{ start: string, end: string }>({
        start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
        end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
    })

    const paymentHistory = useMemo<InstructorPayment[]>(() => {
        if (!mounted || !userId || role !== 'instructor') return []
        return db.getInstructorPayments(userId)
    }, [userId, mounted, role])

    const payrollData = useMemo(() => {
        if (!instructor || !userId || role !== 'instructor') return { classes: [], totalClasses: 0, totalPay: 0, avgStudents: 0, todayClasses: [] }

        const start = parseISO(dateRange.start)
        const end = parseISO(dateRange.end)

        const filteredClasses = classes.filter(c => {
            if (c.instructorId !== userId) return false;
            if (c.status !== 'completed' && c.status !== 'confirmed') return false;
            if (c.paymentId) return false;

            const classDate = parseISO(c.date)
            const adjustedEnd = new Date(end)
            adjustedEnd.setHours(23, 59, 59)

            return isWithinInterval(classDate, { start, end: adjustedEnd })
        })

        const totalClasses = filteredClasses.length
        const totalPay = filteredClasses.reduce((acc, c) => acc + calculateClassPayment(c), 0)
        const totalStudents = filteredClasses.reduce((acc, c) => acc + c.attendees.length, 0)
        const avgStudents = totalClasses > 0 ? (totalStudents / totalClasses).toFixed(1) : "0"

        const today = new Date().toISOString().split('T')[0]
        const todayClasses = classes.filter(c => c.instructorId === userId && c.date === today && c.status !== 'cancelled')

        return {
            classes: filteredClasses.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
            totalClasses,
            totalPay,
            avgStudents,
            todayClasses: todayClasses.sort((a, b) => a.startTime.localeCompare(b.startTime))
        }
    }, [classes, instructor, userId, dateRange, role])

    if (!mounted || authLoading) return null

    if (role === 'admin') {
        return (
            <div className="flex flex-col md:flex-row h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
                <Sidebar />
                <MobileNav />
                <main className="flex-1 p-4 md:p-8 overflow-y-auto min-w-0">
                    <div className="max-w-4xl mx-auto space-y-8">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 italic">Mi Perfil</h1>
                            <p className="text-slate-500 text-sm">Gestiona tu información de acceso y preferencias.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {/* Left: Avatar & Logout */}
                            <div className="md:col-span-1">
                                <Card className="border-none shadow-md bg-white dark:bg-slate-800 p-6 text-center">
                                    <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center text-primary text-4xl mx-auto mb-4 border-2 border-primary/20 shadow-inner">
                                        <User className="h-12 w-12" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{adminProfile.name}</h3>
                                    <Badge variant="outline" className="mt-2 text-primary border-primary/30 uppercase tracking-widest text-[10px]">Administrador</Badge>

                                    <div className="mt-8 space-y-2">
                                        <Button variant="outline" className="w-full text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600" onClick={logout}>
                                            <LogOut className="mr-2 h-4 w-4" /> Cerrar Sesión
                                        </Button>
                                    </div>
                                </Card>
                            </div>

                            {/* Right: Settings Form */}
                            <div className="md:col-span-2 space-y-6">
                                <Card className="border-none shadow-md overflow-hidden">
                                    <CardHeader className="bg-slate-50 dark:bg-slate-800/50 border-b">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <User className="h-5 w-5 text-primary" /> Información de la Cuenta
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-6 space-y-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="admin-name">Nombre Completo</Label>
                                            <Input
                                                id="admin-name"
                                                value={adminProfile.name}
                                                onChange={(e) => setAdminProfile({ ...adminProfile, name: e.target.value })}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="admin-email">Correo Electrónico</Label>
                                            <Input
                                                id="admin-email"
                                                type="email"
                                                value={adminProfile.email}
                                                onChange={(e) => setAdminProfile({ ...adminProfile, email: e.target.value })}
                                            />
                                        </div>
                                        <Button onClick={handleSaveAdminProfile} className="bg-primary hover:bg-primary/90">
                                            <Save className="mr-2 h-4 w-4" /> Guardar Cambios
                                        </Button>
                                    </CardContent>
                                </Card>

                                <Card className="border-none shadow-md overflow-hidden">
                                    <CardHeader className="bg-slate-50 dark:bg-slate-800/50 border-b">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <Lock className="h-5 w-5 text-primary" /> Seguridad
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-6">
                                        <form onSubmit={handleChangePassword} className="space-y-4">
                                            <div className="grid gap-2">
                                                <Label htmlFor="curr-pass">Contraseña Actual</Label>
                                                <Input
                                                    id="curr-pass"
                                                    type="password"
                                                    value={passwords.current}
                                                    onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                                                />
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="grid gap-2">
                                                    <Label htmlFor="new-pass">Nueva Contraseña</Label>
                                                    <Input
                                                        id="new-pass"
                                                        type="password"
                                                        value={passwords.new}
                                                        onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                                                    />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="conf-pass">Confirmar Nueva Contraseña</Label>
                                                    <Input
                                                        id="conf-pass"
                                                        type="password"
                                                        value={passwords.confirm}
                                                        onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                            <Button type="submit" variant="secondary" className="w-full sm:w-auto">
                                                Actualizar Contraseña
                                            </Button>
                                        </form>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        )
    }

    if (!instructor) return (
        <div className="flex h-screen items-center justify-center">
            <p className="text-slate-500">Cargando perfil...</p>
        </div>
    )

    return (
        <div className="flex flex-col md:flex-row h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
            <Sidebar />
            <MobileNav />
            <main className="flex-1 p-4 md:p-8 overflow-y-auto min-w-0">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 italic">Hola, {instructor.name}! 👋</h1>
                        <p className="text-slate-500 text-sm">Este es tu resumen de actividad y pagos en Atria Fitness.</p>
                    </div>
                    <Badge className="px-4 py-1.5 bg-primary/10 text-primary border-primary/20 text-sm">
                        Instructor Activo
                    </Badge>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Stats & Quick Info */}
                    <div className="lg:col-span-1 space-y-6">
                        <Card className="overflow-hidden border-none shadow-md bg-linear-to-br from-slate-900 to-slate-800 text-white">
                            <CardContent className="p-6">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center text-primary text-2xl border-2 border-primary/30">
                                        {instructor.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold">{instructor.name}</h3>
                                        <p className="text-slate-400 text-xs">Instructor de Atria</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <Mail className="h-4 w-4 text-primary" />
                                        <span className="text-sm opacity-90">{instructor.email || "No registrado"}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Phone className="h-4 w-4 text-primary" />
                                        <span className="text-sm opacity-90">{instructor.phone || "No registrado"}</span>
                                    </div>
                                </div>
                                <Separator className="my-6 bg-white/10" />
                                <div>
                                    <Label className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Especialidades</Label>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {instructor.specialties.map(s => (
                                            <Badge key={s} className="bg-white/10 hover:bg-white/20 text-white border-none">
                                                {s}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                                <div className="mt-6">
                                    <Label className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Sobre mí</Label>
                                    <p className="text-xs text-slate-300 mt-1 italic">{instructor.bio || "Sin biografía"}</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-none shadow-md bg-white dark:bg-slate-800">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <CalendarIcon className="h-4 w-4 text-primary" /> Mi Agenda Hoy
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {payrollData.todayClasses.length === 0 ? (
                                    <p className="text-xs text-slate-500 italic">No tienes clases para hoy.</p>
                                ) : (
                                    payrollData.todayClasses.map(c => (
                                        <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                                            <div>
                                                <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{c.startTime}</p>
                                                <p className="text-[10px] text-slate-500">{c.type}</p>
                                            </div>
                                            <Badge className="text-[8px] h-4" variant={c.status === 'confirmed' ? 'default' : 'outline'}>
                                                {c.status === 'confirmed' ? 'Confirmada' : 'Programada'}
                                            </Badge>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>

                        <Card className="border-none shadow-md">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Wallet className="h-4 w-4 text-primary" /> Próximo Cobro Estimado
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                                    {formatCurrency(payrollData.totalPay)}
                                </div>
                                <p className="text-[10px] text-slate-500 mt-1">
                                    Basado en {payrollData.totalClasses} clases realizadas en el periodo actual.
                                </p>
                                <Button className="w-full mt-4 bg-primary/10 text-primary hover:bg-primary/20 border-none h-9 text-xs" onClick={() => router.push('/dashboard/calendar')}>
                                    Ver mi agenda
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column: Detailed views */}
                    <div className="lg:col-span-2 space-y-6">
                        <Tabs defaultValue="payroll" className="w-full">
                            <TabsList className="bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm border h-11">
                                <TabsTrigger value="payroll" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white h-9 px-6 transition-all duration-200">
                                    Pagos Pendientes
                                </TabsTrigger>
                                <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white h-9 px-6 transition-all duration-200">
                                    Historial
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="payroll" className="mt-6 space-y-4">
                                <Card className="border-none shadow-sm">
                                    <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 gap-4">
                                        <div>
                                            <CardTitle className="text-lg">Detalle de Sesiones</CardTitle>
                                            <CardDescription className="text-xs">Clases que aún no han sido liquidadas.</CardDescription>
                                        </div>
                                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                            <div className="grid gap-1">
                                                <Input
                                                    type="date"
                                                    className="h-8 text-[10px] sm:text-xs w-full sm:w-32"
                                                    value={dateRange.start}
                                                    onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
                                                />
                                            </div>
                                            <div className="grid gap-1">
                                                <Input
                                                    type="date"
                                                    className="h-8 text-[10px] sm:text-xs w-full sm:w-32"
                                                    value={dateRange.end}
                                                    onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-x-auto">
                                            <Table className="min-w-[500px]">
                                                <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                                                    <TableRow>
                                                        <TableHead className="text-[10px] font-bold uppercase py-2">Fecha</TableHead>
                                                        <TableHead className="text-[10px] font-bold uppercase py-2">Disciplina</TableHead>
                                                        <TableHead className="text-right text-[10px] font-bold uppercase py-2">Alumnas</TableHead>
                                                        <TableHead className="text-right text-[10px] font-bold uppercase py-2">Pago</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {payrollData.classes.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={4} className="text-center py-8 text-slate-400 text-sm">
                                                                No hay clases pendientes en este periodo.
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : (
                                                        payrollData.classes.map(c => (
                                                            <TableRow key={c.id} className="hover:bg-slate-50/50 transition-colors">
                                                                <TableCell className="text-sm font-medium">
                                                                    {format(parseISO(c.date), "dd/MM/yyyy")}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Badge variant="outline" className="text-[10px] font-semibold">{c.type}</Badge>
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    <div className="flex items-center justify-end gap-1.5 text-sm">
                                                                        <Users className="h-3.5 w-3.5 text-slate-400" />
                                                                        {c.attendees.length}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-right font-bold text-green-600 text-sm">
                                                                    {formatCurrency(calculateClassPayment(c))}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="history" className="mt-6">
                                <Card className="border-none shadow-sm">
                                    <CardHeader>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <History className="h-5 w-5 text-primary" /> Historial de Liquidaciones
                                        </CardTitle>
                                        <CardDescription className="text-xs">Registro histórico de pagos realizados por Atria.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                                            <Table>
                                                <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                                                    <TableRow>
                                                        <TableHead className="text-[10px] font-bold uppercase">Fecha de Pago</TableHead>
                                                        <TableHead className="text-[10px] font-bold uppercase">Periodo</TableHead>
                                                        <TableHead className="text-right text-[10px] font-bold uppercase">Clases</TableHead>
                                                        <TableHead className="text-right text-[10px] font-bold uppercase">Monto</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {paymentHistory.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={4} className="text-center py-8 text-slate-400 text-sm">
                                                                Aún no tienes historial de pagos.
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : (
                                                        paymentHistory.sort((a, b) => b.date.localeCompare(a.date)).map(p => (
                                                            <TableRow key={p.id}>
                                                                <TableCell className="text-sm font-medium">
                                                                    {format(parseISO(p.date), "dd/MM/yyyy")}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-slate-600">
                                                                    {format(parseISO(p.startDate), "dd/MM")} - {format(parseISO(p.endDate), "dd/MM/yyyy")}
                                                                </TableCell>
                                                                <TableCell className="text-right text-xs">
                                                                    {p.classIds.length} clases
                                                                </TableCell>
                                                                <TableCell className="text-right font-bold text-green-600 text-sm">
                                                                    {formatCurrency(p.amount)}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </main>
        </div>
    )
}
