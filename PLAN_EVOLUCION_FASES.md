# PLAN DE EVOLUCIÓN POR FASES — Aukén (adaptado al estado actual)

## FASE 0.5 — Correcciones críticas (3 días) ⚡ URGENTE

**Objetivo**: Arreglar lo roto ANTES de avanzar

### Tareas

#### Día 1: Seguridad y limpieza

**1. Reactivar RLS con políticas correctas**
```sql
-- migrations/004_fix_rls.sql

-- Reactivar RLS
ALTER TABLE public.opticas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citas ENABLE ROW LEVEL SECURITY;

-- Política temporal permisiva (mejorar en Fase 2)
CREATE POLICY "Allow all for development" ON public.opticas FOR ALL USING (true);
CREATE POLICY "Allow all for development" ON public.pacientes FOR ALL USING (true);
CREATE POLICY "Allow all for development" ON public.conversaciones FOR ALL USING (true);
CREATE POLICY "Allow all for development" ON public.citas FOR ALL USING (true);
```

**2. Limpiar .env.example**
```bash
# Agregar las vars de WhatsApp que health.js chequea
WHATSAPP_TOKEN=
PHONE_NUMBER_ID=
VERIFY_TOKEN=
```

**3. Archivar páginas legacy**
```bash
mkdir src/pages/archive
mv src/pages/AukenLanding.jsx src/pages/archive/
mv src/pages/AukenDashboard.jsx src/pages/archive/
mv src/pages/AukenWidget.jsx src/pages/archive/
mv src/pages/AukenPropuesta.jsx src/pages/archive/
mv src/pages/AukenIntegrations.jsx src/pages/archive/
mv src/pages/AukenSkills.jsx src/pages/archive/
```

**4. Actualizar App.jsx**
```javascript
// Eliminar imports de páginas archivadas
// Mantener solo:
- AukenOS (landing principal)
- AukenOptica (chat)
- AukenOpticaDashboard (dashboard óptica)
- AukenOpticaLanding (landing venta ópticas)
- AukenLogin / AukenAdmin
```

#### Día 2: Env vars y health

**5. Hacer vars WhatsApp opcionales en health.js**
```javascript
// En /api/health.js línea 19-27
const requiredEnvs = [
  "ANTHROPIC_API_KEY",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "WORKER_SECRET",
];

const optionalEnvs = [
  "WHATSAPP_TOKEN",
  "PHONE_NUMBER_ID", 
  "VERIFY_TOKEN",
];

// Chequear opcionales sin marcar como error
```

**6. Unificar en una sola URL**
- Decide: ¿auken-sistema.vercel.app o auken-sistema-oficial.vercel.app?
- Elimina el proyecto viejo en Vercel
- Actualiza todos los links

#### Día 3: Verificación

**7. Test completo**
- [ ] `/api/health` devuelve "healthy"
- [ ] Dashboard `/optica/dashboard` carga sin errores
- [ ] Chat `/optica` funciona
- [ ] Login con glow2026 funciona
- [ ] Admin panel accesible

**Resultado Fase 0.5**: Sistema limpio, seguro (básico), sin dead code

---

## FASE 1 — Bot WhatsApp LIVE (2 semanas) 🚀

**Objetivo**: Que Aukén atienda WhatsApp 24/7 sin colapsar

### Semana 1: Configuración Meta + Webhook

#### Días 1-2: Setup Meta Developer

**1. Crear app en Meta Developer**
- Ve a https://developers.facebook.com/apps
- Create App → Business → WhatsApp
- Nombre: "Aukén Bot Glow Vision"
- Agrega WhatsApp Product

**2. Obtener credenciales**
```
WHATSAPP_TOKEN=EAAxxxxxx... (temporary token → permanent después)
PHONE_NUMBER_ID=123456789...
```

**3. Configurar webhook**
```
Callback URL: https://auken-sistema-oficial.vercel.app/api/webhook
Verify Token: (inventa uno y guardalo en VERIFY_TOKEN env var)
Subscribe to: messages
```

**4. Verificar webhook**
- Meta enviará GET request
- webhook.js debe responder con el challenge
- Status debe cambiar a "Connected"

#### Días 3-4: Test ciclo básico

**5. Enviar mensaje de prueba**
- Manda "hola" al número WhatsApp de la app
- Debe llegar al webhook
- Debe insertarse en message_queue
- Verifica en Supabase: `select * from message_queue;`

**6. Worker manual**
- Corre `node api/process-queue.js` localmente
- Debe procesar el mensaje
- Debe llamar a Claude
- Debe enviar respuesta por WhatsApp
- Verifica status = 'done'

#### Día 5: Deploy worker cron

**7. Agregar cron en vercel.json**
```json
{
  "crons": [{
    "path": "/api/process-queue",
    "schedule": "* * * * *"
  }]
}
```

**IMPORTANTE**: Esto requiere Vercel Pro ($20/mes)
Alternativa gratuita: cron-job.org → llama cada minuto

### Semana 2: Robustez y testing

#### Días 6-7: Manejo de errores

**8. Retry logic**
- Si Claude falla → retry_count++
- Max 3 reintentos
- Después de 3 → status='failed', log error

**9. Rate limiting**
- Si >50 mensajes pendientes → pausa procesamiento
- Alerta al admin por WA

#### Días 8-9: Persistencia

**10. Guardar conversaciones**
- Cada intercambio → UPDATE conversaciones
- Agregar a array mensajes
- Si >30 mensajes → resumir con Haiku

**11. Auto-crear pacientes**
- Si teléfono no existe en pacientes
- INSERT nuevo paciente
- Vincular a Glow Vision (optica_id)

#### Día 10: Test de carga

**12. Simular 100 mensajes**
```bash
for i in {1..100}; do
  curl -X POST https://auken-sistema-oficial.vercel.app/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"from": "56912345678", "text": "Hola test '$i'"}'
done
```

- Todos deben procesarse
- Ninguno perdido
- Tiempo promedio <30seg

**Resultado Fase 1**: Bot WhatsApp operativo 24/7

---

## FASE 2 — Dashboard operativo (2 semanas) 📊

**Objetivo**: Dueño gestiona TODO desde el dashboard

### Semana 1: CRUD y OCR

#### Días 1-3: CRUD pacientes

**1. Botón "Nuevo paciente"**
- Modal con form
- Campos: nombre, teléfono, email
- INSERT en pacientes
- Refresh lista

**2. Botón "Editar"**
- Abrir modal con datos actuales
- UPDATE pacientes
- Refresh

**3. Botón "Eliminar"**
- Confirm dialog
- DELETE pacientes CASCADE
- Refresh

**4. Búsqueda**
- Input filtro por nombre/teléfono
- WHERE nombre ILIKE '%search%'

#### Días 4-5: OCR recetas

**5. Upload foto receta**
- Input file accept="image/*"
- Upload a Supabase Storage
- Guardar path en recetas.storage_path

**6. Extraer con Claude Vision**
```javascript
// api/vision.js ya existe, usar eso
// Extraer: OD/OI esfera, cilindro, eje
// INSERT en recetas tabla
```

**7. Mostrar en ficha paciente**
- Lista de recetas
- Última receta destacada
- Estado: vigente/vencida

### Semana 2: Citas y config

#### Días 6-8: Gestión citas

**8. Calendario semanal**
- Grid 7 días x 10 horarios
- Citas existentes como bloques
- Click horario vacío → crear cita

**9. Crear cita manual**
- Modal con: paciente (select), servicio, fecha, hora
- INSERT citas
- Refresh calendario

**10. Confirmar/Cancelar**
- Botón en cada cita
- UPDATE estado
- Opcional: enviar WA confirmación

#### Días 9-10: Tab Config editable

**11. Form configuración óptica**
- Inputs: nombre, dirección, horario, teléfono
- Textarea servicios (JSON)
- Input promoción estrella
- UPDATE opticas WHERE slug='glowvision'

**12. Reflejo inmediato en bot**
- Al guardar config → cache invalidado
- Próximo mensaje bot usa nueva config

**Resultado Fase 2**: Dashboard profesional cobrable

---

## FASE 3 — Motor ventas proactivo (3 semanas) 💰

**Objetivo**: Sistema genera ventas automáticamente

### Semana 1: Cron recetas vencidas

**1. Job diario detección**
```sql
SELECT p.*, r.* 
FROM pacientes p
JOIN recetas r ON r.paciente_id = p.id
WHERE r.fecha_vencimiento < CURRENT_DATE
  AND r.estado = 'vigente'
  AND p.ultimo_recordatorio < (CURRENT_DATE - INTERVAL '30 days')
```

**2. Template WA**
```
Hola {nombre} 👋

Tu receta de lentes venció hace {meses} meses. 

¿Agendamos tu control visual? Es GRATIS al comprar tus nuevos lentes 👓

Responde SÍ para agendar o llámanos al +56 9 5493 2802
```

**3. Envío automático**
- INSERT message_queue con template
- Worker envía como siempre
- UPDATE paciente.ultimo_recordatorio

### Semana 2: Lead scoring

**4. Analizar con Haiku**
```javascript
// Al terminar conversación
const score = await analyzeLeadScore(conversation);
// Score 1-100 basado en:
// - Interés (preguntó precios, horarios)
// - Urgencia (necesita pronto)
// - Objeciones (precio, tiempo)
```

**5. Clasificar**
- Hot (80-100): quiere comprar YA
- Warm (50-79): interesado, necesita empujón
- Cold (1-49): solo preguntó

**6. Ordenar dashboard**
- Lista pacientes ordenada por score DESC
- Badge color según clasificación

### Semana 3: Pipeline y Calendar

**7. Estados pipeline**
```
Lead → Contactado → Citado → Compró → Fidelizado
```
- Transiciones automáticas según eventos
- Filtros por estado en dashboard

**8. Google Calendar OAuth**
- Botón "Conectar Google Calendar"
- OAuth flow → guardar refresh_token
- Al crear cita → POST Google Calendar API
- Sincronización bidireccional

**Resultado Fase 3**: Sistema vende proactivamente

---

## FASE 4 — Multi-óptica (3 semanas) 🏢

**Objetivo**: 5 ópticas del primo operando

### Semana 1: RLS estricta

**1. Políticas por tabla**
```sql
-- Solo óptica propia
CREATE POLICY "optica_isolation" ON pacientes
  USING (optica_id = current_setting('app.current_optica_id')::uuid);
```

**2. Set context en cada request**
```javascript
// En cada API call
await supabase.rpc('set_config', {
  setting: 'app.current_optica_id',
  value: user.optica_id
});
```

### Semana 2: Login multi-óptica

**3. Migrar a Supabase Auth**
- Eliminar localStorage hardcoded
- Crear usuarios en Auth
- Tabla user_optica mapeo

**4. Al login**
- Supabase Auth → user_id
- Lookup user_optica → optica_id
- Set context
- Redirect dashboard

### Semana 3: Dashboard maestro

**5. Vista consolidada**
- Si user tiene >1 óptica asignada
- Overview: total pacientes, conversaciones, citas
- Drill-down a óptica específica

**6. Onboarding nueva óptica**
- Form en /admin
- INSERT opticas
- Generar slug auto
- Crear usuario
- Configurar webhook Meta (número diferente)

**Resultado Fase 4**: 5 ópticas, $450k MRR

---

## FASE 5 — SaaS abierto (2-3 meses) 🌎

**Objetivo**: Self-signup, cualquier óptica LATAM

### Mes 1: Landing y signup

**1. Landing venta**
- Evolucion de /optica/landing
- Planes: Mensual $89.990, Anual $899.900 (2 meses gratis)
- CTA: "Prueba gratis 14 días"

**2. Self-signup**
- Form: nombre óptica, ciudad, email, teléfono
- Crea: optica + usuario + trial
- Email confirmación

**3. Onboarding wizard**
- Paso 1: Configurar óptica
- Paso 2: Conectar WhatsApp
- Paso 3: Subir logo
- Paso 4: Invitar equipo
- Paso 5: Primera campaña

### Mes 2: Pagos y gestión

**4. Stripe / Mercado Pago**
- Webhook pagos
- Si paga → estado='active'
- Si no paga → estado='suspended'

**5. Kill switch**
- Bot responde: "Estamos en mantenimiento"
- Dashboard: banner "Tu suscripción venció"

**6. Panel agencia**
- Ver todas las ópticas
- MRR total, churn
- Tickets soporte

### Mes 3: Expansión

**7. Otros nichos**
- Dental: misma estructura, prompts diferentes
- Veterinaria: idem
- Clínicas: idem

**8. API pública**
- Endpoints para integradores
- Webhooks personalizados
- SDK JavaScript

**Resultado Fase 5**: 20+ ópticas, $1.8M MRR

---

## CRONOGRAMA REALISTA

| Fase | Duración | Acumulado | Entregable |
|------|----------|-----------|------------|
| 0.5 | 3 días | 3 días | Sistema limpio |
| 1 | 2 semanas | 17 días | Bot WA live |
| 2 | 2 semanas | 1 mes | Dashboard operativo |
| 3 | 3 semanas | 2 meses | Motor ventas |
| 4 | 3 semanas | 2.5 meses | Multi-óptica |
| 5 | 2-3 meses | 5 meses | SaaS LATAM |

**Total a MVP cobrable (Fases 0.5+1+2)**: 1 mes
**Total a multi-óptica (hasta Fase 4)**: 2.5 meses
**Total a SaaS escalable (hasta Fase 5)**: 5 meses

---

## PRÓXIMO PASO INMEDIATO

**AHORA MISMO**: Ejecutar Fase 0.5
1. Corre migration 004_fix_rls.sql
2. Actualiza .env.example
3. Archiva páginas legacy
4. Limpia App.jsx
5. Verifica /api/health → "healthy"

**CUANDO Fase 0.5 ESTÉ OK**: Arrancamos Fase 1 Día 1

---

FIN DEL PLAN
