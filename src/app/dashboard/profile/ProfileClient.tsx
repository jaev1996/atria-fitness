"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { changePassword, updateProfile } from "@/actions/auth"
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Users, Mail, Phone, History, Calendar as CalendarIcon, Wallet, User, Lock, Save, LogOut, Eye, School } from "lucide-react"
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns"
import { toast } from "sonner"

// ── Types ─────────────────────────────────────────────────────────────────────
interface Tier { min: number; max: number | null; price: number }

interface ClassWithAttendees {
    id: string
    date: string | Date
    startTime: string
    type: string
    status: string
    instructorId: string
    paymentId?: string | null
    maxCapacity: number
    attendees: { id: string; status?: string; attendanceType?: string; student: { id: string; name: string; email: string } }[]
    isPrivate?: boolean
}

interface InstructorPayment {
    id: string
    date: string | Date
    startDate: string | Date
    endDate: string | Date
    amount: number
    notes?: string | null
    classes: ClassWithAttendees[]
}

interface ProfileClientProps {
    userId: string
    role: "admin" | "instructor" | "student"
    profile: { name: string; email: string; phone: string; bio: string; specialties: string[] }
    instructorClasses: ClassWithAttendees[]
    instructorPayments: InstructorPayment[]
    disciplineRates: Record<string, { privateRate: number; rates: Tier[] }> | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' }).format(amount)

function toDateStr(d: string | Date): string {
    if (typeof d === 'string') return d.split('T')[0]
    return d.toISOString().split('T')[0]
}

function calculateClassPayment(
    cls: ClassWithAttendees,
    rates: Record<string, { privateRate: number; rates: Tier[] }> | null
): number {
    const disciplineRate = rates?.[cls.type]
    if (!disciplineRate) return 0
    if (cls.isPrivate) return disciplineRate.privateRate
    const count = cls.attendees.length
    const tier = disciplineRate.rates.find(t => count >= t.min && (t.max === null || count <= t.max))
    return tier?.price ?? 0
}

// ── Main Component ────────────────────────────────────────────────────────────
export function ProfileClient({
    role,
    profile: initialProfile,
    instructorClasses,
    instructorPayments,
    disciplineRates,
}: ProfileClientProps) {
    const router = useRouter()
    const { logout } = useAuth()

    // Profile edit state
    const [profile, setProfile] = useState(initialProfile)
    const [isSavingProfile, setIsSavingProfile] = useState(false)

    // Password state
    const [passwords, setPasswords] = useState({ new: "", confirm: "" })
    const [isSavingPassword, setIsSavingPassword] = useState(false)

    // Payment detail dialog
    const [selectedPayment, setSelectedPayment] = useState<InstructorPayment | null>(null)
    const [isDetailsOpen, setIsDetailsOpen] = useState(false)

    // ── Print voucher in new window ──────────────────────────────────────────
    const printVoucher = (payment: InstructorPayment) => {
        const rows = payment.classes.map((cls, idx) => {
            const classAmount = calculateClassPayment(cls, disciplineRates)
            const bookedAttendees = cls.attendees.filter(a => !a.status || a.status === 'BOOKED')
            const studentList = bookedAttendees.map(a => a.student?.name ?? '').filter(Boolean).join(', ') || '—'
            return `
                <tr style="border-bottom:1px solid #e2e8f0">
                    <td style="padding:8px 6px;font-size:13px;color:#374151">${idx + 1}</td>
                    <td style="padding:8px 6px;font-size:13px">${format(parseISO(toDateStr(cls.date)), 'dd/MM/yyyy')} ${cls.startTime}</td>
                    <td style="padding:8px 6px;font-size:13px">${cls.type}${cls.isPrivate ? ' ★' : ''}</td>
                    <td style="padding:8px 6px;font-size:13px;text-align:center">${bookedAttendees.length}</td>
                    <td style="padding:8px 6px;font-size:13px;font-weight:600;color:#16a34a;text-align:right">${formatCurrency(classAmount)}</td>
                </tr>
                <tr style="background:#f8fafc">
                    <td></td>
                    <td colspan="4" style="padding:4px 6px 10px 6px;font-size:11px;color:#64748b;font-style:italic">Alumnas: ${studentList}</td>
                </tr>`
        }).join('')

        const totalStudents = payment.classes.reduce((acc, c) =>
            acc + c.attendees.filter(a => !a.status || a.status === 'BOOKED').length, 0)

        const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8" />
    <title>Comprobante de Liquidación — ${profile.name}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1e293b; background: #fff; padding: 40px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 3px solid #7c3aed; }
        .brand { font-size: 26px; font-weight: 800; color: #7c3aed; letter-spacing: -0.5px; }
        .brand-sub { font-size: 13px; color: #64748b; margin-top: 2px; }
        .voucher-title { font-size: 14px; color: #64748b; text-align: right; }
        .voucher-title strong { display: block; font-size: 18px; color: #1e293b; }
        .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 28px; }
        .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
        .meta-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; font-weight: 600; margin-bottom: 4px; }
        .meta-value { font-size: 15px; font-weight: 600; color: #1e293b; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        thead tr { background: #7c3aed; }
        thead th { padding: 10px 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #fff; text-align: left; font-weight: 600; }
        thead th:last-child { text-align: right; }
        thead th:nth-child(4) { text-align: center; }
        .total-row { background: #f0fdf4; border-top: 2px solid #16a34a; }
        .total-row td { padding: 12px 6px; font-weight: 700; font-size: 15px; color: #16a34a; }
        .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; }
        @media print { body { padding: 20px; } }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <div class="brand">Atria Fitness</div>
            <div class="brand-sub">Sistema de Gestión</div>
        </div>
        <div class="voucher-title">
            <strong>Comprobante de Liquidación</strong>
            Emitido: ${format(new Date(), 'dd/MM/yyyy HH:mm')}
        </div>
    </div>
    <div class="meta-grid">
        <div class="meta-box">
            <div class="meta-label">Instructor</div>
            <div class="meta-value">${profile.name}</div>
        </div>
        <div class="meta-box">
            <div class="meta-label">Fecha de Pago</div>
            <div class="meta-value">${format(parseISO(toDateStr(payment.date)), 'dd/MM/yyyy')}</div>
        </div>
        <div class="meta-box">
            <div class="meta-label">Período</div>
            <div class="meta-value">${format(parseISO(toDateStr(payment.startDate)), 'dd/MM/yyyy')} — ${format(parseISO(toDateStr(payment.endDate)), 'dd/MM/yyyy')}</div>
        </div>
        <div class="meta-box">
            <div class="meta-label">Resumen</div>
            <div class="meta-value">${payment.classes.length} clases · ${totalStudents} alumnas</div>
        </div>
    </div>
    <table>
        <thead>
            <tr>
                <th style="width:32px">#</th>
                <th>Fecha y Hora</th>
                <th>Disciplina</th>
                <th style="text-align:center">Asist.</th>
                <th style="text-align:right">Total</th>
            </tr>
        </thead>
        <tbody>
            ${rows}
            <tr class="total-row">
                <td colspan="4" style="text-align:right;padding-right:12px">TOTAL LIQUIDADO</td>
                <td style="text-align:right;padding:12px 6px">${formatCurrency(payment.amount)}</td>
            </tr>
        </tbody>
    </table>
    ${payment.notes ? `<p style="font-size:12px;color:#64748b;font-style:italic;margin-bottom:24px;padding-left:8px;border-left:3px solid #7c3aed">${payment.notes}</p>` : ''}
    <div class="footer">
        <span>Atria Fitness — Sistema de Gestión</span>
        <span>Página 1 de 1</span>
    </div>
    <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`

        const win = window.open('', '_blank', 'width=900,height=700')
        if (win) { win.document.write(html); win.document.close() }
    }

    // Date range filter for payroll
    const [dateRange, setDateRange] = useState({
        start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
        end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    })

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleSaveProfile = async () => {
        setIsSavingProfile(true)
        try {
            await updateProfile(profile.name, profile.email)
            toast.success("Perfil actualizado correctamente")
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Error al actualizar perfil")
        } finally {
            setIsSavingProfile(false)
        }
    }

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        if (passwords.new !== passwords.confirm) { toast.error("Las contraseñas no coinciden"); return }
        if (passwords.new.length < 6) { toast.error("La contraseña debe tener al menos 6 caracteres"); return }
        setIsSavingPassword(true)
        try {
            await changePassword(passwords.new)
            toast.success("Contraseña actualizada correctamente")
            setPasswords({ new: "", confirm: "" })
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Error al cambiar contraseña")
        } finally {
            setIsSavingPassword(false)
        }
    }

    // ── Instructor payroll data ───────────────────────────────────────────────
    const payrollData = useMemo(() => {
        if (role !== 'instructor') return { classes: [], totalClasses: 0, totalPay: 0, avgStudents: "0", todayClasses: [] }

        const start = parseISO(dateRange.start)
        const end = parseISO(dateRange.end)
        const adjustedEnd = new Date(end); adjustedEnd.setHours(23, 59, 59)

        const filteredClasses = instructorClasses.filter(c => {
            if (c.status !== 'COMPLETED' && c.status !== 'CONFIRMED') return false
            if (c.paymentId) return false
            const classDate = parseISO(toDateStr(c.date))
            return isWithinInterval(classDate, { start, end: adjustedEnd })
        })

        const totalClasses = filteredClasses.length
        const totalPay = filteredClasses.reduce((acc, c) => acc + calculateClassPayment(c, disciplineRates), 0)
        const totalStudents = filteredClasses.reduce((acc, c) => acc + c.attendees.length, 0)
        const avgStudents = totalClasses > 0 ? (totalStudents / totalClasses).toFixed(1) : "0"

        const todayStr = new Date().toISOString().split('T')[0]
        const todayClasses = instructorClasses
            .filter(c => toDateStr(c.date) === todayStr && c.status !== 'CANCELLED')
            .sort((a, b) => a.startTime.localeCompare(b.startTime))

        return {
            classes: filteredClasses.sort((a, b) =>
                new Date(toDateStr(a.date)).getTime() - new Date(toDateStr(b.date)).getTime()
            ),
            totalClasses,
            totalPay,
            avgStudents,
            todayClasses,
        }
    }, [instructorClasses, dateRange, role, disciplineRates])

    // ── Admin view ────────────────────────────────────────────────────────────
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
                                    <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center text-primary mx-auto mb-4 border-2 border-primary/20 shadow-inner">
                                        <User className="h-12 w-12" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{profile.name}</h3>
                                    <Badge variant="outline" className="mt-2 text-primary border-primary/30 uppercase tracking-widest text-[10px]">Administrador</Badge>
                                    <div className="mt-8 space-y-2">
                                        <Button variant="outline" className="w-full text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600" onClick={logout}>
                                            <LogOut className="mr-2 h-4 w-4" /> Cerrar Sesión
                                        </Button>
                                    </div>
                                </Card>
                            </div>

                            {/* Right: Forms */}
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
                                            <Input id="admin-name" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="admin-email">Correo Electrónico</Label>
                                            <Input id="admin-email" type="email" value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })} />
                                        </div>
                                        <Button onClick={handleSaveProfile} disabled={isSavingProfile} className="bg-primary hover:bg-primary/90">
                                            <Save className="mr-2 h-4 w-4" />
                                            {isSavingProfile ? "Guardando..." : "Guardar Cambios"}
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
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="grid gap-2">
                                                    <Label htmlFor="new-pass">Nueva Contraseña</Label>
                                                    <Input id="new-pass" type="password" value={passwords.new} onChange={e => setPasswords({ ...passwords, new: e.target.value })} />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="conf-pass">Confirmar Nueva Contraseña</Label>
                                                    <Input id="conf-pass" type="password" value={passwords.confirm} onChange={e => setPasswords({ ...passwords, confirm: e.target.value })} />
                                                </div>
                                            </div>
                                            <Button type="submit" variant="secondary" disabled={isSavingPassword} className="w-full sm:w-auto">
                                                {isSavingPassword ? "Actualizando..." : "Actualizar Contraseña"}
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

    // ── Instructor view ───────────────────────────────────────────────────────
    return (
        <div className="flex flex-col md:flex-row h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
            <Sidebar />
            <MobileNav />
            <main className="flex-1 p-4 md:p-8 overflow-y-auto min-w-0">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 italic">Hola, {profile.name}! 👋</h1>
                        <p className="text-slate-500 text-sm">Este es tu resumen de actividad y pagos en Atria Fitness.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Badge className="px-4 py-1.5 bg-primary/10 text-primary border-primary/20 text-sm">Instructor Activo</Badge>
                        <Button variant="outline" size="sm" className="text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600" onClick={logout}>
                            <LogOut className="mr-2 h-4 w-4" /> Salir
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: Profile Card + Today Schedule + Next Pay */}
                    <div className="lg:col-span-1 space-y-6">
                        <Card className="overflow-hidden border-none shadow-md bg-linear-to-br from-slate-900 to-slate-800 text-white">
                            <CardContent className="p-6">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center text-primary text-2xl font-bold border-2 border-primary/30">
                                        {profile.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold">{profile.name}</h3>
                                        <p className="text-slate-400 text-xs">Instructor de Atria</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <Mail className="h-4 w-4 text-primary" />
                                        <span className="text-sm opacity-90">{profile.email || "No registrado"}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Phone className="h-4 w-4 text-primary" />
                                        <span className="text-sm opacity-90">{profile.phone || "No registrado"}</span>
                                    </div>
                                </div>
                                <Separator className="my-6 bg-white/10" />
                                <div>
                                    <Label className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Especialidades</Label>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {profile.specialties.map(s => (
                                            <Badge key={s} className="bg-white/10 hover:bg-white/20 text-white border-none">{s}</Badge>
                                        ))}
                                    </div>
                                </div>
                                {profile.bio && (
                                    <div className="mt-6">
                                        <Label className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Sobre mí</Label>
                                        <p className="text-xs text-slate-300 mt-1 italic">{profile.bio}</p>
                                    </div>
                                )}
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
                                            <Badge className="text-[8px] h-4" variant={c.status === 'CONFIRMED' ? 'default' : 'outline'}>
                                                {c.status === 'CONFIRMED' ? 'Confirmada' : 'Programada'}
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

                    {/* Right: Tabs (Payroll + History + Security) */}
                    <div className="lg:col-span-2 space-y-6">
                        <Tabs defaultValue="payroll" className="w-full">
                            <TabsList className="bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm border h-11">
                                <TabsTrigger value="payroll" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white h-9 px-5">
                                    Pagos Pendientes
                                </TabsTrigger>
                                <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white h-9 px-5">
                                    Historial
                                </TabsTrigger>
                                <TabsTrigger value="security" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white h-9 px-5">
                                    Seguridad
                                </TabsTrigger>
                            </TabsList>

                            {/* Payroll tab */}
                            <TabsContent value="payroll" className="mt-6 space-y-4">
                                <Card className="border-none shadow-sm">
                                    <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 gap-4">
                                        <div>
                                            <CardTitle className="text-lg">Detalle de Sesiones</CardTitle>
                                            <CardDescription className="text-xs">Clases que aún no han sido liquidadas.</CardDescription>
                                        </div>
                                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                            <Input type="date" className="h-8 text-xs w-full sm:w-36" value={dateRange.start} onChange={e => setDateRange({ ...dateRange, start: e.target.value })} />
                                            <Input type="date" className="h-8 text-xs w-full sm:w-36" value={dateRange.end} onChange={e => setDateRange({ ...dateRange, end: e.target.value })} />
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
                                                            <TableRow key={c.id} className="hover:bg-slate-50/50">
                                                                <TableCell className="text-sm font-medium">
                                                                    {format(parseISO(toDateStr(c.date)), "dd/MM/yyyy")}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Badge variant="outline" className="text-[10px] font-semibold">{c.type}</Badge>
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    <div className="flex items-center justify-end gap-1.5 text-sm">
                                                                        <Users className="h-3.5 w-3.5 text-slate-400" /> {c.attendees.length}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-right font-bold text-green-600 text-sm">
                                                                    {formatCurrency(calculateClassPayment(c, disciplineRates))}
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

                            {/* History tab */}
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
                                                        <TableHead />
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {instructorPayments.length === 0 ? (
                                                        <TableRow>
                                                            <TableCell colSpan={5} className="text-center py-8 text-slate-400 text-sm">
                                                                Aún no tienes historial de pagos.
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : (
                                                        [...instructorPayments]
                                                            .sort((a, b) => toDateStr(b.date).localeCompare(toDateStr(a.date)))
                                                            .map(p => (
                                                                <TableRow key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 cursor-pointer" onClick={() => { setSelectedPayment(p); setIsDetailsOpen(true) }}>
                                                                    <TableCell className="text-sm font-medium">{format(parseISO(toDateStr(p.date)), "dd/MM/yyyy")}</TableCell>
                                                                    <TableCell className="text-xs text-slate-600">
                                                                        {format(parseISO(toDateStr(p.startDate)), "dd/MM")} - {format(parseISO(toDateStr(p.endDate)), "dd/MM/yyyy")}
                                                                    </TableCell>
                                                                    <TableCell className="text-right text-xs">
                                                                        <Badge variant="secondary" className="font-normal text-[10px]">{p.classes.length} clases</Badge>
                                                                    </TableCell>
                                                                    <TableCell className="text-right font-bold text-green-600 text-sm">{formatCurrency(p.amount)}</TableCell>
                                                                    <TableCell className="text-right">
                                                                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary">
                                                                            <Eye className="h-4 w-4" />
                                                                        </Button>
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

                            {/* Security tab */}
                            <TabsContent value="security" className="mt-6">
                                <Card className="border-none shadow-sm overflow-hidden">
                                    <CardHeader className="bg-slate-50 dark:bg-slate-800/50 border-b">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <Lock className="h-5 w-5 text-primary" /> Cambiar Contraseña
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-6">
                                        <form onSubmit={handleChangePassword} className="space-y-4">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="grid gap-2">
                                                    <Label htmlFor="new-pass-instructor">Nueva Contraseña</Label>
                                                    <Input id="new-pass-instructor" type="password" value={passwords.new} onChange={e => setPasswords({ ...passwords, new: e.target.value })} />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="conf-pass-instructor">Confirmar Contraseña</Label>
                                                    <Input id="conf-pass-instructor" type="password" value={passwords.confirm} onChange={e => setPasswords({ ...passwords, confirm: e.target.value })} />
                                                </div>
                                            </div>
                                            <Button type="submit" variant="secondary" disabled={isSavingPassword}>
                                                {isSavingPassword ? "Actualizando..." : "Actualizar Contraseña"}
                                            </Button>
                                        </form>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>

                {/* Payment detail dialog */}
                <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <History className="h-5 w-5 text-primary" /> Detalles de Liquidación
                            </DialogTitle>
                            <DialogDescription>
                                Comprobante de pago generado el {selectedPayment && format(parseISO(toDateStr(selectedPayment.date)), "dd 'de' MMMM, yyyy")}
                            </DialogDescription>
                        </DialogHeader>

                        {selectedPayment && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border">
                                    <div>
                                        <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">Periodo Liquidado</p>
                                        <p className="text-sm font-semibold">
                                            {format(parseISO(toDateStr(selectedPayment.startDate)), "dd/MM/yy")} al {format(parseISO(toDateStr(selectedPayment.endDate)), "dd/MM/yy")}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">Total Pagado</p>
                                        <p className="text-lg font-bold text-green-600">{formatCurrency(selectedPayment.amount)}</p>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-sm font-bold mb-3 flex items-center gap-2">
                                        <School className="h-4 w-4 text-slate-400" />
                                        Clases Incluidas ({selectedPayment.classes.length})
                                    </p>
                                    <div className="max-h-[300px] overflow-y-auto rounded-lg border">
                                        <Table>
                                            <TableHeader className="bg-slate-50 dark:bg-slate-800">
                                                <TableRow>
                                                    <TableHead className="text-[10px] uppercase">Fecha / Hora</TableHead>
                                                    <TableHead className="text-[10px] uppercase">Disciplina</TableHead>
                                                    <TableHead className="text-right text-[10px] uppercase">Alumnas</TableHead>
                                                    <TableHead className="text-right text-[10px] uppercase">Monto</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {selectedPayment.classes.map(c => (
                                                    <TableRow key={c.id}>
                                                        <TableCell className="text-xs">
                                                            <div className="font-bold">{format(parseISO(toDateStr(c.date)), "dd/MM")}</div>
                                                            <div className="text-slate-500">{c.startTime}</div>
                                                        </TableCell>
                                                        <TableCell className="text-xs font-medium">{c.type}</TableCell>
                                                        <TableCell className="text-right text-xs">
                                                            <div className="flex items-center justify-end gap-1">
                                                                <Users className="h-3 w-3 text-slate-400" /> {c.attendees.length}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right text-xs font-bold">
                                                            {formatCurrency(calculateClassPayment(c, disciplineRates))}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>

                                {selectedPayment.notes && (
                                    <div className="bg-primary/5 p-3 rounded-lg border border-primary/10">
                                        <p className="text-[10px] uppercase text-primary font-bold mb-1">Notas</p>
                                        <p className="text-xs italic text-slate-600 dark:text-slate-300">{selectedPayment.notes}</p>
                                    </div>
                                )}

                                <div className="flex justify-end gap-2">
                                    <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>Cerrar</Button>
                                    <Button className="bg-primary" onClick={() => selectedPayment && printVoucher(selectedPayment)}>Imprimir Comprobante</Button>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </main>
        </div>
    )
}
