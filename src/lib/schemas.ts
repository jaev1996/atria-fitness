/**
 * schemas.ts
 * -----------
 * Esquemas de validación en tiempo de ejecución con Zod.
 * Cada esquema define exactamente qué forma y tipo de dato se espera
 * recibir en los Server Actions, protegiendo la base de datos de entradas
 * malformadas o maliciosas independientemente del tipado TypeScript.
 */

import { z } from 'zod'
import { DISCIPLINES, ROOMS } from '@/constants/config'

// ── Utilities ────────────────────────────────────────────────────────────────

/** ID de Supabase/Prisma: CUID o UUID */
const idSchema = z.string().refine(
    (val) => {
        // CUID validation (starts with c, 25-30 chars usually, or new cuid2)
        const isCuid = /^c[^\s-]{8,}$/i.test(val);
        // UUID validation
        const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(val);
        return isCuid || isUuid;
    },
    { message: 'El ID proporcionado no tiene un formato válido (debe ser UUID o CUID).' }
);

/** Fecha en formato "YYYY-MM-DD" */
const dateStrSchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha debe tener el formato YYYY-MM-DD.' })

/** Hora en formato "HH:MM" */
const timeStrSchema = z
    .string()
    .regex(/^\d{2}:\d{2}$/, { message: 'La hora debe tener el formato HH:MM.' })

// Disciplinas válidas extraídas de las constantes del sistema.
// Usamos .refine() para evitar problemas con arrays readonly de TypeScript con z.enum().
const disciplineValues: readonly string[] = DISCIPLINES
const disciplineSchema = z
    .string()
    .refine((v) => disciplineValues.includes(v), { message: 'La disciplina seleccionada no es válida.' })

// Salas válidas extraídas de las constantes del sistema
const roomIdValues: string[] = ROOMS.map(r => r.id)
const roomIdSchema = z
    .string()
    .refine((v) => roomIdValues.includes(v), { message: 'La sala seleccionada no es válida.' })

// ── Estudiantes ───────────────────────────────────────────────────────────────

const VALID_PLANS = ['Sin Plan', 'Clase Suelta', 'Pack 4 Clases', 'Pack 8 Clases', 'Pack 12 Clases', 'Pack 24 Clases', 'Ilimitado'] as const

export const AddStudentSchema = z.object({
    name: z.string().min(1, 'El nombre es obligatorio.').max(100, 'El nombre es demasiado largo.').trim(),
    phone: z.string().min(1, 'El teléfono es obligatorio.').max(30, 'Número de teléfono inválido.').trim(),
    email: z.string().email('El correo no tiene un formato válido.').max(200).trim().optional().or(z.literal('')),
    planType: z.enum(VALID_PLANS).optional(),
    discipline: z.string().max(100).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
    medicalInfo: z.string().max(2000).optional(),
    allergies: z.string().max(500).optional(),
    injuries: z.string().max(500).optional(),
    conditions: z.string().max(500).optional(),
    emergencyContact: z.string().max(200).optional(),
    sportsInfo: z.string().max(1000).optional(),
})

export const ProcessPaymentSchema = z.object({
    studentId: idSchema,
    // Zod v4: error message for wrong type uses `message` directly on number()
    amount: z.number().positive('El monto debe ser positivo.').max(9999, 'El monto parece inusualmente alto.'),
    method: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'OTRO'], { message: 'Método de pago inválido.' }),
    planName: z.string().min(1).max(100),
    credits: z.number().int('Los créditos deben ser un número entero.').positive().max(9999),
    discipline: z.string().max(100).optional(),
})

export const AddHistoryEntrySchema = z.object({
    activity: z.string().min(1, 'La actividad es obligatoria.').max(200).trim(),
    notes: z.string().max(1000).optional(),
    cost: z.number().nonnegative().max(9999).optional(),
})

// ── Clases ───────────────────────────────────────────────────────────────────

export const AddClassSchema = z.object({
    instructorId: idSchema,
    date: dateStrSchema,
    startTime: timeStrSchema,
    type: disciplineSchema,
    room: roomIdSchema,
    maxCapacity: z.number().int().min(1, 'Mínimo 1 persona.').max(100, 'Capacidad máxima excedida.'),
    notes: z.string().max(500).optional(),
    isPrivate: z.boolean().optional(),
})

export const EnrollStudentSchema = z.object({
    classId: idSchema,
    studentId: idSchema,
    type: z.enum(['STANDARD', 'COURTESY']).optional(),
})

export const RemoveAttendeeSchema = z.object({
    classId: idSchema,
    studentId: idSchema,
})

// ── Instructores ─────────────────────────────────────────────────────────────

export const AddInstructorSchema = z.object({
    name: z.string().min(1, 'El nombre es obligatorio.').max(100).trim(),
    email: z.string().email('El correo no tiene un formato válido.').max(200).trim(),
    phone: z.string().max(30).optional(),
    specialties: z.array(z.string().max(100)).max(20, 'Demasiadas especialidades.').default([]),
    bio: z.string().max(2000).optional(),
})

export const AddInstructorPaymentSchema = z.object({
    instructorId: idSchema,
    amount: z.number().positive('El monto debe ser positivo.').max(99999),
    startDate: dateStrSchema,
    endDate: dateStrSchema,
    classIds: z.array(idSchema).min(1, 'Debes seleccionar al menos una clase.'),
    notes: z.string().max(500).optional(),
})

// ── Configuración ─────────────────────────────────────────────────────────────

export const TierSchema = z.object({
    min: z.number().int().nonnegative(),
    max: z.number().int().positive().nullable(),
    price: z.number().nonnegative().max(9999),
})

export const UpdateDisciplineRateSchema = z.object({
    discipline: z.string().min(1).max(100),
    data: z.object({
        privateRate: z.number().nonnegative().max(9999),
        rates: z.array(TierSchema).max(10),
    }),
})

export const UpdateRoomDisciplinesSchema = z.object({
    roomId: roomIdSchema,
    disciplines: z.array(z.string().max(100)).max(20),
})
