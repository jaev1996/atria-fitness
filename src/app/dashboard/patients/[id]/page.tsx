"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { db, Patient, HistoryEntry } from "@/lib/storage"
import { Sidebar } from "@/components/shared/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, Plus, Trash2, FileText, DollarSign } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

import { Odontogram } from "@/components/dental/odontogram"

export default function PatientDetailsPage() {
    // ... existing hooks ...
    const params = useParams()
    const router = useRouter()
    const [patient, setPatient] = useState<Patient | null>(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    // Form state
    const [newEntry, setNewEntry] = useState({
        treatment: "",
        notes: "",
        cost: "",
        date: new Date().toISOString().split('T')[0]
    })

    // Load patient
    const loadPatient = () => {
        if (params.id) {
            const p = db.getPatient(params.id as string)
            if (p) {
                setPatient(p)
            } else {
                toast.error("Paciente no encontrado")
                router.push("/dashboard/patients")
            }
        }
    }

    useEffect(() => {
        loadPatient()
    }, [params.id])

    const handleAddHistory = () => {
        if (!newEntry.treatment || !newEntry.cost) {
            toast.error("Tratamiento y costo son obligatorios")
            return
        }

        if (patient) {
            db.addHistoryEntry(patient.id, {
                treatment: newEntry.treatment,
                notes: newEntry.notes,
                cost: Number(newEntry.cost),
                date: newEntry.date
            })
            toast.success("Historial actualizado")
            setIsDialogOpen(false)
            setNewEntry({
                treatment: "",
                notes: "",
                cost: "",
                date: new Date().toISOString().split('T')[0]
            })
            loadPatient() // Reload data
        }
    }

    const handleDeleteEntry = (entryId: string) => {
        if (confirm("¿Eliminar este registro?")) {
            if (patient) {
                db.deleteHistoryEntry(patient.id, entryId)
                toast.success("Registro eliminado")
                loadPatient()
            }
        }
    }

    if (!patient) return <div className="p-8">Cargando...</div>

    return (
        <div className="flex h-screen bg-slate-50">
            <Sidebar />
            <main className="flex-1 p-8 overflow-y-auto">
                <div className="mb-6 flex items-center gap-4">
                    <Link href="/dashboard/patients">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold text-slate-800">Historial Clínico</h1>
                </div>

                <div className="grid gap-6 md:grid-cols-3 mb-8">
                    <Card className="md:col-span-1 h-fit">
                        <CardHeader>
                            <CardTitle>Información del Paciente</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label className="text-slate-500">Nombre</Label>
                                <div className="font-medium text-lg">{patient.name}</div>
                            </div>
                            <div>
                                <Label className="text-slate-500">Teléfono</Label>
                                <div className="font-medium">{patient.phone}</div>
                            </div>
                            <div>
                                <Label className="text-slate-500">Email</Label>
                                <div className="font-medium">{patient.email || "No registrado"}</div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="md:col-span-2">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Tratamientos y Consultas</CardTitle>
                            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button className="bg-blue-600">
                                        <Plus className="mr-2 h-4 w-4" /> Nueva Consulta
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Registrar Evolución</DialogTitle>
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
                                            <Label>Tratamiento Realizado</Label>
                                            <Input
                                                placeholder="Ej. Limpieza general"
                                                value={newEntry.treatment}
                                                onChange={(e) => setNewEntry({ ...newEntry, treatment: e.target.value })}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>Costo ($)</Label>
                                            <Input
                                                type="number"
                                                placeholder="0.00"
                                                value={newEntry.cost}
                                                onChange={(e) => setNewEntry({ ...newEntry, cost: e.target.value })}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>Notas / Observaciones</Label>
                                            <Textarea
                                                placeholder="Detalles del procedimiento..."
                                                value={newEntry.notes}
                                                onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                                        <Button onClick={handleAddHistory} className="bg-blue-600">Guardar Registro</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Tratamiento</TableHead>
                                        <TableHead>Notas</TableHead>
                                        <TableHead>Costo</TableHead>
                                        <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {patient.history.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                                                No hay historial clínico registrado.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        patient.history.map((entry) => (
                                            <TableRow key={entry.id}>
                                                <TableCell className="font-medium whitespace-nowrap">{entry.date}</TableCell>
                                                <TableCell>{entry.treatment}</TableCell>
                                                <TableCell className="max-w-xs truncate text-slate-500" title={entry.notes}>
                                                    {entry.notes}
                                                </TableCell>
                                                <TableCell className="font-medium text-green-600">
                                                    ${entry.cost}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="sm" onClick={() => handleDeleteEntry(entry.id)}>
                                                        <Trash2 className="h-4 w-4 text-red-500" />
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

                {/* Odontogram Section */}
                <Odontogram patientId={patient.id} />
            </main>
        </div>
    )
}
