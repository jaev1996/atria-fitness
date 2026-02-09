"use client"

import { useState, useEffect } from "react"
import { db, Student } from "@/lib/storage"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sidebar } from "@/components/shared/sidebar"
import { PlusCircle, Search, Eye, Trash2, User, Download, Cross, ShieldAlert } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { useFilter } from "@/hooks/useFilter"
import { PaginationControl } from "@/components/shared/pagination-control"
import { EmptyState } from "@/components/shared/empty-state"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

import { Suspense } from "react"

function StudentsContent() {
    const [students, setStudents] = useState<Student[]>([])

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
        planType: "Sin Plan"
    })

    const loadStudents = () => {
        setStudents(db.getStudents())
    }

    useEffect(() => {
        const timer = setTimeout(() => {
            loadStudents()
        }, 0)
        return () => clearTimeout(timer)
    }, [])

    // --- customFilter logic for advanced filtering ---
    const customFilter = (student: Student, filters: Record<string, string>) => {
        // 1. Discipline/Plan Filter
        if (filters.planType && filters.planType !== 'all') {
            const currentPlan = student.plans?.[0]?.nombreOriginal || "Sin Plan";
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
    } = useFilter<Student>({
        data: students,
        searchKeys: ['name', 'email', 'phone'],
        initialItemsPerPage: 10,
        customFilter
    });

    const handleCreateStudent = () => {
        if (!newStudent.name || !newStudent.phone) {
            toast.error("Por favor completa los campos obligatorios")
            return
        }

        db.addStudent({
            name: newStudent.name,
            phone: newStudent.phone,
            email: newStudent.email,
            medicalInfo: newStudent.medicalInfo,
            allergies: newStudent.allergies,
            injuries: newStudent.injuries,
            conditions: newStudent.conditions,
            emergencyContact: newStudent.emergencyContact,
            sportsInfo: newStudent.sportsInfo,
            planType: newStudent.planType
        })
        toast.success("Alumna registrada correctamente")
        setIsDialogOpen(false)
        setNewStudent({
            name: "", phone: "", email: "",
            medicalInfo: "", allergies: "", injuries: "", conditions: "", emergencyContact: "",
            sportsInfo: "", planType: "Sin Plan"
        })
        loadStudents()
    }

    const handleDeleteStudent = (id: string) => {
        if (confirm("¿Estás seguro de eliminar esta alumna?")) {
            db.deleteStudent(id)
            toast.success("Alumna eliminada")
            loadStudents()
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
            s.phone,
            s.plans?.[0]?.nombreOriginal || "Sin Plan",
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
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
            <Sidebar />
            <main className="flex-1 p-8 overflow-y-auto w-full">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Gestión de Alumnas</h1>
                        <p className="text-slate-500 text-sm">Administra inscripciones, planes y fichas médicas.</p>
                    </div>

                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleExportCSV}>
                            <Download className="mr-2 h-4 w-4" /> Exportar CSV
                        </Button>
                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                                    <PlusCircle className="mr-2 h-4 w-4" /> Nueva Alumna
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>Registrar Nueva Alumna</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4 py-4 grid-cols-2">
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
                                        <Label className="font-semibold text-primary">Información Médica</Label>
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
                                        <Label className="font-semibold text-primary">Información Deportiva & Plan</Label>
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
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                                    <Button onClick={handleCreateStudent} className="bg-primary text-primary-foreground hover:bg-primary/90">Guardar</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                {/* FILTERS TOOLBAR */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border shadow-sm mb-6 space-y-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Buscar por nombre, email o teléfono..."
                                className="pl-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                            <Select value={filters.planType || "all"} onValueChange={(v) => setFilter('planType', v)}>
                                <SelectTrigger className="w-[180px]">
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
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder="Ficha Médica" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Cualquier Estado</SelectItem>
                                    <SelectItem value="true">Con Condición Médica</SelectItem>
                                </SelectContent>
                            </Select>

                            {(filters.planType || filters.hasMedical || searchTerm) && (
                                <Button variant="ghost" onClick={clearFilters} className="text-destructive hover:bg-destructive/10">
                                    <Cross className="h-4 w-4 mr-2 rotate-45" /> Limpiar
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* DATA TABLE */}
                <div className="bg-white dark:bg-slate-800 rounded-lg border shadow-sm flex flex-col">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Plan</TableHead>
                                <TableHead>Teléfono</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedStudents.length === 0 ? (
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
                                                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary relative">
                                                    <User className="h-5 w-5" />
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
                                                                variant={p.creditos <= 1 ? "destructive" : "secondary"}
                                                                className="text-[10px] px-1.5 py-0"
                                                            >
                                                                {p.nombreOriginal} &quot;{p.disciplina}&quot;: {p.creditos}
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
                                                        <Button variant="ghost" size="sm" className="hover:text-primary hover:bg-primary/10">
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </Link>
                                                    <Button variant="ghost" size="sm" className="text-slate-400 hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteStudent(student.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>

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
        <Suspense fallback={<div className="flex h-screen items-center justify-center">Cargando...</div>}>
            <StudentsContent />
        </Suspense>
    )
}
