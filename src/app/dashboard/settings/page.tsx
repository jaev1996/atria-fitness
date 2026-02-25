"use client"

import { useState, useEffect } from "react"
import { db } from "@/lib/storage"
import { DISCIPLINES, ROOMS, Tier } from "@/constants/config"
import { Sidebar } from "@/components/shared/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Trash2, Save, RotateCcw, Layout } from "lucide-react"
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"

export default function SettingsPage() {
    const [roomSettings, setRoomSettings] = useState<Record<string, { privateRate: number, rates: Tier[] }>>({})
    const [roomDisciplines, setRoomDisciplines] = useState<Record<string, string[]>>({})

    useEffect(() => {
        const timer = setTimeout(() => {
            const settings = db.getSettings()
            const initialSettings: Record<string, { privateRate: number, rates: Tier[] }> = {}

            DISCIPLINES.forEach(discipline => {
                const disciplineRates = settings?.disciplineRates?.[discipline]
                if (disciplineRates) {
                    initialSettings[discipline] = {
                        privateRate: disciplineRates.privateRate,
                        rates: [...disciplineRates.rates]
                    }
                } else {
                    initialSettings[discipline] = {
                        privateRate: 25,
                        rates: [
                            { min: 1, max: 2, price: 10 },
                            { min: 3, max: 4, price: 15 },
                            { min: 5, max: null, price: 20 }
                        ]
                    }
                }
            })
            setRoomSettings(initialSettings)

            const initialRoomDisciplines: Record<string, string[]> = {}
            ROOMS.forEach(room => {
                initialRoomDisciplines[room.id] = settings?.roomDisciplines?.[room.id] || [...room.disciplines]
            })
            setRoomDisciplines(initialRoomDisciplines)
        }, 0)
        return () => clearTimeout(timer)
    }, [])

    const handleSave = (discipline: string) => {
        db.updateDisciplineRate(discipline, roomSettings[discipline])
        toast.success(`Configuración para ${discipline} guardada`)
    }

    const addTier = (roomId: string) => {
        const newSettings = { ...roomSettings }
        newSettings[roomId].rates.push({ min: 1, max: null, price: 0 })
        setRoomSettings(newSettings)
    }

    const removeTier = (roomId: string, index: number) => {
        const newSettings = { ...roomSettings }
        newSettings[roomId].rates.splice(index, 1)
        setRoomSettings(newSettings)
    }

    const updateTier = (roomId: string, index: number, field: keyof Tier, value: string) => {
        const newSettings = { ...roomSettings }
        const tier = newSettings[roomId].rates[index]

        if (field === 'max') {
            tier[field] = value === "" ? null : parseInt(value)
        } else if (field === 'min' || field === 'price') {
            tier[field] = parseInt(value) || 0
        }

        setRoomSettings(newSettings)
    }

    const updatePrivateRate = (roomId: string, value: string) => {
        const newSettings = { ...roomSettings }
        newSettings[roomId].privateRate = parseInt(value) || 0
        setRoomSettings(newSettings)
    }

    const handleSaveRoomDisciplines = (roomId: string) => {
        db.updateRoomDisciplines(roomId, roomDisciplines[roomId])
        toast.success(`Distribución de clases guardada`)
    }

    const toggleDisciplineInRoom = (roomId: string, discipline: string) => {
        const current = roomDisciplines[roomId] || []
        const next = current.includes(discipline)
            ? current.filter(d => d !== discipline)
            : [...current, discipline]

        setRoomDisciplines({
            ...roomDisciplines,
            [roomId]: next
        })
    }

    const resetToDefault = (discipline: string) => {
        const newSettings = { ...roomSettings }
        newSettings[discipline] = {
            privateRate: 25,
            rates: [
                { min: 1, max: 2, price: 10 },
                { min: 3, max: 4, price: 15 },
                { min: 5, max: null, price: 20 }
            ]
        }
        setRoomSettings(newSettings)
        toast.info("Valores restaurados a los predeterminados (sin guardar)")
    }

    if (Object.keys(roomSettings).length === 0) return <div className="p-8">Cargando...</div>

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
            <Sidebar />
            <main className="flex-1 p-8 overflow-y-auto">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Configuración</h1>
                    <p className="text-slate-500">Administra las tarifas de pago por disciplina.</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Tarifas por Disciplina</CardTitle>
                        <CardDescription>
                            Define cuánto se le paga al instructor según la disciplina que imparte y la cantidad de alumnas asistentes.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue={DISCIPLINES[0]} className="w-full">
                            <TabsList className="mb-4 flex-wrap h-auto">
                                {DISCIPLINES.map(discipline => (
                                    <TabsTrigger key={discipline} value={discipline}>
                                        {discipline}
                                    </TabsTrigger>
                                ))}
                            </TabsList>

                            {DISCIPLINES.map(discipline => (
                                <TabsContent key={discipline} value={discipline} className="space-y-6">
                                    <div className="grid gap-4 p-4 border rounded-lg bg-white dark:bg-slate-800">
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
                                                    value={roomSettings[discipline].privateRate}
                                                    onChange={(e) => updatePrivateRate(discipline, e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <Label className="text-base font-semibold">Tramos de Pago (Clases Normales)</Label>
                                                <Button size="sm" variant="outline" onClick={() => addTier(discipline)} className="gap-2">
                                                    <Plus className="h-4 w-4" /> Agregar Tramo
                                                </Button>
                                            </div>

                                            <div className="space-y-2">
                                                {roomSettings[discipline].rates.map((tier, idx) => (
                                                    <div key={idx} className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-md border">
                                                        <div className="grid gap-1 flex-1">
                                                            <span className="text-[10px] text-slate-500 uppercase font-bold">Min Alumnas</span>
                                                            <Input
                                                                type="number"
                                                                value={tier.min}
                                                                onChange={(e) => updateTier(discipline, idx, 'min', e.target.value)}
                                                            />
                                                        </div>
                                                        <div className="grid gap-1 flex-1">
                                                            <span className="text-[10px] text-slate-500 uppercase font-bold">Max (Vacio = +)</span>
                                                            <Input
                                                                type="number"
                                                                placeholder="∞"
                                                                value={tier.max === null ? "" : tier.max}
                                                                onChange={(e) => updateTier(discipline, idx, 'max', e.target.value)}
                                                            />
                                                        </div>
                                                        <div className="grid gap-1 flex-1">
                                                            <span className="text-[10px] text-slate-500 uppercase font-bold">Pago ($)</span>
                                                            <Input
                                                                type="number"
                                                                className="font-bold text-green-600"
                                                                value={tier.price}
                                                                onChange={(e) => updateTier(discipline, idx, 'price', e.target.value)}
                                                            />
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="mt-4 text-red-500 hover:bg-red-50"
                                                            onClick={() => removeTier(discipline, idx)}
                                                        >
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
                                            <Button className="gap-2" onClick={() => handleSave(discipline)}>
                                                <Save className="h-4 w-4" /> Guardar Cambios
                                            </Button>
                                        </div>
                                    </div>
                                </TabsContent>
                            ))}
                        </Tabs>
                    </CardContent>
                </Card>

                <Card className="mt-8">
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
                                                    checked={roomDisciplines[room.id]?.includes(discipline)}
                                                    onCheckedChange={() => toggleDisciplineInRoom(room.id, discipline)}
                                                />
                                                <Label
                                                    htmlFor={`${room.id}-${discipline}`}
                                                    className="text-sm font-medium leading-none cursor-pointer"
                                                >
                                                    {discipline}
                                                </Label>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border-t flex justify-end">
                                        <Button size="sm" onClick={() => handleSaveRoomDisciplines(room.id)} className="gap-2">
                                            <Save className="h-3 w-3" /> Guardar
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}
