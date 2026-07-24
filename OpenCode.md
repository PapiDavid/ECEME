# Registro de cambios — OpenCode

## 2026-07-23 · Auditoría ampliada

Se agregaron dos nuevas acciones a la auditoría del sistema:

### EVALUAR_DOCENTE
- Endpoint: `POST /api/estudiantes/evaluar-docente`
- Ahora registra cuando un cursante califica a su docente (cursante #, docente #, materia #, cantidad de criterios).
- Antes no quedaba registro auditado de esta acción.

### GUARDAR_PLANILLA
- Endpoint: `POST /api/notas/guardar-planilla`
- Ahora registra cuando un docente guarda/sincroniza su planilla de notas (cantidad de registros y filas afectadas).
- Antes no quedaba registro auditado de esta acción.

### Archivos modificados
- `apps/server/index.js` — se añadieron llamadas a `registrarAuditoria()` en ambos endpoints.
