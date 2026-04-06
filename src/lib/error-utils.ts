import { Prisma } from "@prisma/client"

/**
 * Convierte errores técnicos de base de datos o lógica en mensajes amigables para el usuario en español.
 */
export function handleActionError(error: unknown, fallbackMessage = "Ocurrió un error inesperado al procesar la solicitud."): never {
    console.error("Action Error Details:", error)

    // 1. Prisma Errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
            case 'P2002': {
                const targets = (error.meta?.target as string[]) || []
                if (targets.includes('email')) throw new Error("Este correo electrónico ya está registrado.")
                if (targets.includes('phone')) throw new Error("Este número de teléfono ya está registrado.")
                if (targets.includes('cedula')) throw new Error("Esta cédula de identidad ya está registrada.")
                throw new Error("Ya existe un registro con estos datos únicos.")
            }
            case 'P2003': // Foreign key constraint violation
                throw new Error("No se puede eliminar o modificar este registro porque tiene otros datos asociados (ej: clases, pagos o asistencias).")
            case 'P2025': // Record not found
                throw new Error("El registro que intentas modificar o eliminar no existe o ya ha sido removido.")
            default:
                throw new Error(`Error de base de datos (${error.code}). Por favor contacta al soporte técnico.`)
        }
    }

    // 2. Custom Business Logic Errors (already thrown as Error)
    if (error instanceof Error) {
        // Si el error ya tiene un mensaje en español amigable (detectado por falta de caracteres técnicos), lo lanzamos tal cual.
        // O si ya es una instancia de Error lanzada por nosotros.
        throw error
    }

    // 3. Fallback
    throw new Error(fallbackMessage)
}
