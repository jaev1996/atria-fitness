import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// This script is intended to be run from the browser console or as a temporary utility
// To migrate localStorage data (atria_fitness_data_v3) to the database.
// Since we can't easily read localStorage from a node script, 
// we'll provide a function that can be called from the dashboard.

export async function migrateLocalToDb(localData: any) {
    console.log("Starting migration...", localData)

    try {
        // 1. Migrate Instructors (Users)
        for (const inst of localData.instructors) {
            await prisma.user.upsert({
                where: { email: inst.email || `${inst.id}@atria.com` },
                update: {
                    name: inst.name,
                    phone: inst.phone,
                    specialties: inst.specialties,
                    bio: inst.bio
                },
                create: {
                    id: inst.id,
                    name: inst.name,
                    email: inst.email || `${inst.id}@atria.com`,
                    phone: inst.phone,
                    role: 'INSTRUCTOR',
                    specialties: inst.specialties,
                    bio: inst.bio
                }
            })
        }

        // 2. Migrate Students
        for (const std of localData.students) {
            await prisma.student.create({
                data: {
                    id: std.id,
                    name: std.name,
                    email: std.email,
                    phone: std.phone,
                    status: std.status.toUpperCase() as any,
                    medicalInfo: std.medicalInfo,
                    allergies: std.allergies,
                    injuries: std.injuries,
                    conditions: std.conditions,
                    emergencyContact: std.emergencyContact,
                    sportsInfo: std.sportsInfo,
                    plans: {
                        create: std.plans.map((p: any) => ({
                            id: p.id,
                            discipline: p.disciplina,
                            credits: p.creditos,
                            isActive: p.activo,
                            originalName: p.nombreOriginal,
                        }))
                    },
                    payments: {
                        create: std.payments.map((py: any) => ({
                            id: py.id,
                            date: new Date(py.date),
                            amount: py.amount,
                            method: py.method.toUpperCase() as any,
                            concept: py.concept
                        }))
                    },
                    history: {
                        create: std.history.map((h: any) => ({
                            id: h.id,
                            date: new Date(h.date),
                            activity: h.activity,
                            notes: h.notes,
                            cost: h.cost
                        }))
                    }
                }
            })
        }

        // 3. Migrate Classes
        for (const cls of localData.classes) {
            await prisma.classSession.create({
                data: {
                    id: cls.id,
                    instructorId: cls.instructorId,
                    date: new Date(cls.date),
                    startTime: cls.startTime,
                    endTime: cls.endTime,
                    status: cls.status.toUpperCase() as any,
                    type: cls.type,
                    room: cls.room,
                    maxCapacity: cls.maxCapacity,
                    notes: cls.notes,
                    isPrivate: cls.isPrivate,
                    attendees: {
                        create: cls.attendees.map((a: any) => ({
                            studentId: a.studentId,
                            status: a.status.toUpperCase() as any,
                            attendanceType: a.attendanceType.toUpperCase() as any,
                            creditDeducted: a.creditDeducted
                        }))
                    }
                }
            })
        }

        // 4. Migrate Instructor Payments
        for (const pay of localData.instructorPayments) {
            await prisma.instructorPayment.create({
                data: {
                    id: pay.id,
                    instructorId: pay.instructorId,
                    date: new Date(pay.date),
                    amount: pay.amount,
                    startDate: new Date(pay.startDate),
                    endDate: new Date(pay.endDate),
                    notes: pay.notes,
                    classes: {
                        connect: pay.classIds.map((id: string) => ({ id }))
                    }
                }
            })
        }

        // 5. Settings
        if (localData.settings) {
            await prisma.settings.create({
                data: {
                    id: 'singleton',
                    disciplineRates: localData.settings.disciplineRates,
                    roomDisciplines: localData.settings.roomDisciplines
                }
            })
        }

        console.log("Migration finished successfully!")
    } catch (error) {
        console.error("Migration failed:", error)
    }
}
