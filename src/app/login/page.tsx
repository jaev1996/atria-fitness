"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dumbbell, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { login } from "@/actions/auth"

export default function LoginPage() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        const formData = new FormData()
        formData.append('email', email)
        formData.append('password', password)

        try {
            const result = await login(formData)
            if (result?.error) {
                toast.error(result.error)
                setIsLoading(false)
            } else if (result?.success) {
                toast.success("Inicio de sesión exitoso")
                // Give the toast time to be seen before redirect
                router.push("/dashboard")
                router.refresh()
            }
        } catch (error) {
            toast.error("Ocurrió un error inesperado")
            setIsLoading(false)
        }
    }

    return (
        <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-slate-900">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1 text-center">
                    <div className="flex justify-center mb-2">
                        <Dumbbell className="h-10 w-10 text-primary" />
                    </div>
                    <CardTitle className="text-2xl">Atria Fitness</CardTitle>
                    <CardDescription>
                        Ingresa tus credenciales para acceder al sistema
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleLogin}>
                    <CardContent className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="email">Correo Electrónico</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="tu@correo.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={isLoading}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="password">Contraseña</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                disabled={isLoading}
                            />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button
                            type="submit"
                            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Iniciando sesión...
                                </>
                            ) : (
                                "Iniciar Sesión"
                            )}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
