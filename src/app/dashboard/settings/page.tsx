"use client"

import { useState, useEffect } from "react"
import { db } from "@/lib/storage"
import { ROOMS, Tier } from "@/constants/config"
import { Sidebar } from "@/components/shared/sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Trash2, Save, RotateCcw } from "lucide-react"
import { toast } from "sonner"

export default function SettingsPage() {
    const [roomSettings, setRoomSettings] = useState<Record<string, { privateRate: number, rates: Tier[] }>>({})

    useEffect(() => {
        const timer = setTimeout(() => {
            const settings = db.getSettings()
            const initialSettings: Record<string, { privateRate: number, rates: Tier[] }> = {}

            ROOMS.forEach(room => {
                const roomRates = settings?.roomRates?.[room.id]
                if (roomRates) {
                    initialSettings[room.id] = {
                        privateRate: roomRates.privateRate,
                        rates: [...roomRates.rates]
                    }
                } else {
                    initialSettings[room.id] = {
                        privateRate: room.privateRate,
                        rates: [...room.rates] as unknown as Tier[]
                    }
                }
            })
            setRoomSettings(initialSettings)
        }, 0)
        return () => clearTimeout(timer)
    }, [])

    const handleSave = (roomId: string) => {
        db.updateRoomRate(roomId, roomSettings[roomId])
        toast.success(`Configuración para ${ROOMS.find(r => r.id === roomId)?.name} guardada`)
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

    const resetToDefault = (roomId: string) => {
        const defaultRoom = ROOMS.find(r => r.id === roomId)
        if (defaultRoom) {
            const newSettings = { ...roomSettings }
            newSettings[roomId] = JSON.parse(JSON.stringify({
                privateRate: defaultRoom.privateRate,
                rates: defaultRoom.rates
            }))
            setRoomSettings(newSettings)
            toast.info("Valores restaurados a los predeterminados (sin guardar)")
        }
    }

    if (Object.keys(roomSettings).length === 0) return <div className="p-8">Cargando...</div>

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
            <Sidebar />
            <main className="flex-1 p-8 overflow-y-auto">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Configuración</h1>
                    <p className="text-slate-500">Administra las tarifas de pago por sala y disciplina.</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Tarifas por Sala</CardTitle>
                        <CardDescription>
                            Define cuánto se le paga al instructor según la cantidad de alumnas asistentes.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue={ROOMS[0].id} className="w-full">
                            <TabsList className="mb-4">
                                {ROOMS.map(room => (
                                    <TabsTrigger key={room.id} value={room.id}>
                                        {room.name}
                                    </TabsTrigger>
                                ))}
                            </TabsList>

                            {ROOMS.map(room => (
                                <TabsContent key={room.id} value={room.id} className="space-y-6">
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
                                                    value={roomSettings[room.id].privateRate}
                                                    onChange={(e) => updatePrivateRate(room.id, e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <Label className="text-base font-semibold">Tramos de Pago (Clases Normales)</Label>
                                                <Button size="sm" variant="outline" onClick={() => addTier(room.id)} className="gap-2">
                                                    <Plus className="h-4 w-4" /> Agregar Tramo
                                                </Button>
                                            </div>

                                            <div className="space-y-2">
                                                {roomSettings[room.id].rates.map((tier, idx) => (
                                                    <div key={idx} className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-md border">
                                                        <div className="grid gap-1 flex-1">
                                                            <span className="text-[10px] text-slate-500 uppercase font-bold">Min Alumnas</span>
                                                            <Input
                                                                type="number"
                                                                value={tier.min}
                                                                onChange={(e) => updateTier(room.id, idx, 'min', e.target.value)}
                                                            />
                                                        </div>
                                                        <div className="grid gap-1 flex-1">
                                                            <span className="text-[10px] text-slate-500 uppercase font-bold">Max (Vacio = +)</span>
                                                            <Input
                                                                type="number"
                                                                placeholder="∞"
                                                                value={tier.max === null ? "" : tier.max}
                                                                onChange={(e) => updateTier(room.id, idx, 'max', e.target.value)}
                                                            />
                                                        </div>
                                                        <div className="grid gap-1 flex-1">
                                                            <span className="text-[10px] text-slate-500 uppercase font-bold">Pago ($)</span>
                                                            <Input
                                                                type="number"
                                                                className="font-bold text-green-600"
                                                                value={tier.price}
                                                                onChange={(e) => updateTier(room.id, idx, 'price', e.target.value)}
                                                            />
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="mt-4 text-red-500 hover:bg-red-50"
                                                            onClick={() => removeTier(room.id, idx)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                                            <Button variant="ghost" className="gap-2" onClick={() => resetToDefault(room.id)}>
                                                <RotateCcw className="h-4 w-4" /> Restaurar
                                            </Button>
                                            <Button className="gap-2" onClick={() => handleSave(room.id)}>
                                                <Save className="h-4 w-4" /> Guardar Cambios
                                            </Button>
                                        </div>
                                    </div>
                                </TabsContent>
                            ))}
                        </Tabs>
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}
