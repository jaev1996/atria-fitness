"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { db, Student, PaymentMethod, StudentStatus } from "@/lib/storage"
import { Sidebar } from "@/components/shared/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, Trash2, Activity, AlertCircle, HeartPulse, ShieldAlert, Phone, CreditCard, ShoppingBag, Edit } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { DISCIPLINES } from "@/constants/config"

export default function StudentDetailsPage() {
    const params = useParams()
    const router = useRouter()
    const [student, setStudent] = useState<Student | null>(null)
    const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)

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
        method: "Transferencia",
        discipline: "Pole Exotic" // Standardized
    })

    // Edit Forms
    const [editProfileForm, setEditProfileForm] = useState<Partial<Student>>({})
    const [editMedicalForm, setEditMedicalForm] = useState<Partial<Student>>({})

    // Load student
    const loadStudent = useCallback(async () => {
        if (params.id) {
            const s = db.getStudent(params.id as string)
            if (s) {
                setStudent(s)
                setEditProfileForm({
                    name: s.name, phone: s.phone, email: s.email, emergencyContact: s.emergencyContact, status: s.status
                })
                setEditMedicalForm({
                    medicalInfo: s.medicalInfo, allergies: s.allergies, injuries: s.injuries, conditions: s.conditions, sportsInfo: s.sportsInfo
                })
            } else {
                toast.error("Alumna no encontrada")
                router.push("/dashboard/students")
            }
        }
    }, [params.id, router])

    useEffect(() => {
        const timer = setTimeout(() => {
            loadStudent()
        }, 0)
        return () => clearTimeout(timer)
    }, [loadStudent])

    const handleUpdateProfile = () => {
        if (student) {
            db.updateStudent(student.id, editProfileForm)
            toast.success("Perfil actualizado")
            setIsProfileDialogOpen(false)
            loadStudent()
        }
    }

    const handleUpdateMedical = () => {
        if (student) {
            db.updateStudent(student.id, editMedicalForm)
            toast.success("Ficha médica actualizada")
            setIsMedicalDialogOpen(false)
            loadStudent()
        }
    }

    const handleAddHistory = () => {
        if (!newEntry.activity || !newEntry.cost) {
            toast.error("Actividad y costo son obligatorios")
            return
        }

        if (student) {
            db.addHistoryEntry(student.id, {
                activity: newEntry.activity,
                notes: newEntry.notes,
                cost: Number(newEntry.cost),
                date: newEntry.date
            })
            toast.success("Historial actualizado")
            setIsHistoryDialogOpen(false)
            setNewEntry({
                activity: "",
                notes: "",
                cost: "",
                date: new Date().toISOString().split('T')[0]
            })
            loadStudent()
        }
    }

    const handleDeleteEntry = (entryId: string) => {
        if (confirm("¿Eliminar este registro?")) {
            if (student) {
                db.deleteHistoryEntry(student.id, entryId)
                toast.success("Registro eliminado")
                loadStudent()
            }
        }
    }

    const handleProcessPayment = () => {
        if (!newPayment.amount || !newPayment.planName) {
            toast.error("Datos incompletos")
            return
        }
        if (student) {
            db.processPayment(
                student.id,
                Number(newPayment.amount),
                newPayment.method,
                newPayment.planName,
                newPayment.credits,
                newPayment.discipline
            )
            toast.success("Pago registrado y plan agregado")
            setIsPaymentDialogOpen(false)
            setNewPayment({
                planName: "Pack 8 Clases",
                credits: 8,
                amount: "",
                method: "Transferencia",
                discipline: "Pole Exotic"
            })
            loadStudent()
        }
    }


    const handleDeletePlan = (planId: string) => {
        if (confirm("¿Estás seguro de eliminar este plan? Esta acción no se puede deshacer.")) {
            if (student) {
                db.deleteStudentPlan(student.id, planId)
                toast.success("Plan eliminado correctamente")
                loadStudent()
            }
        }
    }

    if (!student) return <div className="p-8">Cargando...</div>

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
                                                <Input value={editProfileForm.name} onChange={e => setEditProfileForm({ ...editProfileForm, name: e.target.value })} />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Teléfono</Label>
                                                <Input value={editProfileForm.phone} onChange={e => setEditProfileForm({ ...editProfileForm, phone: e.target.value })} />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Email</Label>
                                                <Input value={editProfileForm.email} onChange={e => setEditProfileForm({ ...editProfileForm, email: e.target.value })} />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Contacto Emergencia</Label>
                                                <Input value={editProfileForm.emergencyContact} onChange={e => setEditProfileForm({ ...editProfileForm, emergencyContact: e.target.value })} />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Estatus</Label>
                                                <Select value={editProfileForm.status} onValueChange={(v: StudentStatus) => setEditProfileForm({ ...editProfileForm, status: v })}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="active">Activa</SelectItem>
                                                        <SelectItem value="inactive">Inactiva</SelectItem>
                                                        <SelectItem value="guest">Invitada</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button variant="outline" onClick={() => setIsProfileDialogOpen(false)}>Cancelar</Button>
                                            <Button onClick={handleUpdateProfile}>Guardar Cambios</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label className="text-slate-500">Nombre</Label>
                                    <div className="font-medium text-lg flex items-center gap-2">
                                        {student.name}
                                        {student.status === 'guest' && <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full">Invitada</span>}
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
                                <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
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
                                                        <SelectItem value="Efectivo">Efectivo</SelectItem>
                                                        <SelectItem value="Transferencia">Transferencia</SelectItem>
                                                        <SelectItem value="Tarjeta">Tarjeta</SelectItem>
                                                        <SelectItem value="Otro">Otro</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>Cancelar</Button>
                                            <Button onClick={handleProcessPayment}>Confirmar</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {(student.plans && student.plans.length > 0) ? (
                                    student.plans.map((plan, idx) => (
                                        <div key={idx} className="p-3 bg-white dark:bg-slate-800 rounded border shadow-sm">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="font-semibold text-sm">{plan.nombreOriginal}</span>
                                                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase",
                                                    plan.activo ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                                                )}>
                                                    {plan.disciplina}
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-xs text-slate-500 mb-1">
                                                <span>Créditos Restantes</span>
                                                <div className="flex items-center gap-2">
                                                    <span className={cn("font-bold", plan.creditos < 2 ? "text-red-500" : "text-slate-700")}>
                                                        {plan.creditos > 900 ? "∞" : plan.creditos}
                                                    </span>
                                                    <Button variant="ghost" size="icon" className="h-4 w-4 text-destructive hover:bg-destructive/10" onClick={() => handleDeletePlan(plan.id)}>
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-slate-500">No hay planes activos.</p>
                                )}
                            </CardContent>
                        </Card>

                        {/* PAYMENT HISTORY */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CreditCard className="h-4 w-4" /> Historial de Pagos
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4 max-h-[200px] overflow-y-auto">
                                    {!student.payments || student.payments.length === 0 ? (
                                        <p className="text-xs text-slate-400 text-center py-4">Sin pagos registrados</p>
                                    ) : (
                                        student.payments.slice().reverse().map(p => (
                                            <div key={p.id} className="flex justify-between items-center text-sm border-b pb-2 last:border-0 last:pb-0">
                                                <div>
                                                    <div className="font-medium">{p.concept}</div>
                                                    <div className="text-xs text-slate-500">{p.date} • {p.method}</div>
                                                </div>
                                                <div className="font-bold text-green-600">${p.amount}</div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Column 2 & 3: Medical Info & History */}
                    <div className="md:col-span-2 space-y-6">
                        {/* MEDICAL INFO DETAILED */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle className="flex items-center gap-2">
                                    <Activity className="h-5 w-5 text-red-500" /> Ficha Médica y Deportiva
                                </CardTitle>
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
                                                <Input value={editMedicalForm.allergies} onChange={e => setEditMedicalForm({ ...editMedicalForm, allergies: e.target.value })} />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label>Condiciones</Label>
                                                <Input value={editMedicalForm.conditions} onChange={e => setEditMedicalForm({ ...editMedicalForm, conditions: e.target.value })} />
                                            </div>
                                            <div className="grid gap-2 col-span-2">
                                                <Label>Lesiones</Label>
                                                <Input value={editMedicalForm.injuries} onChange={e => setEditMedicalForm({ ...editMedicalForm, injuries: e.target.value })} />
                                            </div>
                                            <div className="grid gap-2 col-span-2">
                                                <Label>Observaciones Médicas</Label>
                                                <Textarea value={editMedicalForm.medicalInfo} onChange={e => setEditMedicalForm({ ...editMedicalForm, medicalInfo: e.target.value })} />
                                            </div>
                                            <div className="grid gap-2 col-span-2">
                                                <Label>Información Deportiva</Label>
                                                <Input value={editMedicalForm.sportsInfo} onChange={e => setEditMedicalForm({ ...editMedicalForm, sportsInfo: e.target.value })} />
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button variant="outline" onClick={() => setIsMedicalDialogOpen(false)}>Cancelar</Button>
                                            <Button onClick={handleUpdateMedical}>Guardar Cambios</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
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
                                            <Button onClick={handleAddHistory} className="bg-primary text-primary-foreground hover:bg-primary/90">Guardar</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
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
                                            student.history.slice().reverse().map((entry) => (
                                                <TableRow key={entry.id}>
                                                    <TableCell className="font-medium whitespace-nowrap">{entry.date}</TableCell>
                                                    <TableCell>
                                                        <div>{entry.activity}</div>
                                                        {entry.notes && <div className="text-xs text-slate-400">{entry.notes}</div>}
                                                    </TableCell>
                                                    <TableCell className="font-medium text-green-600">
                                                        {entry.cost > 0 ? `$${entry.cost}` : '-'}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="sm" onClick={() => handleDeleteEntry(entry.id)}>
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    )
}
