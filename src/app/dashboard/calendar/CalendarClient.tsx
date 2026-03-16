"use client"

import { useState, useMemo, useCallback, useTransition } from "react"
import { useRouter } from "next/navigation"
import { getClasses, addClass, updateClass, deleteClass, enrollStudent, removeAttendee } from "@/actions/classes"
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
import { ChevronLeft, ChevronRight, Plus, Users, School, Trash, Sparkles, AlertTriangle, ZoomIn, ZoomOut, Download } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { ROOMS, RoomId } from "@/constants/config"
import { StudentSearchSelect } from "@/components/dashboard/StudentSearchSelect"
import { toPng } from "html-to-image"

const HOURS = Array.from({ length: 26 }, (_, i) => {
    const hour = Math.floor(i / 2) + 8
    const minutes = i % 2 === 0 ? '00' : '30'
    return `${hour.toString().padStart(2, '0')}:${minutes}`
})

const toYYYYMMDD = (date: Date) =>
    `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`

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
    instructor: User
    attendees: (PrismaAttendee & { student: User })[]
}

type StudentSummary = { id: string; name: string; email?: string }

interface CalendarClientProps {
    initialClasses: ClassWithDetails[]
    initialStudents: StudentSummary[]
    initialInstructors: User[]
    initialSettings: Settings | null
    initialRole: "admin" | "instructor" | "student" | null
    initialUserId: string | null
}

const getInstructorColor = (name: string) => {
    const colors = [
        "bg-red-400", "bg-orange-400", "bg-amber-400", "bg-yellow-400",
        "bg-lime-400", "bg-green-400", "bg-emerald-400", "bg-teal-400",
        "bg-cyan-400", "bg-sky-400", "bg-blue-400", "bg-indigo-400",
        "bg-violet-400", "bg-purple-400", "bg-fuchsia-400", "bg-pink-400", "bg-rose-400",
    ]
    let hash = 0
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
}

export function CalendarClient({
    initialClasses,
    initialStudents,
    initialInstructors,
    initialSettings,
    initialRole,
    initialUserId,
}: CalendarClientProps) {
    const router = useRouter()
    // Auth (kept for real-time session checks, but role comes from server initially)
    const { role: clientRole, userId: clientUserId } = useAuth(true)

    // Use server-side values on first render, then switch to client values once auth resolves
    const role = clientRole ?? initialRole
    const userId = clientUserId ?? initialUserId

    const [currentWeekStart, setCurrentWeekStart] = useState(() => {
        const today = new Date()
        const day = today.getDay()
        const diff = today.getDate() - day + (day === 0 ? -6 : 1)
        const date = new Date(today.setDate(diff))
        date.setHours(0, 0, 0, 0)
        return date
    })
    const [activeRoom, setActiveRoom] = useState<RoomId>('salon-alma')

    // Data — initialized from server props
    const [classes, setClasses] = useState<ClassWithDetails[]>(initialClasses)
    const [students] = useState<StudentSummary[]>(initialStudents)
    const [instructors] = useState<User[]>(initialInstructors)
    const [settings] = useState<Settings | null>(initialSettings)
    const [isPending, startTransition] = useTransition()
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [zoomLevel, setZoomLevel] = useState(1) // 0.8 to 1.5
    const [viewType, setViewType] = useState<'week' | 'month'>('week')

    // UI State
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [studentToAdd, setStudentToAdd] = useState<string>("")
    const [isCourtesy, setIsCourtesy] = useState(false)

    const [formData, setFormData] = useState<{
        instructorId: string
        date: string
        startTime: string
        type: string
        notes: string
        status: ClassStatus
        room: RoomId
        maxCapacity: number
        id?: string
        attendees: (PrismaAttendee & { student: User })[]
        isPrivate?: boolean
        observation?: string
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
        isPrivate: false,
        observation: "",
    })


    // Navigation — triggers a classes refresh for the new period
    const navigatePeriod = useCallback(async (direction: 'prev' | 'next') => {
        const newDate = new Date(currentWeekStart)
        if (viewType === 'week') {
            newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
        } else {
            newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1))
            newDate.setDate(1) // Always start at the 1st of the month
        }
        
        setCurrentWeekStart(newDate)
        setIsRefreshing(true)
        try {
            const periodEnd = new Date(newDate)
            if (viewType === 'week') {
                periodEnd.setDate(periodEnd.getDate() + 6)
            } else {
                periodEnd.setMonth(periodEnd.getMonth() + 1)
                periodEnd.setDate(0) // Last day of month
            }
            
            const fetchedClasses = await getClasses(
                toYYYYMMDD(newDate),
                toYYYYMMDD(periodEnd),
                role === 'instructor' ? userId || undefined : undefined
            )
            setClasses(fetchedClasses as ClassWithDetails[])
        } catch {
            toast.error("Error al cargar periodo")
        } finally {
            setIsRefreshing(false)
        }
    }, [currentWeekStart, role, userId, viewType])

    const weekDates = useMemo(() => {
        return Array.from({ length: 6 }, (_, i) => {
            const date = new Date(currentWeekStart)
            date.setDate(date.getDate() + i)
            return date
        })
    }, [currentWeekStart])

    const monthDays = useMemo(() => {
        const start = new Date(currentWeekStart)
        start.setDate(1)
        const dayOfWeek = start.getDay() // 0 (Sun) to 6 (Sat)
        // Shift to Monday (1)
        const diff = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek
        const firstViewDay = new Date(start)
        firstViewDay.setDate(start.getDate() + diff)

        return Array.from({ length: 42 }, (_, i) => {
            const date = new Date(firstViewDay)
            date.setDate(firstViewDay.getDate() + i)
            return date
        })
    }, [currentWeekStart])

    // Handlers
    const handleSlotClick = (date: Date, time: string) => {
        const dateStr = toYYYYMMDD(date)
        const existingClass = classes.find(c => {
            const cDate = new Date(c.date)
            const cDateStr = `${cDate.getUTCFullYear()}-${(cDate.getUTCMonth() + 1).toString().padStart(2, '0')}-${cDate.getUTCDate().toString().padStart(2, '0')}`
            return cDateStr === dateStr && c.startTime === time && c.room === activeRoom && c.status !== 'CANCELLED'
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
                isPrivate: existingClass.isPrivate ?? false,
                observation: existingClass.observation || "",
            })
            setIsDialogOpen(true)
        } else if (role === 'admin' || role === null) {
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
                isPrivate: false,
                observation: "",
            })
            setIsDialogOpen(true)
        }
    }

    const checkInstructorCollision = (instructorId: string, date: string, time: string, excludeClassId?: string) => {
        const [h, m] = time.split(':').map(Number)
        const startMins = h * 60 + m
        const endMins = startMins + 60

        return classes.some(c => {
            if (c.id === excludeClassId || c.status === 'CANCELLED' || c.instructorId !== instructorId) return false

            const cd = new Date(c.date)
            const cdStr = `${cd.getUTCFullYear()}-${(cd.getUTCMonth() + 1).toString().padStart(2, '0')}-${cd.getUTCDate().toString().padStart(2, '0')}`
            if (cdStr !== date) return false

            const [ch, cm] = c.startTime.split(':').map(Number)
            const cStartMins = ch * 60 + cm
            const cEndMins = cStartMins + 60

            // Overlap check: max(start1, start2) < min(end1, end2)
            return Math.max(startMins, cStartMins) < Math.min(endMins, cEndMins)
        })
    }

    const handleSaveClass = () => {
        if (!formData.instructorId || !formData.type) {
            toast.error("Faltan datos obligatorios (Instructor, Disciplina)")
            return
        }
        if (formData.type === 'Pole' && !formData.observation) {
            toast.error("Debes seleccionar el tipo de clase de Pole")
            return
        }
        const instructor = instructors.find(i => i.id === formData.instructorId)
        if (!instructor) return

        startTransition(async () => {
            try {
                if (formData.id) {
                    const updated = await updateClass(formData.id, {
                        instructorId: formData.instructorId,
                        // @ts-expect-error - string date handled by server action
                        date: formData.date,
                        startTime: formData.startTime,
                        type: formData.type,
                        notes: formData.notes,
                        status: formData.status,
                        room: formData.room,
                        maxCapacity: formData.maxCapacity,
                        isPrivate: formData.isPrivate,
                        observation: formData.observation,
                    })

                    // Optimistic update: patch the class in local state
                    setClasses(prev => prev.map(c =>
                        c.id === formData.id
                            ? { ...c, ...updated, instructor, attendees: formData.attendees }
                            : c
                    ))
                    toast.success("Clase actualizada")
                } else {
                    const created = await addClass({
                        instructorId: formData.instructorId,
                        date: formData.date,
                        startTime: formData.startTime,
                        type: formData.type,
                        room: formData.room,
                        maxCapacity: formData.maxCapacity,
                        notes: formData.notes,
                        isPrivate: formData.isPrivate,
                        observation: formData.observation,
                    })

                    // Optimistic update: add the new class to local state
                    setClasses(prev => [...prev, { ...created, instructor, attendees: [] } as ClassWithDetails])
                    toast.success("Clase creada")
                }

                setIsDialogOpen(false)
                // Revalidate in background so next navigation is fresh
                router.refresh()
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

                    // Remove from local state immediately
                    setClasses(prev => prev.filter(c => c.id !== formData.id))
                    setIsDialogOpen(false)
                    toast.success("Clase eliminada")
                    router.refresh()
                } catch {
                    toast.error("Error al eliminar clase")
                }
            })
        }
    }

    const handleAddStudent = (studentIdOverride?: string) => {
        const targetStudentId = studentIdOverride || studentToAdd
        if (!formData.id) {
            toast.error("Debes guardar la clase antes de inscribir alumnas")
            return
        }
        if (!targetStudentId) return

        // Optimistic UI: check capacity locally before hitting server
        if (formData.attendees.length >= formData.maxCapacity) {
            toast.error("La clase ya está llena")
            return
        }

        // Check if student is already enrolled
        if (formData.attendees.some(a => a.studentId === targetStudentId)) {
            toast.error("La alumna ya está inscrita en esta clase")
            return
        }

        startTransition(async () => {
            try {
                // Server mutation — returns the new Attendee with student
                const newAttendee = await enrollStudent(formData.id!, targetStudentId, isCourtesy ? 'COURTESY' : 'STANDARD')
                toast.success(isCourtesy ? "Alumna inscrita (Cortesía)" : "Alumna inscrita")

                // Patch formData attendees directly — no second query needed
                setFormData(prev => ({ ...prev, attendees: [...prev.attendees, newAttendee as typeof prev.attendees[0]] }))

                // Also patch the calendar grid state for the current class
                setClasses(prev => prev.map(c =>
                    c.id === formData.id
                        ? { ...c, attendees: [...c.attendees, newAttendee as typeof c.attendees[0]] }
                        : c
                ))

                setStudentToAdd("")
                setIsCourtesy(false)
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

                // Patch formData attendees directly — no second query needed
                setFormData(prev => ({ ...prev, attendees: prev.attendees.filter(a => a.studentId !== studentId) }))

                // Also patch the calendar grid state
                setClasses(prev => prev.map(c =>
                    c.id === formData.id
                        ? { ...c, attendees: c.attendees.filter(a => a.studentId !== studentId) }
                        : c
                ))
            } catch {
                toast.error("Error al remover alumna")
            }
        })
    }

    const exportToImage = async () => {
        const element = document.getElementById('calendar-capture')
        if (!element) return

        const toastId = toast.loading("Preparando imagen...")
        try {
            // Using html-to-image (toPng) which handles modern CSS better
            const dataUrl = await toPng(element, {
                cacheBust: true,
                backgroundColor: "#ffffff",
                style: {
                    borderRadius: '0px',
                    margin: '0px'
                },
                // Add filter to ensure hidden elements stay hidden if they leak
                filter: (node) => {
                    const exclusionClasses = ['no-export', 'lucide-zoom-in']
                    if (node instanceof HTMLElement) {
                        return !exclusionClasses.some(cls => node.classList.contains(cls))
                    }
                    return true
                }
            })

            const link = document.createElement("a")
            link.download = `calendario-atria-${toYYYYMMDD(new Date())}.png`
            link.href = dataUrl
            link.click()
            toast.success("Imagen exportada con éxito", { id: toastId })
        } catch (error) {
            console.error("Export error:", error)
            toast.error("Error al exportar la imagen", { id: toastId })
        }
    }

    const availableInstructors = instructors.filter(i => i.specialties.includes(formData.type))

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
                            <Button variant="ghost" size="icon" className="hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full h-8 w-8" onClick={() => navigatePeriod('prev')}>
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                            <span className="text-sm font-semibold capitalize text-slate-700 dark:text-slate-200 text-center select-none min-w-[120px]">
                                {viewType === 'week' 
                                    ? currentWeekStart.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
                                    : currentWeekStart.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
                                }
                            </span>
                            <Button variant="ghost" size="icon" className="hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full h-8 w-8" onClick={() => navigatePeriod('next')}>
                                <ChevronRight className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                        {/* View Toggle */}
                        <div className="flex bg-white dark:bg-slate-800 border rounded-lg p-1 shadow-sm shrink-0">
                            <Button 
                                variant={viewType === 'week' ? 'default' : 'ghost'} 
                                size="sm" 
                                className={cn("h-7 px-3 text-[10px] font-bold", viewType === 'week' ? "" : "text-slate-500")}
                                onClick={() => setViewType('week')}
                            >
                                Semana
                            </Button>
                            <Button 
                                variant={viewType === 'month' ? 'default' : 'ghost'} 
                                size="sm" 
                                className={cn("h-7 px-3 text-[10px] font-bold", viewType === 'month' ? "" : "text-slate-500")}
                                onClick={() => setViewType('month')}
                            >
                                Mes
                            </Button>
                        </div>
                        {/* Export Button */}
                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 gap-2 shrink-0 shadow-sm hover:bg-slate-50"
                            onClick={exportToImage}
                        >
                            <Download className="h-4 w-4" />
                            <span className="hidden xs:inline">Reporte PNG</span>
                        </Button>
                        {/* Zoom Controls */}
                        <div className="hidden sm:flex items-center bg-white dark:bg-slate-800 border rounded-full px-2 py-1 shadow-sm gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-full"
                                onClick={() => setZoomLevel(prev => Math.max(0.6, prev - 0.1))}
                                title="Alejar"
                            >
                                <ZoomOut className="h-4 w-4" />
                            </Button>
                            <span className="text-[10px] font-bold w-9 text-center text-slate-500">
                                {Math.round(zoomLevel * 100)}%
                            </span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-full"
                                onClick={() => setZoomLevel(prev => Math.min(1.4, prev + 0.1))}
                                title="Acercar"
                            >
                                <ZoomIn className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Calendar Grid with Tabs */}
                <div className="w-full" id="calendar-capture">
                    <Tabs value={activeRoom} onValueChange={(v) => setActiveRoom(v as RoomId)}>
                        <div className="flex items-center mb-4 overflow-x-auto pb-2 scrollbar-hide">
                            <TabsList className="bg-white dark:bg-slate-800 p-1 flex w-max min-w-full sm:w-auto">
                                {ROOMS.map(room => (
                                    <TabsTrigger
                                        key={room.id}
                                        value={room.id}
                                        className="px-6 data-[state=active]:bg-brand-primary data-[state=active]:text-white whitespace-nowrap"
                                    >
                                        {room.name}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </div>

                        {ROOMS.map(room => (
                            <TabsContent key={room.id} value={room.id} className="mt-0 border rounded-lg bg-white dark:bg-slate-800 shadow-sm relative">
                                {/* Refreshing overlay */}
                                {isRefreshing && (
                                    <div className="absolute inset-0 z-20 bg-white/60 dark:bg-slate-800/60 backdrop-blur-[1px] rounded-lg flex items-center justify-center">
                                        <div className="flex items-center gap-2 text-sm text-slate-500 bg-white dark:bg-slate-800 px-4 py-2 rounded-full shadow border">
                                            <span className="h-4 w-4 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                                            Actualizando...
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <div className="overflow-x-auto overflow-y-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                                        <div className="min-w-[1000px] bg-white dark:bg-slate-800">
                                            {/* Header */}
                                            <div className="grid grid-cols-[96px_repeat(6,1fr)] border-b dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10 shadow-sm">
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

                                            {viewType === 'week' ? (
                                                <>
                                                    {/* Time Slots */}
                                                    {HOURS.map(hour => (
                                                <div
                                                    key={hour}
                                                    className="grid grid-cols-[96px_repeat(6,1fr)] border-b dark:border-slate-700 last:border-0"
                                                    style={{ height: `${64 * zoomLevel}px` }}
                                                >
                                                    <div className={cn(
                                                        "p-2 border-r dark:border-slate-700 text-slate-500 text-center flex items-center justify-center bg-slate-50/50 dark:bg-slate-900/50 w-24 shrink-0 transition-all",
                                                        zoomLevel < 0.8 ? "text-[9px]" : "text-xs"
                                                    )}>
                                                        {hour.endsWith(':00') ? hour : (zoomLevel > 0.9 ? hour : "")}
                                                    </div>
                                                    {weekDates.map((date, i) => {
                                                        const dateStr = toYYYYMMDD(date)
                                                        const classSession = classes.find(c => {
                                                            const cd = new Date(c.date)
                                                            const cdStr = `${cd.getUTCFullYear()}-${(cd.getUTCMonth() + 1).toString().padStart(2, '0')}-${cd.getUTCDate().toString().padStart(2, '0')}`
                                                            return cdStr === dateStr && c.startTime === hour && c.room === room.id && c.status !== 'CANCELLED'
                                                        })

                                                        // Check if this slot is covered by a class that started 30 mins ago
                                                        const [h, m] = hour.split(':').map(Number)
                                                        const currentMins = h * 60 + m
                                                        const prevMins = currentMins - 30
                                                        const prevHourStr = `${Math.floor(prevMins / 60).toString().padStart(2, '0')}:${(prevMins % 60).toString().padStart(2, '0')}`

                                                        const coveringClass = classes.find(c => {
                                                            const cd = new Date(c.date)
                                                            const cdStr = `${cd.getUTCFullYear()}-${(cd.getUTCMonth() + 1).toString().padStart(2, '0')}-${cd.getUTCDate().toString().padStart(2, '0')}`
                                                            return cdStr === dateStr && c.startTime === prevHourStr && c.room === room.id && c.status !== 'CANCELLED'
                                                        })

                                                        return (
                                                            <div
                                                                key={i}
                                                                className={cn(
                                                                    "border-r dark:border-slate-700 last:border-r-0 relative p-1 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50 group flex-1",
                                                                    (classSession || coveringClass || (role !== 'instructor' && role !== null)) ? "cursor-pointer" : "cursor-default"
                                                                )}
                                                                onClick={() => {
                                                                    if (classSession) {
                                                                        handleSlotClick(date, hour)
                                                                    } else if (coveringClass) {
                                                                        handleSlotClick(date, prevHourStr)
                                                                    } else if (role === 'admin' || role === null) {
                                                                        handleSlotClick(date, hour)
                                                                    }
                                                                }}
                                                            >
                                                                {classSession ? (
                                                                    <div
                                                                        className={cn(
                                                                            "absolute inset-x-1 top-1 z-10 rounded p-1.5 sm:p-2 border-l-4 flex flex-col gap-0.5 sm:gap-1 shadow-md overflow-hidden transition-all",
                                                                            STATUS_COLORS[classSession.status]
                                                                        )}
                                                                        style={{ height: `calc(${(64 * zoomLevel) * 2}px - 8px)` }}
                                                                    >
                                                                        <div className={cn(
                                                                            "font-bold truncate",
                                                                            zoomLevel < 0.8 ? "text-[9px]" : "text-[10px] sm:text-xs"
                                                                        )}>
                                                                            {classSession.type} {classSession.observation ? `(${classSession.observation})` : ''}
                                                                        </div>
                                                                        <div className={cn(
                                                                            "truncate opacity-75 flex items-center gap-1",
                                                                            zoomLevel < 0.8 ? "text-[8px]" : "text-[9px] sm:text-[10px]"
                                                                        )}>
                                                                            <div className={cn("w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0", getInstructorColor(classSession.instructor.name))} />
                                                                            <span className="truncate">{classSession.instructor.name}</span>
                                                                        </div>
                                                                        {zoomLevel > 0.7 && (
                                                                            <div className="mt-auto flex justify-between items-center opacity-90 font-medium bg-white/50 dark:bg-black/20 p-0.5 rounded text-[8px] sm:text-[10px]">
                                                                                <span className="flex items-center gap-1">
                                                                                    <Users className="h-2 w-2 sm:h-3 sm:w-3" />
                                                                                    {classSession.attendees.length}/{classSession.maxCapacity}
                                                                                </span>
                                                                                {classSession.attendees.some(a => a.attendanceType === 'COURTESY') && (
                                                                                    <Sparkles className="h-2 w-2 sm:h-3 sm:w-3 text-yellow-500" />
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : !coveringClass && (
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
                                                </>
                                            ) : (
                                                <div className="grid grid-cols-7 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                                                    {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'].map(d => (
                                                        <div key={d} className="p-2 text-center text-[10px] font-bold text-slate-500 border-r dark:border-slate-700 last:border-0">{d}</div>
                                                    ))}
                                                    {monthDays.map((date, i) => {
                                                        const dateStr = toYYYYMMDD(date)
                                                        const isCurrentMonth = date.getMonth() === currentWeekStart.getMonth()
                                                        const dayClasses = classes.filter(c => {
                                                            const cd = new Date(c.date)
                                                            const cdStr = `${cd.getUTCFullYear()}-${(cd.getUTCMonth() + 1).toString().padStart(2, '0')}-${cd.getUTCDate().toString().padStart(2, '0')}`
                                                            return cdStr === dateStr && c.status !== 'CANCELLED'
                                                        })

                                                        return (
                                                            <div 
                                                                key={i} 
                                                                className={cn(
                                                                    "min-h-[100px] p-1 border-r border-b dark:border-slate-700 last:border-r-0 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50",
                                                                    !isCurrentMonth && "bg-slate-50/30 dark:bg-slate-900/10 opacity-40"
                                                                )}
                                                            >
                                                                <div className="text-[10px] font-bold text-slate-400 mb-1">{date.getDate()}</div>
                                                                <div className="flex flex-col gap-1">
                                                                    {dayClasses.map(c => (
                                                                        <div 
                                                                            key={c.id} 
                                                                            className={cn(
                                                                                "px-1 py-0.5 rounded text-[8px] truncate border-l-2 shadow-sm cursor-pointer",
                                                                                STATUS_COLORS[c.status]
                                                                            )}
                                                                            onClick={() => handleSlotClick(date, c.startTime)}
                                                                        >
                                                                            <span className="font-bold">{c.startTime}</span> {c.type} {c.observation ? `(${c.observation})` : ''}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>
                        ))}
                    </Tabs>
                </div>
            </main>

            {/* Class Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
                            <Sparkles className="h-4 w-4 text-brand-primary" />
                            <span className="text-sm text-blue-800">Vista de solo lectura del Instructor</span>
                        </div>
                    ) : null}

                    <div className="grid gap-6 py-4">
                        <section className="space-y-4 border-b pb-4">
                            <h3 className="font-semibold text-sm text-brand-primary flex items-center gap-2">
                                <School className="h-4 w-4" /> Detalles de Clase
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Fecha</Label>
                                    <Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} disabled={role === 'instructor'} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Hora (1 Hora de Duración)</Label>
                                    <Select value={formData.startTime} onValueChange={v => setFormData({ ...formData, startTime: v })} disabled={role === 'instructor'}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Disciplina</Label>
                                    <Select value={formData.type} onValueChange={v => setFormData({ ...formData, type: v })} disabled={role === 'instructor'}>
                                        <SelectTrigger><SelectValue placeholder="Seleccionar disciplina..." /></SelectTrigger>
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
                                    <Select value={formData.instructorId} onValueChange={v => setFormData({ ...formData, instructorId: v })} disabled={role === 'instructor' || role === 'student'}>
                                        <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
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
                            {formData.type === 'Pole' && (
                                <div className="grid gap-2 border p-3 rounded-md border-pink-200 bg-pink-50 dark:bg-pink-900/20 dark:border-pink-800">
                                    <Label className="text-pink-700 dark:text-pink-300">Tipo de clase de Pole (Obligatorio)</Label>
                                    <Select value={formData.observation || ''} onValueChange={v => setFormData({ ...formData, observation: v })} disabled={role === 'instructor'}>
                                        <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                        <SelectContent>
                                            {['Fitness', 'Coreografico', 'Giratorio', 'Exotic', 'Sport', 'Flexi', 'Flow', 'Power'].map(o => (
                                                <SelectItem key={o} value={o}>{o}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Capacidad Máxima</Label>
                                    <Input type="number" min={1} value={formData.maxCapacity} onChange={e => setFormData({ ...formData, maxCapacity: parseInt(e.target.value) })} disabled={role === 'instructor'} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Estado</Label>
                                    <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v as ClassStatus })} disabled={role === 'instructor'}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2 pt-2 pb-2">
                                <Checkbox id="isPrivate" checked={formData.isPrivate} onCheckedChange={(c) => setFormData({ ...formData, isPrivate: c as boolean })} disabled={role === 'instructor' || role === 'student'} />
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

                        {formData.id && (
                            <section className="space-y-4">
                                <h3 className="font-semibold text-sm text-primary flex items-center justify-between">
                                    <span className="flex items-center gap-2"><Users className="h-4 w-4" /> Alumnas Inscritas</span>
                                    <span className="text-xs bg-slate-100 px-2 py-1 rounded-full text-slate-600">
                                        {formData.attendees.length} / {formData.maxCapacity} Cupos
                                    </span>
                                </h3>

                                {(role === 'admin' || role === null) && (
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
                                                    <label htmlFor="courtesy" className="text-sm font-medium leading-none whitespace-nowrap">Cortesía</label>
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
                                                {(role === 'admin' || role === null) && (
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
            </Dialog>
        </div>
    )
}
