import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Stethoscope, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-slate-50 gap-8">
      <div className="flex flex-col items-center gap-4">
        <div className="rounded-full bg-blue-100 p-4">
          <Stethoscope className="h-12 w-12 text-blue-600" />
        </div>
        <h1 className="text-4xl font-bold text-slate-800">DentalCloud</h1>
        <p className="text-slate-500 max-w-md text-center">
          Sistema de Gestión Odontológica profesional. Gestiona pacientes, citas y tratamientos de forma eficiente.
        </p>
      </div>

      <div className="flex gap-4">
        <Link href="/login">
          <Button className="bg-blue-600 hover:bg-blue-700 h-12 px-8 text-lg">
            Iniciar Sesión
          </Button>
        </Link>
        <Link href="/dashboard">
          <Button variant="outline" className="h-12 px-8 text-lg flex gap-2">
            Ir al Dashboard <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
