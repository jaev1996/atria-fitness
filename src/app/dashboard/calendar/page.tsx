"use client"

import { useState, useEffect, useMemo } from "react"
import { db, Patient, Appointment, AppointmentStatus } from "@/lib/storage"
import { Sidebar } from "@/components/shared/sidebar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Calendar, ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const HOURS = Array.from({ length: 13 }, (_, i) => {
    const hour = i + 8 // 8 AM to 8 PM
    return `${hour.toString().padStart(2, '0')}:00`
})

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const STATUS_COLORS = {
    scheduled: "bg-green-100 border-green-500 text-green-700",
    postponed: "bg-yellow-100 border-yellow-500 text-yellow-700",
    cancelled: "bg-red-100 border-red-500 text-red-700",
    completed: "bg-slate-200 border-slate-500 text-slate-700",
}

const STATUS_LABELS: Record<AppointmentStatus, string> = {
    scheduled: "Confirmada",
    postponed: "Pospuesta",
    cancelled: "Cancelada",
    completed: "Completada",
}

export default function CalendarPage() {
    const [currentWeekStart, setCurrentWeekStart] = useState(new Date())
    const [appointments, setAppointments] = useState<Appointment[]>([])
    const [patients, setPatients] = useState<Patient[]>([])
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [selectedSlot, setSelectedSlot] = useState<{ date: Date, time: string } | null>(null)

    // Form State
    const [formData, setFormData] = useState<{
        patientId: string;
        date: string;
        startTime: string;
        endTime: string;
        treatmentType: string;
        notes: string;
        status: AppointmentStatus;
        id?: string;
    }>({
        patientId: "",
        date: "",
        startTime: "09:00",
        endTime: "10:00",
        treatmentType: "",
        notes: "",
        status: "scheduled"
    })

    // Load Initial Data
    useEffect(() => {
        setAppointments(db.getAppointments())
        setPatients(db.getPatients())

        // Set to Monday of current week if not already
        const today = new Date()
        const day = today.getDay()
        const diff = today.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday
        const monday = new Date(today.setDate(diff))
        setCurrentWeekStart(monday)
    }, [])

    // Navigation
    const navigateWeek = (direction: 'prev' | 'next') => {
        const newDate = new Date(currentWeekStart)
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
        setCurrentWeekStart(newDate)
    }

    // Get dates for current week view
    const weekDates = useMemo(() => {
        return Array.from({ length: 6 }, (_, i) => {
            const date = new Date(currentWeekStart)
            date.setDate(date.getDate() + i)
            return date
        })
    }, [currentWeekStart])

    // Handlers
    const handleSlotClick = (date: Date, time: string) => {
        const dateStr = date.toISOString().split('T')[0]
        const existingApp = appointments.find(a =>
            a.date === dateStr && a.startTime === time && a.status !== 'cancelled'
        )

        if (existingApp) {
            setFormData({
                id: existingApp.id,
                patientId: existingApp.patientId,
                date: existingApp.date,
                startTime: existingApp.startTime,
                endTime: existingApp.endTime,
                treatmentType: existingApp.treatmentType,
                notes: existingApp.notes || "",
                status: existingApp.status
            })
        } else {
            setFormData({
                patientId: "",
                date: dateStr,
                startTime: time,
                endTime: getTimePlusOneHour(time),
                treatmentType: "",
                notes: "",
                status: "scheduled"
            })
        }
        setSelectedSlot({ date, time })
        setIsDialogOpen(true)
    }

    const getTimePlusOneHour = (time: string) => {
        const [h, m] = time.split(':').map(Number)
        return `${(h + 1).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
    }

    const handleSave = () => {
        if (!formData.patientId || !formData.treatmentType) {
            toast.error("Selecciona un paciente y el tipo de tratamiento")
            return
        }

        const patient = patients.find(p => p.id === formData.patientId)
        if (!patient) return

        // Check for collisions (simple check)
        const collision = appointments.find(a =>
            a.date === formData.date &&
            a.startTime === formData.startTime &&
            a.status !== 'cancelled' &&
            a.id !== formData.id
        )

        if (collision) {
            toast.error("Ya existe una cita en este horario")
            return
        }

        if (formData.id) {
            // Update existing
            // Note: In a real app we would have a updateAppointment method. 
            // For this prototype we cheat a bit or need to add it to storage.ts.
            // Let's manually filter and re-add for now since we didn't add update full object in storage.
            // Actually storage.ts only has updateStatus. Let's rely on delete/add implicitly or better yet, add a proper update to storage logic if needed.
            // OR, just modify the local state and save everything.

            // Prudent approach: delete old, add new to simulate update
            db.deleteAppointment(formData.id)
            db.addAppointment({
                patientId: formData.patientId,
                patientName: patient.name,
                date: formData.date,
                startTime: formData.startTime,
                endTime: formData.endTime,
                treatmentType: formData.treatmentType,
                notes: formData.notes,
                status: formData.status
            })
            toast.success("Cita actualizada")

        } else {
            // Create new
            db.addAppointment({
                patientId: formData.patientId,
                patientName: patient.name,
                date: formData.date,
                startTime: formData.startTime,
                endTime: formData.endTime,
                treatmentType: formData.treatmentType,
                notes: formData.notes,
                status: formData.status
            })
            toast.success("Cita agendada")
        }

        setAppointments(db.getAppointments()) // Reload
        setIsDialogOpen(false)
    }

    const handleDelete = () => {
        if (formData.id && confirm("¿Eliminar esta cita?")) {
            db.deleteAppointment(formData.id)
            setAppointments(db.getAppointments())
            setIsDialogOpen(false)
            toast.success("Cita eliminada")
        }
    }

    return (
        <div className="flex h-screen bg-slate-50">
            <Sidebar />
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Header */}
                <header className="bg-white border-b p-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl font-bold text-slate-800">Agenda Semanal</h1>
                        <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                            <Button variant="ghost" size="icon" onClick={() => navigateWeek('prev')}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-sm font-medium px-2">
                                {currentWeekStart.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                            </span>
                            <Button variant="ghost" size="icon" onClick={() => navigateWeek('next')}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                    <Button onClick={() => {
                        setFormData({
                            patientId: "",
                            date: new Date().toISOString().split('T')[0],
                            startTime: "09:00",
                            endTime: "10:00",
                            treatmentType: "",
                            notes: "",
                            status: "scheduled"
                        })
                        setIsDialogOpen(true)
                    }} className="bg-blue-600">
                        <Plus className="mr-2 h-4 w-4" /> Nueva Cita
                    </Button>
                </header>

                {/* Calendar Grid */}
                <div className="flex-1 overflow-y-auto p-4">
                    <div className="bg-white rounded-lg shadow border flex flex-col min-w-[800px]">
                        {/* Days Header */}
                        <div className="grid grid-cols-7 border-b">
                            <div className="p-3 border-r bg-slate-50 font-medium text-slate-500 text-center">Hora</div>
                            {weekDates.map((date, i) => (
                                <div key={i} className="p-3 border-r bg-slate-50 font-medium text-slate-700 text-center min-w-[120px]">
                                    <div>{DAYS[i]}</div>
                                    <div className="text-xs text-slate-400 font-normal">{date.getDate()}</div>
                                </div>
                            ))}
                        </div>

                        {/* Time Slots */}
                        {HOURS.map(hour => (
                            <div key={hour} className="grid grid-cols-7 border-b last:border-0 h-24">
                                <div className="p-2 border-r text-xs text-slate-500 text-center flex items-center justify-center bg-slate-50/50">
                                    {hour}
                                </div>
                                {weekDates.map((date, i) => {
                                    const dateStr = date.toISOString().split('T')[0]
                                    const appointment = appointments.find(a =>
                                        a.date === dateStr && a.startTime === hour && a.status !== 'cancelled'
                                    )

                                    return (
                                        <div
                                            key={i}
                                            className="border-r relative p-1 transition-colors hover:bg-slate-50 cursor-pointer"
                                            onClick={() => handleSlotClick(date, hour)}
                                        >
                                            {appointment && (
                                                <div className={cn(
                                                    "h-full w-full rounded p-2 text-xs border-l-4 flex flex-col gap-1 shadow-sm overflow-hidden",
                                                    STATUS_COLORS[appointment.status]
                                                )}>
                                                    <div className="font-bold truncate">{appointment.patientName}</div>
                                                    <div className="truncate opacity-90">{appointment.treatmentType}</div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Appointment Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{formData.id ? "Editar Cita" : "Nueva Cita"}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Fecha</Label>
                                <Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Hora Inicio</Label>
                                <Select value={formData.startTime} onValueChange={v => setFormData({ ...formData, startTime: v })}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label>Paciente</Label>
                            <Select value={formData.patientId} onValueChange={v => setFormData({ ...formData, patientId: v })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar paciente..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {patients.map(p => (
                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <Label>Tratamiento</Label>
                            <Input
                                placeholder="Ej. Limpieza"
                                value={formData.treatmentType}
                                onChange={e => setFormData({ ...formData, treatmentType: e.target.value })}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label>Estado</Label>
                            <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v as AppointmentStatus })}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                                        <SelectItem key={key} value={key}>{label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <Label>Notas</Label>
                            <Textarea
                                value={formData.notes}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        {formData.id && (
                            <Button variant="destructive" onClick={handleDelete} type="button">
                                Eliminar
                            </Button>
                        )}
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                            <Button onClick={handleSave} className="bg-blue-600">Guardar</Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
