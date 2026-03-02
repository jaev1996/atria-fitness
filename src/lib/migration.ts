import {
    PrismaClient,
    StudentStatus,
    PaymentMethod,
    ClassStatus,
    AttendanceStatus,
    AttendanceType
} from '@prisma/client'

const prisma = new PrismaClient()

interface LocalPlan {
    id: string;
    disciplina: string;
    creditos: number;
    activo: boolean;
    nombreOriginal: string;
}

interface LocalPayment {
    id: string;
    date: string;
    amount: number;
    method: string;
    concept: string;
}

interface LocalHistory {
    id: string;
    date: string;
    activity: string;
    notes: string;
    cost: number;
}

interface LocalAttendee {
    studentId: string;
    status: string;
    attendanceType: string;
    creditDeducted: boolean;
}

interface LocalInstructor {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    specialties: string[];
    bio?: string;
}

interface LocalStudent {
    id: string;
    name: string;
    email: string;
    phone: string;
    status: string;
    medicalInfo?: string;
    allergies?: string;
    injuries?: string;
    conditions?: string;
    emergencyContact?: string;
    sportsInfo?: string;
    plans: LocalPlan[];
    payments: LocalPayment[];
    history: LocalHistory[];
}

interface LocalClass {
    id: string;
    instructorId: string;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
    type: string;
    room: string;
    maxCapacity: number;
    notes: string;
    isPrivate: boolean;
    attendees: LocalAttendee[];
}

interface LocalInstructorPayment {
    id: string;
    instructorId: string;
    date: string;
    amount: number;
    startDate: string;
    endDate: string;
    notes: string;
    classIds: string[];
}

interface LocalSettings {
    disciplineRates: Record<string, number>;
    roomDisciplines: Record<string, string[]>;
}

interface LocalData {
    instructors: LocalInstructor[];
    students: LocalStudent[];
    classes: LocalClass[];
    instructorPayments: LocalInstructorPayment[];
    settings?: LocalSettings;
}

// This script is intended to be run from the browser console or as a temporary utility
// To migrate localStorage data (atria_fitness_data_v3) to the database.
// Since we can't easily read localStorage from a node script, 
// we'll provide a function that can be called from the dashboard.

export async function migrateLocalToDb(localData: LocalData) {
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
            await prisma.user.create({
                data: {
                    id: std.id,
                    name: std.name,
                    email: std.email,
                    phone: std.phone,
                    role: 'STUDENT',
                    status: std.status.toUpperCase() as StudentStatus,
                    medicalInfo: std.medicalInfo,
                    allergies: std.allergies,
                    injuries: std.injuries,
                    conditions: std.conditions,
                    emergencyContact: std.emergencyContact,
                    sportsInfo: std.sportsInfo,
                    plans: {
                        create: std.plans.map((p: LocalPlan) => ({
                            id: p.id,
                            discipline: p.disciplina,
                            credits: p.creditos,
                            isActive: p.activo,
                            originalName: p.nombreOriginal,
                        }))
                    },
                    paymentsMade: {
                        create: std.payments.map((py: LocalPayment) => ({
                            id: py.id,
                            date: new Date(py.date),
                            amount: py.amount,
                            method: py.method.toUpperCase() as PaymentMethod,
                            concept: py.concept
                        }))
                    },
                    history: {
                        create: std.history.map((h: LocalHistory) => ({
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
                    status: cls.status.toUpperCase() as ClassStatus,
                    type: cls.type,
                    room: cls.room,
                    maxCapacity: cls.maxCapacity,
                    notes: cls.notes,
                    isPrivate: cls.isPrivate,
                    attendees: {
                        create: cls.attendees.map((a: LocalAttendee) => ({
                            studentId: a.studentId,
                            status: a.status.toUpperCase() as AttendanceStatus,
                            attendanceType: a.attendanceType.toUpperCase() as AttendanceType,
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

