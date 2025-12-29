# DentalCloud 🦷

Sistema de Gestión Odontológica (Prototipo Funcional) construido con Next.js, TypeScript y Shadcn/UI.

## Características

- **Dashboard Interactivo**: Métricas en tiempo real de pacientes y citas.
- **Gestión de Pacientes**: CRUD completo con almacenamiento local.
- **Historial Clínico**: Registro de tratamientos, costos y notas.
- **Odontograma Interactivo**: Herramienta visual para marcar estado de los dientes (Caries, Obturaciones, Ausentes).
- **Agenda / Calendario**: Sistema de citas semanal con detección de conflictos.
- **Autenticación Simulada**: Login de acceso para demostración.

## Stack Tecnológico

- **Framework**: Next.js 15 (App Router)
- **Lenguaje**: TypeScript
- **Estilos**: Tailwind CSS 4
- **UI Components**: Shadcn/UI (Radix Primitives)
- **Iconos**: Lucide React
- **Persistencia**: LocalStorage (Cliente)

## Instalación y Uso

1.  Clonar el repositorio:
    ```bash
    git clone https://github.com/TU_USUARIO/dental-history-app.git
    ```
2.  Instalar dependencias:
    ```bash
    npm install
    ```
3.  Iniciar servidor de desarrollo:
    ```bash
    npm run dev
    ```
4.  Abrir `http://localhost:3000`.

## Credenciales de Acceso

Para acceder al sistema demo:
- **Usuario**: `admin@admin.com`
- **Contraseña**: `123`

## Nota sobre Persistencia de Datos

Este proyecto utiliza **LocalStorage** para simular una base de datos.
- Los datos se guardan **únicamente en el navegador** de tu dispositivo.
- Si abres la app en otro ordenador o navegador, los datos no estarán sincronizados.
- Al iniciar por primera vez, el sistema cargará datos de prueba (Seeding) automáticamente.
