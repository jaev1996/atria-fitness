"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { getStudent, updateStudent, processStudentPayment, deleteStudentPlan, deleteHistoryEntry, addHistoryEntry } from "@/actions/students"
import { User, StudentPlan, StudentPayment, StudentHistory, StudentStatus, PaymentMethod } from "@prisma/client"
import { useSubmitting } from "@/hooks/useSubmitting"
import { Sidebar } from "@/components/shared/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, Trash2, Activity, AlertCircle, HeartPulse, ShieldAlert, Phone, CreditCard, ShoppingBag, Edit, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/useAuth"
import { DISCIPLINES } from "@/constants/config"

type StudentWithDetails = User & {
    plans: StudentPlan[];
    paymentsMade: StudentPayment[];
    history: StudentHistory[];
}

export default function StudentDetailsPage() {
    const params = useParams()
    const router = useRouter()
    const { role } = useAuth(true)
    const [student, setStudent] = useState<StudentWithDetails | null>(null)
    const { submit, isSubmitting: isFormSaving } = useSubmitting()
    const [isPaymentLoading, setIsPaymentLoading] = useState(false)
    const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)

    // Pagination for History
    const [historyPage, setHistoryPage] = useState(1)
    const ITEMS_PER_PAGE = 10

    // Edit Modals State
    const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false)
    const [isMedicalDialogOpen, setIsMedicalDialogOpen] = useState(false)

    // Form state for History/Activity
    const [newEntry, setNewEntry] = useState({
        activity: "",
        notes: "",
        cost: "",
        date: new Date().toISOString().split('T')[0]
    })

    // Payment Form
    const [newPayment, setNewPayment] = useState<{
        planName: string;
        credits: number;
        amount: string;
        method: PaymentMethod;
        discipline: string;
    }>({
        planName: "Pack 8 Clases",
        credits: 8,
        amount: "",
        method: "TRANSFERENCIA",
        discipline: "Pole" // Standardized
    })

    // Edit Forms
    const [editProfileForm, setEditProfileForm] = useState<Partial<User>>({})
    const [editMedicalForm, setEditMedicalForm] = useState<Partial<User>>({})

    // Load student
    const loadStudent = useCallback(async () => {
        if (params.id) {
            try {
                const s = await getStudent(params.id as string)
                if (s) {
                    const studentData = s as unknown as StudentWithDetails;
                    setStudent(studentData)
                    setEditProfileForm({
                        name: studentData.name,
                        phone: studentData.phone ?? "",
                        email: studentData.email,
                        emergencyContact: studentData.emergencyContact ?? "",
                        status: studentData.status ?? "ACTIVE"
                    })
                    setEditMedicalForm({
                        medicalInfo: studentData.medicalInfo ?? "",
                        allergies: studentData.allergies ?? "",
                        injuries: studentData.injuries ?? "",
                        conditions: studentData.conditions ?? "",
                        sportsInfo: studentData.sportsInfo ?? ""
                    })
                } else {
                    toast.error("Alumna no encontrada")
                    router.push("/dashboard/students")
                }
            } catch {
                toast.error("Error al cargar alumna")
            }
        }
    }, [params.id, router])

    useEffect(() => {
        const timer = setTimeout(() => {
            loadStudent()
        }, 0)
        return () => clearTimeout(timer)
    }, [loadStudent])

    const handleUpdateProfile = async () => {
        if (student) {
            try {
                await submit(() => updateStudent(student.id, editProfileForm))
                toast.success("Perfil actualizado")
                setIsProfileDialogOpen(false)
                loadStudent()
            } catch {
                toast.error("Error al actualizar perfil")
            }
        }
    }

    const handleUpdateMedical = async () => {
        if (student) {
            try {
                await submit(() => updateStudent(student.id, editMedicalForm))
                toast.success("Ficha médica actualizada")
                setIsMedicalDialogOpen(false)
                loadStudent()
            } catch {
                toast.error("Error al actualizar ficha médica")
            }
        }
    }

    const handleAddHistory = async () => {
        if (!newEntry.activity || !newEntry.cost) {
            toast.error("Actividad y costo son obligatorios")
            return
        }

        if (student) {
            try {
                await submit(() => addHistoryEntry(student.id, {
                    activity: newEntry.activity,
                    notes: newEntry.notes,
                    cost: Number(newEntry.cost)
                }))
                toast.success("Historial actualizado")
                setIsHistoryDialogOpen(false)
                setNewEntry({ activity: "", notes: "", cost: "", date: new Date().toISOString().split('T')[0] })
                loadStudent()
            } catch {
                toast.error("Error al agregar historial")
            }
        }
    }

    const handleDeleteEntry = async (entryId: string) => {
        if (confirm("¿Eliminar este registro?")) {
            if (student) {
                try {
                    await submit(() => deleteHistoryEntry(entryId, student.id))
                    toast.success("Registro eliminado")
                    loadStudent()
                } catch {
                    toast.error("Error al eliminar registro")
                }
            }
        }
    }

    const handleProcessPayment = async () => {
        if (!newPayment.amount || !newPayment.planName) {
            toast.error("Datos incompletos")
            return
        }
        if (isPaymentLoading) return  // double-click guard
        if (student) {
            setIsPaymentLoading(true)
            try {
                await processStudentPayment({
                    studentId: student.id,
                    amount: Number(newPayment.amount),
                    method: newPayment.method,
                    planName: newPayment.planName,
                    credits: newPayment.credits,
                    discipline: newPayment.discipline
                })
                toast.success("Pago registrado y plan agregado")
                setIsPaymentDialogOpen(false)
                setNewPayment({
                    planName: "Pack 8 Clases",
                    credits: 8,
                    amount: "",
                    method: "TRANSFERENCIA",
                    discipline: "Pole"
                })
                loadStudent()
            } catch (err) {
                toast.error(err instanceof Error ? err.message : "Error al procesar pago")
            } finally {
                setIsPaymentLoading(false)
            }
        }
    }


    const handleDeletePlan = async (planId: string) => {
        if (confirm("¿Estás seguro de eliminar este plan? Esta acción no se puede deshacer.")) {
            if (student) {
                try {
                    await submit(() => deleteStudentPlan(planId, student.id))
                    toast.success("Plan eliminado correctamente")
                    loadStudent()
                } catch {
                    toast.error("Error al eliminar plan")
                }
            }
        }
    }

    if (!student) return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
            <Sidebar />
            <div className="flex-1 flex flex-col items-center justify-center p-8">
                <div className="flex flex-col items-center gap-6 bg-white dark:bg-slate-800/80 backdrop-blur px-14 py-12 rounded-3xl shadow-lg border border-slate-100 dark:border-slate-700">
                    {/* Brand glow ring + spinner */}
                    <div className="relative flex items-center justify-center">
                        <div className="absolute h-24 w-24 rounded-full bg-primary/10 animate-pulse" />
                        <div className="absolute h-20 w-20 rounded-full ring-2 ring-primary/30" />
                        <Loader2 className="h-10 w-10 text-primary animate-spin relative z-10" />
                    </div>
                    {/* Text */}
                    <div className="flex flex-col items-center gap-1.5">
                        <p className="text-base font-semibold text-slate-800 dark:text-slate-100 tracking-tight">Cargando perfil</p>
                        <p className="text-sm text-slate-400 dark:text-slate-500">Atria Fitness</p>
                    </div>
                    {/* Dot pulse */}
                    <div className="flex gap-1.5">
                        {[0, 150, 300].map((delay) => (
                            <span
                                key={delay}
                                className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce"
                                style={{ animationDelay: `${delay}ms` }}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
            <Sidebar />
            <main className="flex-1 p-8 overflow-y-auto">
                <div className="mb-6 flex items-center gap-4">
                    <Link href="/dashboard/students">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Detalles de Alumna</h1>
                </div>

                <div className="grid gap-6 md:grid-cols-3 mb-8">
                    {/* Column 1: Profile & Plan */}
                    <div className="md:col-span-1 space-y-6">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>Perfil</CardTitle>
                                {role === 'admin' && (
                                    <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button size="icon" variant="ghost" className="h-6 w-6">
                                                <Edit className="h-3 w-3" />
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Editar Información Personal</DialogTitle>
                                            </DialogHeader>
                                            <div className="grid gap-4 py-4">
                                                <div className="grid gap-2">
                                                    <Label>Nombre Completo</Label>
                                                    <Input value={editProfileForm.name ?? ""} onChange={e => setEditProfileForm({ ...editProfileForm, name: e.target.value })} />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label>Teléfono</Label>
                                                    <Input value={editProfileForm.phone ?? ""} onChange={e => setEditProfileForm({ ...editProfileForm, phone: e.target.value })} />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label>Email</Label>
                                                    <Input value={editProfileForm.email ?? ""} onChange={e => setEditProfileForm({ ...editProfileForm, email: e.target.value })} />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label>Contacto Emergencia</Label>
                                                    <Input value={editProfileForm.emergencyContact ?? ""} onChange={e => setEditProfileForm({ ...editProfileForm, emergencyContact: e.target.value })} />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label>Estatus</Label>
                                                    <span className="text-xs text-slate-400 mb-1">El estatus solo puede ser cambiado por un administrador.</span>
                                                    <Select value={editProfileForm.status ?? "ACTIVE"} onValueChange={(v: StudentStatus) => setEditProfileForm({ ...editProfileForm, status: v })}>
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="ACTIVE">Activa</SelectItem>
                                                            <SelectItem value="INACTIVE">Inactiva</SelectItem>
                                                            <SelectItem value="GUEST">Invitada</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <Button variant="outline" onClick={() => setIsProfileDialogOpen(false)}>Cancelar</Button>
                                                <Button onClick={handleUpdateProfile} disabled={isFormSaving}>
                                                    {isFormSaving ? "Guardando..." : "Guardar Cambios"}
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                )}
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label className="text-slate-500">Nombre</Label>
                                    <div className="font-medium text-lg flex items-center gap-2">
                                        {student.name}
                                        {student.status === 'GUEST' && <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full">Invitada</span>}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <Label className="text-slate-500">Teléfono</Label>
                                        <div className="font-medium">{student.phone}</div>
                                    </div>
                                    <div>
                                        <Label className="text-slate-500">Email</Label>
                                        <div className="font-medium truncate text-xs" title={student.email}>{student.email || "-"}</div>
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-slate-500 flex items-center gap-2">
                                        <Phone className="h-3 w-3 text-red-500" /> Contacto Emergencia
                                    </Label>
                                    <div className="font-medium">{student.emergencyContact || "No registrado"}</div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* PLAN WIDGET & PAYMENT */}
                        <Card className="border-primary/20 bg-primary/5 dark:bg-primary/10">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-primary flex items-center gap-2">
                                    <ShoppingBag className="h-4 w-4" /> Planes Activos
                                </CardTitle>
                                {role === 'admin' && (
                                    <Dialog open={isPaymentDialogOpen} onOpenChange={(open) => { if (!isPaymentLoading) setIsPaymentDialogOpen(open) }}>
                                        <DialogTrigger asChild>
                                            <Button size="sm" variant="secondary" className="h-7 text-xs bg-white text-primary border border-primary/20 hover:bg-primary hover:text-white">
                                                + Nuevo Plan
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Registrar Pago / Nuevo Plan</DialogTitle>
                                            </DialogHeader>
                                            <div className="grid gap-4 py-4">
                                                <div className="grid gap-2">
                                                    <Label>Disciplina</Label>
                                                    <Select value={newPayment.discipline} onValueChange={(v) => setNewPayment({ ...newPayment, discipline: v })}>
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            {DISCIPLINES.map(d => (
                                                                <SelectItem key={d} value={d}>{d}</SelectItem>
                                                            ))}
                                                            <SelectItem value="General">General (Todas)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label>Tipo de Plan</Label>
                                                    <Select
                                                        value={newPayment.planName}
                                                        onValueChange={(v) => {
                                                            let c = 8
                                                            if (v === 'Pack 4 Clases') c = 4
                                                            if (v === 'Pack 12 Clases') c = 12
                                                            if (v === 'Pack 24 Clases') c = 24
                                                            if (v === 'Ilimitado') c = 999
                                                            if (v === 'Clase Suelta') c = 1
                                                            setNewPayment({ ...newPayment, planName: v, credits: c })
                                                        }}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Clase Suelta">Clase Suelta (1 Crédito)</SelectItem>
                                                            <SelectItem value="Pack 4 Clases">Pack 4 Clases</SelectItem>
                                                            <SelectItem value="Pack 8 Clases">Pack 8 Clases</SelectItem>
                                                            <SelectItem value="Pack 12 Clases">Pack 12 Clases</SelectItem>
                                                            <SelectItem value="Ilimitado">Ilimitado</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label>Créditos</Label>
                                                    <Input type="number" value={newPayment.credits} onChange={e => setNewPayment({ ...newPayment, credits: parseInt(e.target.value) })} />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label>Monto ($)</Label>
                                                    <Input type="number" value={newPayment.amount} onChange={e => setNewPayment({ ...newPayment, amount: e.target.value })} />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label>Método de Pago</Label>
                                                    <Select value={newPayment.method} onValueChange={(v: PaymentMethod) => setNewPayment({ ...newPayment, method: v })}>
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                                                            <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                                                            <SelectItem value="TARJETA">Tarjeta</SelectItem>
                                                            <SelectItem value="OTRO">Otro</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>Cancelar</Button>
                                                <Button onClick={handleProcessPayment} disabled={isPaymentLoading}>
                                                    {isPaymentLoading ? "Confirmando..." : "Confirmar"}
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                )}
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {(student.plans && student.plans.length > 0) ? (
                                    student.plans.map((plan, idx) => (
                                        <div key={idx} className="p-3 bg-white dark:bg-slate-800 rounded border shadow-sm">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="font-semibold text-sm">{plan.originalName}</span>
                                                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase",
                                                    plan.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                                                )}>
                                                    {plan.discipline}
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-xs text-slate-500 mb-1">
                                                <span>Créditos Restantes</span>
                                                <div className="flex items-center gap-2">
                                                    <span className={cn("font-bold", plan.credits < 2 ? "text-red-500" : "text-slate-700")}>
                                                        {plan.credits > 900 ? "∞" : plan.credits}
                                                    </span>
                                                    {role === 'admin' && (
                                                        <Button variant="ghost" size="icon" className="h-4 w-4 text-destructive hover:bg-destructive/10" onClick={() => handleDeletePlan(plan.id)}>
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-slate-500">No hay planes activos.</p>
                                )}
                            </CardContent>
                        </Card>

                        {/* PAYMENT HISTORY (Admin only) */}
                        {role === 'admin' && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <CreditCard className="h-4 w-4" /> Historial de Pagos
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div>
                                        {!student.paymentsMade || student.paymentsMade.length === 0 ? (
                                            <p className="text-xs text-slate-400 text-center py-4">Sin pagos registrados</p>
                                        ) : (
                                            student.paymentsMade.slice().reverse().map(p => (
                                                <div key={p.id} className="flex justify-between items-center text-sm border-b pb-2 last:border-0 last:pb-0">
                                                    <div>
                                                        <div className="font-medium">{p.concept}</div>
                                                        <div className="text-xs text-slate-500">{new Date(p.date).toLocaleDateString()} • {p.method}</div>
                                                    </div>
                                                    <div className="font-bold text-green-600">${p.amount}</div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Column 2 & 3: Medical Info & History */}
                    <div className="md:col-span-2 space-y-6">
                        {/* MEDICAL INFO DETAILED */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle className="flex items-center gap-2">
                                    <Activity className="h-5 w-5 text-red-500" /> Ficha Médica y Deportiva
                                </CardTitle>
                                {role === 'admin' && (
                                    <Dialog open={isMedicalDialogOpen} onOpenChange={setIsMedicalDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button size="icon" variant="ghost" className="h-6 w-6">
                                                <Edit className="h-3 w-3" />
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-2xl">
                                            <DialogHeader>
                                                <DialogTitle>Editar Ficha Médica</DialogTitle>
                                            </DialogHeader>
                                            <div className="grid grid-cols-2 gap-4 py-4">
                                                <div className="grid gap-2">
                                                    <Label>Alergias</Label>
                                                    <Input value={editMedicalForm.allergies ?? ""} onChange={e => setEditMedicalForm({ ...editMedicalForm, allergies: e.target.value })} />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label>Condiciones</Label>
                                                    <Input value={editMedicalForm.conditions ?? ""} onChange={e => setEditMedicalForm({ ...editMedicalForm, conditions: e.target.value })} />
                                                </div>
                                                <div className="grid gap-2 col-span-2">
                                                    <Label>Lesiones</Label>
                                                    <Input value={editMedicalForm.injuries ?? ""} onChange={e => setEditMedicalForm({ ...editMedicalForm, injuries: e.target.value })} />
                                                </div>
                                                <div className="grid gap-2 col-span-2">
                                                    <Label>Observaciones Médicas</Label>
                                                    <Textarea value={editMedicalForm.medicalInfo ?? ""} onChange={e => setEditMedicalForm({ ...editMedicalForm, medicalInfo: e.target.value })} />
                                                </div>
                                                <div className="grid gap-2 col-span-2">
                                                    <Label>Información Deportiva</Label>
                                                    <Input value={editMedicalForm.sportsInfo ?? ""} onChange={e => setEditMedicalForm({ ...editMedicalForm, sportsInfo: e.target.value })} />
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <Button variant="outline" onClick={() => setIsMedicalDialogOpen(false)}>Cancelar</Button>
                                                <Button onClick={handleUpdateMedical} disabled={isFormSaving}>
                                                    {isFormSaving ? "Guardando..." : "Guardar Cambios"}
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                )}
                            </CardHeader>
                            <CardContent className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-slate-500 flex items-center gap-2">
                                        <ShieldAlert className="h-3 w-3" /> Alergias
                                    </Label>
                                    <div className="p-2 bg-red-50 dark:bg-red-900/10 rounded text-sm text-red-800 dark:text-red-200">
                                        {student.allergies || "Ninguna conocida"}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-slate-500 flex items-center gap-2">
                                        <HeartPulse className="h-3 w-3" /> Condiciones
                                    </Label>
                                    <div className="p-2 bg-orange-50 dark:bg-orange-900/10 rounded text-sm text-orange-800 dark:text-orange-200">
                                        {student.conditions || "Ninguna reportada"}
                                    </div>
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                    <Label className="text-slate-500 flex items-center gap-2">
                                        <AlertCircle className="h-3 w-3" /> Lesiones
                                    </Label>
                                    <div className="p-2 bg-yellow-50 dark:bg-yellow-900/10 rounded text-sm text-yellow-800 dark:text-yellow-200">
                                        {student.injuries || "Sin lesiones recientes"}
                                    </div>
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                    <Label className="text-slate-500">Observaciones Médicas Generales</Label>
                                    <p className="text-sm text-slate-700 dark:text-slate-300">{student.medicalInfo || "-"}</p>
                                </div>
                                <div className="space-y-1 md:col-span-2 border-t pt-4 mt-2">
                                    <Label className="text-slate-500">Nota Deportiva</Label>
                                    <p className="text-sm text-slate-700 dark:text-slate-300 italic">&ldquo;{student.sportsInfo || "Sin antecedentes"}&rdquo;</p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* HISTORY */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div className="space-y-1">
                                    <CardTitle>Historial de Clases</CardTitle>
                                    <CardDescription>Registro automatizado de asistencia y créditos</CardDescription>
                                </div>
                                {role === 'admin' && (
                                    <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button variant="outline" size="sm">
                                                Ajuste Manual
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Ajuste Manual de Historial</DialogTitle>
                                            </DialogHeader>
                                            <div className="grid gap-4 py-4">
                                                <div className="grid gap-2">
                                                    <Label>Fecha</Label>
                                                    <Input
                                                        type="date"
                                                        value={newEntry.date}
                                                        onChange={(e) => setNewEntry({ ...newEntry, date: e.target.value })}
                                                    />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label>Actividad</Label>
                                                    <Input
                                                        placeholder="Ej. Ajuste Crédito +1"
                                                        value={newEntry.activity}
                                                        onChange={(e) => setNewEntry({ ...newEntry, activity: e.target.value })}
                                                    />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label>Costo / Valor ($)</Label>
                                                    <Input
                                                        type="number"
                                                        placeholder="0.00"
                                                        value={newEntry.cost}
                                                        onChange={(e) => setNewEntry({ ...newEntry, cost: e.target.value })}
                                                    />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label>Notas</Label>
                                                    <Textarea
                                                        placeholder="Razón del ajuste..."
                                                        value={newEntry.notes}
                                                        onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <Button variant="outline" onClick={() => setIsHistoryDialogOpen(false)}>Cancelar</Button>
                                                <Button onClick={handleAddHistory} disabled={isFormSaving} className="bg-primary text-primary-foreground hover:bg-primary/90">
                                                    {isFormSaving ? "Guardando..." : "Guardar"}
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                )}
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead>Actividad</TableHead>
                                            <TableHead>Valor</TableHead>
                                            <TableHead className="text-right">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {student.history.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                                                    No hay historial registrado.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            student.history
                                                .slice()
                                                .reverse()
                                                .slice((historyPage - 1) * ITEMS_PER_PAGE, historyPage * ITEMS_PER_PAGE)
                                                .map((entry) => (
                                                    <TableRow key={entry.id}>
                                                        <TableCell className="font-medium whitespace-nowrap">{new Date(entry.date).toLocaleDateString()}</TableCell>
                                                        <TableCell>
                                                            <div>{entry.activity}</div>
                                                            {entry.notes && (
                                                                <div className="text-xs text-slate-400">
                                                                    {entry.notes.includes('ID: ') ? 'Instructor Registrado' : entry.notes}
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="font-medium text-green-600">
                                                            {entry.cost > 0 ? `$${entry.cost}` : '-'}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {role === 'admin' && (
                                                                <Button variant="ghost" size="sm" onClick={() => handleDeleteEntry(entry.id)}>
                                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                        )}
                                    </TableBody>
                                </Table>

                                {/* PAGINATION CONTROLS */}
                                {student.history.length > ITEMS_PER_PAGE && (
                                    <div className="flex items-center justify-between mt-4 px-2">
                                        <div className="text-xs text-slate-500">
                                            Mostrando {(historyPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(historyPage * ITEMS_PER_PAGE, student.history.length)} de {student.history.length}
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                                                disabled={historyPage === 1}
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setHistoryPage(p => Math.min(Math.ceil(student.history.length / ITEMS_PER_PAGE), p + 1))}
                                                disabled={historyPage >= Math.ceil(student.history.length / ITEMS_PER_PAGE)}
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    )
}
