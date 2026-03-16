"use client"

import { useState, useMemo, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { addInstructorPayment, deleteInstructorPayment } from "@/actions/instructors"
import { ROOMS, DISCIPLINES, Tier } from "@/constants/config"
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ArrowLeft, DollarSign, Users, Briefcase, Mail, Phone, Printer, CheckCircle2, History, Trash, ChevronDown, ChevronRight, Sparkles, Calendar, Clock, Eye } from "lucide-react"
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns"
import { toast } from "sonner"
import { useCurrency } from "@/components/providers/CurrencyProvider"

// ── Types ─────────────────────────────────────────────────────────────────────
interface AttendeeWithStudent {
    id: string
    studentId: string
    attendanceType: string
    status: string
    creditDeducted: boolean
    student: { id: string; name: string; email: string }
}

interface ClassWithAttendees {
    id: string
    date: string | Date
    startTime: string
    type: string
    status: string
    room: string
    paymentId?: string | null
    maxCapacity: number
    isPrivate?: boolean
    observation?: string | null
    attendees: AttendeeWithStudent[]
}

interface PaymentWithClasses {
    id: string
    date: string | Date
    startDate: string | Date
    endDate: string | Date
    amount: number
    notes?: string | null
    classes: ClassWithAttendees[]
}

interface InstructorDetailClientProps {
    instructor: {
        id: string
        name: string
        email: string
        phone: string
        bio: string
        specialties: string[]
    }
    classes: ClassWithAttendees[]
    payments: PaymentWithClasses[]
    disciplineRates: Record<string, { privateRate: number; rates: Tier[] }> | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────
// DEPRECATED: use context formatCurrency instead
// const formatCurrency = (amount: number) =>
//     new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

function toDateStr(d: string | Date): string {
    if (typeof d === 'string') return d.split('T')[0]
    return d.toISOString().split('T')[0]
}

// Fallback defaults — used when DB settings haven't been seeded yet
const DEFAULT_RATES: Record<string, { privateRate: number; rates: Tier[] }> = Object.fromEntries(
    DISCIPLINES.map(d => [
        d,
        {
            privateRate: 25,
            rates: [
                { min: 1, max: 2, price: 10 },
                { min: 3, max: 4, price: 15 },
                { min: 5, max: null, price: 20 },
            ],
        },
    ])
)

function calculateClassPayment(
    cls: ClassWithAttendees,
    rates: Record<string, { privateRate: number; rates: Tier[] }> | null
): number {
    // Use DB rates if available, otherwise fall back to defaults
    const effectiveRates = rates ?? DEFAULT_RATES
    const disciplineRate = effectiveRates[cls.type]
    if (!disciplineRate) return 0
    if (cls.isPrivate) return disciplineRate.privateRate
    const count = cls.attendees.length
    const tier = disciplineRate.rates.find(t => count >= t.min && (t.max === null || count <= t.max))
    return tier?.price ?? 0
}

// ── Component ─────────────────────────────────────────────────────────────────
export function InstructorDetailClient({
    instructor,
    classes,
    payments: initialPayments,
    disciplineRates,
}: InstructorDetailClientProps) {
    const router = useRouter()
    const { formatCurrency } = useCurrency()
    const [isPending, startTransition] = useTransition()

    // Held locally so we can optimistically update without a full page reload
    const [payments, setPayments] = useState<PaymentWithClasses[]>(initialPayments)

    const [dateRange, setDateRange] = useState({
        start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
        end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    })

    // ── Payroll calculation ───────────────────────────────────────────────────
    const payrollData = useMemo(() => {
        const start = parseISO(dateRange.start)
        const end = parseISO(dateRange.end)
        const adjustedEnd = new Date(end); adjustedEnd.setHours(23, 59, 59)

        // Already-paid class IDs (from any payment in history)
        const paidClassIds = new Set(payments.flatMap(p => p.classes.map(c => c.id)))

        const filteredClasses = classes.filter(c => {
            if (c.status !== 'COMPLETED' && c.status !== 'CONFIRMED') return false
            if (paidClassIds.has(c.id)) return false
            const classDate = parseISO(toDateStr(c.date))
            return isWithinInterval(classDate, { start, end: adjustedEnd })
        })

        const totalClasses = filteredClasses.length
        const totalHours = totalClasses // 1 hr per class
        const totalPay = filteredClasses.reduce((acc, c) => acc + calculateClassPayment(c, disciplineRates), 0)
        const totalStudents = filteredClasses.reduce((acc, c) => acc + c.attendees.length, 0)
        const avgStudents = totalClasses > 0 ? (totalStudents / totalClasses).toFixed(1) : "0"

        return {
            classes: filteredClasses.sort((a, b) =>
                new Date(toDateStr(a.date)).getTime() - new Date(toDateStr(b.date)).getTime()
            ),
            totalClasses,
            totalHours,
            totalPay,
            avgStudents,
        }
    }, [classes, payments, dateRange, disciplineRates])

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleRecordPayment = () => {
        if (payrollData.classes.length === 0) {
            toast.error("No hay clases pendientes para pagar en este rango")
            return
        }
        if (!confirm(`¿Confirmar pago de ${formatCurrency(payrollData.totalPay)} por ${payrollData.totalClasses} clases?`)) return

        startTransition(async () => {
            try {
                const newPayment = await addInstructorPayment({
                    instructorId: instructor.id,
                    amount: payrollData.totalPay,
                    startDate: dateRange.start,
                    endDate: dateRange.end,
                    classIds: payrollData.classes.map(c => c.id),
                    notes: `Pago de periodo ${dateRange.start} a ${dateRange.end}`,
                })

                // Optimistically rebuild the payment with its classes attached
                const paidClasses = payrollData.classes
                setPayments(prev => [{
                    ...newPayment,
                    date: newPayment.date,
                    startDate: newPayment.startDate,
                    endDate: newPayment.endDate,
                    classes: paidClasses,
                } as PaymentWithClasses, ...prev])

                toast.success("Pago registrado correctamente")
                router.refresh()
            } catch (err: unknown) {
                toast.error(err instanceof Error ? err.message : "Error al registrar pago")
            }
        })
    }

    const handleDeletePayment = (paymentId: string) => {
        if (!confirm("¿Eliminar este registro de pago? Las clases volverán a estar pendientes.")) return

        startTransition(async () => {
            try {
                await deleteInstructorPayment(paymentId)
                setPayments(prev => prev.filter(p => p.id !== paymentId))
                toast.success("Pago eliminado")
                router.refresh()
            } catch {
                toast.error("Error al eliminar pago")
            }
        })
    }

    return (
        <div className="flex flex-col md:flex-row h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
            <Sidebar />
            <MobileNav />
            <main className="flex-1 p-4 md:p-8 overflow-y-auto min-w-0 print:p-0 print:overflow-visible">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6 print:hidden">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{instructor.name}</h1>
                        <p className="text-slate-500 text-sm">Detalle de Instructor y Liquidaciones</p>
                    </div>
                </div>

                <Tabs defaultValue="payroll" className="space-y-4">
                    <TabsList className="print:hidden bg-white dark:bg-slate-800 shadow-sm">
                        <TabsTrigger value="profile">Perfil</TabsTrigger>
                        <TabsTrigger value="payroll">Liquidación Pendiente</TabsTrigger>
                        <TabsTrigger value="history">Historial de Pagos</TabsTrigger>
                    </TabsList>

                    {/* ── PROFILE TAB ─────────────────────────────────────────── */}
                    <TabsContent value="profile" className="space-y-4">
                        <Card className="border-none shadow-sm">
                            <CardHeader className="bg-slate-50 dark:bg-slate-800/50 border-b">
                                <CardTitle>Información Personal</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center text-primary text-3xl font-bold border-2 border-primary/20">
                                        {instructor.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{instructor.name}</h3>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {instructor.specialties.map(s => (
                                                <Badge key={s} variant="secondary">{s}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <Separator />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1">
                                        <Label className="text-slate-500 flex items-center gap-2"><Mail className="h-4 w-4" /> Email</Label>
                                        <div className="font-medium">{instructor.email || "No registrado"}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-slate-500 flex items-center gap-2"><Phone className="h-4 w-4" /> Teléfono</Label>
                                        <div className="font-medium">{instructor.phone || "No registrado"}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-slate-500 flex items-center gap-2"><DollarSign className="h-4 w-4" /> Tarifas de Pago</Label>
                                        <div className="text-xs text-slate-700 bg-slate-50 dark:bg-slate-900 p-2 rounded border">
                                            <p className="mb-1">Las tarifas se calculan según la disciplina y asistencia.</p>
                                            <Link href="/dashboard/settings" className="text-primary hover:underline font-semibold">
                                                Ver tabla de tarifas →
                                            </Link>
                                        </div>
                                    </div>
                                    {instructor.bio && (
                                        <div className="col-span-2 space-y-1">
                                            <Label className="text-slate-500 flex items-center gap-2"><Briefcase className="h-4 w-4" /> Biografía</Label>
                                            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{instructor.bio}</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ── PAYROLL TAB ─────────────────────────────────────────── */}
                    <TabsContent value="payroll" className="space-y-6">
                        {/* Date filters */}
                        <Card className="print:hidden border-none shadow-sm">
                            <CardContent className="pt-6">
                                <div className="flex flex-col md:flex-row gap-4 items-end">
                                    <div className="grid gap-2 flex-1">
                                        <Label>Fecha Inicio</Label>
                                        <Input type="date" value={dateRange.start} onChange={e => setDateRange({ ...dateRange, start: e.target.value })} />
                                    </div>
                                    <div className="grid gap-2 flex-1">
                                        <Label>Fecha Fin</Label>
                                        <Input type="date" value={dateRange.end} onChange={e => setDateRange({ ...dateRange, end: e.target.value })} />
                                    </div>
                                    <Button variant="outline" onClick={() => setDateRange({
                                        start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
                                        end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
                                    })}>
                                        Mes Actual
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Printable area */}
                        <div id="printable-report">
                            {/* Print header */}
                            <div className="hidden print:block mb-8">
                                <h1 className="text-4xl font-bold tracking-tight text-primary">Atria Fitness</h1>
                                <h2 className="text-2xl font-bold mb-2 mt-2">Liquidación de Instructor</h2>
                                <div className="flex justify-between border-b-2 border-slate-200 pb-4 mb-6">
                                    <div>
                                        <p className="text-lg"><strong>Instructor:</strong> {instructor.name}</p>
                                        <p className="text-slate-600">Periodo: {format(parseISO(dateRange.start), 'dd/MM/yyyy')} - {format(parseISO(dateRange.end), 'dd/MM/yyyy')}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-slate-500 text-sm">Fecha de Emisión</p>
                                        <p className="font-medium">{format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
                                    </div>
                                </div>
                            </div>

                            {/* KPIs */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <Card className="border-none shadow-sm">
                                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Clases Completadas</CardTitle></CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{payrollData.totalClasses}</div>
                                        <p className="text-xs text-slate-500">en el periodo</p>
                                    </CardContent>
                                </Card>
                                <Card className="border-none shadow-sm">
                                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Horas Totales</CardTitle></CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{payrollData.totalHours} hr</div>
                                        <p className="text-xs text-slate-500">tiempo efectivo</p>
                                    </CardContent>
                                </Card>
                                <Card className="border-none shadow-sm">
                                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Alumnas/Clase</CardTitle></CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{payrollData.avgStudents}</div>
                                        <p className="text-xs text-slate-500">promedio</p>
                                    </CardContent>
                                </Card>
                                <Card className="bg-slate-900 text-white border-none shadow-sm">
                                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium opacity-80">Monto a Pagar</CardTitle></CardHeader>
                                    <CardContent>
                                        <div className="text-3xl font-bold">{formatCurrency(payrollData.totalPay)}</div>
                                        <p className="text-xs opacity-70">según asistencia</p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Detail table */}
                            <Card className="border-none shadow-sm print:shadow-none">
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle>Detalle de Clases</CardTitle>
                                        <CardDescription className="print:hidden">Desglose de todas las sesiones del período seleccionado.</CardDescription>
                                    </div>
                                    <div className="flex flex-wrap gap-2 print:hidden">
                                        <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
                                            <Printer className="h-4 w-4" /> Imprimir
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                                            onClick={handleRecordPayment}
                                            disabled={isPending || payrollData.classes.length === 0}
                                        >
                                            <CheckCircle2 className="h-4 w-4" />
                                            {isPending ? "Procesando..." : "Registrar Pago"}
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="rounded-xl border overflow-x-auto">
                                        <Table className="min-w-[600px]">
                                            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                                                <TableRow>
                                                    <TableHead>Fecha</TableHead>
                                                    <TableHead>Hora</TableHead>
                                                    <TableHead>Disciplina</TableHead>
                                                    <TableHead>Sala</TableHead>
                                                    <TableHead className="text-right">Asistencia</TableHead>
                                                    <TableHead className="text-right">Total</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {payrollData.classes.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                                                            No hay clases pendientes en este periodo.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    payrollData.classes.map(c => {
                                                        const roomName = ROOMS.find(r => r.id === c.room)?.name || c.room
                                                        return (
                                                            <TableRow key={c.id}>
                                                                <TableCell className="font-medium">{format(parseISO(toDateStr(c.date)), "dd/MM/yyyy")}</TableCell>
                                                                <TableCell>{c.startTime}</TableCell>
                                                                <TableCell>
                                                                    <Badge variant="outline" className="capitalize">{c.type} {c.observation ? `(${c.observation})` : ''}</Badge>
                                                                </TableCell>
                                                                <TableCell>{roomName}</TableCell>
                                                                <TableCell className="text-right">
                                                                    <div className="flex items-center justify-end gap-1">
                                                                        <Users className="h-3 w-3 text-slate-400" /> {c.attendees.length}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-right font-medium">
                                                                    {formatCurrency(calculateClassPayment(c, disciplineRates))}
                                                                    {c.isPrivate && <Badge variant="secondary" className="ml-2 text-[10px]">Privada</Badge>}
                                                                </TableCell>
                                                            </TableRow>
                                                        )
                                                    })
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Print footer */}
                            <div className="hidden print:block mt-12 pt-8 border-t border-slate-200">
                                <div className="flex justify-between text-sm text-slate-500">
                                    <p>Atria Fitness System</p>
                                    <p>Página 1 de 1</p>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    {/* ── HISTORY TAB ──────────────────────────────────────── */}
                    <TabsContent value="history" className="space-y-3">
                        <Card className="border-none shadow-sm">
                            <CardHeader className="bg-slate-50 dark:bg-slate-800/50 border-b">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <History className="h-5 w-5 text-primary" /> Historial de Pagos
                                        </CardTitle>
                                        <CardDescription>Haz clic en cada liquidación para ver el detalle completo de clases y alumnas.</CardDescription>
                                    </div>
                                    {payments.length > 0 && (
                                        <Badge variant="outline" className="text-sm font-semibold">
                                            {payments.length} liquidaci{payments.length === 1 ? 'ón' : 'ones'}
                                        </Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="p-0 divide-y">
                                {payments.length === 0 ? (
                                    <div className="py-12 text-center text-slate-400">
                                        <History className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                        <p className="font-medium">No hay historial de pagos registrado</p>
                                    </div>
                                ) : (
                                    [...payments]
                                        .sort((a, b) => toDateStr(b.date).localeCompare(toDateStr(a.date)))
                                        .map(p => <PaymentAccordion
                                            key={p.id}
                                            payment={p}
                                            disciplineRates={disciplineRates}
                                            isPending={isPending}
                                            onDelete={handleDeletePayment}
                                            instructorName={instructor.name}
                                        />)
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    )
}

// ── PaymentAccordion sub-component ────────────────────────────────────────────
function PaymentAccordion({
    payment,
    disciplineRates,
    isPending,
    onDelete,
    instructorName,
}: {
    payment: PaymentWithClasses
    disciplineRates: Record<string, { privateRate: number; rates: Tier[] }> | null
    isPending: boolean
    onDelete: (id: string) => void
    instructorName: string
}) {
    const { formatCurrency } = useCurrency()
    const [expanded, setExpanded] = useState(false)
    const [expandedClassId, setExpandedClassId] = useState<string | null>(null)
    const [showModal, setShowModal] = useState(false)

    const totalStudents = payment.classes.reduce((acc, c) => acc + c.attendees.filter(a => a.status === 'BOOKED').length, 0)

    // ── Print voucher in new window ──────────────────────────────────────────
    const printVoucher = () => {
        const rows = payment.classes.map((cls, idx) => {
            const roomName = ROOMS.find(r => r.id === cls.room)?.name || cls.room
            const classAmount = calculateClassPayment(cls, disciplineRates)
            const bookedAttendees = cls.attendees.filter(a => a.status === 'BOOKED')
            const studentList = bookedAttendees.map(a => a.student.name).join(', ') || '—'
            return `
                <tr style="border-bottom:1px solid #e2e8f0">
                    <td style="padding:8px 6px;font-size:13px;color:#374151">${idx + 1}</td>
                    <td style="padding:8px 6px;font-size:13px">${format(parseISO(toDateStr(cls.date)), 'dd/MM/yyyy')} ${cls.startTime}</td>
                    <td style="padding:8px 6px;font-size:13px">${cls.type}${cls.observation ? ` (${cls.observation})` : ''}${cls.isPrivate ? ' ★' : ''}</td>
                    <td style="padding:8px 6px;font-size:13px">${roomName}</td>
                    <td style="padding:8px 6px;font-size:13px;text-align:center">${bookedAttendees.length}</td>
                    <td style="padding:8px 6px;font-size:13px;font-weight:600;color:#16a34a;text-align:right">${formatCurrency(classAmount)}</td>
                </tr>
                <tr style="background:#f8fafc">
                    <td></td>
                    <td colspan="5" style="padding:4px 6px 10px 6px;font-size:11px;color:#64748b;font-style:italic">Alumnas: ${studentList}</td>
                </tr>`
        }).join('')

        const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8" />
    <title>Comprobante de Liquidación — ${instructorName}</title>
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
        thead th:nth-child(5) { text-align: center; }
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
            <div class="meta-value">${instructorName}</div>
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
                <th>Sala</th>
                <th style="text-align:center">Asist.</th>
                <th style="text-align:right">Total</th>
            </tr>
        </thead>
        <tbody>
            ${rows}
            <tr class="total-row">
                <td colspan="5" style="text-align:right;padding-right:12px">TOTAL LIQUIDADO</td>
                <td style="text-align:right;padding:12px 6px">${formatCurrency(payment.amount)}</td>
            </tr>
        </tbody>
    </table>

    ${payment.notes ? `<p style="font-size:12px;color:#64748b;font-style:italic;margin-bottom:24px;padding-left:8px;border-left:3px solid #7c3aed">${payment.notes}</p>` : ''}

    <div class="footer">
        <span>Atria Fitness — Sistema de Gestión</span>
        <span>Página 1 de 1</span>
    </div>

    <script>window.onload = () => { window.print(); }</script>
</body>
</html>`

        const win = window.open('', '_blank', 'width=900,height=700')
        if (win) {
            win.document.write(html)
            win.document.close()
        }
    }

    return (
        <div className="bg-white dark:bg-slate-900">
            {/* ── Payment summary row */}
            <div className="flex items-center gap-3 px-4 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                {/* Clickable area */}
                <div
                    role="button"
                    tabIndex={0}
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer text-left"
                    onClick={() => setExpanded(e => !e)}
                    onKeyDown={(e) => e.key === 'Enter' && setExpanded(v => !v)}
                >
                    <span className="text-slate-400 shrink-0">
                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </span>

                    <div className="min-w-[90px] shrink-0">
                        <p className="text-[10px] text-slate-400 uppercase font-semibold">Fecha</p>
                        <p className="font-medium text-sm">{format(parseISO(toDateStr(payment.date)), 'dd/MM/yyyy')}</p>
                    </div>

                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-slate-400 uppercase font-semibold">Período</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300 truncate">
                            {format(parseISO(toDateStr(payment.startDate)), 'dd/MM/yyyy')} — {format(parseISO(toDateStr(payment.endDate)), 'dd/MM/yyyy')}
                        </p>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-500 shrink-0">
                        <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {payment.classes.length} clase{payment.classes.length !== 1 ? 's' : ''}
                        </span>
                        <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" /> {totalStudents} alumna{totalStudents !== 1 ? 's' : ''}
                        </span>
                    </div>

                    <div className="text-right shrink-0 min-w-[90px]">
                        <p className="text-[10px] text-slate-400 uppercase font-semibold">Total</p>
                        <p className="font-bold text-green-600 text-base">{formatCurrency(payment.amount)}</p>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 shrink-0">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-slate-400 hover:text-primary hover:bg-primary/10"
                        title="Ver detalles"
                        onClick={() => setShowModal(true)}
                    >
                        <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-slate-400 hover:text-primary hover:bg-primary/10"
                        title="Imprimir comprobante"
                        onClick={printVoucher}
                    >
                        <Printer className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:bg-red-50 hover:text-red-600 h-8 w-8 p-0"
                        disabled={isPending}
                        onClick={() => onDelete(payment.id)}
                    >
                        <Trash className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* ── Expanded accordion detail */}
            {expanded && (
                <div className="bg-slate-50 dark:bg-slate-900/50 border-t px-4 pb-4 pt-3 space-y-2">
                    {payment.notes && (
                        <p className="text-xs text-slate-500 italic border-l-2 border-primary/40 pl-3 mb-3">{payment.notes}</p>
                    )}

                    {payment.classes.map((cls, idx) => {
                        const roomName = ROOMS.find(r => r.id === cls.room)?.name || cls.room
                        const classAmount = calculateClassPayment(cls, disciplineRates)
                        const bookedAttendees = cls.attendees.filter(a => a.status === 'BOOKED')
                        const isClsOpen = expandedClassId === cls.id

                        return (
                            <div key={cls.id} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                                <div
                                    role="button"
                                    tabIndex={0}
                                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                                    onClick={() => setExpandedClassId(isClsOpen ? null : cls.id)}
                                    onKeyDown={(e) => e.key === 'Enter' && setExpandedClassId(isClsOpen ? null : cls.id)}
                                >
                                    <span className="text-slate-400 shrink-0">
                                        {isClsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                    </span>
                                    <span className="text-xs text-slate-400 font-mono w-5 shrink-0">{idx + 1}.</span>
                                    <span className="flex items-center gap-1.5 min-w-[140px] shrink-0">
                                        <Calendar className="h-3 w-3 text-slate-400" />
                                        <span className="text-sm font-medium">{format(parseISO(toDateStr(cls.date)), 'dd/MM/yyyy')}</span>
                                        <Clock className="h-3 w-3 text-slate-400" />
                                        <span className="text-sm">{cls.startTime}</span>
                                    </span>
                                    <Badge variant="outline" className="text-xs capitalize shrink-0">{cls.type} {cls.observation ? `(${cls.observation})` : ''}</Badge>
                                    {cls.isPrivate && (
                                        <Badge className="text-[10px] bg-purple-100 text-purple-700 border-0 shrink-0">
                                            <Sparkles className="h-2.5 w-2.5 mr-0.5" /> Privada
                                        </Badge>
                                    )}
                                    <span className="text-xs text-slate-500 flex-1 truncate">{roomName}</span>
                                    <span className="text-xs text-slate-400 flex items-center gap-1 shrink-0">
                                        <Users className="h-3 w-3" /> {bookedAttendees.length}
                                    </span>
                                    <span className="font-semibold text-sm text-green-600 shrink-0 min-w-[64px] text-right">
                                        {formatCurrency(classAmount)}
                                    </span>
                                </div>

                                {isClsOpen && (
                                    <div className="border-t bg-slate-50/80 dark:bg-slate-900/40 px-4 py-3">
                                        {bookedAttendees.length === 0 ? (
                                            <p className="text-xs text-slate-400 text-center py-2">Sin alumnas registradas</p>
                                        ) : (
                                            <div className="space-y-2">
                                                <p className="text-[10px] uppercase font-bold text-slate-400 mb-2 tracking-wide">Alumnas asistentes</p>
                                                {bookedAttendees.map(att => (
                                                    <div key={att.id} className="flex items-center justify-between py-1">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                                                                {att.student.name.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-medium leading-tight">{att.student.name}</p>
                                                                {att.student.email && <p className="text-[10px] text-slate-400">{att.student.email}</p>}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {att.attendanceType === 'COURTESY' && (
                                                                <Badge className="text-[9px] bg-yellow-100 text-yellow-700 border-0">
                                                                    <Sparkles className="h-2 w-2 mr-0.5" /> Cortesía
                                                                </Badge>
                                                            )}
                                                            {att.creditDeducted && (
                                                                <Badge variant="outline" className="text-[9px] text-green-600 border-green-300">
                                                                    ✓ Crédito descontado
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}

                    <div className="flex justify-between items-end pt-3 border-t mt-2">
                        <p className="text-xs text-slate-400">{payment.classes.length} clases · {totalStudents} alumnas</p>
                        <div className="text-right">
                            <p className="text-[10px] text-slate-400 uppercase">Total liquidado</p>
                            <p className="text-xl font-bold text-green-600">{formatCurrency(payment.amount)}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Detail Modal ────────────────────────────────────────── */}
            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <History className="h-5 w-5 text-primary" />
                            Detalles de Liquidación
                        </DialogTitle>
                    </DialogHeader>

                    {/* Meta */}
                    <div className="grid grid-cols-2 gap-3 mt-2">
                        {[
                            { label: 'Instructor', value: instructorName },
                            { label: 'Fecha de Pago', value: format(parseISO(toDateStr(payment.date)), 'dd/MM/yyyy') },
                            { label: 'Período', value: `${format(parseISO(toDateStr(payment.startDate)), 'dd/MM/yyyy')} — ${format(parseISO(toDateStr(payment.endDate)), 'dd/MM/yyyy')}` },
                            { label: 'Resumen', value: `${payment.classes.length} clases · ${totalStudents} alumnas` },
                        ].map(m => (
                            <div key={m.label} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 border">
                                <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1">{m.label}</p>
                                <p className="font-semibold text-sm text-slate-800 dark:text-slate-100">{m.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Classes table */}
                    <div className="mt-4 space-y-2">
                        {payment.classes.map((cls, idx) => {
                            const roomName = ROOMS.find(r => r.id === cls.room)?.name || cls.room
                            const classAmount = calculateClassPayment(cls, disciplineRates)
                            const bookedAttendees = cls.attendees.filter(a => a.status === 'BOOKED')
                            return (
                                <div key={cls.id} className="border rounded-xl overflow-hidden">
                                    <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800">
                                        <span className="text-xs text-slate-400 font-mono w-5">{idx + 1}.</span>
                                        <span className="flex items-center gap-1.5 text-sm font-medium flex-1">
                                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                            {format(parseISO(toDateStr(cls.date)), 'dd/MM/yyyy')} {cls.startTime}
                                        </span>
                                        <Badge variant="outline" className="text-xs capitalize">{cls.type}</Badge>
                                        <span className="text-xs text-slate-500">{roomName}</span>
                                        <span className="text-xs text-slate-400 flex items-center gap-1">
                                            <Users className="h-3 w-3" /> {bookedAttendees.length}
                                        </span>
                                        <span className="font-bold text-sm text-green-600 min-w-[64px] text-right">{formatCurrency(classAmount)}</span>
                                    </div>
                                    {bookedAttendees.length > 0 && (
                                        <div className="px-4 py-2 divide-y">
                                            {bookedAttendees.map(att => (
                                                <div key={att.id} className="flex items-center justify-between py-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                                                            {att.student.name.charAt(0)}
                                                        </div>
                                                        <span className="text-sm">{att.student.name}</span>
                                                    </div>
                                                    {att.attendanceType === 'COURTESY' && (
                                                        <Badge className="text-[9px] bg-yellow-100 text-yellow-700 border-0">Cortesía</Badge>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {/* Total */}
                    <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-5 py-4 mt-4">
                        <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wide">Total Liquidado</p>
                            <p className="text-2xl font-bold text-green-600">{formatCurrency(payment.amount)}</p>
                        </div>
                        <Button onClick={printVoucher} className="gap-2 bg-primary hover:bg-primary/90">
                            <Printer className="h-4 w-4" /> Imprimir Comprobante
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}


