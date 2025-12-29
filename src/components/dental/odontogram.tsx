"use client"

import React, { useState, useEffect } from "react"
import { ToothState, ToothStatus, Patient, db } from "@/lib/storage"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Ban, Eraser } from "lucide-react"

// FDI Notation
// Upper Right (Q1): 18, 17, 16, 15, 14, 13, 12, 11
// Upper Left (Q2): 21, 22, 23, 24, 25, 26, 27, 28
// Lower Right (Q4): 48, 47, 46, 45, 44, 43, 42, 41
// Lower Left (Q3): 31, 32, 33, 34, 35, 36, 37, 38

const QUADRANTS = {
    q1: [18, 17, 16, 15, 14, 13, 12, 11],
    q2: [21, 22, 23, 24, 25, 26, 27, 28],
    q4: [48, 47, 46, 45, 44, 43, 42, 41],
    q3: [31, 32, 33, 34, 35, 36, 37, 38]
}

const COLORS = {
    healthy: "fill-white",
    caries: "fill-red-500",
    filled: "fill-blue-500"
}

type ToothProps = {
    id: number
    data: ToothState
    onChange: (id: number, face: keyof ToothState['faces'] | 'status', value: any) => void
}

const Tooth = ({ id, data, onChange }: ToothProps) => {
    const isMissing = data.status === 'missing'

    const handleFaceClick = (face: keyof ToothState['faces']) => {
        if (isMissing) return

        // Cycle: healthy -> caries -> filled -> healthy
        const current = data.faces[face]
        let next: ToothStatus = 'healthy'
        if (current === 'healthy') next = 'caries'
        else if (current === 'caries') next = 'filled'

        onChange(id, face, next)
    }

    const toggleMissing = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation() // Prevent face click
        onChange(id, 'status', isMissing ? 'present' : 'missing')
    }

    return (
        <div className="flex flex-col items-center gap-1 group relative">
            <div className="text-xs text-slate-500 font-medium mb-1">{id}</div>

            {/* Visual Representation */}
            <div
                className={`relative w-10 h-10 ${isMissing ? 'opacity-50' : ''}`}
                onContextMenu={toggleMissing}
            >
                <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm cursor-pointer">
                    {/* Top Face */}
                    <polygon
                        points="0,0 100,0 75,25 25,25"
                        className={`${COLORS[data.faces.top]} stroke-slate-300 stroke-1 hover:brightness-95 transition-all`}
                        onClick={() => handleFaceClick('top')}
                    />
                    {/* Right Face (Visual Right) */}
                    <polygon
                        points="100,0 100,100 75,75 75,25"
                        className={`${COLORS[data.faces.right]} stroke-slate-300 stroke-1 hover:brightness-95 transition-all`}
                        onClick={() => handleFaceClick('right')}
                    />
                    {/* Bottom Face */}
                    <polygon
                        points="100,100 0,100 25,75 75,75"
                        className={`${COLORS[data.faces.bottom]} stroke-slate-300 stroke-1 hover:brightness-95 transition-all`}
                        onClick={() => handleFaceClick('bottom')}
                    />
                    {/* Left Face (Visual Left) */}
                    <polygon
                        points="0,100 0,0 25,25 25,75"
                        className={`${COLORS[data.faces.left]} stroke-slate-300 stroke-1 hover:brightness-95 transition-all`}
                        onClick={() => handleFaceClick('left')}
                    />
                    {/* Center Face */}
                    <rect
                        x="25" y="25" width="50" height="50"
                        className={`${COLORS[data.faces.center]} stroke-slate-300 stroke-1 hover:brightness-95 transition-all`}
                        onClick={() => handleFaceClick('center')}
                    />

                    {/* Missing X Overlay */}
                    {isMissing && (
                        <line x1="0" y1="0" x2="100" y2="100" className="stroke-red-600 stroke-[4]" />
                    )}
                    {isMissing && (
                        <line x1="100" y1="0" x2="0" y2="100" className="stroke-red-600 stroke-[4]" />
                    )}
                </svg>
            </div>

            {/* Hover action for non-right-clickers */}
            <button
                onClick={toggleMissing}
                className="opacity-0 group-hover:opacity-100 absolute -bottom-4 bg-slate-800 text-white rounded-full p-1 transition-opacity z-10"
                title={isMissing ? "Restaurar" : "Marcar Ausente"}
            >
                <Ban className="w-3 h-3" />
            </button>
        </div>
    )
}

export function Odontogram({ patientId }: { patientId: string }) {
    const [teeth, setTeeth] = useState<Record<number, ToothState>>({})
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Initialize or load
        const patient = db.getPatient(patientId)
        if (patient) {
            if (patient.odontogram) {
                setTeeth(patient.odontogram)
            } else {
                // Init empty odontogram
                const initialTeeth: Record<number, ToothState> = {}
                const allTeeth = [...QUADRANTS.q1, ...QUADRANTS.q2, ...QUADRANTS.q4, ...QUADRANTS.q3]
                allTeeth.forEach(id => {
                    initialTeeth[id] = {
                        id,
                        status: 'present',
                        faces: { center: 'healthy', top: 'healthy', bottom: 'healthy', left: 'healthy', right: 'healthy' }
                    }
                })
                setTeeth(initialTeeth)
            }
        }
        setLoading(false)
    }, [patientId])

    const handleToothChange = (id: number, face: keyof ToothState['faces'] | 'status', value: any) => {
        setTeeth(prev => {
            const newTeeth = { ...prev }
            if (!newTeeth[id]) return prev

            if (face === 'status') {
                newTeeth[id] = { ...newTeeth[id], status: value }
            } else {
                newTeeth[id] = {
                    ...newTeeth[id],
                    faces: { ...newTeeth[id].faces, [face]: value }
                }
            }
            return newTeeth
        })
    }

    const saveOdontogram = () => {
        const patient = db.getPatient(patientId)
        if (patient) {
            patient.odontogram = teeth
            // We need to save the specific patient back to the list
            // Since our storage logic is simple 'getAll' / 'save all', we need a way to update one patient.
            // We can reuse addPatient logic but that adds duplicates, we need 'updatePatient'.
            // Or manually do it here since we have direct access to 'db' but db doesn't have updatePatient exposed clearly.
            // Let's implement a quick manual save using db.getAll() logic inline or extend db.

            const state = db.getAll()
            const pIndex = state.patients.findIndex((p: Patient) => p.id === patientId)
            if (pIndex >= 0) {
                state.patients[pIndex].odontogram = teeth
                db.save(state)
                // Ideally trigger a toast here
            }
        }
    }

    // Auto-save effect or Save Button?
    // Let's use a Save Button for clarity, or auto-save on unmount.
    // For prototype, specific Save button is safer.

    if (loading) return <div>Cargando odontograma...</div>

    return (
        <div className="space-y-8 p-4 bg-white rounded-lg border shadow-sm max-w-full overflow-x-auto">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Odontograma</h3>
                <Button onClick={saveOdontogram} size="sm" className="bg-blue-600">Guardar Cambios</Button>
            </div>

            <div className="min-w-[700px] flex flex-col gap-12 items-center">
                {/* Upper Arch */}
                <div className="flex gap-16">
                    {/* Q1 Right (Visual Left) */}
                    <div className="flex gap-2">
                        {QUADRANTS.q1.map(id => (
                            teeth[id] && <Tooth key={id} id={id} data={teeth[id]} onChange={handleToothChange} />
                        ))}
                    </div>
                    {/* Q2 Left (Visual Right) */}
                    <div className="flex gap-2">
                        {QUADRANTS.q2.map(id => (
                            teeth[id] && <Tooth key={id} id={id} data={teeth[id]} onChange={handleToothChange} />
                        ))}
                    </div>
                </div>

                {/* Lower Arch */}
                <div className="flex gap-16">
                    {/* Q4 Right (Visual Left) */}
                    <div className="flex gap-2">
                        {QUADRANTS.q4.map(id => (
                            teeth[id] && <Tooth key={id} id={id} data={teeth[id]} onChange={handleToothChange} />
                        ))}
                    </div>
                    {/* Q3 Left (Visual Right) */}
                    <div className="flex gap-2">
                        {QUADRANTS.q3.map(id => (
                            teeth[id] && <Tooth key={id} id={id} data={teeth[id]} onChange={handleToothChange} />
                        ))}
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="flex justify-center gap-8 text-sm mt-8 border-t pt-4">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border border-slate-300 bg-white"></div>
                    <span>Sano</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border border-slate-300 bg-red-500"></div>
                    <span>Caries</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border border-slate-300 bg-blue-500"></div>
                    <span>Obturado</span>
                </div>
                <div className="flex items-center gap-2">
                    <Ban className="w-4 h-4 text-red-600" />
                    <span>Ausente (Click Derecho)</span>
                </div>
            </div>
        </div>
    )
}
