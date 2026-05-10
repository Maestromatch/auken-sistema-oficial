# 🎯 AUKÉN FASE 0 — PROYECTO COMPLETO

**Fecha Inicio**: 9 Mayo 2026  
**Estado**: En Desarrollo (Fase 0 - Nutrient OCR)  
**Piloto**: Glow Vision (Punitaqui, Región de Coquimbo)  
**Herramienta**: Claude Desktop + Antigravity  

---

## 📋 ÍNDICE RÁPIDO

### Visión del Proyecto
- ✅ MVP con OCR automática de recetas (Nutrient API)
- ✅ Escalable a N ópticas sin cambios de código
- ✅ $89,990/mes por óptica (modelo SaaS)
- ✅ Diferenciador: OCR en tiempo real (vs competidores)

### Stack Técnico
- **Frontend**: React 18 + Vite + Tailwind
- **Backend**: Vercel Functions (Node.js)
- **BD**: Supabase (PostgreSQL)
- **IA**: Claude 3.5 Sonnet + Nutrient OCR
- **Deployment**: Vercel

### Archivos Críticos
```
migrations/
  └─ 005_nutrient_ocr.sql        # Schema tablas recetas
  
api/
  └─ vision-scan.js              # Endpoint POST /api/vision-scan
  
src/components/
  └─ RecetaScanner.jsx           # Widget cámara + galería
  
src/pages/
  └─ AukenOpticaDashboard.jsx    # INTEGRACIÓN EN PROGRESO
  
.env.local                         # Variables de entorno
```

---

## 🚀 ESTADO ACTUAL (9 Mayo 2026)

### ✅ COMPLETADO
- [x] Script automatizado Fase 0 (fase_0_setup.sh)
- [x] Migration SQL (005_nutrient_ocr.sql)
- [x] Endpoint API (api/vision-scan.js)
- [x] Componente React (RecetaScanner.jsx)
- [x] Configuración env vars
- [x] Instalación dependencias
- [x] Servidor local corriendo (localhost:5173)

### 🔄 EN PROGRESO
- [ ] Integración RecetaScanner en Dashboard
- [ ] Obtener UUID real de Glow Vision
- [ ] Test local (cámara + escaneo)
- [ ] Deploy a Vercel prod

### ⏳ PRÓXIMOS
- [ ] Ejecutar migration SQL en Supabase
- [ ] Primera receta escaneada (test real)
- [ ] Demo con Glow Vision
- [ ] Fase 1: Monitor Zen + n8n

---

## 📁 ARCHIVOS GENERADOS (Copiar a tu Proyecto)

### 1. Migration SQL
**Ruta**: `migrations/005_nutrient_ocr.sql`
**Acción**: Copiar contenido → Supabase SQL Editor → Ejecutar
**Tablas creadas**: 
- `recetas` (principal)
- `ocr_scans` (log de escaneos)
- `receta_audits` (compliance)

### 2. Endpoint API
**Ruta**: `api/vision-scan.js`
**Función**: POST /api/vision-scan
**Parámetros**:
```json
{
  "image_base64": "iVBORw0KGgo...",
  "optica_id": "uuid-aquí",
  "paciente_id": "uuid-aquí",
  "source_type": "dashboard|whatsapp|api"
}
```
**Respuesta**:
```json
{
  "success": true,
  "receta_id": "uuid",
  "extracted": {
    "od": {"esfera": -1.50, "cilindro": -0.50},
    "oi": {"esfera": -1.50, "cilindro": 0}
  }
}
```

### 3. Componente React
**Ruta**: `src/components/RecetaScanner.jsx`
**Props**:
- `pacienteId` (UUID)
- `opticaId` (UUID)
- `onSuccess` (callback con receta_id)

**Funcionalidades**:
- 📷 Cámara (móvil-first)
- 📁 Galería (upload archivo)
- 👁️ Preview antes de guardar
- ⏳ Indicador de procesamiento
- ✅ Muestra resultado (OD/OI)

### 4. Integración Dashboard
**Ruta**: `src/pages/AukenOpticaDashboard.jsx`
**Cambios**:
- Import: `import RecetaScanner from '../components/RecetaScanner'`
- 3 Tabs: Chat | Recetas | Escanear
- Sidebar: Lista pacientes
- useEffect: Cargar pacientes y recetas

---

## 🔑 VARIABLES DE ENTORNO (.env.local)

```bash
# Nutrient OCR (YA TIENES)
NUTRIENT_API_KEY=pdf_live_1HcH5YSlxLRm85PI1V3mgCroUF2ftvh149lkUgAevV2

# Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-...

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Vercel
VERCEL_URL=https://auken-sistema-oficial.vercel.app
```

---

## ⚙️ CHECKLIST PARA CONTINUAR

### Hoy/Mañana
- [ ] Copia código de RecetaScanner.jsx → tu proyecto
- [ ] Copia código de vision-scan.js → api/
- [ ] Integra RecetaScanner en AukenOpticaDashboard.jsx
- [ ] Ejecuta migration 005 en Supabase
- [ ] Obtén UUID de Glow Vision (en tabla opticas)
- [ ] Reemplaza "glow-vision-uuid" en 2 lugares
- [ ] Test local: `npm run dev` → localhost:5173

### Semana 1
- [ ] Primera receta escaneada exitosamente
- [ ] Verifica BD: `select * from recetas;`
- [ ] Test con 5 recetas reales
- [ ] Deploy a Vercel prod
- [ ] Demo viva con Glow Vision

### Semana 2 (Fase 1)
- [ ] Integración WhatsApp
- [ ] Bot detecta imágenes
- [ ] OCR automático por WA
- [ ] Monitor Zen High-Gama

---

## 🎯 COMANDOS ÚTILES

```bash
# Test local
npm run dev

# Ejecutar migration (en Supabase SQL Editor)
-- Pega contenido de migrations/005_nutrient_ocr.sql
-- Click "Run"

# Verificar BD
-- En Supabase SQL Editor:
SELECT * FROM recetas;
SELECT * FROM ocr_scans;

# Deploy a Vercel
git add .
git commit -m "Fase 0: RecetaScanner integrado"
git push

# Ver logs en Vercel
vercel logs
```

---

## 📊 MÉTRICAS DE ÉXITO (Fase 0)

| Métrica | Target | Actual | Status |
|---------|--------|--------|--------|
| OCR Accuracy | >95% | ___ | ⏳ |
| Processing time | <5 seg | ___ | ⏳ |
| Primera receta | Día 2 | ___ | ⏳ |
| 10 recetas reales | Día 5 | ___ | ⏳ |
| WA integration | Día 3 | ___ | ⏳ |
| Dashboard UX | Sin errores | ___ | ⏳ |

---

## 💬 CONVERSACIÓN CLAUDE (Context)

### Memoria de Habilidades
- ✅ **Nutrient Engine**: API OCR viva (tiene KEY)
- ✅ **Adspirer Agent**: Segmentación y campañas
- ✅ **n8n-CLI Engine**: Workflows automáticos
- ✅ **Zen High-Gama**: Diseño glassmorphism dark
- ✅ **gstack**: Arquitectura escalable

### Próximas Fases
1. **Fase 0.5** (5 días): Nutrient OCR ← AQUÍ
2. **Fase 1** (2 sem): Monitor Zen + n8n
3. **Fase 2** (2.5 sem): Adspirer (campañas)
4. **Fase 3** (2 sem): RLS + Local-first
5. **Fase 4** (2 sem): Multi-óptica (5 pilotes)
6. **Fase 5** (2-3 meses): SaaS público

---

## 🔗 REFERENCIAS IMPORTANTES

### URLs en Vivo
- Dashboard: https://auken-sistema-oficial.vercel.app/optica/dashboard
- Supabase: https://app.supabase.com

### Contactos
- Cliente Piloto: Glow Vision (Punitaqui)
- Desarrollador: Saúl (Constructor Saúl)
- API Key Nutrient: pdf_live_1HcH5YSlxLRm85PI1V3mgCroUF2ftvh149lkUgAevV2

### Documentación Técnica
- Claude Prompting: https://docs.claude.com/
- Supabase SQL: https://supabase.com/docs
- Vercel Functions: https://vercel.com/docs/functions

---

## 📝 NOTAS DE DESARROLLO

### Decisiones Arquitectónicas
✅ **OCR primero** (vs Dashboard vs WhatsApp)
- Razón: Mayor diferenciador, API key ya disponible
- Impacto: Datos limpios para Fases 1-5

✅ **Nutrient + Claude** (vs solo Nutrient)
- Razón: Mayor precisión, parsing estructurado
- Impacto: Confianza >95% en extracción

✅ **Escalable desde Día 1**
- Razón: Mismo código = N ópticas
- Impacto: Replica sin refactoring

### Problemas Conocidos
- ⚠️ RLS deshabilitada (Fase 3 lo arregla)
- ⚠️ Login inseguro (localStorage hardcoded)
- ⚠️ WhatsApp no conectado (Fase 1)

### Roadmap Realista
- MVP OCR: 5 días (Fase 0) ← AHORA
- MVP+WhatsApp: 2 semanas (Fase 0+1)
- Producto cobrable: 1 mes (Fases 0+1+2)
- Multi-óptica: 2.5 meses
- SaaS público: 4.5 meses

---

## 🚀 ÚLTIMA ACCIÓN

**Cuando abras esta conversación en Claude Desktop:**

1. Copia este índice a `PROJECT_INDEX.md` en tu proyecto
2. Mencionáme: "Soy Saúl, continúo Fase 0 con OCR"
3. Cuéntame estado actual:
   - ¿Ya integraste RecetaScanner?
   - ¿Ejecutaste migration SQL?
   - ¿Obtuviste UUID de Glow Vision?
4. Continuaremos sin perder contexto ✅

---

**FIN DEL ÍNDICE**  
*Última actualización: 9 Mayo 2026, 14:12 PM (Chile)*

---

### CÓMO CONTINUAR CON CLAUDE DESKTOP

#### Opción 1: Copiar/Pegar Índice (Recomendado)
1. Copia este archivo → `PROJECT_INDEX.md` en tu proyecto
2. Abre Claude Desktop
3. Pega: "Abre PROJECT_INDEX.md"
4. Claude tendrá contexto completo

#### Opción 2: Exportar Conversación
1. Abre esta conversación en claude.ai
2. Botón ⋮ (arriba derecha) → "Export conversation"
3. Descarga JSON
4. Comparte con Claude Desktop

#### Opción 3: Crear Proyecto en Claude (Recomendado)
1. Abre Claude Desktop
2. File → New Project
3. Arrastra tu carpeta `auken-sistema/`
4. Carga `PROJECT_INDEX.md`
5. Empieza conversación
