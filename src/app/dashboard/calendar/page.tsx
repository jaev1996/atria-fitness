"use client"

import { useState, useEffect, useMemo, useCallback, useTransition } from "react"
import { getClasses, addClass, updateClass, deleteClass, enrollStudent, removeAttendee } from "@/actions/classes"
import { getStudentsSummary } from "@/actions/students"
import { getInstructors } from "@/actions/instructors"
import { getSettings } from "@/actions/settings"
import { ClassStatus, User, ClassSession as PrismaClassSession, Attendee as PrismaAttendee, Settings } from "@prisma/client"
import { useAuth } from "@/hooks/useAuth"
import { Sidebar } from "@/components/shared/sidebar"
import { MobileNav } from "@/components/shared/mobile-nav"
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
import { StudentSearchSelect } from "@/components/dashboard/StudentSearchSelect"

const HOURS = Array.from({ length: 13 }, (_, i) => {
    const hour = i + 8 // 8 AM to 8 PM
    return `${hour.toString().padStart(2, '0')}:00`
})

const toYYYYMMDD = (date: Date) => {
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
}

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const STATUS_LABELS: Record<ClassStatus, string> = {
    SCHEDULED: "Programada",
    CONFIRMED: "Confirmada",
    RESCHEDULED: "Reagendada",
    CANCELLED: "Cancelada",
    COMPLETED: "Completada/Realizada",
}

const STATUS_COLORS: Record<string, string> = {
    SCHEDULED: "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300",
    CONFIRMED: "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300",
    RESCHEDULED: "bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-300",
    CANCELLED: "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300",
    COMPLETED: "bg-slate-100 border-slate-300 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400",
}

type ClassWithDetails = PrismaClassSession & {
    instructor: User;
    attendees: (PrismaAttendee & { student: User })[];
};

export default function CalendarPage() {
    const [currentWeekStart, setCurrentWeekStart] = useState(() => {
        const today = new Date()
        const day = today.getDay()
        const diff = today.getDate() - day + (day === 0 ? -6 : 1)
        const date = new Date(today.setDate(diff))
        date.setHours(0, 0, 0, 0) // Zero out time to avoid UTC day-shifts
        return date
    })
    const [activeRoom, setActiveRoom] = useState<RoomId>('salon-alma')

    type StudentSummary = {
        id: string;
        name: string;
        email?: string;
    };

    // Data
    const [classes, setClasses] = useState<ClassWithDetails[]>([])
    const [students, setStudents] = useState<StudentSummary[]>([])
    const [instructors, setInstructors] = useState<User[]>([])
    const [settings, setSettings] = useState<Settings | null>(null)
    const [isPending, startTransition] = useTransition()

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
        attendees: (PrismaAttendee & { student: User })[];
        isPrivate?: boolean;
    }>({
        instructorId: "",
        date: "",
        startTime: "09:00",
        type: "",
        notes: "",
        status: "SCHEDULED",
        room: 'salon-alma',
        maxCapacity: 5,
        attendees: [],
        isPrivate: false
    })

    // Load Metadata (Role-aware and non-blocking)
    const loadMetadata = useCallback(async () => {
        if (!role) return;

        try {
            console.log(`Loading metadata for role: ${role}...`)

            // Parallel fetch of generic settings
            const settingsPromise = getSettings()

            // Role-based fetching: Instructors don't need student search or other instructors list for scheduling
            if (role === 'admin') {
                const [allStudents, allInstructors, allSettings] = await Promise.all([
                    getStudentsSummary(),
                    getInstructors(),
                    settingsPromise
                ])
                setStudents(allStudents)
                setInstructors(allInstructors as User[])
                setSettings(allSettings)
            } else if (role === 'instructor') {
                const allSettings = await settingsPromise
                setSettings(allSettings)
                // We might only want the current instructor in the list for local consistency
            }
        } catch (error) {
            console.error("Error loading metadata:", error)
        }
    }, [role])

    // Refresh only classes based on current visible week
    const refreshClasses = useCallback(async () => {
        if (!role) return;

        try {
            const weekEnd = new Date(currentWeekStart)
            weekEnd.setDate(weekEnd.getDate() + 6)

            const startStr = toYYYYMMDD(currentWeekStart)
            const endStr = toYYYYMMDD(weekEnd)

            // Server-side filtering by instructor if applicable
            const fetchedClasses = await getClasses(
                startStr,
                endStr,
                role === 'instructor' ? userId || undefined : undefined
            )

            setClasses(fetchedClasses as ClassWithDetails[])
        } catch (error) {
            console.error("Error refreshing classes:", error)
            toast.error("Error al actualizar calendario")
        }
    }, [role, userId, currentWeekStart])

    useEffect(() => {
        const timer = setTimeout(() => {
            loadMetadata()
        }, 0)
        return () => clearTimeout(timer)
    }, [loadMetadata])

    useEffect(() => {
        if (!authLoading) {
            const timer = setTimeout(() => {
                refreshClasses()
            }, 0)
            return () => clearTimeout(timer)
        }
    }, [refreshClasses, authLoading])

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
        const dateStr = toYYYYMMDD(date)
        const existingClass = classes.find(c => {
            const cDate = new Date(c.date)
            const cDateStr = `${cDate.getUTCFullYear()}-${(cDate.getUTCMonth() + 1).toString().padStart(2, '0')}-${cDate.getUTCDate().toString().padStart(2, '0')}`
            return cDateStr === dateStr &&
                c.startTime === time &&
                c.room === activeRoom &&
                c.status !== 'CANCELLED'
        })

        setIsCourtesy(false)
        setStudentToAdd("")

        const roomConfig = ROOMS.find(r => r.id === activeRoom)
        const defaultDiscipline = roomConfig?.disciplines[0] || ""

        if (existingClass) {
            const eDate = new Date(existingClass.date)
            const dStr = `${eDate.getUTCFullYear()}-${(eDate.getUTCMonth() + 1).toString().padStart(2, '0')}-${eDate.getUTCDate().toString().padStart(2, '0')}`
            setFormData({
                id: existingClass.id,
                instructorId: existingClass.instructorId,
                date: dStr,
                startTime: existingClass.startTime,
                type: existingClass.type,
                notes: existingClass.notes || "",
                status: existingClass.status as ClassStatus,
                room: existingClass.room as RoomId,
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
                status: "SCHEDULED",
                room: activeRoom,
                maxCapacity: 5,
                attendees: [],
                isPrivate: false
            })
            setIsDialogOpen(true)
        }
    }

    // Client-side collision helper (for feedback only, real check is on server)
    const checkInstructorCollision = (instructorId: string, date: string, time: string, excludeClassId?: string) => {
        const dStr = toYYYYMMDD(new Date(date))
        return classes.some(c => {
            const cd = new Date(c.date)
            const cdStr = `${cd.getUTCFullYear()}-${(cd.getUTCMonth() + 1).toString().padStart(2, '0')}-${cd.getUTCDate().toString().padStart(2, '0')}`
            return c.instructorId === instructorId &&
                cdStr === dStr &&
                c.startTime === time &&
                c.id !== excludeClassId &&
                c.status !== 'CANCELLED'
        })
    }



    const handleSaveClass = () => {
        if (!formData.instructorId || !formData.type) {
            toast.error("Faltan datos obligatorios (Instructor, Disciplina)")
            return
        }

        const instructor = instructors.find(i => i.id === formData.instructorId)
        if (!instructor) return

        startTransition(async () => {
            try {
                if (formData.id) {
                    await updateClass(formData.id, {
                        instructorId: formData.instructorId,
                        // @ts-expect-error - passing string to server action that expects partial prisma type (handled by server action logic)
                        date: formData.date,
                        startTime: formData.startTime,
                        type: formData.type,
                        notes: formData.notes,
                        status: formData.status,
                        room: formData.room,
                        maxCapacity: formData.maxCapacity,
                        isPrivate: formData.isPrivate
                    })
                    toast.success("Clase actualizada")
                } else {
                    await addClass({
                        instructorId: formData.instructorId,
                        date: formData.date,
                        startTime: formData.startTime,
                        type: formData.type,
                        room: formData.room,
                        maxCapacity: formData.maxCapacity,
                        notes: formData.notes,
                        isPrivate: formData.isPrivate
                    })
                    toast.success("Clase creada")
                }
                await refreshClasses()
                setIsDialogOpen(false)
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : "Error al guardar clase"
                toast.error(message)
            }
        })
    }

    const handleDeleteClass = () => {
        if (formData.id && confirm("¿Eliminar esta clase y sus inscripciones?")) {
            startTransition(async () => {
                try {
                    await deleteClass(formData.id!)
                    await refreshClasses()
                    setIsDialogOpen(false)
                    toast.success("Clase eliminada")
                } catch {
                    toast.error("Error al eliminar clase")
                }
            })
        }
    }

    // Enrollment Logic in Dialog
    const handleAddStudent = (studentIdOverride?: string) => {
        const targetStudentId = studentIdOverride || studentToAdd
        if (!formData.id) {
            toast.error("Debes guardar la clase antes de inscribir alumnas")
            return
        }
        if (!targetStudentId) return

        startTransition(async () => {
            try {
                await enrollStudent(formData.id!, targetStudentId, isCourtesy ? 'COURTESY' : 'STANDARD')
                toast.success(isCourtesy ? "Alumna inscrita (Cortesía)" : "Alumna inscrita")
                await refreshClasses()
                setStudentToAdd("")
                setIsCourtesy(false)

                // Update local form state too
                const updatedClasses = await getClasses()
                const updatedClass = updatedClasses.find(c => c.id === formData.id)
                if (updatedClass) {
                    setFormData(prev => ({ ...prev, attendees: updatedClass.attendees }))
                }
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : "Error al inscribir alumna"
                toast.error(message)
            }
        })
    }

    const handleRemoveStudent = (studentId: string) => {
        if (!formData.id) return
        startTransition(async () => {
            try {
                await removeAttendee(formData.id!, studentId)
                toast.success("Alumna removida")
                await refreshClasses()

                const updatedClasses = await getClasses()
                const updatedClass = updatedClasses.find(c => c.id === formData.id)
                if (updatedClass) {
                    setFormData(prev => ({ ...prev, attendees: updatedClass.attendees }))
                }
            } catch {
                toast.error("Error al remover alumna")
            }
        })
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
        <div className="flex flex-col md:flex-row h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
            <Sidebar />
            <MobileNav />
            <main className="flex-1 h-full overflow-y-auto overflow-x-hidden p-4 md:p-6 min-w-0">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 italic">Agenda Multisalas</h1>

                        <div className="flex items-center justify-between bg-white dark:bg-slate-800 border rounded-full px-4 py-2 shadow-sm w-full sm:w-auto min-w-[280px]">
                            <Button variant="ghost" size="icon" className="hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full h-8 w-8" onClick={() => navigateWeek('prev')}>
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                            <span className="text-sm font-semibold capitalize text-slate-700 dark:text-slate-200 text-center select-none">
                                {currentWeekStart.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                            </span>
                            <Button variant="ghost" size="icon" className="hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full h-8 w-8" onClick={() => navigateWeek('next')}>
                                <ChevronRight className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Calendar Grid with Tabs */}
                <div className="w-full">
                    <Tabs value={activeRoom} onValueChange={(v) => setActiveRoom(v as RoomId)}>
                        <div className="flex items-center mb-4 overflow-x-auto pb-2 scrollbar-hide">
                            <TabsList className="bg-white dark:bg-slate-800 p-1 flex w-max min-w-full sm:w-auto">
                                {ROOMS.map(room => (
                                    <TabsTrigger
                                        key={room.id}
                                        value={room.id}
                                        className="px-6 data-[state=active]:bg-primary data-[state=active]:text-white whitespace-nowrap"
                                    >
                                        {room.name}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </div>

                        {ROOMS.map(room => (
                            <TabsContent key={room.id} value={room.id} className="mt-0 border rounded-lg bg-white dark:bg-slate-800 shadow-sm relative">
                                <div>
                                    {/* Unified scrollable container */}
                                    <div className="overflow-x-auto overflow-y-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                                        <div className="min-w-[1000px] bg-white dark:bg-slate-800">
                                            {/* Days Header */}
                                            <div className="grid grid-cols-7 border-b dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10 shadow-sm">
                                                <div className="p-3 border-r dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-medium text-slate-500 text-center w-24 shrink-0">Hora</div>
                                                {weekDates.map((date, i) => (
                                                    <div key={i} className="p-3 border-r dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-medium text-slate-700 dark:text-slate-200 text-center flex-1">
                                                        <div className="text-sm font-bold">{DAYS[i]}</div>
                                                        <div className="text-[10px] text-slate-400 font-normal">
                                                            {date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Time Slots Area */}
                                            {HOURS.map(hour => (
                                                <div key={hour} className="grid grid-cols-7 border-b dark:border-slate-700 last:border-0 h-32">
                                                    <div className="p-2 border-r dark:border-slate-700 text-xs text-slate-500 text-center flex items-center justify-center bg-slate-50/50 dark:bg-slate-900/50 w-24 shrink-0">
                                                        {hour}
                                                    </div>
                                                    {weekDates.map((date, i) => {
                                                        const dateStr = toYYYYMMDD(date)
                                                        const classSession = classes.find(c => {
                                                            const cDate = new Date(c.date)
                                                            const cDateStr = `${cDate.getUTCFullYear()}-${(cDate.getUTCMonth() + 1).toString().padStart(2, '0')}-${cDate.getUTCDate().toString().padStart(2, '0')}`
                                                            return cDateStr === dateStr &&
                                                                c.startTime === hour &&
                                                                c.room === room.id &&
                                                                c.status !== 'CANCELLED'
                                                        })

                                                        return (
                                                            <div
                                                                key={i}
                                                                className={cn(
                                                                    "border-r dark:border-slate-700 last:border-r-0 relative p-1 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50 group flex-1",
                                                                    classSession || (role !== 'instructor' && role !== null) ? "cursor-pointer" : "cursor-default"
                                                                )}
                                                                onClick={() => {
                                                                    if (classSession || (role !== 'instructor' && role !== null)) {
                                                                        handleSlotClick(date, hour)
                                                                    }
                                                                }}
                                                            >
                                                                {classSession ? (
                                                                    <div className={cn(
                                                                        "h-full w-full rounded p-2 text-[10px] sm:text-xs border-l-4 flex flex-col gap-1 shadow-sm overflow-hidden",
                                                                        STATUS_COLORS[classSession.status]
                                                                    )}>
                                                                        <div className="font-bold truncate text-[11px] sm:text-sm">{classSession.type}</div>
                                                                        <div className="truncate opacity-75 flex items-center gap-1">
                                                                            <div className={cn("w-2 h-2 rounded-full shrink-0", getInstructorColor(classSession.instructor.name))}></div>
                                                                            <span className="truncate">{classSession.instructor.name}</span>
                                                                        </div>
                                                                        <div className="mt-auto flex justify-between items-center opacity-90 font-medium bg-white/50 dark:bg-black/20 p-0.5 sm:p-1 rounded">
                                                                            <span className="flex items-center gap-1">
                                                                                <Users className="h-2 w-2 sm:h-3 sm:w-3" />
                                                                                {classSession.attendees.length}/{classSession.maxCapacity}
                                                                            </span>
                                                                            {classSession.attendees.some(a => a.attendanceType === 'COURTESY') && (
                                                                                <Sparkles className="h-2 w-2 sm:h-3 sm:w-3 text-yellow-500" />
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    role !== 'instructor' && role !== null && (
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
                                    </div>
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
                                    activeRoom === 'salon-alma' && "bg-fuchsia-100 text-fuchsia-800",
                                    activeRoom === 'salon-armonia' && "bg-emerald-100 text-emerald-800",
                                    activeRoom === 'salon-sinergia' && "bg-sky-100 text-sky-800",
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
                                    <Label>Disciplina</Label>
                                    <Select
                                        value={formData.type}
                                        onValueChange={v => setFormData({ ...formData, type: v })}
                                        disabled={role === 'instructor'}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar disciplina..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {(settings?.roomDisciplines as Record<string, string[]>)?.[formData.room]?.map((d: string) => (
                                                <SelectItem key={d} value={d}>{d}</SelectItem>
                                            )) || ROOMS.find(r => r.id === formData.room)?.disciplines.map((d: string) => (
                                                <SelectItem key={d} value={d}>{d}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[10px] text-slate-400">Disciplinas permitidas en esta sala.</p>
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
                            {(role === 'admin' || role === null) && (
                                <div className="grid gap-2">
                                    <Button onClick={handleSaveClass} className="w-full bg-primary text-primary-foreground" disabled={isPending}>
                                        {isPending ? "Procesando..." : (formData.id ? "Guardar Cambios de Clase" : "Crear Clase")}
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
                                    <div className="flex flex-col gap-4">
                                        <div className="space-y-2">
                                            <Label>Buscar Alumna</Label>
                                            <div className="flex gap-2">
                                                <div className="flex-1">
                                                    <StudentSearchSelect
                                                        students={students}
                                                        onSelect={(id) => setStudentToAdd(id)}
                                                        placeholder="Seleccionar alumna para inscribir..."
                                                    />
                                                </div>
                                                <div className="flex items-center space-x-2 shrink-0">
                                                    <Checkbox id="courtesy" checked={isCourtesy} onCheckedChange={(c) => setIsCourtesy(c as boolean)} />
                                                    <label htmlFor="courtesy" className="text-sm font-medium leading-none whitespace-nowrap">
                                                        Cortesía
                                                    </label>
                                                </div>
                                                <Button onClick={() => handleAddStudent()} disabled={!studentToAdd || isPending} size="sm">
                                                    <Plus className="h-4 w-4" /> Inscribir
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="border rounded-md divide-y max-h-[200px] overflow-y-auto">
                                    {formData.attendees.length === 0 ? (
                                        <div className="p-4 text-center text-sm text-slate-500">No hay alumnas inscritas aún.</div>
                                    ) : (
                                        formData.attendees.map(attendee => (
                                            <div key={attendee.studentId} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800">
                                                <div>
                                                    <span className="text-sm font-medium block">{attendee.student.name}</span>
                                                    {attendee.attendanceType === 'COURTESY' && (
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
                                                {(role !== 'instructor' && role !== null) && (
                                                    <Button variant="ghost" size="sm" className="h-6 w-6 text-red-500 hover:bg-red-50" onClick={() => handleRemoveStudent(attendee.studentId)} disabled={isPending}>
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
