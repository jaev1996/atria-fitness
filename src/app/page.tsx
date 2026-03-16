import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Users, CalendarCheck, ShieldCheck, Dumbbell } from "lucide-react"

export default function Home() {
  return (
    <div className="h-screen w-full bg-slate-950 text-white overflow-hidden flex flex-col md:flex-row">

      {/* ── Left panel: brand + hero ────────────────────────────────── */}
      <div className="relative flex-1 flex flex-col justify-between p-8 md:p-12 overflow-hidden">

        {/* Background geometry */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-brand-primary/20 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-brand-primary/10 blur-2xl" />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: "repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)",
              backgroundSize: "24px 24px",
            }}
          />
        </div>

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <Image src="/logos/isotipo-color.png" alt="Atria Fitness Logo" width={128} height={128} className="h-24 w-auto object-contain" />
          <span className="text-3xl font-bold tracking-tight">Atria Fitness</span>
        </div>

        {/* Hero */}
        <div className="relative space-y-6">
          <div className="inline-flex items-center gap-2 bg-brand-primary/15 border border-brand-primary/25 text-brand-secondary text-xs font-semibold px-3 py-1.5 rounded-full uppercase tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-secondary animate-pulse" />
            Sistema de Gestión Interna
          </div>

          <h1 className="text-4xl md:text-5xl xl:text-6xl font-extrabold leading-tight tracking-tight">
            Portal de
            <span className="text-transparent bg-clip-text bg-linear-to-r from-brand-primary to-brand-secondary">
              {" "}Administración.
            </span>
          </h1>

          <p className="text-slate-400 max-w-md text-base md:text-lg leading-relaxed">
            Herramienta de gestión operativa para el personal de Atria Fitness.
            Acceso restringido a usuarios autorizados.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/login">
              <button className="flex items-center gap-2 bg-brand-primary hover:bg-brand-primary/90 text-white font-semibold px-7 py-3 rounded-xl transition-all duration-200 shadow-lg shadow-brand-primary/30 hover:shadow-brand-primary/50 hover:scale-[1.02] text-sm">
                Acceder al Sistema
                <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
            <Link href="/privacy">
              <button className="text-slate-400 hover:text-white text-sm px-4 py-3 rounded-xl transition-colors duration-200 border border-slate-800 hover:border-slate-600">
                Política de Privacidad
              </button>
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="relative text-slate-600 text-xs">
          &copy; 2026 Atria Fitness. Todos los derechos reservados.
        </div>
      </div>

      {/* ── Right panel: feature cards ──────────────────────────────── */}
      <div className="hidden md:flex flex-col justify-center gap-4 p-12 w-[420px] xl:w-[460px] bg-slate-900/60 border-l border-slate-800/60 backdrop-blur">
        <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-2">
          Funcionalidades clave
        </p>

        {[
          {
            icon: Users,
            title: "Gestión de Alumnas",
            desc: "Perfiles detallados, historial médico y seguimiento de asistencia.",
            color: "text-violet-400",
            bg: "bg-violet-500/10",
          },
          {
            icon: CalendarCheck,
            title: "Control de Clases",
            desc: "Calendario, inscripciones y estadísticas de ocupación en tiempo real.",
            color: "text-sky-400",
            bg: "bg-sky-500/10",
          },
          {
            icon: Dumbbell,
            title: "Panel de Instructores",
            desc: "Liquidaciones automáticas, historial de clases y comprobantes imprimibles.",
            color: "text-pink-400",
            bg: "bg-pink-500/10",
          },
          {
            icon: ShieldCheck,
            title: "Control de Acceso",
            desc: "Roles diferenciados para admins e instructores con permisos granulares.",
            color: "text-emerald-400",
            bg: "bg-emerald-500/10",
          },
        ].map(({ icon: Icon, title, desc, color, bg }) => (
          <div
            key={title}
            className="flex items-start gap-4 p-4 rounded-2xl bg-slate-800/40 border border-slate-700/40 hover:border-slate-600/60 transition-colors"
          >
            <div className={`shrink-0 h-10 w-10 rounded-xl ${bg} flex items-center justify-center`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div>
              <p className="font-semibold text-sm text-slate-100">{title}</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
