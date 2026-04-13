"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { DISCIPLINES, ROOMS, Tier } from "@/constants/config"
import { Prisma } from "@prisma/client"
import { ensureRole } from "@/lib/auth-utils"
import { UpdateDisciplineRateSchema, UpdateRoomDisciplinesSchema } from "@/lib/schemas"
import { fetchBCVRates } from "@/lib/exchange-rate"

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
    let existing = await prisma.settings.findUnique({ where: { id: 'singleton' } })

    if (!existing) {
        const initialRates = await fetchBCVRates()
        existing = await prisma.settings.create({
            data: {
                id: 'singleton',
                disciplineRates: toJson(DEFAULT_DISCIPLINE_RATES),
                roomDisciplines: toJson(DEFAULT_ROOM_DISCIPLINES),
                currency: '$',
                usdRate: initialRates?.usd,
                eurRate: initialRates?.eur,
                rateUpdatedAt: initialRates?.lastUpdated
            }
        })
    }

    // 1. Back-fill any new disciplines added to DISCIPLINES constant
    const disciplineRates = (existing.disciplineRates as unknown as Record<string, { privateRate: number; rates: Tier[] }>) ?? {}
    const missingDisciplines = DISCIPLINES.filter(d => !disciplineRates[d])

    if (missingDisciplines.length > 0) {
        missingDisciplines.forEach(d => { disciplineRates[d] = DEFAULT_DISCIPLINE_RATES[d] })
        existing = await prisma.settings.update({
            where: { id: 'singleton' },
            data: { disciplineRates: toJson(disciplineRates) }
        })
    }

    // 2. Exchange Rate Auto-Refresh (Lazy)
    const oneHourAgo = new Date(Date.now() - 3600 * 1000)
    const needsRefresh = !existing.rateUpdatedAt || existing.rateUpdatedAt < oneHourAgo

    if (needsRefresh) {
        console.log("Exchange rates expired, refreshing...")
        const rates = await fetchBCVRates()
        if (rates) {
            existing = await prisma.settings.update({
                where: { id: 'singleton' },
                data: {
                    usdRate: rates.usd,
                    eurRate: rates.eur,
                    rateUpdatedAt: rates.lastUpdated
                }
            })
        }
    }

    return existing
}

export async function refreshExchangeRates() {
    await ensureRole(['admin'])
    const rates = await fetchBCVRates()
    if (!rates) throw new Error("No se pudieron obtener las tasas actuales del BCV.")
    
    await prisma.settings.upsert({
        where: { id: 'singleton' },
        update: {
            usdRate: rates.usd,
            eurRate: rates.eur,
            rateUpdatedAt: rates.lastUpdated
        },
        create: {
            id: 'singleton',
            usdRate: rates.usd,
            eurRate: rates.eur,
            rateUpdatedAt: rates.lastUpdated,
            disciplineRates: toJson(DEFAULT_DISCIPLINE_RATES),
            roomDisciplines: toJson(DEFAULT_ROOM_DISCIPLINES),
            currency: '$'
        }
    })
    
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/settings')
    revalidatePath('/dashboard/instructors')
    return { success: true }
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
            currency: '$'
        }
    })
    revalidatePath('/dashboard/settings')
}

export async function updateCurrency(currency: string) {
    await ensureRole(['admin'])
    await prisma.settings.upsert({
        where: { id: 'singleton' },
        update: { currency },
        create: {
            id: 'singleton',
            disciplineRates: toJson(DEFAULT_DISCIPLINE_RATES),
            roomDisciplines: toJson(DEFAULT_ROOM_DISCIPLINES),
            currency
        }
    })
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/settings')
    revalidatePath('/dashboard/instructors')
    revalidatePath('/dashboard/profile')
    revalidatePath('/dashboard/students')
}
