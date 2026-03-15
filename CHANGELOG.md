# Changelog - Atria Fitness

## [v1.1.0] - 2026-03-15

### Añadido
- **Programación Flexible (30 min)**: Ahora es posible agendar clases en intervalos de 30 minutos (ej. 8:30 - 9:30).
- **Control de Zoom**: Implementada funcionalidad de zoom in/out en el calendario para visualizar mejor la agenda diaria.
- **Exportación de Reporte (PNG)**: Botón para descargar una captura de alta calidad del calendario semanal o mensual.
- **Vista Mensual**: Nueva visualización mensual para una perspectiva a largo plazo de la programación.

### Mejoras
- **Detección de Colisiones**: Refactorización del sistema de conflictos para detectar solapamientos de 1 hora en cualquier intervalo de tiempo.
- **Rendimiento de Exportación**: Cambio de `html2canvas` a `html-to-image` para soportar colores modernos (OKLCH) y mejorar la calidad de la captura.

### Correciones
- Corregido error "unsupported color function lab" durante la exportación de imagen.
- Ajuste de estilos en modo oscuro para el calendario.
