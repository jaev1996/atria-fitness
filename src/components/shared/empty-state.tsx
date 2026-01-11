
import { Button } from "@/components/ui/button"
import { SearchX } from "lucide-react"

interface EmptyStateProps {
    title?: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
}

export function EmptyState({
    title = "No se encontraron resultados",
    description = "Intenta ajustar los filtros de búsqueda o agrega un nuevo registro.",
    actionLabel = "Limpiar Filtros",
    onAction
}: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 dark:bg-slate-900/20 border-2 border-dashed rounded-lg border-slate-200 dark:border-slate-800">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                <SearchX className="h-6 w-6 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
                {title}
            </h3>
            <p className="text-sm text-slate-500 mt-1 mb-4 max-w-sm">
                {description}
            </p>
            {onAction && (
                <Button variant="outline" onClick={onAction}>
                    {actionLabel}
                </Button>
            )}
        </div>
    )
}
