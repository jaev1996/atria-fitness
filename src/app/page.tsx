import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dumbbell, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 gap-8">
      <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-500">
        <div className="rounded-full bg-primary/10 p-6 ring-1 ring-primary/20">
          <Dumbbell className="h-16 w-16 text-primary" />
        </div>
        <h1 className="text-5xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">Atria Fitness</h1>
        <p className="text-slate-500 dark:text-slate-400 max-w-md text-center text-lg">
          Transforma tu gestión fitness. Administra alumnas, clases e instructores en una sola plataforma unificada.
        </p>
      </div>

      <div className="flex gap-4 animate-in slide-in-from-bottom-4 duration-700 delay-200">
        <Link href="/login">
          <Button className="bg-primary hover:bg-primary/90 h-12 px-8 text-lg shadow-lg shadow-primary/20 transition-all hover:scale-105">
            Iniciar Sesión
          </Button>
        </Link>
        <Link href="/dashboard">
          <Button variant="outline" className="h-12 px-8 text-lg flex gap-2 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
            Ir al Dashboard <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
