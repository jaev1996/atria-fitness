"use client"

import { useState } from "react"
import { DISCIPLINES, ROOMS, Tier } from "@/constants/config"
import { updateDisciplineRate, updateRoomDisciplines } from "@/actions/settings"
import { Sidebar } from "@/components/shared/sidebar"
import { MobileNav } from "@/components/shared/mobile-nav"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Trash2, Save, RotateCcw, Layout, ShieldCheck, RefreshCw, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { syncAllUserMetadata } from "@/actions/sync-metadata"
import { cn } from "@/lib/utils"

// ── Default values ────────────────────────────────────────────────────────────
const DEFAULT_RATES: { privateRate: number; rates: Tier[] } = {
    privateRate: 25,
    rates: [
        { min: 1, max: 2, price: 10 },
        { min: 3, max: 4, price: 15 },
        { min: 5, max: null, price: 20 },
    ],
}

function buildInitialRoomSettings(
    savedRates: Record<string, { privateRate: number; rates: Tier[] }> | null | undefined
): Record<string, { privateRate: number; rates: Tier[] }> {
    const result: Record<string, { privateRate: number; rates: Tier[] }> = {}
    DISCIPLINES.forEach(d => {
        const saved = savedRates?.[d]
        result[d] = saved
            ? { privateRate: saved.privateRate, rates: [...saved.rates] }
            : { ...DEFAULT_RATES, rates: DEFAULT_RATES.rates.map(r => ({ ...r })) }
    })
    return result
}

function buildInitialRoomDisciplines(
    savedRoomDisciplines: Record<string, string[]> | null | undefined
): Record<string, string[]> {
    const result: Record<string, string[]> = {}
    ROOMS.forEach(room => {
        result[room.id] = savedRoomDisciplines?.[room.id] ?? [...room.disciplines]
    })
    return result
}

// ── Component ─────────────────────────────────────────────────────────────────
interface SettingsClientProps {
    initialSettings: {
        disciplineRates: Record<string, { privateRate: number; rates: Tier[] }> | null
        roomDisciplines: Record<string, string[]> | null
    } | null
}

export function SettingsClient({ initialSettings }: SettingsClientProps) {
    const [roomSettings, setRoomSettings] = useState(() =>
        buildInitialRoomSettings(initialSettings?.disciplineRates)
    )
    const [roomDisciplines, setRoomDisciplines] = useState(() =>
        buildInitialRoomDisciplines(initialSettings?.roomDisciplines)
    )
    const [saving, setSaving] = useState<string | null>(null)

    // ── Discipline rate handlers ───────────────────────────────────────────────
    const addTier = (discipline: string) => {
        setRoomSettings(prev => ({
            ...prev,
            [discipline]: {
                ...prev[discipline],
                rates: [...prev[discipline].rates, { min: 1, max: null, price: 0 }],
            },
        }))
    }

    const removeTier = (discipline: string, index: number) => {
        setRoomSettings(prev => {
            const rates = [...prev[discipline].rates]
            rates.splice(index, 1)
            return { ...prev, [discipline]: { ...prev[discipline], rates } }
        })
    }

    const updateTier = (discipline: string, index: number, field: keyof Tier, value: string) => {
        setRoomSettings(prev => {
            const rates = [...prev[discipline].rates]
            const tier = { ...rates[index] }
            if (field === 'max') tier.max = value === "" ? null : parseInt(value)
            else if (field === 'min' || field === 'price') tier[field] = parseInt(value) || 0
            rates[index] = tier
            return { ...prev, [discipline]: { ...prev[discipline], rates } }
        })
    }

    const updatePrivateRate = (discipline: string, value: string) => {
        setRoomSettings(prev => ({
            ...prev,
            [discipline]: { ...prev[discipline], privateRate: parseInt(value) || 0 },
        }))
    }

    const resetToDefault = (discipline: string) => {
        setRoomSettings(prev => ({
            ...prev,
            [discipline]: { ...DEFAULT_RATES, rates: DEFAULT_RATES.rates.map(r => ({ ...r })) },
        }))
        toast.info("Valores restaurados a los predeterminados (sin guardar)")
    }

    const handleSaveDiscipline = async (discipline: string) => {
        setSaving(discipline)
        try {
            await updateDisciplineRate(discipline, roomSettings[discipline])
            toast.success(`Tarifas de ${discipline} guardadas`)
        } catch {
            toast.error("Error al guardar tarifas")
        } finally {
            setSaving(null)
        }
    }

    // ── Room discipline handlers ──────────────────────────────────────────────
    const toggleDisciplineInRoom = (roomId: string, discipline: string) => {
        setRoomDisciplines(prev => {
            const current = prev[roomId] ?? []
            const next = current.includes(discipline)
                ? current.filter(d => d !== discipline)
                : [...current, discipline]
            return { ...prev, [roomId]: next }
        })
    }

    const handleSaveRoomDisciplines = async (roomId: string) => {
        setSaving(roomId)
        try {
            await updateRoomDisciplines(roomId, roomDisciplines[roomId])
            toast.success("Distribución de disciplinas guardada")
        } catch {
            toast.error("Error al guardar distribución")
        } finally {
            setSaving(null)
        }
    }

    const handleSyncMetadata = async () => {
        setSaving("sync-all")
        const id = toast.loading("Sincronizando todos los usuarios...")
        try {
            const results = await syncAllUserMetadata()
            if (results.errors > 0) {
                toast.warning(`Sincronización parcial: ${results.updated} actualizados, ${results.errors} errores.`, { id })
            } else {
                toast.success(`Sincronización exitosa: ${results.updated} usuarios actualizados.`, { id })
            }
        } catch (e) {
            console.error(e)
            toast.error("Error crítico durante la sincronización", { id })
        } finally {
            setSaving(null)
        }
    }

    return (
        <div className="flex flex-col md:flex-row h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
            <Sidebar />
            <MobileNav />
            <main className="flex-1 p-4 md:p-8 overflow-y-auto min-w-0">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Configuración</h1>
                    <p className="text-slate-500 mt-1">Administra las tarifas de pago por disciplina y los salones.</p>
                </div>

                {/* Discipline Rates Card */}
                <Card className="mb-8 border-none shadow-sm">
                    <CardHeader>
                        <CardTitle>Tarifas por Disciplina</CardTitle>
                        <CardDescription>
                            Define cuánto se le paga al instructor según la disciplina que imparte y la cantidad de alumnas asistentes.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue={DISCIPLINES[0]} className="w-full">
                            <TabsList className="mb-4 flex-wrap h-auto gap-1">
                                {DISCIPLINES.map(d => (
                                    <TabsTrigger key={d} value={d}>{d}</TabsTrigger>
                                ))}
                            </TabsList>

                            {DISCIPLINES.map(discipline => (
                                <TabsContent key={discipline} value={discipline} className="space-y-6">
                                    <div className="grid gap-4 p-4 border rounded-lg bg-white dark:bg-slate-800">
                                        {/* Private rate */}
                                        <div className="flex justify-between items-center bg-purple-50 dark:bg-purple-900/10 p-4 rounded-lg border border-purple-100 dark:border-purple-900/20">
                                            <div className="space-y-1">
                                                <Label className="text-purple-700 dark:text-purple-300 font-bold">Tarifa Clase Privada</Label>
                                                <p className="text-xs text-purple-600 dark:text-purple-400">Pago fijo al instructor por cada sesión privada.</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg font-bold text-purple-700 dark:text-purple-300">$</span>
                                                <Input
                                                    type="number"
                                                    className="w-24 text-right font-bold"
                                                    value={roomSettings[discipline]?.privateRate ?? 0}
                                                    onChange={e => updatePrivateRate(discipline, e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        {/* Tiers */}
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <Label className="text-base font-semibold">Tramos de Pago (Clases Normales)</Label>
                                                <Button size="sm" variant="outline" onClick={() => addTier(discipline)} className="gap-2">
                                                    <Plus className="h-4 w-4" /> Agregar Tramo
                                                </Button>
                                            </div>
                                            <div className="space-y-2">
                                                {(roomSettings[discipline]?.rates ?? []).map((tier, idx) => (
                                                    <div key={idx} className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-md border">
                                                        <div className="grid gap-1 flex-1">
                                                            <span className="text-[10px] text-slate-500 uppercase font-bold">Min Alumnas</span>
                                                            <Input type="number" value={tier.min} onChange={e => updateTier(discipline, idx, 'min', e.target.value)} />
                                                        </div>
                                                        <div className="grid gap-1 flex-1">
                                                            <span className="text-[10px] text-slate-500 uppercase font-bold">Max (Vacío = ∞)</span>
                                                            <Input type="number" placeholder="∞" value={tier.max === null ? "" : tier.max} onChange={e => updateTier(discipline, idx, 'max', e.target.value)} />
                                                        </div>
                                                        <div className="grid gap-1 flex-1">
                                                            <span className="text-[10px] text-slate-500 uppercase font-bold">Pago ($)</span>
                                                            <Input type="number" className="font-bold text-green-600" value={tier.price} onChange={e => updateTier(discipline, idx, 'price', e.target.value)} />
                                                        </div>
                                                        <Button variant="ghost" size="icon" className="mt-4 text-red-500 hover:bg-red-50" onClick={() => removeTier(discipline, idx)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                                            <Button variant="ghost" className="gap-2" onClick={() => resetToDefault(discipline)}>
                                                <RotateCcw className="h-4 w-4" /> Restaurar
                                            </Button>
                                            <Button className="gap-2" disabled={saving === discipline} onClick={() => handleSaveDiscipline(discipline)}>
                                                <Save className="h-4 w-4" />
                                                {saving === discipline ? "Guardando..." : "Guardar Cambios"}
                                            </Button>
                                        </div>
                                    </div>
                                </TabsContent>
                            ))}
                        </Tabs>
                    </CardContent>
                </Card>

                {/* Room Disciplines Card */}
                <Card className="border-none shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Layout className="h-5 w-5 text-primary" /> Distribución de Disciplinas por Sala
                        </CardTitle>
                        <CardDescription>
                            Define qué disciplinas están permitidas y se pueden programar en cada salón.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {ROOMS.map(room => (
                                <div key={room.id} className="flex flex-col border rounded-lg overflow-hidden bg-white dark:bg-slate-800">
                                    <div className="bg-slate-50 dark:bg-slate-900/50 p-3 border-b">
                                        <h3 className="font-bold text-slate-700 dark:text-slate-300">{room.name}</h3>
                                    </div>
                                    <div className="p-4 flex-1 space-y-3">
                                        {DISCIPLINES.map(discipline => (
                                            <div key={discipline} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`${room.id}-${discipline}`}
                                                    checked={roomDisciplines[room.id]?.includes(discipline) ?? false}
                                                    onCheckedChange={() => toggleDisciplineInRoom(room.id, discipline)}
                                                />
                                                <Label htmlFor={`${room.id}-${discipline}`} className="text-sm font-medium leading-none cursor-pointer">
                                                    {discipline}
                                                </Label>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border-t flex justify-end">
                                        <Button size="sm" disabled={saving === room.id} onClick={() => handleSaveRoomDisciplines(room.id)} className="gap-2">
                                            <Save className="h-3 w-3" />
                                            {saving === room.id ? "Guardando..." : "Guardar"}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Advanced Security & Speed Tools (Only visible in Development) */}
                {process.env.NODE_ENV === 'development' && (
                    <Card className="mt-8 border-none shadow-sm bg-slate-100 dark:bg-slate-800/40">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                                <ShieldCheck className="h-5 w-5 text-emerald-600" /> Herramientas de Rendimiento y Seguridad
                            </CardTitle>
                            <CardDescription>
                                Optimiza el sistema sincronizando los datos críticos entre la base de datos y el motor de autenticación.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col md:flex-row items-center justify-between p-6 bg-white dark:bg-slate-900 rounded-xl border border-dotted border-slate-300 dark:border-slate-700 gap-6">
                                <div className="space-y-2">
                                    <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                        Sincronización Global de Metadatos
                                    </h3>
                                    <p className="text-sm text-slate-500 max-w-xl">
                                        Esta herramienta actualizará los roles y nombres de **todos** los usuarios en Supabase Auth
                                        usando la información actual de la base de datos. Resuelve problemas de permisos y elimina
                                        la necesidad de consultas lentas a la tabla de usuarios durante la navegación.
                                    </p>
                                    <div className="flex items-center gap-2 text-[10px] text-amber-600 font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded w-fit">
                                        <AlertTriangle className="h-3 w-3" /> Usar solo cuando sea necesario (Ej: tras una migración)
                                    </div>
                                </div>
                                <Button
                                    onClick={handleSyncMetadata}
                                    disabled={saving === "sync-all"}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-12 px-6 shrink-0 shadow-lg shadow-emerald-600/20"
                                >
                                    <RefreshCw className={cn("h-5 w-5", saving === "sync-all" && "animate-spin")} />
                                    {saving === "sync-all" ? "Sincronizando..." : "Sincronizar Todos los Usuarios"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </main>
        </div>
    )
}
