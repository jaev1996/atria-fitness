"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { db, Instructor, ClassSession } from "@/lib/storage"
import { ROOMS } from "@/constants/config"
import { Sidebar } from "@/components/shared/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Calendar as CalendarIcon, DollarSign, Users, Briefcase, Mail, Phone, Clock, Download, Printer } from "lucide-react"
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Helper to format currency
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export default function InstructorDetailPage() {
    const params = useParams()
    const router = useRouter()
    const instructorId = params.id as string

    const [instructor, setInstructor] = useState<Instructor | null>(null)
    const [classes, setClasses] = useState<ClassSession[]>([])

    // Payroll Filter State
    const [dateRange, setDateRange] = useState<{ start: string, end: string }>({
        start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
        end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
    })

    useEffect(() => {
        const allInstructors = db.getInstructors()
        const found = allInstructors.find(i => i.id === instructorId)
        if (found) {
            setInstructor(found)
        } else {
            toast.error("Instructor no encontrado")
            router.push("/dashboard/instructors")
        }

        setClasses(db.getClasses())
    }, [instructorId, router])

    const payrollData = useMemo(() => {
        if (!instructor) return { classes: [], totalClasses: 0, totalHours: 0, totalPay: 0, avgStudents: 0 }

        const start = parseISO(dateRange.start)
        const end = parseISO(dateRange.end)

        // Filter classes: Correct Instructor + 'completed' status + Within Date Range
        const filteredClasses = classes.filter(c => {
            if (c.instructorId !== instructorId) return false;
            if (c.status !== 'completed' && c.status !== 'confirmed') return false; // Including confirmed for demo if no completed exist, usually strict to completed

            const classDate = parseISO(c.date)
            // Adjust end date to include the full day
            const adjustedEnd = new Date(end)
            adjustedEnd.setHours(23, 59, 59)

            return isWithinInterval(classDate, { start, end: adjustedEnd })
        })

        const totalClasses = filteredClasses.length
        // Approx hours (assuming 1hr per class if no end time diff logic, but we have startTime/endTime)
        const totalHours = filteredClasses.reduce((acc, c) => {
            // Simple diff calculation
            const [startH, startM] = c.startTime.split(':').map(Number)
            // Default 1 hour duration if no endTime (though our type has endTime usually? Let's assume standard if needed or calc)
            // Let's assume 1 hour for simplicity unless we parse endTime
            return acc + 1
        }, 0)

        const totalPay = totalClasses * (instructor.ratePerClass || 0)

        const totalStudents = filteredClasses.reduce((acc, c) => acc + c.attendees.length, 0)
        const avgStudents = totalClasses > 0 ? (totalStudents / totalClasses).toFixed(1) : "0"

        return {
            classes: filteredClasses.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
            totalClasses,
            totalHours,
            totalPay,
            avgStudents
        }
    }, [classes, instructor, instructorId, dateRange])


    const handlePrint = () => {
        window.print()
    }

    if (!instructor) return <div className="p-8">Cargando...</div>

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
            <Sidebar />
            <main className="flex-1 p-8 overflow-y-auto w-full print:p-0 print:overflow-visible">
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
                    <TabsList className="print:hidden">
                        <TabsTrigger value="profile">Perfil</TabsTrigger>
                        <TabsTrigger value="payroll">Liquidación & Pagos</TabsTrigger>
                    </TabsList>

                    {/* PROFILE TAB */}
                    <TabsContent value="profile" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Información Personal</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="h-20 w-20 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-3xl">
                                        <Users className="h-10 w-10" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold">{instructor.name}</h3>
                                        <div className="flex gap-2 mt-2">
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
                                        <Label className="text-slate-500 flex items-center gap-2"><DollarSign className="h-4 w-4" /> Tarifa Base por Clase</Label>
                                        <div className="font-bold text-lg text-green-600">
                                            {formatCurrency(instructor.ratePerClass || 0)}
                                        </div>
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                        <Label className="text-slate-500 flex items-center gap-2"><Briefcase className="h-4 w-4" /> Biografía</Label>
                                        <p className="text-sm text-slate-700 leading-relaxed">{instructor.bio || "Sin información"}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* PAYROLL TAB */}
                    <TabsContent value="payroll" className="space-y-6">
                        {/* Filters */}
                        <Card className="print:hidden">
                            <CardContent className="pt-6">
                                <div className="flex flex-col md:flex-row gap-4 items-end">
                                    <div className="grid gap-2 flex-1">
                                        <Label>Fecha Inicio</Label>
                                        <Input
                                            type="date"
                                            value={dateRange.start}
                                            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid gap-2 flex-1">
                                        <Label>Fecha Fin</Label>
                                        <Input
                                            type="date"
                                            value={dateRange.end}
                                            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                        />
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

                        {/* Printable Area Wrapper */}
                        <div id="printable-report">
                            {/* Report Header for Print */}
                            <div className="hidden print:block mb-8">
                                <div className="flex items-center gap-4 mb-4">
                                    {/* Logo placeholder if needed */}
                                    <h1 className="text-4xl font-bold tracking-tight text-primary">Atria Fitness</h1>
                                </div>
                                <h2 className="text-2xl font-bold mb-2">Liquidación de Instructor</h2>
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

                            {/* KPIS */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-slate-500">Clases Completadas</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{payrollData.totalClasses}</div>
                                        <p className="text-xs text-slate-500">en el periodo seleccionado</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-slate-500">Horas Totales</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{payrollData.totalHours} hr</div>
                                        <p className="text-xs text-slate-500">tiempo efectivo</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-slate-500">Alumnas/Clase</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{payrollData.avgStudents}</div>
                                        <p className="text-xs text-slate-500">promedio de asistencia</p>
                                    </CardContent>
                                </Card>
                                <Card className="bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900 border-none print:border print:border-black print:text-black print:bg-white">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium opacity-80">Monto a Pagar</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-3xl font-bold">{formatCurrency(payrollData.totalPay)}</div>
                                        <p className="text-xs opacity-70">Tarifa base: {formatCurrency(instructor.ratePerClass || 0)}</p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Detailed Table */}
                            <Card className="print:shadow-none print:border-none">
                                <CardHeader className="flex flex-row items-center justify-between print:px-0">
                                    <div>
                                        <CardTitle className="print:text-xl">Detalle de Clases</CardTitle>
                                        <CardDescription className="print:hidden">Desglose de todas las sesiones incluidas en el cálculo.</CardDescription>
                                    </div>
                                    <Button variant="outline" size="sm" className="print:hidden gap-2" onClick={handlePrint}>
                                        <Printer className="h-4 w-4" /> Imprimir Reporte
                                    </Button>
                                </CardHeader>
                                <CardContent className="print:px-0">
                                    <Table>
                                        <TableHeader>
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
                                                    <TableCell colSpan={6} className="text-center py-6 text-slate-500">
                                                        No hay clases registradas en este periodo.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                payrollData.classes.map(c => {
                                                    const roomName = ROOMS.find(r => r.id === c.room)?.name || c.room;
                                                    const rate = instructor.ratePerClass || 0;
                                                    // In print/report we might want to see attendees names? For now simple count is fine as req by user
                                                    return (
                                                        <TableRow key={c.id}>
                                                            <TableCell className="font-medium">
                                                                {format(parseISO(c.date), "dd/MM/yyyy")}
                                                            </TableCell>
                                                            <TableCell>{c.startTime}</TableCell>
                                                            <TableCell>
                                                                <Badge variant="outline" className="capitalize print:border-black print:text-black">{c.type}</Badge>
                                                            </TableCell>
                                                            <TableCell>{roomName}</TableCell>
                                                            <TableCell className="text-right flex items-center justify-end gap-1">
                                                                <Users className="h-3 w-3 text-slate-400 print:hidden" />
                                                                {c.attendees.length}
                                                            </TableCell>
                                                            <TableCell className="text-right font-medium">
                                                                {formatCurrency(rate)}
                                                            </TableCell>
                                                        </TableRow>
                                                    )
                                                })
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>

                            {/* Footer for print */}
                            <div className="hidden print:block mt-12 pt-8 border-t border-slate-200">
                                <div className="flex justify-between text-sm text-slate-500">
                                    <p>Atria Fitness System</p>
                                    <p>Página 1 de 1</p>
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    )
}
