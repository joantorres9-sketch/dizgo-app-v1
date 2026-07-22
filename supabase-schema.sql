-- ============================================================
-- DIZGO.APP — Schema completo v1.0
-- Pegar en: Supabase → SQL Editor → New Query → Run
-- ============================================================
--
-- ⚠️ DESACTUALIZADO — NO es la fuente de verdad del esquema real.
-- Este archivo quedó congelado en la v1.0 (11 tablas) y nunca se actualizó
-- cuando el proyecto creció a 70+ tablas con columnas distintas en varios
-- casos (ej. pedidos.cliente_telefono aquí figura como cliente_tel).
-- La base de datos real vive en Supabase y su historial de cambios
-- verdadero son las migraciones aplicadas vía Supabase MCP — para ver el
-- esquema actual, usa `list_tables`/`list_migrations` del MCP de Supabase
-- en vez de confiar en este archivo. Se conserva solo como referencia
-- histórica del arranque del proyecto.
-- ============================================================

-- ── EXTENSIONES ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. TENANTS (Tiendas)
-- ============================================================
CREATE TABLE IF NOT EXISTS tenants (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre        TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL, -- URL amigable: mi-tienda
  pais          TEXT NOT NULL DEFAULT 'COL', -- COL / ECU / MEX
  moneda        TEXT NOT NULL DEFAULT 'COP', -- COP / USD / MXN
  dropi_pais    TEXT DEFAULT 'dropi.co', -- dropi.co / dropi.ec
  logo_url      TEXT,
  licencia      TEXT NOT NULL DEFAULT 'activa', -- activa / vencida / suspendida
  licencia_vence DATE,
  activo        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. PERFILES DE USUARIO (extiende Supabase Auth)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id     UUID REFERENCES tenants(id) ON DELETE SET NULL,
  email         TEXT NOT NULL,
  nombre        TEXT,
  apellido      TEXT,
  rol           TEXT NOT NULL DEFAULT 'owner',
  -- Roles: superadmin | owner | gestor_pedidos | trafficker | tesorero | logistica | readonly
  permisos      JSONB DEFAULT '{}'::JSONB,
  -- Módulos habilitados: {"dashboard":true,"pedidos":true,"wallet":true,...}
  activo        BOOLEAN DEFAULT TRUE,
  avatar_url    TEXT,
  telefono      TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. CATÁLOGO DE PRODUCTOS (núcleo central)
-- ============================================================
CREATE TABLE IF NOT EXISTS productos (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nombre              TEXT NOT NULL,
  sku                 TEXT,
  descripcion         TEXT,
  imagen_url          TEXT,
  -- Estado del producto
  estado              TEXT NOT NULL DEFAULT 'activo',
  -- activo | inactivo | temporada | eliminado
  temporada_inicio    DATE,
  temporada_fin       DATE,
  -- Costos unitarios
  pvp                 NUMERIC(12,2) DEFAULT 0, -- Precio de venta público
  costo_proveedor     NUMERIC(12,2) DEFAULT 0,
  costo_flete_envio   NUMERIC(12,2) DEFAULT 0,
  costo_flete_dev     NUMERIC(12,2) DEFAULT 0, -- flete devolución
  costo_fulfillment   NUMERIC(12,2) DEFAULT 0,
  costo_full_dev      NUMERIC(12,2) DEFAULT 0, -- fulfillment devolución
  -- Porcentajes variables
  pct_publicidad      NUMERIC(5,2) DEFAULT 20,
  pct_comision        NUMERIC(5,2) DEFAULT 3,
  pct_popup           NUMERIC(5,2) DEFAULT 5,
  pct_pasarela        NUMERIC(5,2) DEFAULT 0,
  pct_margen          NUMERIC(5,2) DEFAULT 15,
  -- Combos
  es_combo            BOOLEAN DEFAULT FALSE,
  combo_detalle       JSONB DEFAULT '[]'::JSONB,
  -- [{"producto_id":"uuid","cantidad":1,"nombre":"Men Pro"}]
  -- Dropi
  dropi_producto_id   TEXT,
  dropi_sku           TEXT,
  -- Meta
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. COSTOS FIJOS
-- ============================================================
CREATE TABLE IF NOT EXISTS costos_fijos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  periodo         DATE NOT NULL, -- primer día del mes: 2026-05-01
  categoria       TEXT NOT NULL,
  -- Personal Operativo | Administrativos | Honorarios | Servicios | Plataformas | Testeos | Formación | Otros
  concepto        TEXT NOT NULL,
  cantidad        NUMERIC(10,2) DEFAULT 1,
  valor_unitario  NUMERIC(12,2) DEFAULT 0,
  total           NUMERIC(12,2) GENERATED ALWAYS AS (cantidad * valor_unitario) STORED,
  activo          BOOLEAN DEFAULT TRUE,
  notas           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. PEDIDOS
-- ============================================================
CREATE TABLE IF NOT EXISTS pedidos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- IDs externos
  dropi_orden_id  BIGINT,
  shopify_id      TEXT,
  -- Datos del pedido
  tipo            TEXT DEFAULT 'NORMAL', -- NORMAL | ABANDONED
  estado          TEXT NOT NULL DEFAULT 'NUEVO',
  -- NUEVO | PENDIENTE | CONFIRMADO | DESPACHADO | EN_TRANSITO
  -- NOVEDAD | ENTREGADO | DEVOLUCION | CANCELADO
  estado_anterior TEXT,
  -- Producto
  producto_id     UUID REFERENCES productos(id) ON DELETE SET NULL,
  producto_nombre TEXT, -- guardamos nombre por si se elimina el producto
  cantidad        INTEGER DEFAULT 1,
  pvp             NUMERIC(12,2) DEFAULT 0,
  -- Cliente
  cliente_nombre  TEXT,
  cliente_tel     TEXT,
  cliente_email   TEXT,
  -- Logística
  direccion       TEXT,
  ciudad          TEXT,
  departamento    TEXT,
  pais            TEXT DEFAULT 'COL',
  transportadora  TEXT,
  numero_guia     TEXT,
  -- Costos
  costo_flete     NUMERIC(12,2) DEFAULT 0,
  costo_producto  NUMERIC(12,2) DEFAULT 0,
  ganancia        NUMERIC(12,2) DEFAULT 0, -- de Dropi
  -- Gestión
  motivo_cancel   TEXT,
  notas           TEXT,
  wa_enviado      BOOLEAN DEFAULT FALSE,
  wa_enviado_at   TIMESTAMPTZ,
  -- Fechas
  fecha_pedido    TIMESTAMPTZ,
  fecha_despacho  TIMESTAMPTZ,
  fecha_entrega   TIMESTAMPTZ,
  -- Origen
  fuente          TEXT DEFAULT 'manual',
  -- manual | dropi_api | shopify_api | csv_dropi | csv_shopify
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. WALLET — TRANSACCIONES DROPI
-- ============================================================
CREATE TABLE IF NOT EXISTS wallet_transacciones (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Datos de Dropi (del Excel exportado)
  dropi_id        BIGINT UNIQUE, -- columna ID del Excel
  fecha           TIMESTAMPTZ NOT NULL,
  tipo            TEXT NOT NULL, -- ENTRADA | SALIDA
  monto           NUMERIC(12,2) NOT NULL,
  monto_previo    NUMERIC(12,2),
  orden_id        BIGINT,
  numero_guia     TEXT,
  descripcion     TEXT,
  cuenta          TEXT,
  concepto_retiro TEXT,
  -- Clasificación automática
  categoria       TEXT,
  -- ganancia_dropshipper | flete | publicidad | retiro | otro
  fuente          TEXT DEFAULT 'excel_upload',
  -- excel_upload | dropi_api
  upload_batch_id UUID, -- para identificar cada carga
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. PAUTA PUBLICITARIA
-- ============================================================
CREATE TABLE IF NOT EXISTS pauta (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fecha           DATE NOT NULL,
  plataforma      TEXT NOT NULL, -- META | TIKTOK | GOOGLE | OTRO
  campana         TEXT,
  conjunto        TEXT,
  anuncio         TEXT,
  -- Métricas
  inversion       NUMERIC(12,2) DEFAULT 0,
  impresiones     BIGINT DEFAULT 0,
  clics           BIGINT DEFAULT 0,
  ctr             NUMERIC(6,4) DEFAULT 0, -- porcentaje
  cpm             NUMERIC(10,2) DEFAULT 0,
  cpc             NUMERIC(10,2) DEFAULT 0,
  resultados      INTEGER DEFAULT 0, -- pedidos generados
  cpa             NUMERIC(10,2) DEFAULT 0,
  -- Meta
  fuente          TEXT DEFAULT 'manual', -- manual | meta_api | tiktok_api | csv
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. METAS MENSUALES
-- ============================================================
CREATE TABLE IF NOT EXISTS metas (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  periodo               DATE NOT NULL, -- 2026-05-01
  -- Metas operativas
  meta_pedidos          INTEGER DEFAULT 0,
  meta_pedidos_dia      NUMERIC(8,2) DEFAULT 0,
  meta_ventas           NUMERIC(12,2) DEFAULT 0,
  meta_utilidad         NUMERIC(12,2) DEFAULT 0,
  meta_cpa              NUMERIC(10,2) DEFAULT 0,
  -- Tasas objetivo
  meta_confirmacion     NUMERIC(5,2) DEFAULT 65, -- %
  meta_entrega          NUMERIC(5,2) DEFAULT 78, -- %
  meta_devolucion_max   NUMERIC(5,2) DEFAULT 15, -- %
  -- Pauta
  meta_inversion_pauta  NUMERIC(12,2) DEFAULT 0,
  meta_roas             NUMERIC(6,2) DEFAULT 2,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, periodo)
);

-- ============================================================
-- 9. PQRSF
-- ============================================================
CREATE TABLE IF NOT EXISTS pqrsf (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  numero_radicado TEXT UNIQUE NOT NULL,
  -- Tipo: P=Petición Q=Queja R=Reclamo S=Sugerencia F=Felicitación
  tipo            TEXT NOT NULL DEFAULT 'R',
  -- Datos del cliente
  nombre_cliente  TEXT NOT NULL,
  email_cliente   TEXT,
  telefono        TEXT,
  orden_id        TEXT, -- número de pedido relacionado
  -- Contenido
  asunto          TEXT NOT NULL,
  descripcion     TEXT NOT NULL,
  -- Gestión
  estado          TEXT DEFAULT 'RECIBIDO',
  -- RECIBIDO | EN_GESTION | RESPONDIDO | CERRADO
  respuesta       TEXT,
  respondido_por  UUID REFERENCES profiles(id),
  fecha_respuesta TIMESTAMPTZ,
  -- Fechas
  fecha_limite    TIMESTAMPTZ, -- 15 días hábiles en Colombia
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10. ALERTAS
-- ============================================================
CREATE TABLE IF NOT EXISTS alertas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  -- null = alerta global para todas las tiendas
  tipo            TEXT NOT NULL,
  -- critico | atencion | info | oportunidad | externo
  titulo          TEXT NOT NULL,
  mensaje         TEXT NOT NULL,
  modulo          TEXT, -- módulo relacionado
  icono           TEXT DEFAULT '⚠️',
  activa          BOOLEAN DEFAULT TRUE,
  leida           BOOLEAN DEFAULT FALSE,
  publicada_por   UUID REFERENCES profiles(id),
  -- null = sistema automático
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  expira_at       TIMESTAMPTZ
);

-- ============================================================
-- 11. UPLOADS (registro de cargas de archivos)
-- ============================================================
CREATE TABLE IF NOT EXISTS uploads (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL,
  -- wallet_dropi | pedidos_dropi | pedidos_shopify | pauta_meta | pauta_tiktok
  nombre_archivo  TEXT,
  registros_total INTEGER DEFAULT 0,
  registros_ok    INTEGER DEFAULT 0,
  registros_error INTEGER DEFAULT 0,
  estado          TEXT DEFAULT 'procesando',
  -- procesando | completado | error
  notas           TEXT,
  subido_por      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES DE PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_pedidos_tenant     ON pedidos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado     ON pedidos(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha      ON pedidos(fecha_pedido);
CREATE INDEX IF NOT EXISTS idx_pedidos_producto   ON pedidos(producto_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tenant      ON wallet_transacciones(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wallet_fecha       ON wallet_transacciones(fecha);
CREATE INDEX IF NOT EXISTS idx_wallet_tipo        ON wallet_transacciones(tipo);
CREATE INDEX IF NOT EXISTS idx_pauta_tenant       ON pauta(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pauta_fecha        ON pauta(fecha);
CREATE INDEX IF NOT EXISTS idx_costos_tenant      ON costos_fijos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_costos_periodo     ON costos_fijos(periodo);
CREATE INDEX IF NOT EXISTS idx_productos_tenant   ON productos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alertas_tenant     ON alertas(tenant_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) — Seguridad por tenant
-- ============================================================
ALTER TABLE tenants              ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE costos_fijos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transacciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE pauta                ENABLE ROW LEVEL SECURITY;
ALTER TABLE metas                ENABLE ROW LEVEL SECURITY;
ALTER TABLE pqrsf                ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploads              ENABLE ROW LEVEL SECURITY;

-- ── POLÍTICAS RLS ────────────────────────────────────────────

-- Profiles: cada usuario ve solo su perfil
CREATE POLICY "profiles_self" ON profiles
  FOR ALL USING (auth.uid() = id);

-- Superadmin ve todo (identificado por rol en profiles)
CREATE POLICY "superadmin_all_tenants" ON tenants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.rol = 'superadmin'
    )
  );

-- Dueño y equipo ven solo su tenant
CREATE POLICY "tenant_isolation_tenants" ON tenants
  FOR SELECT USING (
    id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  );

-- Política genérica por tenant para tablas operativas
CREATE POLICY "tenant_isolation_pedidos" ON pedidos
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'superadmin')
  );

CREATE POLICY "tenant_isolation_wallet" ON wallet_transacciones
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'superadmin')
  );

CREATE POLICY "tenant_isolation_productos" ON productos
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'superadmin')
  );

CREATE POLICY "tenant_isolation_costos" ON costos_fijos
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'superadmin')
  );

CREATE POLICY "tenant_isolation_pauta" ON pauta
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'superadmin')
  );

CREATE POLICY "tenant_isolation_metas" ON metas
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'superadmin')
  );

CREATE POLICY "tenant_isolation_pqrsf" ON pqrsf
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'superadmin')
  );

CREATE POLICY "tenant_isolation_uploads" ON uploads
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'superadmin')
  );

-- Alertas: globales (tenant_id null) + propias
CREATE POLICY "alertas_visibles" ON alertas
  FOR SELECT USING (
    tenant_id IS NULL
    OR tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'superadmin')
  );

CREATE POLICY "alertas_admin" ON alertas
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('superadmin','owner'))
  );

-- ============================================================
-- FUNCIÓN: Auto-crear profile al registrarse
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, rol)
  VALUES (NEW.id, NEW.email, 'owner')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: se dispara al crear usuario en auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- FUNCIÓN: Auto-generar número de radicado PQRSF
-- ============================================================
CREATE OR REPLACE FUNCTION generar_radicado()
RETURNS TRIGGER AS $$
BEGIN
  NEW.numero_radicado := 'DZ-' ||
    TO_CHAR(NOW(), 'YYYYMM') || '-' ||
    LPAD(CAST(EXTRACT(EPOCH FROM NOW()) AS BIGINT) % 100000 + '', 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_radicado ON pqrsf;
CREATE TRIGGER tr_radicado
  BEFORE INSERT ON pqrsf
  FOR EACH ROW EXECUTE FUNCTION generar_radicado();

-- ============================================================
-- DATOS INICIALES — Superadmin Joan
-- ============================================================
-- NOTA: El superadmin se crea primero en Authentication → Add User
-- Luego correr esto con el UUID obtenido:

-- INSERT INTO tenants (nombre, slug, pais, moneda)
-- VALUES ('DIZGO Admin', 'dizgo-admin', 'COL', 'COP');

-- UPDATE profiles
-- SET rol = 'superadmin',
--     nombre = 'Joan',
--     apellido = 'Torres',
--     tenant_id = (SELECT id FROM tenants WHERE slug = 'dizgo-admin')
-- WHERE email = 'joantorres9@gmail.com';

-- ============================================================
-- FIN DEL SCHEMA
-- ============================================================
SELECT 'DIZGO Schema v1.0 instalado correctamente ✅' AS resultado;
