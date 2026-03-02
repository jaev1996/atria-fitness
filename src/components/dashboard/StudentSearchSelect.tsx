"use client"

import { useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

interface Student {
    id: string;
    name: string;
    email?: string;
    plans?: Array<{ originalName: string }>;
}

interface StudentSearchSelectProps {
    students: Student[];
    onSelect: (studentId: string) => void;
    placeholder?: string;
}

export function StudentSearchSelect({ students, onSelect, placeholder = "Buscar alumna..." }: StudentSearchSelectProps) {
    const [open, setOpen] = useState(false)
    const [value, setValue] = useState("")

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                >
                    {value
                        ? students.find((student) => student.id === value)?.name
                        : placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Filtrar por nombre o email..." />
                    <CommandList>
                        <CommandEmpty>No se encontraron alumnas.</CommandEmpty>
                        <CommandGroup>
                            {students.map((student) => (
                                <CommandItem
                                    key={student.id}
                                    value={student.name + " " + (student.email || "")}
                                    onSelect={() => {
                                        setValue(student.id)
                                        onSelect(student.id)
                                        setOpen(false)
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === student.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <div className="flex flex-col">
                                        <span className="font-medium">{student.name}</span>
                                        {student.email && <span className="text-xs text-slate-500">{student.email}</span>}
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
