"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { DISCIPLINES, ROOMS, Tier } from "@/constants/config"
import { Prisma } from "@prisma/client"
import { ensureRole } from "@/lib/auth-utils"
import { UpdateDisciplineRateSchema, UpdateRoomDisciplinesSchema } from "@/lib/schemas"

// ── Default rates used when no settings exist in DB ───────────────────────────
const DEFAULT_DISCIPLINE_RATES: Record<string, { privateRate: number; rates: Tier[] }> = Object.fromEntries(
    DISCIPLINES.map(d => [
        d,
        {
            privateRate: 25,
            rates: [
                { min: 1, max: 2, price: 10 },
                { min: 3, max: 4, price: 15 },
                { min: 5, max: null, price: 20 },
            ],
        },
    ])
)

const DEFAULT_ROOM_DISCIPLINES: Record<string, string[]> = Object.fromEntries(
    ROOMS.map(r => [r.id, [...r.disciplines]])
)

// Helper: cast to Prisma JsonValue safely
const toJson = (v: unknown) => v as Prisma.InputJsonValue

// ── Actions ───────────────────────────────────────────────────────────────────

/**
 * Returns the current settings. If none exist, seeds them with defaults so that
 * payment calculations always have real rates to work with.
 */
export async function getSettings() {
    // Both admin and instructor need settings for calendar disciplines
    await ensureRole(['admin', 'instructor'])
    const existing = await prisma.settings.findUnique({ where: { id: 'singleton' } })

    if (existing) {
        // Back-fill any new disciplines added to DISCIPLINES constant
        const rates = (existing.disciplineRates as unknown as Record<string, { privateRate: number; rates: Tier[] }>) ?? {}
        const missingDisciplines = DISCIPLINES.filter(d => !rates[d])

        if (missingDisciplines.length > 0) {
            missingDisciplines.forEach(d => { rates[d] = DEFAULT_DISCIPLINE_RATES[d] })
            await prisma.settings.update({
                where: { id: 'singleton' },
                data: { disciplineRates: toJson(rates) }
            })
            return { ...existing, disciplineRates: rates }
        }

        return existing
    }

    // First access — create with all defaults
    return await prisma.settings.create({
        data: {
            id: 'singleton',
            disciplineRates: toJson(DEFAULT_DISCIPLINE_RATES),
            roomDisciplines: toJson(DEFAULT_ROOM_DISCIPLINES),
        }
    })
}

export async function updateDisciplineRate(discipline: string, data: { privateRate: number; rates: Tier[] }) {
    await ensureRole(['admin'])
    UpdateDisciplineRateSchema.parse({ discipline, data })
    const current = await prisma.settings.findUnique({ where: { id: 'singleton' } })
    const disciplineRates = { ...(current?.disciplineRates as Record<string, unknown> ?? {}), [discipline]: data }

    await prisma.settings.upsert({
        where: { id: 'singleton' },
        update: { disciplineRates: toJson(disciplineRates) },
        create: {
            id: 'singleton',
            disciplineRates: toJson({ ...DEFAULT_DISCIPLINE_RATES, [discipline]: data }),
            roomDisciplines: toJson(DEFAULT_ROOM_DISCIPLINES),
        }
    })
    revalidatePath('/dashboard/settings')
    revalidatePath('/dashboard/instructors')
    revalidatePath('/dashboard/profile')
}

export async function updateRoomDisciplines(roomId: string, disciplines: string[]) {
    await ensureRole(['admin'])
    UpdateRoomDisciplinesSchema.parse({ roomId, disciplines })
    const current = await prisma.settings.findUnique({ where: { id: 'singleton' } })
    const roomDisciplines = { ...(current?.roomDisciplines as Record<string, unknown> ?? {}), [roomId]: disciplines }

    await prisma.settings.upsert({
        where: { id: 'singleton' },
        update: { roomDisciplines: toJson(roomDisciplines) },
        create: {
            id: 'singleton',
            disciplineRates: toJson(DEFAULT_DISCIPLINE_RATES),
            roomDisciplines: toJson({ ...DEFAULT_ROOM_DISCIPLINES, [roomId]: disciplines }),
        }
    })
    revalidatePath('/dashboard/settings')
}
