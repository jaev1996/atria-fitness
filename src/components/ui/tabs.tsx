"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface TabsProps {
    defaultValue?: string
    value?: string
    onValueChange?: (value: string) => void
    children: React.ReactNode
    className?: string
}

const TabsContext = React.createContext<{ value: string; onValueChange: (v: string) => void } | null>(null)

const Tabs = ({ value, onValueChange, defaultValue, children, className }: TabsProps) => {
    const [stateValue, setStateValue] = React.useState(defaultValue || "")
    const currentValue = value !== undefined ? value : stateValue
    const changeHandler = onValueChange || setStateValue

    return (
        <TabsContext.Provider value={{ value: currentValue, onValueChange: changeHandler }}>
            <div className={cn("", className)}>{children}</div>
        </TabsContext.Provider>
    )
}

const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={cn(
                "inline-flex h-10 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800 p-1 text-slate-500 dark:text-slate-400",
                className
            )}
            {...props}
        />
    )
)
TabsList.displayName = "TabsList"

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    value: string
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
    ({ className, value, ...props }, ref) => {
        const context = React.useContext(TabsContext)
        const isActive = context?.value === value
        return (
            <button
                ref={ref}
                type="button"
                onClick={() => context?.onValueChange(value)}
                className={cn(
                    "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:ring-offset-slate-950 dark:focus-visible:ring-slate-300",
                    isActive
                        ? "bg-white text-slate-950 shadow-sm dark:bg-slate-950 dark:text-slate-50"
                        : "hover:bg-white/50 dark:hover:bg-slate-800/50",
                    className
                )}
                {...props}
            />
        )
    }
)
TabsTrigger.displayName = "TabsTrigger"

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
    value: string
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
    ({ className, value, ...props }, ref) => {
        const context = React.useContext(TabsContext)
        if (context?.value !== value) return null
        return (
            <div
                ref={ref}
                className={cn(
                    "mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 dark:ring-offset-slate-950 dark:focus-visible:ring-slate-300",
                    className
                )}
                {...props}
            />
        )
    }
)
TabsContent.displayName = "TabsContent"

export { Tabs, TabsList, TabsTrigger, TabsContent }
