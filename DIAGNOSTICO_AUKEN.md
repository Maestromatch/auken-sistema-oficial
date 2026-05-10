# DIAGNÓSTICO COMPLETO — Aukén Sistema Oficial

## ESTADO ACTUAL (Análisis del código real)

### ✅ LO QUE FUNCIONA

**Infraestructura base**:
- ✅ React 18 + Vite configurado correctamente
- ✅ React Router con 9 rutas definidas
- ✅ Supabase integrado (cliente + admin)
- ✅ Claude API (Anthropic SDK v0.20.0)
- ✅ Vercel deployment activo en 2 URLs:
  - auken-sistema.vercel.app
  - auken-sistema-oficial.vercel.app

**Backend (API)**:
- ✅ `/api/health` — diagnóstico completo
- ✅ `/api/chat` — endpoint chat web
- ✅ `/api/webhook` — preparado para WhatsApp
- ✅ `/api/process-queue` — worker async
- ✅ `/api/send-whatsapp` — envío de mensajes
- ✅ `/api/vision` — OCR con Groq
- ✅ `/api/voice-webhook` — Vapi integrado

**Frontend (Pages)**:
- ✅ AukenOS — landing principal
- ✅ AukenOpticaDashboard — dashboard limpio (874 líneas, sin TDZ bug)
- ✅ AukenOptica — monitor de chat
- ✅ AukenAdmin — SuperAdmin
- ✅ AukenLogin — auth (hardcoded)
- ✅ Rutas protegidas con ProtectedRoute

**Migraciones**:
- ✅ 001 y 002 ejecutadas (tablas base creadas)
- ✅ 003_fix_permissions.sql — desbloqueo RLS (INSEGURO pero funcional)

---

### ⚠️ PROBLEMAS DETECTADOS

#### 1. SEGURIDAD CRÍTICA
**Problema**: Migration 003 deshabilitó RLS completamente
```sql
ALTER TABLE public.pacientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.opticas DISABLE ROW LEVEL SECURITY;
-- etc. todas sin RLS
```
**Impacto**: CUALQUIERA puede ver datos de TODAS las ópticas
**Riesgo**: Violación HIPAA/privacidad, datos médicos expuestos
**Fix necesario**: Reactivar RLS con políticas correctas por optica_id

#### 2. ENV VARS INCONSISTENTES
**Problema**: health.js chequea WhatsApp vars pero no están en .env.example
```javascript
const requiredEnvs = [
  "WHATSAPP_TOKEN",      // ← No está en .env.example
  "PHONE_NUMBER_ID",     // ← No está en .env.example
  "VERIFY_TOKEN",        // ← No está en .env.example
];
```
**Impacto**: health endpoint siempre dice "degraded" aunque funcione
**Fix**: Agregar vars a .env.example o hacerlas opcionales en health.js

#### 3. TABLA MENSAJES_CHAT INEXISTENTE
**Problema**: Migration 003 referencia tabla que no existe
```sql
DROP POLICY IF EXISTS "Allow all" ON public.mensajes_chat;
```
**Impacto**: Si se corre la migration en BD limpia, falla
**Fix**: Eliminar referencia o crear tabla

#### 4. PÁGINAS LEGACY MEZCLADAS
**Problema**: Hay páginas del sistema viejo que no se usan:
- AukenLanding (landing genérica)
- AukenDashboard (dashboard agencia)
- AukenWidget (chatbot genérico)
- AukenPropuesta (propuestas)
- AukenIntegrations (panel n8n)
- AukenSkills (habilidades)
**Impacto**: Confusión en el código, rutas que no se usan
**Fix**: Moverlas a /archive/ o eliminarlas

#### 5. LOGIN INSEGURO
**Problema**: Passwords hardcodeados en localStorage
```javascript
const isAuthenticated = localStorage.getItem("auken_auth") === "true";
```
**Impacto**: Cualquiera con DevTools puede acceder
**Fix**: Migrar a Supabase Auth (Fase 2)

#### 6. WHATSAPP NO CONECTADO
**Problema**: Webhook existe pero Meta no está configurado
**Impacto**: Bot NO atiende por WhatsApp (solo web)
**Fix**: Configurar Meta Developer + Webhook (Fase 1)

#### 7. COLA ASYNC NO USA
**Problema**: message_queue existe pero no se procesa
**Impacto**: Mensajes van directo a Claude, sin encolar
**Fix**: Activar worker con cron (Fase 1)

---

## BRECHAS PARA SER PRODUCTO COBRABLE

### Brecha 1: Bot WhatsApp no funciona
**Estado**: Código listo, Meta NO conectado
**Para cobrar $89,990/mes**: Debe atender WhatsApp 24/7

### Brecha 2: Dashboard no edita
**Estado**: UI existe, CRUD parcial
**Para cobrar**: Dueño debe poder gestionar TODO

### Brecha 3: No genera ventas
**Estado**: Bot reactivo, no proactivo
**Para cobrar**: Debe rescatar clientes automáticamente

### Brecha 4: No escala
**Estado**: RLS deshabilitada, login inseguro
**Para cobrar**: Multi-óptica segura

---

## ARQUITECTURA DE DATOS ACTUAL

**Tablas detectadas** (por código):
1. `opticas` — config ópticas
2. `pacientes` — clientes
3. `conversaciones` — historial chat
4. `message_queue` — cola async
5. `api_logs` — monitoreo
6. `citas` — agenda (mencionada en código)
7. `recetas` — prescripciones (mencionada)
8. `cola_dashboard` — vista (health.js la usa)

**Problema**: No hay confirmación de que TODAS existan en Supabase

---

## URLS ACTIVAS

**URL 1**: https://auken-sistema.vercel.app
- Deploy anterior (pre-clean-slate)
- Puede tener bugs viejos

**URL 2**: https://auken-sistema-oficial.vercel.app
- Deploy nuevo (post-clean-slate)
- Debe ser el OFICIAL

**Recomendación**: Eliminar URL 1, solo usar URL 2

---

## CAPACIDADES TÉCNICAS VS FUNCIONALES

| Capacidad | Código existe | Funciona | Productivo |
|-----------|---------------|----------|------------|
| Chat web Claude | ✅ | ✅ | ✅ |
| Dashboard UI | ✅ | ✅ | ⚠️ Solo lectura |
| WhatsApp bot | ✅ | ❌ | ❌ |
| Cola async | ✅ | ❌ | ❌ |
| OCR recetas | ✅ | ⚠️ | ❌ |
| Google Calendar | ❌ | ❌ | ❌ |
| Cron recetas | ❌ | ❌ | ❌ |
| Multi-óptica | ⚠️ | ❌ | ❌ |
| RLS segura | ❌ | ❌ | ❌ |
| Supabase Auth | ❌ | ❌ | ❌ |

---

## EVALUACIÓN DE MADUREZ

**Infraestructura**: 8/10 — Stack sólido, bien configurado
**Funcionalidad**: 3/10 — Poco funciona end-to-end
**Seguridad**: 2/10 — RLS deshabilitada, login inseguro
**Productividad**: 2/10 — No genera valor real aún
**Escalabilidad**: 4/10 — Arquitectura preparada, implementación no

**Nota general**: 3.8/10 — MVP técnico, no producto cobrable

---

## PRIORIDADES CRÍTICAS (orden de urgencia)

### CRÍTICO AHORA
1. ⚡ Reactivar RLS con políticas correctas
2. ⚡ Conectar WhatsApp Meta API
3. ⚡ Activar cola async con worker

### URGENTE (2 semanas)
4. 🔥 CRUD pacientes completo
5. 🔥 OCR recetas funcional
6. 🔥 Gestión citas en dashboard

### IMPORTANTE (1 mes)
7. 📊 Google Calendar OAuth
8. 📊 Cron recetas vencidas
9. 📊 Métricas negocio

### FUTURO (2+ meses)
10. 🚀 Supabase Auth real
11. 🚀 Multi-óptica completa
12. 🚀 Self-signup SaaS

---

## RESUMEN EJECUTIVO

**Tienes**: Código bien estructurado, stack moderno, deploy funcionando
**Te falta**: Conectar las piezas para que funcione end-to-end
**Bloqueo principal**: WhatsApp no conectado = no hay producto
**Tiempo para MVP cobrable**: 2-3 semanas si enfocas en Fase 1+2

---

FIN DEL DIAGNÓSTICO
