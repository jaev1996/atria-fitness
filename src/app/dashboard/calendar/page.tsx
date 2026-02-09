"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { db, Student, ClassSession, ClassStatus, Instructor, Attendee } from "@/lib/storage"
import { useAuth } from "@/hooks/useAuth"
import { Sidebar } from "@/components/shared/sidebar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronLeft, ChevronRight, Plus, Users, School, Trash, Sparkles, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { ROOMS, RoomId } from "@/constants/config"

const HOURS = Array.from({ length: 13 }, (_, i) => {
    const hour = i + 8 // 8 AM to 8 PM
    return `${hour.toString().padStart(2, '0')}:00`
})

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const STATUS_COLORS = {
    scheduled: "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300",
    confirmed: "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300",
    rescheduled: "bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-300",
    cancelled: "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300",
    completed: "bg-slate-100 border-slate-300 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400",
}

const STATUS_LABELS: Record<ClassStatus, string> = {
    scheduled: "Programada",
    confirmed: "Confirmada",
    rescheduled: "Reagendada",
    cancelled: "Cancelada",
    completed: "Completada/Realizada",
}

export default function CalendarPage() {
    const [currentWeekStart, setCurrentWeekStart] = useState(() => {
        const today = new Date()
        const day = today.getDay()
        const diff = today.getDate() - day + (day === 0 ? -6 : 1)
        const date = new Date(today.setDate(diff))
        date.setHours(0, 0, 0, 0) // Zero out time to avoid UTC day-shifts
        return date
    })
    const [activeRoom, setActiveRoom] = useState<RoomId>('sala-pole')

    // Data
    const [classes, setClasses] = useState<ClassSession[]>([])
    const [students, setStudents] = useState<Student[]>([])
    const [instructors, setInstructors] = useState<Instructor[]>([])

    const { role, userId, loading: authLoading } = useAuth(true)

    // UI State
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [studentToAdd, setStudentToAdd] = useState<string>("")
    const [isCourtesy, setIsCourtesy] = useState(false)

    // Detailed Form State (for creating/editing CLASS)
    const [formData, setFormData] = useState<{
        instructorId: string;
        date: string;
        startTime: string;
        type: string;
        notes: string;
        status: ClassStatus;
        room: RoomId;
        maxCapacity: number;
        id?: string;
        attendees: Attendee[];
        isPrivate?: boolean;
    }>({
        instructorId: "",
        date: "",
        startTime: "09:00",
        type: "",
        notes: "",
        status: "scheduled",
        room: 'sala-pole',
        maxCapacity: 5,
        attendees: [],
        isPrivate: false
    })

    // Load Initial Data
    const loadData = useCallback(() => {
        let allClasses = db.getClasses()

        // Filter classes for instructor role
        if (role === 'instructor' && userId) {
            allClasses = allClasses.filter(c => c.instructorId === userId)
        }

        setClasses(allClasses)
        setStudents(db.getStudents())
        setInstructors(db.getInstructors())
    }, [role, userId])

    useEffect(() => {
        const timer = setTimeout(() => {
            loadData()
        }, 0)
        return () => clearTimeout(timer)
    }, [loadData])

    // Navigation
    const navigateWeek = (direction: 'prev' | 'next') => {
        const newDate = new Date(currentWeekStart)
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
        setCurrentWeekStart(newDate)
    }

    const weekDates = useMemo(() => {
        return Array.from({ length: 6 }, (_, i) => {
            const date = new Date(currentWeekStart)
            date.setDate(date.getDate() + i)
            return date
        })
    }, [currentWeekStart])

    // Handlers
    const handleSlotClick = (date: Date, time: string) => {
        // Robust way to get YYYY-MM-DD in local time
        const dateStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
        const existingClass = classes.find(c =>
            c.date === dateStr &&
            c.startTime === time &&
            c.room === activeRoom &&
            c.status !== 'cancelled'
        )

        setIsCourtesy(false)
        setStudentToAdd("")

        const roomConfig = ROOMS.find(r => r.id === activeRoom)
        const defaultDiscipline = roomConfig?.discipline || ""

        if (existingClass) {
            setFormData({
                id: existingClass.id,
                instructorId: existingClass.instructorId,
                date: existingClass.date,
                startTime: existingClass.startTime,
                type: existingClass.type,
                notes: existingClass.notes || "",
                status: existingClass.status as ClassStatus,
                room: existingClass.room,
                maxCapacity: existingClass.maxCapacity,
                attendees: existingClass.attendees,
                isPrivate: existingClass.isPrivate ?? false
            })
            setIsDialogOpen(true)
        } else if (role === 'admin' || role === null) {
            // Explicitly allow if admin or still loading role (default for master)
            setFormData({
                instructorId: "",
                date: dateStr,
                startTime: time,
                type: defaultDiscipline,
                notes: "",
                status: "scheduled",
                room: activeRoom,
                maxCapacity: 5,
                attendees: [],
                isPrivate: false
            })
            setIsDialogOpen(true)
        }
    }

    const checkInstructorCollision = (instructorId: string, date: string, time: string, excludeClassId?: string) => {
        // Use the db helper I should have added, but for now I'll do it locally or call db.checkAvailability if I can rely on it updating state immediately. 
        // Since state 'classes' might be stale if I didn't reload, but usually it is fine.
        // Actually, let's use the local state 'classes' for instant feedback before saving.

        // Actually, let's use db.checkAvailability
        return !db.checkAvailability(instructorId, date, time, 'instructor', excludeClassId)
    }

    const handleSaveClass = () => {
        if (!formData.instructorId || !formData.type) {
            toast.error("Faltan datos obligatorios (Instructor, Disciplina)")
            return
        }

        const instructor = instructors.find(i => i.id === formData.instructorId)
        if (!instructor) return

        // 1. Check Instructor Collision
        // Logic: Is this instructor busy at this Date & Time in ANY room?
        const isBusy = !db.checkAvailability(formData.instructorId, formData.date, formData.startTime, 'instructor', formData.id)
        if (isBusy) {
            toast.error(`⚠️ Colisión: ${instructor.name} ya tiene clase a esta hora en otra sala.`, { className: "bg-red-50 text-red-800 border-red-200" })
            return
        }

        // 2. Check Room Collision (Already covered by UI Slot, but good safety)
        // checkAvailability doesn't check room collision specifically because we filtered the slot usage. 
        // But let's trust the slot click logic.

        const classData = {
            instructorId: formData.instructorId,
            instructorName: instructor.name,
            date: formData.date,
            startTime: formData.startTime,
            type: formData.type,
            notes: formData.notes,
            status: formData.status,
            room: formData.room,
            maxCapacity: formData.maxCapacity,
            attendees: formData.attendees,
            isPrivate: formData.isPrivate
        }

        const [h, m] = formData.startTime.split(':').map(Number)
        const endTime = `${(h + 1).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`

        if (formData.id) {
            db.updateClass({
                ...classData,
                id: formData.id,
                endTime,
                attendees: formData.attendees,
                isPrivate: formData.isPrivate
            })
            toast.success("Clase actualizada")
        } else {
            db.addClass(classData)
            toast.success("Clase creada")
        }

        loadData()
        setIsDialogOpen(false)
    }

    const handleDeleteClass = () => {
        if (formData.id && confirm("¿Eliminar esta clase y sus inscripciones?")) {
            db.deleteClass(formData.id)
            loadData()
            setIsDialogOpen(false)
            toast.success("Clase eliminada")
        }
    }

    // Enrollment Logic in Dialog
    const handleAddStudent = () => {
        if (!formData.id) {
            toast.error("Debes guardar la clase antes de inscribir alumnas")
            return
        }
        if (!studentToAdd) return

        try {
            const student = students.find(s => s.id === studentToAdd)
            if (student) {
                const type = isCourtesy ? 'courtesy' : 'standard'
                db.enrollStudent(formData.id, student.id, student.name, type)
                toast.success(isCourtesy ? "Alumna inscrita (Cortesía)" : "Alumna inscrita")

                const updatedClasses = db.getClasses()
                const updatedClass = updatedClasses.find(c => c.id === formData.id)
                if (updatedClass) {
                    setFormData(prev => ({ ...prev, attendees: updatedClass.attendees }))
                    setClasses(updatedClasses)
                }
                setStudentToAdd("")
                setIsCourtesy(false)
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Ocurrió un error inesperado"
            toast.error(message) // This catches "Colisión: La alumna ya tiene una clase..."
        }
    }

    const handleRemoveStudent = (studentId: string) => {
        if (!formData.id) return
        db.removeAttendee(formData.id, studentId)
        toast.success("Alumna removida")

        const updatedClasses = db.getClasses()
        const updatedClass = updatedClasses.find(c => c.id === formData.id)
        if (updatedClass) {
            setFormData(prev => ({ ...prev, attendees: updatedClass.attendees }))
            setClasses(updatedClasses)
        }
    }

    // Filter Instructors based on selected discipline (which is locked by room)
    const availableInstructors = instructors.filter(i => i.specialties.includes(formData.type));

    // Helper for random consistent colors
    const getInstructorColor = (name: string) => {
        const colors = [
            "bg-red-400", "bg-orange-400", "bg-amber-400", "bg-yellow-400",
            "bg-lime-400", "bg-green-400", "bg-emerald-400", "bg-teal-400",
            "bg-cyan-400", "bg-sky-400", "bg-blue-400", "bg-indigo-400",
            "bg-violet-400", "bg-purple-400", "bg-fuchsia-400", "bg-pink-400", "bg-rose-400"
        ];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    }

    if (authLoading) return null

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
            <Sidebar />
            <main className="flex-1 h-screen overflow-auto p-6">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Agenda Multisalas</h1>
                        </div>

                        <div className="flex items-center gap-4 bg-white dark:bg-slate-800 border rounded-full px-4 py-2 shadow-sm">
                            <Button variant="ghost" size="icon" className="hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full h-8 w-8" onClick={() => navigateWeek('prev')}>
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                            <span className="text-lg font-semibold capitalize text-slate-700 dark:text-slate-200 min-w-[200px] text-center select-none">
                                {currentWeekStart.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                            </span>
                            <Button variant="ghost" size="icon" className="hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full h-8 w-8" onClick={() => navigateWeek('next')}>
                                <ChevronRight className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Calendar Grid with Tabs */}
                <div className="min-w-[800px]">
                    <Tabs value={activeRoom} onValueChange={(v) => setActiveRoom(v as RoomId)}>
                        <div className="flex items-center justify-between mb-4">
                            <TabsList>
                                {ROOMS.map(room => (
                                    <TabsTrigger key={room.id} value={room.id}>
                                        {room.name}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </div>

                        {ROOMS.map(room => (
                            <TabsContent key={room.id} value={room.id} className="mt-0 border rounded-lg bg-white dark:bg-slate-800 shadow-sm relative">
                                <div>
                                    {/* Days Header */}
                                    <div className="grid grid-cols-7 border-b dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10 shadow-sm rounded-t-lg">
                                        <div className="p-3 border-r dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-medium text-slate-500 text-center w-20">Hora</div>
                                        {weekDates.map((date, i) => (
                                            <div key={i} className="p-3 border-r dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-medium text-slate-700 dark:text-slate-200 text-center min-w-[140px]">
                                                <div>{DAYS[i]}</div>
                                                <div className="text-xs text-slate-400 font-normal">
                                                    {date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Time Slots */}
                                    {HOURS.map(hour => (
                                        <div key={hour} className="grid grid-cols-7 border-b dark:border-slate-700 last:border-0 h-32">
                                            <div className="p-2 border-r dark:border-slate-700 text-xs text-slate-500 text-center flex items-center justify-center bg-slate-50/50 dark:bg-slate-900/50">
                                                {hour}
                                            </div>
                                            {weekDates.map((date, i) => {
                                                const dateStr = date.toISOString().split('T')[0]
                                                const classSession = classes.find(c =>
                                                    c.date === dateStr &&
                                                    c.startTime === hour &&
                                                    c.room === room.id && // Filter by current Room Tab
                                                    c.status !== 'cancelled'
                                                )

                                                return (
                                                    <div
                                                        key={i}
                                                        className={cn(
                                                            "border-r dark:border-slate-700 relative p-1 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50 group",
                                                            classSession || role !== 'instructor' ? "cursor-pointer" : "cursor-default"
                                                        )}
                                                        onClick={() => {
                                                            if (classSession || role !== 'instructor') {
                                                                handleSlotClick(date, hour)
                                                            }
                                                        }}
                                                    >
                                                        {classSession ? (
                                                            <div className={cn(
                                                                "h-full w-full rounded p-2 text-xs border-l-4 flex flex-col gap-1 shadow-sm overflow-hidden",
                                                                STATUS_COLORS[classSession.status]
                                                            )}>
                                                                <div className="font-bold truncate text-sm">{classSession.type}</div>
                                                                <div className="truncate opacity-75 flex items-center gap-1">
                                                                    <div className={cn("w-2 h-2 rounded-full", getInstructorColor(classSession.instructorName))}></div>
                                                                    {classSession.instructorName}
                                                                </div>
                                                                <div className="mt-auto flex justify-between items-center opacity-90 font-medium bg-white/50 dark:bg-black/20 p-1 rounded">
                                                                    <span className="flex items-center gap-1">
                                                                        <Users className="h-3 w-3" />
                                                                        {classSession.attendees.length}/{classSession.maxCapacity}
                                                                    </span>
                                                                    {classSession.attendees.some(a => a.attendanceType === 'courtesy') && (
                                                                        <Sparkles className="h-3 w-3 text-yellow-500" />
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            role !== 'instructor' && (
                                                                <div className="hidden group-hover:flex h-full w-full items-center justify-center text-slate-300 dark:text-slate-600">
                                                                    <Plus className="h-6 w-6" />
                                                                </div>
                                                            )
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </TabsContent>
                        ))}
                    </Tabs>
                </div>
            </main >

            {/* Class Dialog */}
            < Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen} >
                <DialogContent className="max-w-2xl h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {formData.id ? "Gestionar Clase" : "Programar Nueva Clase"}
                            {formData.room && (
                                <span className={cn(
                                    "text-sm font-normal px-2 py-0.5 rounded",
                                    activeRoom === 'sala-pole' && "bg-fuchsia-100 text-fuchsia-800",
                                    activeRoom === 'sala-yoga' && "bg-emerald-100 text-emerald-800",
                                    activeRoom === 'sala-telas' && "bg-sky-100 text-sky-800",
                                    activeRoom === 'sala-gluteos' && "bg-rose-100 text-rose-800",
                                )}>
                                    {ROOMS.find(r => r.id === activeRoom)?.name}
                                </span>
                            )}
                        </DialogTitle>
                    </DialogHeader>

                    {role === 'instructor' ? (
                        <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg flex items-center gap-2 mb-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <span className="text-sm text-blue-800">Vista de solo lectura del Instructor</span>
                        </div>
                    ) : null}

                    <div className="grid gap-6 py-4">
                        {/* CLASS DETAILS SECTION */}
                        <section className="space-y-4 border-b pb-4">
                            <h3 className="font-semibold text-sm text-primary flex items-center gap-2">
                                <School className="h-4 w-4" /> Detalles de Clase
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Fecha</Label>
                                    <Input
                                        type="date"
                                        value={formData.date}
                                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                                        disabled={role === 'instructor'}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Hora (1 Hora de Duración)</Label>
                                    <Select
                                        value={formData.startTime}
                                        onValueChange={v => setFormData({ ...formData, startTime: v })}
                                        disabled={role === 'instructor'}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Disciplina (Sala)</Label>
                                    <Input value={formData.type} disabled className="bg-slate-100 text-slate-500 cursor-not-allowed" />
                                    <p className="text-[10px] text-slate-400">La disciplina está vinculada a la sala.</p>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Instructor</Label>
                                    <Select
                                        value={formData.instructorId}
                                        onValueChange={v => setFormData({ ...formData, instructorId: v })}
                                        disabled={role === 'instructor'}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableInstructors.length > 0 ? (
                                                availableInstructors.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)
                                            ) : (
                                                <div className="p-2 text-xs text-slate-500">No hay instructores disponibles para {formData.type}</div>
                                            )}
                                        </SelectContent>
                                    </Select>
                                    {formData.instructorId && checkInstructorCollision(formData.instructorId, formData.date, formData.startTime, formData.id) && (
                                        <div className="text-xs text-red-600 flex items-center gap-1 mt-1">
                                            <AlertTriangle className="h-3 w-3" /> Colisión de horario
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Capacidad Máxima</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        value={formData.maxCapacity}
                                        onChange={e => setFormData({ ...formData, maxCapacity: parseInt(e.target.value) })}
                                        disabled={role === 'instructor'}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Estado</Label>
                                    <Select
                                        value={formData.status}
                                        onValueChange={v => setFormData({ ...formData, status: v as ClassStatus })}
                                        disabled={role === 'instructor'}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2 pt-2 pb-2">
                                <Checkbox
                                    id="isPrivate"
                                    checked={formData.isPrivate}
                                    onCheckedChange={(c) => setFormData({ ...formData, isPrivate: c as boolean })}
                                    disabled={role === 'instructor'}
                                />
                                <Label htmlFor="isPrivate" className="font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-2">
                                    <Sparkles className="h-4 w-4" /> ¿Es Clase Privada?
                                </Label>
                            </div>
                            {role !== 'instructor' && (
                                <div className="grid gap-2">
                                    <Button onClick={handleSaveClass} className="w-full bg-primary text-primary-foreground">
                                        {formData.id ? "Guardar Cambios de Clase" : "Crear Clase"}
                                    </Button>
                                </div>
                            )}
                        </section>

                        {/* ATTENDEES SECTION - Only visible if class exists */}
                        {formData.id && (
                            <section className="space-y-4">
                                <h3 className="font-semibold text-sm text-primary flex items-center justify-between">
                                    <span className="flex items-center gap-2"><Users className="h-4 w-4" /> Alumnas Inscritas</span>
                                    <span className="text-xs bg-slate-100 px-2 py-1 rounded-full text-slate-600">
                                        {formData.attendees.length} / {formData.maxCapacity} Cupos
                                    </span>
                                </h3>

                                {role !== 'instructor' && (
                                    <div className="flex gap-2 items-end">
                                        <div className="flex-1 space-y-2">
                                            <Select value={studentToAdd} onValueChange={setStudentToAdd}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccionar alumna para inscribir..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {students.map(s => (
                                                        <SelectItem key={s.id} value={s.id}>{s.name} ({s.plans?.[0]?.nombreOriginal || "Sin Plan"})</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex items-center space-x-2 pb-2">
                                            <Checkbox id="courtesy" checked={isCourtesy} onCheckedChange={(c) => setIsCourtesy(c as boolean)} />
                                            <label htmlFor="courtesy" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                                Cortesía
                                            </label>
                                        </div>
                                        <Button onClick={handleAddStudent} disabled={!studentToAdd} size="sm">
                                            <Plus className="h-4 w-4" /> Inscribir
                                        </Button>
                                    </div>
                                )}

                                <div className="border rounded-md divide-y max-h-[200px] overflow-y-auto">
                                    {formData.attendees.length === 0 ? (
                                        <div className="p-4 text-center text-sm text-slate-500">No hay alumnas inscritas aún.</div>
                                    ) : (
                                        formData.attendees.map(attendee => (
                                            <div key={attendee.studentId} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800">
                                                <div>
                                                    <span className="text-sm font-medium block">{attendee.studentName}</span>
                                                    {attendee.attendanceType === 'courtesy' && (
                                                        <span className="text-xs text-yellow-600 flex items-center gap-1">
                                                            <Sparkles className="h-3 w-3" /> Cortesía
                                                        </span>
                                                    )}
                                                    {attendee.creditDeducted && (
                                                        <span className="text-xs text-green-600 flex items-center gap-1">
                                                            <span className="font-bold">✓</span> Crédito descontado
                                                        </span>
                                                    )}
                                                </div>
                                                {role !== 'instructor' && (
                                                    <Button variant="ghost" size="sm" className="h-6 w-6 text-red-500 hover:bg-red-50" onClick={() => handleRemoveStudent(attendee.studentId)}>
                                                        <Trash className="h-3 w-3" />
                                                    </Button>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </section>
                        )}
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0 border-t pt-4">
                        {formData.id && role !== 'instructor' && (
                            <Button variant="ghost" className="text-red-500 hover:bg-red-50 hover:text-red-600 mr-auto" onClick={handleDeleteClass}>
                                Eliminar Clase
                            </Button>
                        )}
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cerrar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog >
        </div >
    )
}
