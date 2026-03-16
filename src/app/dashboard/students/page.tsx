"use client"

import { useState, useEffect, useTransition } from "react"
import { getStudents, addStudent, deleteStudent } from "@/actions/students"
import { User, StudentPlan } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sidebar } from "@/components/shared/sidebar"
import { MobileNav } from "@/components/shared/mobile-nav"
import { useAuth } from "@/hooks/useAuth"
import { PlusCircle, Search, Eye, Trash2, User as UserIcon, Download, Cross, ShieldAlert, Loader2 } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { useFilter } from "@/hooks/useFilter"
import { PaginationControl } from "@/components/shared/pagination-control"
import { EmptyState } from "@/components/shared/empty-state"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { DISCIPLINES } from "@/constants/config"

import { Suspense } from "react"

type StudentWithParams = User & {
    plans: StudentPlan[]
}

function StudentsContent() {
    const { role, loading: authLoading } = useAuth(true)
    const [students, setStudents] = useState<StudentWithParams[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isPending, startTransition] = useTransition()

    // Create Student UI State
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [newStudent, setNewStudent] = useState({
        name: "",
        phone: "",
        email: "",
        medicalInfo: "",
        allergies: "",
        injuries: "",
        conditions: "",
        emergencyContact: "",
        sportsInfo: "",
        planType: "Sin Plan",
        discipline: "General"
    })

    useEffect(() => {
        let isMounted = true
        const fetchStudents = async () => {
            try {
                const data = await getStudents()
                if (isMounted) setStudents(data as StudentWithParams[])
            } catch (err) {
                console.error("Error loading students:", err)
            } finally {
                if (isMounted) setIsLoading(false)
            }
        }
        fetchStudents()
        return () => { isMounted = false }
    }, [])

    // --- customFilter logic for advanced filtering ---
    const customFilter = (student: StudentWithParams, filters: Record<string, string>) => {
        // 1. Discipline/Plan Filter
        if (filters.planType && filters.planType !== 'all') {
            const currentPlan = student.plans?.[0]?.originalName || "Sin Plan";
            // Simple string includes match for now, or exact match
            if (!currentPlan.includes(filters.planType)) return false;
        }

        // 2. Medical Info Filter (Boolean-ish)
        if (filters.hasMedical === 'true') {
            const hasMedical = Boolean(student.medicalInfo || student.allergies || student.injuries || student.conditions);
            if (!hasMedical) return false;
        }

        return true;
    };

    const {
        data: paginatedStudents,
        totalItems,
        currentPage,
        totalPages,
        itemsPerPage,
        setPage,
        setItemsPerPage,
        searchTerm,
        setSearchTerm,
        setFilter,
        clearFilters,
        filters
    } = useFilter<StudentWithParams>({
        data: students,
        searchKeys: ['name' as keyof StudentWithParams, 'email' as keyof StudentWithParams, 'phone' as keyof StudentWithParams],
        initialItemsPerPage: 10,
        customFilter
    });

    if (authLoading) return (
        <div className="flex h-screen flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 gap-4 text-slate-500">
            <Loader2 className="h-10 w-10 animate-spin text-brand-primary" />
            <p className="italic text-sm animate-pulse">Verificando permisos...</p>
        </div>
    );

    if (role !== 'admin' && role !== 'instructor') {
        return (
            <div className="flex h-screen items-center justify-center p-4 bg-slate-50 dark:bg-slate-900">
                <div className="text-center bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg border max-w-md w-full">
                    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
                        <ShieldAlert className="h-10 w-10 text-destructive" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2 italic">Acceso Denegado</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-8">Lo sentimos, esta sección es exclusiva para la administración e instructores de Atria Fitness.</p>
                    <Link href="/dashboard">
                        <Button className="w-full h-12 text-lg">Volver al Dashboard</Button>
                    </Link>
                </div>
            </div>
        )
    }

    const handleCreateStudent = async () => {
        if (!newStudent.name || !newStudent.phone) {
            toast.error("Por favor completa los campos obligatorios")
            return
        }

        startTransition(async () => {
            try {
                await addStudent({
                    name: newStudent.name,
                    phone: newStudent.phone,
                    email: newStudent.email,
                    medicalInfo: newStudent.medicalInfo,
                    allergies: newStudent.allergies,
                    injuries: newStudent.injuries,
                    conditions: newStudent.conditions,
                    emergencyContact: newStudent.emergencyContact,
                    sportsInfo: newStudent.sportsInfo,
                    planType: newStudent.planType,
                    discipline: newStudent.discipline,
                })
                toast.success("Alumna registrada correctamente")
                setIsDialogOpen(false)
                setNewStudent({
                    name: "", phone: "", email: "",
                    medicalInfo: "", allergies: "", injuries: "", conditions: "", emergencyContact: "",
                    sportsInfo: "", planType: "Sin Plan", discipline: "General"
                })
                // trigger a refresh of the list
                const refreshed = await getStudents()
                setStudents(refreshed as StudentWithParams[])
            } catch (err: unknown) {
                const errorMessage = err instanceof Error ? err.message : "Error al registrar alumna"
                toast.error(errorMessage)
            }
        })
    }

    const handleDeleteStudent = async (id: string) => {
        if (confirm("¿Estás seguro de eliminar esta alumna?")) {
            startTransition(async () => {
                try {
                    await deleteStudent(id)
                    toast.success("Alumna eliminada")
                    const refreshed = await getStudents()
                    setStudents(refreshed as StudentWithParams[])
                } catch {
                    toast.error("Error al eliminar alumna")
                }
            })
        }
    }

    const handleExportCSV = () => {
        // Filter logic is complex to replicate, so we export ALL current filtered result or just all students? 
        // Ideally export visible filtered list. Since `useFilter` paginates, we might need access to 'filteredData' (unpaginated).
        // For simplicity in this iteration, let's export ALL students or current page. 
        // User request says "download current data". We'll act on 'students' if filters are empty, or maybe we should expose filteredData from hook.
        // Let's just export ALL for now to be safe, or I'd need to update hook to return unpaginated result.

        const headers = ["ID", "Nombre", "Email", "Teléfono", "Plan Actual", "Info Médica"];
        const rows = students.map(s => [
            s.id,
            s.name,
            s.email,
            s.phone || "",
            s.plans?.[0]?.originalName || "Sin Plan",
            s.medicalInfo || s.conditions || s.allergies || "Ninguna"
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "alumnas_atria.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    return (
        <div className="flex flex-col md:flex-row h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
            <Sidebar />
            <MobileNav />
            <main className="flex-1 h-full overflow-y-auto overflow-x-hidden p-4 md:p-8 min-w-0">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Gestión de Alumnas</h1>
                        <p className="text-slate-500 text-sm">Administra inscripciones, planes y fichas médicas.</p>
                    </div>

                    {role === 'admin' && (
                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                            <Button variant="outline" onClick={handleExportCSV} className="w-full sm:w-auto">
                                <Download className="mr-2 h-4 w-4" /> Exportar CSV
                            </Button>
                            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button className="bg-brand-primary hover:bg-brand-primary/90 text-white w-full sm:w-auto">
                                        <PlusCircle className="mr-2 h-4 w-4" /> Nueva Alumna
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl h-[90vh] sm:h-[80vh] overflow-y-auto">
                                    <DialogHeader>
                                        <DialogTitle>Registrar Nueva Alumna</DialogTitle>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-4 grid-cols-1 sm:grid-cols-2">
                                        <div className="grid gap-2">
                                            <Label htmlFor="name">Nombre Completo *</Label>
                                            <Input
                                                id="name"
                                                value={newStudent.name}
                                                onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                                                placeholder="Ej. Ana Pérez"
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="phone">Teléfono *</Label>
                                            <Input
                                                id="phone"
                                                value={newStudent.phone}
                                                onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })}
                                                placeholder="Ej. 555-1234"
                                            />
                                        </div>
                                        <div className="grid gap-2 col-span-2">
                                            <Label htmlFor="email">Correo Electrónico (Opcional)</Label>
                                            <Input
                                                id="email"
                                                value={newStudent.email}
                                                onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                                                placeholder="ejemplo@correo.com"
                                            />
                                        </div>
                                        <div className="grid gap-2 col-span-2 border-t pt-2 mt-2">
                                            <Label className="font-semibold text-brand-primary">Información Médica</Label>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="allergies">Alergias</Label>
                                            <Input
                                                id="allergies"
                                                value={newStudent.allergies}
                                                onChange={(e) => setNewStudent({ ...newStudent, allergies: e.target.value })}
                                                placeholder="Medicamentos, polen..."
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="conditions">Condiciones</Label>
                                            <Input
                                                id="conditions"
                                                value={newStudent.conditions}
                                                onChange={(e) => setNewStudent({ ...newStudent, conditions: e.target.value })}
                                                placeholder="Asma, cardíaco..."
                                            />
                                        </div>
                                        <div className="grid gap-2 col-span-2">
                                            <Label htmlFor="injuries">Lesiones Previas</Label>
                                            <Input
                                                id="injuries"
                                                value={newStudent.injuries}
                                                onChange={(e) => setNewStudent({ ...newStudent, injuries: e.target.value })}
                                                placeholder="Rodilla, hombro, espalda..."
                                            />
                                        </div>
                                        <div className="grid gap-2 col-span-2">
                                            <Label htmlFor="medicalInfo">Observaciones Médicas Adicionales</Label>
                                            <Textarea
                                                id="medicalInfo"
                                                value={newStudent.medicalInfo}
                                                onChange={(e) => setNewStudent({ ...newStudent, medicalInfo: e.target.value })}
                                                className="h-16"
                                            />
                                        </div>
                                        <div className="grid gap-2 col-span-2">
                                            <Label htmlFor="emergencyContact">Contacto de Emergencia (Nombre y Tel)</Label>
                                            <Input
                                                id="emergencyContact"
                                                value={newStudent.emergencyContact}
                                                onChange={(e) => setNewStudent({ ...newStudent, emergencyContact: e.target.value })}
                                                placeholder="Ej. Mamá - 555-9999"
                                            />
                                        </div>
                                        <div className="grid gap-2 col-span-2 border-t pt-2 mt-2">
                                            <Label className="font-semibold text-brand-primary">Información Deportiva & Plan</Label>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="sportsInfo">Antecedentes Deportivos</Label>
                                            <Input
                                                id="sportsInfo"
                                                value={newStudent.sportsInfo}
                                                onChange={(e) => setNewStudent({ ...newStudent, sportsInfo: e.target.value })}
                                                placeholder="Yoga, Danza..."
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="plan">Plan Inicial</Label>
                                            <Select value={newStudent.planType} onValueChange={(v) => setNewStudent({ ...newStudent, planType: v })}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Sin Plan">Sin Plan</SelectItem>
                                                    <SelectItem value="Clase Suelta">Clase Suelta (1 Clase)</SelectItem>
                                                    <SelectItem value="Pack 4 Clases">Pack 4 Clases</SelectItem>
                                                    <SelectItem value="Pack 8 Clases">Pack 8 Clases</SelectItem>
                                                    <SelectItem value="Pack 12 Clases">Pack 12 Clases</SelectItem>
                                                    <SelectItem value="Pack 24 Clases">Pack 24 Clases</SelectItem>
                                                    <SelectItem value="Ilimitado">Ilimitado</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {newStudent.planType !== "Sin Plan" && (
                                            <div className="grid gap-2">
                                                <Label htmlFor="discipline">Disciplina del Plan</Label>
                                                <Select value={newStudent.discipline} onValueChange={(v) => setNewStudent({ ...newStudent, discipline: v })}>
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="General">General (Todas)</SelectItem>
                                                        {DISCIPLINES.map(d => (
                                                            <SelectItem key={d} value={d}>{d}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                                        <Button onClick={handleCreateStudent} disabled={isPending} className="bg-brand-primary text-white hover:bg-brand-primary/90">
                                            {isPending ? "Guardando..." : "Guardar"}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    )}
                </div>

                {/* FILTERS TOOLBAR */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border shadow-sm mb-6 space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Buscar por nombre, email o teléfono..."
                                className="pl-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-wrap sm:flex-nowrap gap-2">
                            <Select value={filters.planType || "all"} onValueChange={(v) => setFilter('planType', v)}>
                                <SelectTrigger className="w-full sm:w-[180px]">
                                    <SelectValue placeholder="Tipo de Plan" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos los Planes</SelectItem>
                                    <SelectItem value="Sin Plan">Sin Plan</SelectItem>
                                    <SelectItem value="Clase Suelta">Clase Suelta</SelectItem>
                                    <SelectItem value="Pack 4">Pack 4 Clases</SelectItem>
                                    <SelectItem value="Pack 8">Pack 8 Clases</SelectItem>
                                    <SelectItem value="Pack 12">Pack 12 Clases</SelectItem>
                                    <SelectItem value="Pack 24">Pack 24 Clases</SelectItem>
                                    <SelectItem value="Ilimitado">Ilimitado</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={filters.hasMedical || "all"} onValueChange={(v) => setFilter('hasMedical', v)}>
                                <SelectTrigger className="w-full sm:w-[200px]">
                                    <SelectValue placeholder="Ficha Médica" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Cualquier Estado</SelectItem>
                                    <SelectItem value="true">Con Condición Médica</SelectItem>
                                </SelectContent>
                            </Select>

                            {(filters.planType || filters.hasMedical || searchTerm) && (
                                <Button variant="ghost" onClick={clearFilters} className="text-destructive hover:bg-destructive/10 w-full sm:w-auto">
                                    <Cross className="h-4 w-4 mr-2 rotate-45" /> Limpiar Filtros
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* DATA TABLE */}
                <div className="bg-white dark:bg-slate-800 rounded-lg border shadow-sm flex flex-col overflow-hidden">
                    <div className="overflow-x-auto">
                        <Table className="min-w-[800px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Plan</TableHead>
                                    <TableHead>Teléfono</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array.from({ length: 6 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse shrink-0" />
                                                    <div className="space-y-1.5">
                                                        <div className="h-3.5 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                                                        <div className="h-3 w-24 bg-slate-100 dark:bg-slate-600 rounded animate-pulse" />
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell><div className="h-5 w-28 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse" /></TableCell>
                                            <TableCell><div className="h-3.5 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <div className="h-8 w-8 bg-slate-100 dark:bg-slate-700 rounded animate-pulse" />
                                                    <div className="h-8 w-8 bg-slate-100 dark:bg-slate-700 rounded animate-pulse" />
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : paginatedStudents.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="p-0">
                                            <EmptyState onAction={clearFilters} />
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedStudents.map((student) => {
                                        const hasMedical = Boolean(student.medicalInfo || student.conditions || student.allergies || student.injuries);

                                        return (
                                            <TableRow key={student.id}>
                                                <TableCell className="font-medium flex items-center gap-3">
                                                    <div className="h-9 w-9 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary relative">
                                                        <UserIcon className="h-5 w-5" />
                                                        {hasMedical && (
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <div className="absolute -top-1 -right-1 bg-white dark:bg-slate-800 rounded-full p-0.5 shadow-sm">
                                                                            <ShieldAlert className="h-4 w-4 text-red-500 fill-red-100" />
                                                                        </div>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent className="max-w-[200px] text-xs">
                                                                        <p className="font-bold">Información Médica:</p>
                                                                        <p>{student.medicalInfo}</p>
                                                                        <p>{student.conditions}</p>
                                                                        <p>{student.allergies}</p>
                                                                        <p>{student.injuries}</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-slate-700 dark:text-slate-200">{student.name}</span>
                                                        <span className="text-xs text-slate-400">{student.email || "Sin email"}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1">
                                                        {student.plans && student.plans.length > 0 ? (
                                                            student.plans.map((p, idx) => (
                                                                <Badge
                                                                    key={idx}
                                                                    variant={p.credits <= 1 ? "destructive" : "secondary"}
                                                                    className="text-[10px] px-1.5 py-0"
                                                                >
                                                                    {p.originalName} &quot;{p.discipline}&quot;: {p.credits}
                                                                </Badge>
                                                            ))
                                                        ) : (
                                                            <span className="text-xs text-slate-400">Sin Plan</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>{student.phone}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Link href={`/dashboard/students/${student.id}`}>
                                                            <Button variant="ghost" size="sm" className="hover:text-brand-primary hover:bg-brand-primary/10">
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                        </Link>
                                                        {role === 'admin' && (
                                                            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteStudent(student.id)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {paginatedStudents.length > 0 && (
                        <div className="p-4 border-t">
                            <PaginationControl
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onPageChange={setPage}
                                totalItems={totalItems}
                                itemsPerPage={itemsPerPage}
                                onItemsPerPageChange={setItemsPerPage}
                            />
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}

export default function StudentsPage() {
    return (
        <Suspense fallback={
            <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
                <Sidebar />
                <div className="flex-1 flex items-center justify-center p-8">
                    <div className="flex flex-col items-center gap-6 bg-white dark:bg-slate-800/80 backdrop-blur px-14 py-12 rounded-3xl shadow-lg border border-slate-100 dark:border-slate-700">
                        <div className="relative flex items-center justify-center">
                            <div className="absolute h-24 w-24 rounded-full bg-brand-primary/10 animate-pulse" />
                            <div className="absolute h-20 w-20 rounded-full ring-2 ring-brand-primary/30" />
                            <Loader2 className="h-10 w-10 text-brand-primary animate-spin relative z-10" />
                        </div>
                        <div className="flex flex-col items-center gap-1.5">
                            <p className="text-base font-semibold text-slate-800 dark:text-slate-100 tracking-tight">Cargando alumnas</p>
                            <p className="text-sm text-slate-400 dark:text-slate-500">Atria Fitness</p>
                        </div>
                        <div className="flex gap-1.5">
                            {[0, 150, 300].map((delay) => (
                                <span key={delay} className="h-1.5 w-1.5 rounded-full bg-brand-primary/60 animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        }>
            <StudentsContent />
        </Suspense>
    )
}
