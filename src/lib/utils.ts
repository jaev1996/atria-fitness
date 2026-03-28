import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDateUTC(date: Date | string | null | undefined) {
    if (!date) return "-"
    const d = new Date(date)
    return `${d.getUTCDate().toString().padStart(2, '0')}/${(d.getUTCMonth() + 1).toString().padStart(2, '0')}/${d.getUTCFullYear()}`
}

export function formatDateLocal(date: Date | string | null | undefined) {
    if (!date) return "-"
    const d = new Date(date)
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`
}

/**
 * Convierte un error de validación de Zod en un mensaje legible y amigable en español.
 */
export function formatZodError(error: unknown): string {
    if (!(error instanceof Error) || error.name !== 'ZodError') {
        return error instanceof Error ? error.message : "Error de validación desconocido."
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zodError = error as any
    if (zodError.errors && Array.isArray(zodError.errors) && zodError.errors.length > 0) {
        // Retornamos el primer mensaje de error encontrado
        return zodError.errors[0].message
    }

    return "Los datos proporcionados no son válidos."
}

/**
 * Convierte una hora en formato 24h (HH:mm) a formato 12h (h:mm AM/PM).
 */
export function formatTimeAMPM(time24: string | null | undefined): string {
    if (!time24) return "-"
    try {
        const [hoursStr, minutesStr] = time24.split(":")
        let hours = parseInt(hoursStr)
        const ampm = hours >= 12 ? "PM" : "AM"
        hours = hours % 12
        hours = hours ? hours : 12 // la hora '0' debe ser '12'
        return `${hours}:${minutesStr} ${ampm}`
    } catch {
        return time24
    }
}
