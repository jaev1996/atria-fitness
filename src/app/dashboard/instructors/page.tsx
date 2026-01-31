"use client"

import { useState, useEffect } from "react"
import { db, Instructor } from "@/lib/storage"
import { Sidebar } from "@/components/shared/sidebar"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2, Edit, Search, User, Download, Cross, Eye } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { DISCIPLINES } from "@/constants/config"
import { useFilter } from "@/hooks/useFilter"
import { PaginationControl } from "@/components/shared/pagination-control"
import { EmptyState } from "@/components/shared/empty-state"

import { Suspense } from "react"

function InstructorsContent() {
    const [instructors, setInstructors] = useState<Instructor[]>([])
    // Removed old states in favor of hook
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)

    const [formData, setFormData] = useState<{
        name: string,
        email: string,
        phone: string,
        bio: string,
        specialties: string[],
        ratePerClass: number
    }>({
        name: "",
        email: "",
        phone: "",
        bio: "",
        specialties: [],
        ratePerClass: 0
    })

    const loadInstructors = () => {
        setInstructors(db.getInstructors())
    }

    useEffect(() => {
        loadInstructors()
    }, [])

    // --- customFilter logic for advanced filtering ---
    const customFilter = (item: Instructor, filters: Record<string, any>) => {
        // 1. Specialty Filter
        if (filters.specialty && filters.specialty !== 'all') {
            if (!item.specialties?.includes(filters.specialty)) return false;
        }

        return true;
    };

    const {
        data: paginatedInstructors,
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
    } = useFilter<Instructor>({
        data: instructors,
        searchKeys: ['name', 'email', 'bio'],
        initialItemsPerPage: 10,
        customFilter
    });

    const handleOpenDialog = (instructor?: Instructor) => {
        if (instructor) {
            setEditingId(instructor.id)
            setFormData({
                name: instructor.name,
                email: instructor.email || "",
                phone: instructor.phone || "",
                bio: instructor.bio || "",
                specialties: instructor.specialties || [],
                ratePerClass: instructor.ratePerClass || 0
            })
        } else {
            setEditingId(null)
            setFormData({
                name: "",
                email: "",
                phone: "",
                bio: "",
                specialties: [],
                ratePerClass: 0
            })
        }
        setIsDialogOpen(true)
    }


    const handleSave = () => {
        if (!formData.name) {
            toast.error("El nombre es obligatorio")
            return
        }
        if (formData.specialties.length === 0) {
            toast.error("Selecciona al menos una especialidad")
            return
        }

        if (editingId) {
            db.updateInstructor(editingId, formData)
            toast.success("Instructor actualizado")
        } else {
            db.addInstructor(formData)
            toast.success("Instructor creado")
        }
        setIsDialogOpen(false)
        loadInstructors()
    }

    const handleDelete = (id: string) => {
        if (confirm("¿Estás seguro de eliminar este instructor?")) {
            db.deleteInstructor(id)
            toast.success("Instructor eliminado")
            loadInstructors()
        }
    }

    const toggleSpecialty = (specialty: string) => {
        setFormData(prev => {
            const exists = prev.specialties.includes(specialty)
            if (exists) {
                return { ...prev, specialties: prev.specialties.filter(s => s !== specialty) }
            } else {
                return { ...prev, specialties: [...prev.specialties, specialty] }
            }
        })
    }

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
            <Sidebar />
            <main className="flex-1 p-8 overflow-y-auto w-full">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Gestión de Instructores</h1>
                        <p className="text-slate-500 text-sm">Administra el equipo de profesores y sus especialidades.</p>
                    </div>
                    <Button onClick={() => handleOpenDialog()} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                        <Plus className="mr-2 h-4 w-4" /> Nuevo Instructor
                    </Button>
                </div>

                {/* FILTERS TOOLBAR */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border shadow-sm mb-6 space-y-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Buscar por nombre o biografía..."
                                className="pl-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                            <Select value={filters.specialty || "all"} onValueChange={(v) => setFilter('specialty', v)}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Especialidad" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas</SelectItem>
                                    {DISCIPLINES.map(d => (
                                        <SelectItem key={d} value={d}>{d}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {(filters.specialty || searchTerm) && (
                                <Button variant="ghost" onClick={clearFilters} className="text-destructive hover:bg-destructive/10">
                                    <Cross className="h-4 w-4 mr-2 rotate-45" /> Limpiar
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-lg border shadow-sm flex flex-col">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Especialidades</TableHead>
                                <TableHead>Contacto</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedInstructors.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="p-0">
                                        <EmptyState onAction={clearFilters} />
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedInstructors.map((instructor) => (
                                    <TableRow key={instructor.id}>
                                        <TableCell className="font-medium flex items-center gap-2">
                                            <div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500">
                                                <User className="h-4 w-4" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-slate-700 dark:text-slate-200">{instructor.name}</span>
                                                <span className="text-xs text-slate-400 truncate max-w-[200px]">{instructor.bio || "Sin biografía"}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {instructor.specialties.map(s => (
                                                    <span key={s} className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                                                        {s}
                                                    </span>
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm font-medium">{instructor.email}</div>
                                            <div className="text-xs text-slate-500">{instructor.phone}</div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Link href={`/dashboard/instructors/${instructor.id}`}>
                                                    <Button variant="ghost" size="sm">
                                                        <Eye className="h-4 w-4 text-slate-500 hover:text-blue-600" />
                                                    </Button>
                                                </Link>
                                                <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(instructor)}>
                                                    <Edit className="h-4 w-4 text-slate-500 hover:text-primary" />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleDelete(instructor.id)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>

                    {paginatedInstructors.length > 0 && (
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

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle>{editingId ? "Editar Instructor" : "Nuevo Instructor"}</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label>Nombre Completo *</Label>
                                <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ej. Valentina" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Email</Label>
                                    <Input value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="correo@ejemplo.com" />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Teléfono</Label>
                                    <Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="555-0000" />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Tarifa por Clase (Bs)</Label>
                                    <Input
                                        type="number"
                                        value={formData.ratePerClass || ""}
                                        onChange={e => setFormData({ ...formData, ratePerClass: parseFloat(e.target.value) || 0 })}
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label>Biografía Corta</Label>
                                <Textarea value={formData.bio} onChange={e => setFormData({ ...formData, bio: e.target.value })} placeholder="Experiencia, certificaciones..." />
                            </div>
                            <div className="grid gap-2">
                                <Label className="mb-2">Especialidades *</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    {DISCIPLINES.map(d => (
                                        <div key={d} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`spec-${d}`}
                                                checked={formData.specialties.includes(d)}
                                                onCheckedChange={() => toggleSpecialty(d)}
                                            />
                                            <label
                                                htmlFor={`spec-${d}`}
                                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                            >
                                                {d}
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                            <Button onClick={handleSave}>Guardar</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </main>
        </div>
    )
}

export default function InstructorsPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center">Cargando...</div>}>
            <InstructorsContent />
        </Suspense>
    )
}
