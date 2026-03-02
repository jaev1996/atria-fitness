'use server'

import prisma from "@/lib/prisma"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { ensureRole } from "@/lib/auth-utils"

/**
 * Sincroniza el rol y nombre de todos los usuarios de la base de datos (Prisma)
 * con los metadatos de Supabase Auth.
 * Esto optimiza el rendimiento al evitar consultas a la base de datos en cada carga de página.
 */
export async function syncAllUserMetadata() {
    // Solo un administrador puede ejecutar esta sincronización masiva
    await ensureRole(['admin'])

    const users = await prisma.user.findMany()
    const results = {
        total: users.length,
        updated: 0,
        errors: 0,
        details: [] as string[]
    }

    console.log(`Iniciando sincronización de metadatos para ${users.length} usuarios...`)

    for (const user of users) {
        try {
            // Actualizamos Supabase Auth con los datos de Prisma
            const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
                user_metadata: {
                    name: user.name,
                    role: user.role.toLowerCase()
                },
                // También lo guardamos en app_metadata para mayor seguridad (el middleware puede leerlo aquí)
                app_metadata: {
                    role: user.role.toLowerCase()
                }
            })

            if (error) {
                console.error(`Error sincronizando usuario ${user.email}:`, error.message)
                results.errors++
                results.details.push(`Error en ${user.email}: ${error.message}`)
            } else {
                results.updated++
            }
        } catch (e) {
            console.error(`Error inesperado sincronizando usuario ${user.id}:`, e)
            results.errors++
        }
    }

    console.log(`Sincronización completada. Actualizados: ${results.updated}, Errores: ${results.errors}`)
    return results
}
