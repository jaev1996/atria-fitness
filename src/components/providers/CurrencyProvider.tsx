"use client"

import React, { createContext, useContext, ReactNode } from "react"

interface CurrencyContextType {
  currency: string
  formatCurrency: (amount: number) => string
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined)

export function CurrencyProvider({ 
  children, 
  currency = "$" 
}: { 
  children: ReactNode
  currency?: string 
}) {
  const formatCurrency = (amount: number) => {
    // Basic formatting, could be improved with Intl.NumberFormat if needed
    // but preserving the current style of just prefixing/suffixing symbol
    return `${currency}${amount.toLocaleString()}`
  }

  return (
    <CurrencyContext.Provider value={{ currency, formatCurrency }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  const context = useContext(CurrencyContext)
  if (context === undefined) {
    throw new Error("useCurrency must be used within a CurrencyProvider")
  }
  return context
}
