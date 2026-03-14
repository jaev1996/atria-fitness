"use client"

import { useRef, useState, useCallback } from "react"

/**
 * Hook reutilizable que envuelve una operación async y la protege contra
 * doble ejecución (doble clic, re-render, etc.).
 *
 * - isSubmitting: true mientras la operación está en curso
 * - error: el Error capturado si la operación falla, null si fue exitosa
 * - submit: función que ejecuta la operación con la protección activa
 *
 * Uso:
 *   const { submit, isSubmitting } = useSubmitting()
 *   await submit(() => myServerAction(data))
 *
 * El hook NO muestra toasts ni hace routing — eso queda en el componente.
 */
export function useSubmitting() {
    const inFlight = useRef(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    const submit = useCallback(async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
        // Hard guard: ref is synchronously updated — immune to render timing
        if (inFlight.current) return undefined
        inFlight.current = true
        setIsSubmitting(true)
        setError(null)
        try {
            return await fn()
        } catch (err) {
            const e = err instanceof Error ? err : new Error(String(err))
            setError(e)
            throw e  // re-throw so the caller can still handle it (e.g. toast)
        } finally {
            inFlight.current = false
            setIsSubmitting(false)
        }
    }, [])

    return { submit, isSubmitting, error }
}
