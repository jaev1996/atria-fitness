
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"

interface PaginationControlProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalItems: number;
    itemsPerPage: number;
    onItemsPerPageChange: (items: number) => void;
}

export function PaginationControl({
    currentPage,
    totalPages,
    onPageChange,
    totalItems,
    itemsPerPage,
    onItemsPerPageChange
}: PaginationControlProps) {
    return (
        <div className="flex flex-col sm:flex-row items-center justify-between px-2 gap-4 mt-4 text-sm text-slate-500">
            <div className="flex items-center gap-2 order-2 sm:order-1">
                <span>Mostrar</span>
                <Select
                    value={itemsPerPage.toString()}
                    onValueChange={(v) => onItemsPerPageChange(Number(v))}
                >
                    <SelectTrigger className="h-8 w-[70px]">
                        <SelectValue placeholder={itemsPerPage} />
                    </SelectTrigger>
                    <SelectContent side="top">
                        {[5, 10, 20, 50].map((pageSize) => (
                            <SelectItem key={pageSize} value={`${pageSize}`}>
                                {pageSize}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <span>de {totalItems} registros</span>
            </div>

            <div className="flex items-center gap-1 order-1 sm:order-2">
                <span className="mr-2 hidden sm:inline-block">
                    Página {currentPage} de {totalPages || 1}
                </span>

                <div className="flex items-center space-x-1">
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onPageChange(1)}
                        disabled={currentPage <= 1}
                    >
                        <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage <= 1}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <div className="flex items-center justify-center min-w-[2rem] font-medium sm:hidden">
                        {currentPage} / {totalPages || 1}
                    </div>

                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage >= totalPages}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onPageChange(totalPages)}
                        disabled={currentPage >= totalPages}
                    >
                        <ChevronsRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
