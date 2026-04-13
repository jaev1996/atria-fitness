/**
 * Utility to fetch official BCV exchange rates from dolarapi.com
 */

export interface BCVRateResponse {
    moneda: string
    fuente: string
    nombre: string
    compra: number | null
    venta: number | null
    promedio: number
    fechaActualizacion: string
}

export interface ExchangeRates {
    usd: number
    eur: number
    lastUpdated: Date
}

export async function fetchBCVRates(): Promise<ExchangeRates | null> {
    try {
        console.log("Fetching official BCV exchange rates...")
        
        // Fetch USD and EUR rates in parallel
        const [usdRes, eurRes] = await Promise.all([
            fetch('https://ve.dolarapi.com/v1/dolares/oficial', { next: { revalidate: 3600 } }),
            fetch('https://ve.dolarapi.com/v1/euros/oficial', { next: { revalidate: 3600 } })
        ])

        if (!usdRes.ok || !eurRes.ok) {
            throw new Error(`Failed to fetch rates: USD(${usdRes.status}) EUR(${eurRes.status})`)
        }

        const usdData: BCVRateResponse = await usdRes.json()
        const eurData: BCVRateResponse = await eurRes.json()

        return {
            usd: usdData.promedio,
            eur: eurData.promedio,
            lastUpdated: new Date(usdData.fechaActualizacion)
        }
    } catch (error) {
        console.error("Error fetching BCV rates:", error)
        return null
    }
}
