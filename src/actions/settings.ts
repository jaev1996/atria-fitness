"use server"

import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function getSettings() {
    return await prisma.settings.findUnique({
        where: { id: 'singleton' }
    })
}

export async function updateDisciplineRate(discipline: string, data: any) {
    const current = await prisma.settings.findUnique({ where: { id: 'singleton' } })
    const disciplineRates = (current?.disciplineRates as any) || {}
    disciplineRates[discipline] = data

    await prisma.settings.upsert({
        where: { id: 'singleton' },
        update: { disciplineRates },
        create: { id: 'singleton', disciplineRates }
    })
    revalidatePath('/dashboard')
}

export async function updateRoomDisciplines(roomId: string, disciplines: string[]) {
    const current = await prisma.settings.findUnique({ where: { id: 'singleton' } })
    const roomDisciplines = (current?.roomDisciplines as any) || {}
    roomDisciplines[roomId] = disciplines

    await prisma.settings.upsert({
        where: { id: 'singleton' },
        update: { roomDisciplines },
        create: { id: 'singleton', roomDisciplines }
    })
    revalidatePath('/dashboard')
}
