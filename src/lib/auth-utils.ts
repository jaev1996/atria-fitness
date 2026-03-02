import { jwtVerify, JWTPayload } from 'jose'
import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'
import { createClient } from '@/lib/supabase/server'

/**
 * Utilidad para verificar manualmente un token JWT de Supabase usando el secreto.
 * Útil para validaciones personalizadas fuera del cliente estándar de Supabase.
 */
export async function verifySupabaseToken(token: string): Promise<JWTPayload | null> {
    const secret = process.env.SUPABASE_JWT_SECRET

    if (!secret) {
        console.warn('SUPABASE_JWT_SECRET no configurado en las variables de entorno.')
        return null
    }

    try {
        const secretUint8 = new TextEncoder().encode(secret)
        const { payload } = await jwtVerify(token, secretUint8, {
            algorithms: ['HS256'],
        })

        return payload
    } catch (error) {
        console.error('Error al verificar el token JWT:', error)
        return null
    }
}

/**
 * Obtiene el token de sesión desde las cookies manualmente (si es necesario).
 */
export function extractTokenFromCookies(cookies: ReadonlyRequestCookies): string | null {
    // Supabase suele guardar la sesión en una cookie con prefijo sb-
    const prefix = 'sb-'
    const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1].split('.')[0]

    if (!projectRef) return null

    const cookieName = `${prefix}${projectRef}-auth-token`
    const cookie = cookies.get(cookieName)

    if (!cookie) return null

    try {
        const parsed = JSON.parse(cookie.value)
        return parsed[0] || null
    } catch {
        return cookie.value || null
    }
}

/**
 * Verifica si el usuario actual tiene uno de los roles requeridos.
 * Especialmente útil para asegurar Server Actions.
 */
export async function ensureRole(allowedRoles: string[]) {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
        throw new Error("No autenticado")
    }

    const role = (user.app_metadata?.role || user.user_metadata?.role || 'student').toLowerCase()

    if (!allowedRoles.includes(role)) {
        throw new Error("No tienes permisos suficientes para realizar esta acción")
    }

    return user
}
