'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── CONFIGURACIÓN POR PAÍS ────────────────────────────────────
const CONFIG_PAIS: Record<string, {
  nombre: string; moneda: string; simbolo: string
  ciudades: string[]; capital: string
  transportadoras: string[]
  productos: { nombre: string; costo: number; pvp: number; categoria: string; descripcion: string }[]
  cf_conceptos: { categoria: string; concepto: string; valor: number }[]
  nombres: string[]; apellidos: string[]
}> = {
  COL: {
    nombre: 'Colombia', moneda: 'COP', simbolo: '$',
    ciudades: ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Bucaramanga', 'Pereira', 'Cartagena', 'Cúcuta'],
    capital: 'Bogotá',
    transportadoras: ['Servientrega', 'Coordinadora', 'Interrapidísimo', 'TCC'],
    productos: [
      { nombre: 'Masajeador Cervical Eléctrico Pro', costo: 28000, pvp: 89900, categoria: 'Salud y bienestar', descripcion: 'Masajeador de cuello y hombros con calor y vibración 3D' },
      { nombre: 'Organizador Cables Magnético x5', costo: 8500, pvp: 34900, categoria: 'Tecnología', descripcion: 'Set de 5 organizadores magnéticos para cables USB' },
      { nombre: 'Soporte Celular Carro Magnético 360°', costo: 7000, pvp: 29900, categoria: 'Autopartes', descripcion: 'Soporte magnético universal para tablero y rejilla del carro' },
    ],
    cf_conceptos: [
      { categoria: 'Tecnología', concepto: 'Shopify / WooCommerce', valor: 120000 },
      { categoria: 'Tecnología', concepto: 'DIZGO SaaS', valor: 89000 },
      { categoria: 'Comunicaciones', concepto: 'WhatsApp Business API', valor: 45000 },
      { categoria: 'Personal', concepto: 'Confirmador pedidos (part)', valor: 700000 },
      { categoria: 'Servicios', concepto: 'Internet y teléfono', valor: 80000 },
    ],
    nombres: ['Carlos', 'María', 'Juan', 'Ana', 'Luis', 'Sofia', 'Diego', 'Valentina', 'Andrés', 'Carolina'],
    apellidos: ['Pérez', 'López', 'García', 'Martínez', 'Rodríguez', 'Hernández', 'Gómez', 'Torres', 'Flores', 'Díaz'],
  },
  ECU: {
    nombre: 'Ecuador', moneda: 'USD', simbolo: '$',
    ciudades: ['Quito', 'Guayaquil', 'Cuenca', 'Ambato', 'Manta', 'Loja'],
    capital: 'Quito',
    transportadoras: ['Servientrega Ecuador', 'Laar Courier', 'Speed', 'Tramaco'],
    productos: [
      { nombre: 'Masajeador Cervical Pro', costo: 8, pvp: 25, categoria: 'Salud y bienestar', descripcion: 'Masajeador eléctrico de cuello con calor' },
      { nombre: 'Organizador Cables x5', costo: 2.5, pvp: 9.99, categoria: 'Tecnología', descripcion: 'Organizadores magnéticos para cables USB' },
      { nombre: 'Soporte Celular Magnético', costo: 2, pvp: 8.99, categoria: 'Autopartes', descripcion: 'Soporte magnético para carro 360°' },
    ],
    cf_conceptos: [
      { categoria: 'Tecnología', concepto: 'Shopify / WooCommerce', valor: 35 },
      { categoria: 'Tecnología', concepto: 'DIZGO SaaS', valor: 25 },
      { categoria: 'Comunicaciones', concepto: 'WhatsApp Business API', valor: 15 },
      { categoria: 'Personal', concepto: 'Confirmador pedidos (part)', valor: 200 },
      { categoria: 'Servicios', concepto: 'Internet y teléfono', valor: 25 },
    ],
    nombres: ['Miguel', 'Gabriela', 'Roberto', 'Isabella', 'Fernando', 'Daniela', 'Sebastián', 'Valeria'],
    apellidos: ['Salazar', 'Vega', 'Mora', 'Jiménez', 'Castro', 'Ríos', 'Guerrero', 'Ortiz'],
  },
  MEX: {
    nombre: 'México', moneda: 'MXN', simbolo: '$',
    ciudades: ['Ciudad de México', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana', 'León', 'Cancún'],
    capital: 'Ciudad de México',
    transportadoras: ['Estafeta', 'DHL México', 'FedEx México', 'Paquetexpress'],
    productos: [
      { nombre: 'Masajeador Cervical Eléctrico', costo: 180, pvp: 599, categoria: 'Salud y bienestar', descripcion: 'Masajeador de cuello con calor y vibración 3D' },
      { nombre: 'Organizador Cables Magnético', costo: 55, pvp: 199, categoria: 'Tecnología', descripcion: 'Set organizadores magnéticos cables USB' },
      { nombre: 'Soporte Celular Magnético', costo: 45, pvp: 169, categoria: 'Autopartes', descripcion: 'Soporte magnético para carro 360°' },
    ],
    cf_conceptos: [
      { categoria: 'Tecnología', concepto: 'Shopify', valor: 700 },
      { categoria: 'Tecnología', concepto: 'DIZGO SaaS', valor: 500 },
      { categoria: 'Comunicaciones', concepto: 'WhatsApp Business', valor: 300 },
      { categoria: 'Personal', concepto: 'Confirmador pedidos', valor: 4000 },
      { categoria: 'Servicios', concepto: 'Internet y teléfono', valor: 600 },
    ],
    nombres: ['José', 'Guadalupe', 'Francisco', 'Fernanda', 'Javier', 'Alejandra', 'Eduardo', 'Mariana'],
    apellidos: ['González', 'Hernández', 'López', 'Martínez', 'García', 'Sánchez', 'Ramírez', 'Torres'],
  },
  PER: {
    nombre: 'Perú', moneda: 'PEN', simbolo: 'S/',
    ciudades: ['Lima', 'Arequipa', 'Trujillo', 'Chiclayo', 'Piura', 'Cusco'],
    capital: 'Lima',
    transportadoras: ['Olva Courier', 'Shalom', 'Skynet Perú', 'Cruz del Sur'],
    productos: [
      { nombre: 'Masajeador Cervical Eléctrico', costo: 30, pvp: 99, categoria: 'Salud y bienestar', descripcion: 'Masajeador eléctrico de cuello con calor' },
      { nombre: 'Organizador Cables Magnético', costo: 9, pvp: 29, categoria: 'Tecnología', descripcion: 'Set organizadores cables USB' },
      { nombre: 'Soporte Celular Magnético', costo: 7, pvp: 24, categoria: 'Autopartes', descripcion: 'Soporte magnético para carro' },
    ],
    cf_conceptos: [
      { categoria: 'Tecnología', concepto: 'Shopify', valor: 120 },
      { categoria: 'Tecnología', concepto: 'DIZGO SaaS', valor: 90 },
      { categoria: 'Comunicaciones', concepto: 'WhatsApp Business', valor: 50 },
      { categoria: 'Personal', concepto: 'Confirmador pedidos', valor: 900 },
      { categoria: 'Servicios', concepto: 'Internet y teléfono', valor: 80 },
    ],
    nombres: ['Ricardo', 'Lucía', 'Manuel', 'Paola', 'Alejandro', 'Stephanie', 'Hugo', 'Natalia'],
    apellidos: ['Quispe', 'Mamani', 'Huanca', 'Cárdenas', 'Vásquez', 'Flores', 'Mendoza', 'Chávez'],
  },
  CHL: {
    nombre: 'Chile', moneda: 'CLP', simbolo: '$',
    ciudades: ['Santiago', 'Valparaíso', 'Concepción', 'La Serena', 'Antofagasta', 'Temuco'],
    capital: 'Santiago',
    transportadoras: ['Starken', 'Chilexpress', 'Blue Express', 'DHL Chile'],
    productos: [
      { nombre: 'Masajeador Cervical Eléctrico', costo: 7500, pvp: 24990, categoria: 'Salud y bienestar', descripcion: 'Masajeador de cuello con calor y vibración' },
      { nombre: 'Organizador Cables Magnético', costo: 2200, pvp: 7990, categoria: 'Tecnología', descripcion: 'Set organizadores magnéticos cables' },
      { nombre: 'Soporte Celular Magnético', costo: 1800, pvp: 6990, categoria: 'Autopartes', descripcion: 'Soporte magnético para auto 360°' },
    ],
    cf_conceptos: [
      { categoria: 'Tecnología', concepto: 'Shopify', valor: 30000 },
      { categoria: 'Tecnología', concepto: 'DIZGO SaaS', valor: 22000 },
      { categoria: 'Comunicaciones', concepto: 'WhatsApp Business', valor: 12000 },
      { categoria: 'Personal', concepto: 'Confirmador pedidos', valor: 180000 },
      { categoria: 'Servicios', concepto: 'Internet y teléfono', valor: 20000 },
    ],
    nombres: ['Matías', 'Valentina', 'Sebastián', 'Camila', 'Nicolás', 'Fernanda', 'Ignacio', 'Javiera'],
    apellidos: ['Muñoz', 'Rojas', 'Fuentes', 'Herrera', 'Medina', 'Contreras', 'Espinoza', 'Castillo'],
  },
  ARG: {
    nombre: 'Argentina', moneda: 'ARS', simbolo: '$',
    ciudades: ['Buenos Aires', 'Córdoba', 'Rosario', 'Mendoza', 'La Plata', 'Tucumán', 'Mar del Plata'],
    capital: 'Buenos Aires',
    transportadoras: ['Andreani', 'OCA', 'Correo Argentino', 'Via Cargo'],
    productos: [
      { nombre: 'Masajeador Cervical Eléctrico', costo: 8500, pvp: 28000, categoria: 'Salud y bienestar', descripcion: 'Masajeador de cuello con calor y vibración' },
      { nombre: 'Organizador Cables Magnético', costo: 2500, pvp: 8500, categoria: 'Tecnología', descripcion: 'Set organizadores magnéticos cables' },
      { nombre: 'Soporte Celular Magnético', costo: 2000, pvp: 7200, categoria: 'Autopartes', descripcion: 'Soporte magnético para auto 360°' },
    ],
    cf_conceptos: [
      { categoria: 'Tecnología', concepto: 'Shopify', valor: 32000 },
      { categoria: 'Tecnología', concepto: 'DIZGO SaaS', valor: 24000 },
      { categoria: 'Comunicaciones', concepto: 'WhatsApp Business', valor: 13000 },
      { categoria: 'Personal', concepto: 'Confirmador pedidos', valor: 200000 },
      { categoria: 'Servicios', concepto: 'Internet y teléfono', valor: 22000 },
    ],
    nombres: ['Martín', 'Florencia', 'Leandro', 'Melina', 'Facundo', 'Sofía', 'Gonzalo', 'Agustina'],
    apellidos: ['González', 'Rodríguez', 'Gómez', 'Fernández', 'López', 'Díaz', 'Martínez', 'Pérez'],
  },
  PAN: {
    nombre: 'Panamá', moneda: 'USD', simbolo: '$',
    ciudades: ['Ciudad de Panamá', 'Colón', 'David', 'Santiago', 'Chitré', 'La Chorrera'],
    capital: 'Ciudad de Panamá',
    transportadoras: ['Urbano Express', 'DHL Panamá', 'MRW Panamá', 'Fedex Panamá'],
    productos: [
      { nombre: 'Masajeador Cervical Eléctrico', costo: 8, pvp: 25, categoria: 'Salud', descripcion: 'Masajeador eléctrico de cuello con calor' },
      { nombre: 'Organizador Cables Magnético x5', costo: 2.5, pvp: 9.99, categoria: 'Tecnología', descripcion: 'Organizadores magnéticos para cables' },
      { nombre: 'Soporte Celular Carro Magnético', costo: 2, pvp: 8.99, categoria: 'Autopartes', descripcion: 'Soporte magnético para carro 360°' },
    ],
    cf_conceptos: [
      { categoria: 'Tecnología', concepto: 'Shopify', valor: 35 },
      { categoria: 'Tecnología', concepto: 'DIZGO SaaS', valor: 25 },
      { categoria: 'Comunicaciones', concepto: 'WhatsApp Business', valor: 15 },
      { categoria: 'Personal', concepto: 'Confirmador pedidos', valor: 220 },
      { categoria: 'Servicios', concepto: 'Internet y teléfono', valor: 30 },
    ],
    nombres: ['José', 'María', 'Carlos', 'Ana', 'Luis', 'Diana', 'Ricardo', 'Valentina'],
    apellidos: ['González', 'Martínez', 'López', 'García', 'Rodríguez', 'Herrera', 'Castillo', 'Morales'],
  },
  CRI: {
    nombre: 'Costa Rica', moneda: 'CRC', simbolo: '₡',
    ciudades: ['San José', 'Alajuela', 'Desamparados', 'Cartago', 'Heredia', 'Liberia'],
    capital: 'San José',
    transportadoras: ['Correos de Costa Rica', 'Guatuso', 'TransExpress', 'DHL Costa Rica'],
    productos: [
      { nombre: 'Masajeador Cervical Eléctrico', costo: 4500, pvp: 14900, categoria: 'Salud', descripcion: 'Masajeador eléctrico de cuello con calor' },
      { nombre: 'Organizador Cables Magnético x5', costo: 1400, pvp: 5900, categoria: 'Tecnología', descripcion: 'Organizadores magnéticos para cables' },
      { nombre: 'Soporte Celular Carro Magnético', costo: 1100, pvp: 4900, categoria: 'Autopartes', descripcion: 'Soporte magnético para carro 360°' },
    ],
    cf_conceptos: [
      { categoria: 'Tecnología', concepto: 'Shopify', valor: 19000 },
      { categoria: 'Tecnología', concepto: 'DIZGO SaaS', valor: 14000 },
      { categoria: 'Comunicaciones', concepto: 'WhatsApp Business', valor: 8000 },
      { categoria: 'Personal', concepto: 'Confirmador pedidos', valor: 120000 },
      { categoria: 'Servicios', concepto: 'Internet y teléfono', valor: 15000 },
    ],
    nombres: ['Andrés', 'Gabriela', 'Diego', 'Sofía', 'Mauricio', 'Adriana', 'Esteban', 'Paola'],
    apellidos: ['Jiménez', 'Solano', 'Vargas', 'Mora', 'Quesada', 'Arias', 'Chinchilla', 'Rojas'],
  },
  GTM: {
    nombre: 'Guatemala', moneda: 'GTQ', simbolo: 'Q',
    ciudades: ['Ciudad de Guatemala', 'Mixco', 'Villa Nueva', 'Quetzaltenango', 'Escuintla', 'Cobán'],
    capital: 'Ciudad de Guatemala',
    transportadoras: ['Guatex', 'DHL Guatemala', 'Flash Cargo', 'Forza'],
    productos: [
      { nombre: 'Masajeador Cervical Eléctrico', costo: 62, pvp: 199, categoria: 'Salud', descripcion: 'Masajeador eléctrico de cuello con calor' },
      { nombre: 'Organizador Cables Magnético x5', costo: 19, pvp: 75, categoria: 'Tecnología', descripcion: 'Organizadores magnéticos para cables' },
      { nombre: 'Soporte Celular Carro Magnético', costo: 15, pvp: 65, categoria: 'Autopartes', descripcion: 'Soporte magnético para carro 360°' },
    ],
    cf_conceptos: [
      { categoria: 'Tecnología', concepto: 'Shopify', valor: 270 },
      { categoria: 'Tecnología', concepto: 'DIZGO SaaS', valor: 195 },
      { categoria: 'Comunicaciones', concepto: 'WhatsApp Business', valor: 115 },
      { categoria: 'Personal', concepto: 'Confirmador pedidos', valor: 1600 },
      { categoria: 'Servicios', concepto: 'Internet y teléfono', valor: 200 },
    ],
    nombres: ['Juan', 'María', 'Pedro', 'Rosa', 'Miguel', 'Carmen', 'Jorge', 'Elena'],
    apellidos: ['García', 'López', 'Pérez', 'Martínez', 'González', 'Hernández', 'Chávez', 'Morales'],
  },
  BOL: {
    nombre: 'Bolivia', moneda: 'BOB', simbolo: 'Bs.',
    ciudades: ['Santa Cruz', 'La Paz', 'Cochabamba', 'Oruro', 'Sucre', 'Potosí'],
    capital: 'La Paz',
    transportadoras: ['DHL Bolivia', 'Trans Copacabana', 'Urbano Bolivia', 'EcoBol'],
    productos: [
      { nombre: 'Masajeador Cervical Eléctrico', costo: 55, pvp: 179, categoria: 'Salud', descripcion: 'Masajeador eléctrico de cuello con calor' },
      { nombre: 'Organizador Cables Magnético x5', costo: 17, pvp: 65, categoria: 'Tecnología', descripcion: 'Organizadores magnéticos para cables' },
      { nombre: 'Soporte Celular Carro Magnético', costo: 13, pvp: 55, categoria: 'Autopartes', descripcion: 'Soporte magnético para carro 360°' },
    ],
    cf_conceptos: [
      { categoria: 'Tecnología', concepto: 'Shopify', valor: 240 },
      { categoria: 'Tecnología', concepto: 'DIZGO SaaS', valor: 175 },
      { categoria: 'Comunicaciones', concepto: 'WhatsApp Business', valor: 100 },
      { categoria: 'Personal', concepto: 'Confirmador pedidos', valor: 1400 },
      { categoria: 'Servicios', concepto: 'Internet y teléfono', valor: 180 },
    ],
    nombres: ['Juan', 'María', 'Carlos', 'Rosa', 'Felipe', 'Lucía', 'Rodrigo', 'Patricia'],
    apellidos: ['Mamani', 'Quispe', 'Flores', 'Condori', 'Cruz', 'Chávez', 'Vargas', 'Morales'],
  },
  URY: {
    nombre: 'Uruguay', moneda: 'UYU', simbolo: '$',
    ciudades: ['Montevideo', 'Salto', 'Ciudad de la Costa', 'Paysandú', 'Las Piedras', 'Rivera'],
    capital: 'Montevideo',
    transportadoras: ['Correo Uruguayo', 'OCA Uruguay', 'Uruexpress', 'DHL Uruguay'],
    productos: [
      { nombre: 'Masajeador Cervical Eléctrico', costo: 320, pvp: 990, categoria: 'Salud', descripcion: 'Masajeador eléctrico de cuello con calor' },
      { nombre: 'Organizador Cables Magnético x5', costo: 98, pvp: 390, categoria: 'Tecnología', descripcion: 'Organizadores magnéticos para cables' },
      { nombre: 'Soporte Celular Carro Magnético', costo: 78, pvp: 320, categoria: 'Autopartes', descripcion: 'Soporte magnético para carro 360°' },
    ],
    cf_conceptos: [
      { categoria: 'Tecnología', concepto: 'Shopify', valor: 1400 },
      { categoria: 'Tecnología', concepto: 'DIZGO SaaS', valor: 1000 },
      { categoria: 'Comunicaciones', concepto: 'WhatsApp Business', valor: 580 },
      { categoria: 'Personal', concepto: 'Confirmador pedidos', valor: 9000 },
      { categoria: 'Servicios', concepto: 'Internet y teléfono', valor: 1100 },
    ],
    nombres: ['Santiago', 'Valentina', 'Nicolás', 'Camila', 'Mateo', 'Lucía', 'Agustín', 'Florencia'],
    apellidos: ['González', 'Rodríguez', 'García', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Pérez'],
  },
  VEN: {
    nombre: 'Venezuela', moneda: 'USD', simbolo: '$',
    ciudades: ['Caracas', 'Maracaibo', 'Valencia', 'Barquisimeto', 'Maracay', 'Barcelona'],
    capital: 'Caracas',
    transportadoras: ['Zoom', 'MRW Venezuela', 'Domesa', 'Tealca'],
    productos: [
      { nombre: 'Masajeador Cervical Eléctrico', costo: 8, pvp: 25, categoria: 'Salud', descripcion: 'Masajeador eléctrico de cuello con calor' },
      { nombre: 'Organizador Cables Magnético x5', costo: 2.5, pvp: 9.99, categoria: 'Tecnología', descripcion: 'Organizadores magnéticos para cables' },
      { nombre: 'Soporte Celular Carro Magnético', costo: 2, pvp: 8.99, categoria: 'Autopartes', descripcion: 'Soporte magnético para carro 360°' },
    ],
    cf_conceptos: [
      { categoria: 'Tecnología', concepto: 'Shopify', valor: 35 },
      { categoria: 'Tecnología', concepto: 'DIZGO SaaS', valor: 25 },
      { categoria: 'Comunicaciones', concepto: 'WhatsApp Business', valor: 15 },
      { categoria: 'Personal', concepto: 'Confirmador pedidos', valor: 150 },
      { categoria: 'Servicios', concepto: 'Internet y teléfono', valor: 20 },
    ],
    nombres: ['José', 'María', 'Carlos', 'Ana', 'Miguel', 'Gabriela', 'Luis', 'Valentina'],
    apellidos: ['González', 'Rodríguez', 'Pérez', 'García', 'Martínez', 'López', 'Hernández', 'Díaz'],
  },
  HND: {
    nombre: 'Honduras', moneda: 'HNL', simbolo: 'L',
    ciudades: ['Tegucigalpa', 'San Pedro Sula', 'Choloma', 'La Ceiba', 'El Progreso', 'Comayagua'],
    capital: 'Tegucigalpa',
    transportadoras: ['DHL Honduras', 'Cargo Trans', 'Urbano Honduras', 'Catracho Express'],
    productos: [
      { nombre: 'Masajeador Cervical Eléctrico', costo: 197, pvp: 620, categoria: 'Salud', descripcion: 'Masajeador eléctrico de cuello con calor' },
      { nombre: 'Organizador Cables Magnético x5', costo: 61, pvp: 245, categoria: 'Tecnología', descripcion: 'Organizadores magnéticos para cables' },
      { nombre: 'Soporte Celular Carro Magnético', costo: 49, pvp: 200, categoria: 'Autopartes', descripcion: 'Soporte magnético para carro 360°' },
    ],
    cf_conceptos: [
      { categoria: 'Tecnología', concepto: 'Shopify', valor: 860 },
      { categoria: 'Tecnología', concepto: 'DIZGO SaaS', valor: 620 },
      { categoria: 'Comunicaciones', concepto: 'WhatsApp Business', valor: 370 },
      { categoria: 'Personal', concepto: 'Confirmador pedidos', valor: 5000 },
      { categoria: 'Servicios', concepto: 'Internet y teléfono', valor: 620 },
    ],
    nombres: ['José', 'María', 'Juan', 'Ana', 'Carlos', 'Rosa', 'Miguel', 'Karla'],
    apellidos: ['Martínez', 'García', 'López', 'Hernández', 'González', 'Rodríguez', 'Flores', 'Cruz'],
  },
  SLV: {
    nombre: 'El Salvador', moneda: 'USD', simbolo: '$',
    ciudades: ['San Salvador', 'Santa Ana', 'Soyapango', 'San Miguel', 'Nueva San Salvador', 'Mejicanos'],
    capital: 'San Salvador',
    transportadoras: ['DHL El Salvador', 'Urbano Express SV', 'Correos El Salvador', 'Cargo Plus'],
    productos: [
      { nombre: 'Masajeador Cervical Eléctrico', costo: 8, pvp: 25, categoria: 'Salud', descripcion: 'Masajeador eléctrico de cuello con calor' },
      { nombre: 'Organizador Cables Magnético x5', costo: 2.5, pvp: 9.99, categoria: 'Tecnología', descripcion: 'Organizadores magnéticos para cables' },
      { nombre: 'Soporte Celular Carro Magnético', costo: 2, pvp: 8.99, categoria: 'Autopartes', descripcion: 'Soporte magnético para carro 360°' },
    ],
    cf_conceptos: [
      { categoria: 'Tecnología', concepto: 'Shopify', valor: 35 },
      { categoria: 'Tecnología', concepto: 'DIZGO SaaS', valor: 25 },
      { categoria: 'Comunicaciones', concepto: 'WhatsApp Business', valor: 15 },
      { categoria: 'Personal', concepto: 'Confirmador pedidos', valor: 200 },
      { categoria: 'Servicios', concepto: 'Internet y teléfono', valor: 25 },
    ],
    nombres: ['José', 'María', 'Carlos', 'Ana', 'Roberto', 'Sofía', 'Ernesto', 'Diana'],
    apellidos: ['García', 'Martínez', 'López', 'González', 'Hernández', 'Rodríguez', 'Flores', 'Cruz'],
  },
  DOM: {
    nombre: 'República Dominicana', moneda: 'DOP', simbolo: 'RD$',
    ciudades: ['Santo Domingo', 'Santiago de los Caballeros', 'La Romana', 'San Pedro de Macorís', 'San Francisco de Macorís', 'La Vega'],
    capital: 'Santo Domingo',
    transportadoras: ['Caribe Express', 'DHL Dominicana', 'Vimenpaq', 'Domex'],
    productos: [
      { nombre: 'Masajeador Cervical Eléctrico', costo: 470, pvp: 1490, categoria: 'Salud', descripcion: 'Masajeador eléctrico de cuello con calor' },
      { nombre: 'Organizador Cables Magnético x5', costo: 145, pvp: 590, categoria: 'Tecnología', descripcion: 'Organizadores magnéticos para cables' },
      { nombre: 'Soporte Celular Carro Magnético', costo: 115, pvp: 490, categoria: 'Autopartes', descripcion: 'Soporte magnético para carro 360°' },
    ],
    cf_conceptos: [
      { categoria: 'Tecnología', concepto: 'Shopify', valor: 2050 },
      { categoria: 'Tecnología', concepto: 'DIZGO SaaS', valor: 1470 },
      { categoria: 'Comunicaciones', concepto: 'WhatsApp Business', valor: 880 },
      { categoria: 'Personal', concepto: 'Confirmador pedidos', valor: 11800 },
      { categoria: 'Servicios', concepto: 'Internet y teléfono', valor: 1470 },
    ],
    nombres: ['José', 'María', 'Juan', 'Ana', 'Carlos', 'Paola', 'Miguel', 'Rosanna'],
    apellidos: ['Pérez', 'García', 'Martínez', 'González', 'Rodríguez', 'Santos', 'Cruz', 'Reyes'],
  },
  PRY: {
    nombre: 'Paraguay', moneda: 'PYG', simbolo: '₲',
    ciudades: ['Asunción', 'Ciudad del Este', 'San Lorenzo', 'Luque', 'Capiatá', 'Lambaré'],
    capital: 'Asunción',
    transportadoras: ['DHL Paraguay', 'Jet Sur', 'Laar Courier PY', 'Trans Express PY'],
    productos: [
      { nombre: 'Masajeador Cervical Eléctrico', costo: 55000, pvp: 175000, categoria: 'Salud', descripcion: 'Masajeador eléctrico de cuello con calor' },
      { nombre: 'Organizador Cables Magnético x5', costo: 17000, pvp: 65000, categoria: 'Tecnología', descripcion: 'Organizadores magnéticos para cables' },
      { nombre: 'Soporte Celular Carro Magnético', costo: 13500, pvp: 55000, categoria: 'Autopartes', descripcion: 'Soporte magnético para carro 360°' },
    ],
    cf_conceptos: [
      { categoria: 'Tecnología', concepto: 'Shopify', valor: 235000 },
      { categoria: 'Tecnología', concepto: 'DIZGO SaaS', valor: 168000 },
      { categoria: 'Comunicaciones', concepto: 'WhatsApp Business', valor: 100000 },
      { categoria: 'Personal', concepto: 'Confirmador pedidos', valor: 1350000 },
      { categoria: 'Servicios', concepto: 'Internet y teléfono', valor: 167000 },
    ],
    nombres: ['José', 'María', 'Juan', 'Ana', 'Diego', 'Sofía', 'Pablo', 'Claudia'],
    apellidos: ['González', 'Rodríguez', 'García', 'López', 'Martínez', 'Fernández', 'Romero', 'Sánchez'],
  },
  ESP: {
    nombre: 'España', moneda: 'EUR', simbolo: '€',
    ciudades: ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Zaragoza', 'Málaga', 'Bilbao'],
    capital: 'Madrid',
    transportadoras: ['Correos España', 'SEUR', 'MRW España', 'GLS Spain'],
    productos: [
      { nombre: 'Masajeador Cervical Eléctrico', costo: 12, pvp: 39.99, categoria: 'Salud', descripcion: 'Masajeador eléctrico de cuello con calor y vibración 3D' },
      { nombre: 'Organizador Cables Magnético x5', costo: 3.5, pvp: 14.99, categoria: 'Tecnología', descripcion: 'Set 5 organizadores magnéticos para cables USB' },
      { nombre: 'Soporte Celular Carro Magnético', costo: 3, pvp: 12.99, categoria: 'Autopartes', descripcion: 'Soporte magnético universal para coche 360°' },
    ],
    cf_conceptos: [
      { categoria: 'Tecnología', concepto: 'Shopify', valor: 32 },
      { categoria: 'Tecnología', concepto: 'DIZGO SaaS', valor: 25 },
      { categoria: 'Comunicaciones', concepto: 'WhatsApp Business', valor: 15 },
      { categoria: 'Personal', concepto: 'Gestor de pedidos (part)', valor: 400 },
      { categoria: 'Servicios', concepto: 'Internet y teléfono', valor: 45 },
    ],
    nombres: ['Antonio', 'María', 'José', 'Carmen', 'David', 'Laura', 'Javier', 'Ana'],
    apellidos: ['García', 'Martínez', 'López', 'González', 'Rodríguez', 'Hernández', 'Sánchez', 'Pérez'],
  },
}

const PASOS_SEED = [
  { key: 'productos', label: '🛍️ Productos', desc: '3 productos con costos reales del país' },
  { key: 'costos', label: '📊 Costos Fijos', desc: '5 conceptos × 6 meses' },
  { key: 'pedidos', label: '📦 Pedidos', desc: '~528 pedidos en 6 meses (tasas reales)' },
  { key: 'pauta', label: '📡 Pauta', desc: '12 campañas Meta Ads con métricas reales' },
  { key: 'wallet', label: '💳 Wallet', desc: 'Entradas por recaudo y retiros' },
  { key: 'libro_caja', label: '📒 Libro de Caja', desc: 'Espejo financiero 6 meses' },
  { key: 'metas', label: '🎯 Metas', desc: '6 meses de objetivos progresivos' },
  { key: 'bodegas', label: '🏭 Bodega', desc: '2 bodegas + inventario inicial' },
  { key: 'pqrsf', label: '📬 PQRSF', desc: '15 casos simulados (quejas, reclamos, preguntas)' },
  { key: 'alertas', label: '🚨 Alertas', desc: '8 alertas por módulo para demostración' },
  { key: 'nomina', label: '👥 Nómina', desc: '2 colaboradores + tasas por país' },
  { key: 'inversion', label: '💰 Inversión', desc: '3 activos fijos + 1 crédito capital trabajo' },
  { key: 'cxp', label: '📋 Cuentas por Pagar', desc: '5 CXP (1 vencida para demo)' },
  { key: 'metas_diarias',     label: '📅 Seguimiento Diario', desc: '30 días de avance diario real' },
  { key: 'nomina_procesos',   label: '🏢 Procesos Nómina',   desc: '3 procesos organizacionales' },
  { key: 'inversion_capital', label: '💼 Capital & Socios',  desc: 'Capital propio + socio fundador' },
  { key: 'equilibrio',        label: '⚖️ Punto Equilibrio',  desc: 'PE configurado por mes y país' },
  { key: 'whatsapp',          label: '💬 Centro Contacto',   desc: '5 templates WhatsApp + contexto tienda' },
  { key: 'logistica',         label: '🚚 Logística',         desc: 'Transportadoras + 7 scripts novedades IA' },
]

function rnd(arr: unknown[]) { return arr[Math.floor(Math.random() * arr.length)] }
function rndInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }

export default function AdminPage() {
  const supabase = createClient()
  const [tenantId, setTenantId] = useState('')
  const [paisCodigo, setPaisCodigo] = useState('COL')
  const [loading, setLoading] = useState(true)
  const [seedActivo, setSeedActivo] = useState(false)
  const [progreso, setProgreso] = useState<Record<string, 'pendiente' | 'cargando' | 'ok' | 'error'>>({})
  const [log, setLog] = useState<string[]>([])
  const [yaHayDatos, setYaHayDatos] = useState(false)
  const [conteos, setConteos] = useState<Record<string, number>>({})

  const addLog = (msg: string) => setLog(prev => [`${new Date().toLocaleTimeString('es-CO')} — ${msg}`, ...prev.slice(0, 49)])

  // El sembrador insertaba datos sin revisar si Supabase devolvía error, así que un insert que
  // fallara (columna inexistente, NOT NULL sin valor...) igual reportaba "✅ cargado" — pasó con
  // PQRSF y Pauta. Este helper centraliza insert + verificación + log real para cada paso.
  async function insertarPaso(tabla: string, filas: Record<string, unknown>[], pasoKey: string, mensajeExito: string) {
    if (filas.length === 0) return true
    const { error } = await supabase.from(tabla).insert(filas)
    if (error) {
      addLog(`❌ ${tabla}: ${error.message}`)
      setProgreso(p => ({ ...p, [pasoKey]: 'error' }))
      return false
    }
    setProgreso(p => ({ ...p, [pasoKey]: 'ok' }))
    addLog(mensajeExito)
    return true
  }

  const loadEstado = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
    if (!profile?.tenant_id) { setLoading(false); return }
    const tid = profile.tenant_id
    setTenantId(tid)

    const [{ count: c1 }, { count: c2 }, { count: c3 }, { count: c4 }] = await Promise.all([
      supabase.from('productos').select('id', { count: 'exact', head: true }).eq('tenant_id', tid),
      supabase.from('pedidos').select('id', { count: 'exact', head: true }).eq('tenant_id', tid),
      supabase.from('pauta').select('id', { count: 'exact', head: true }).eq('tenant_id', tid),
      supabase.from('metas').select('id', { count: 'exact', head: true }).eq('tenant_id', tid),
    ])
    setConteos({ productos: c1 || 0, pedidos: c2 || 0, pauta: c3 || 0, metas: c4 || 0 })
    setYaHayDatos((c2 || 0) > 10)
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadEstado() }, [loadEstado])

  async function limpiarDatos() {
    if (!tenantId) return
    if (!confirm('¿Eliminar TODOS los datos de demostración? Esta acción no se puede deshacer.')) return
    addLog('🧹 Limpiando datos anteriores...')
    await Promise.all([
      supabase.from('pedidos').delete().eq('tenant_id', tenantId),
      supabase.from('productos').delete().eq('tenant_id', tenantId),
      supabase.from('costos_fijos').delete().eq('tenant_id', tenantId),
      supabase.from('pauta').delete().eq('tenant_id', tenantId),
      supabase.from('wallet_transacciones').delete().eq('tenant_id', tenantId),
      supabase.from('libro_caja').delete().eq('tenant_id', tenantId),
      supabase.from('metas').delete().eq('tenant_id', tenantId),
      supabase.from('bodegas').delete().eq('tenant_id', tenantId),
      supabase.from('inventario').delete().eq('tenant_id', tenantId),
      supabase.from('pqrsf').delete().eq('tenant_id', tenantId),
      supabase.from('alertas').delete().eq('tenant_id', tenantId),
      supabase.from('colaboradores').delete().eq('tenant_id', tenantId),
      supabase.from('nomina_tasas_historico').delete().eq('tenant_id', tenantId),
      supabase.from('nomina_procesos').delete().eq('tenant_id', tenantId),
      supabase.from('inversiones_activos').delete().eq('tenant_id', tenantId),
      supabase.from('inversiones_creditos').delete().eq('tenant_id', tenantId),
      supabase.from('inversiones_capital').delete().eq('tenant_id', tenantId),
      supabase.from('inversiones_socios').delete().eq('tenant_id', tenantId),
      supabase.from('cuentas_por_pagar').delete().eq('tenant_id', tenantId),
      supabase.from('metas_seguimiento_diario').delete().eq('tenant_id', tenantId),
      supabase.from('pe_configuraciones').delete().eq('tenant_id', tenantId),
      supabase.from('whatsapp_store_context').delete().eq('tenant_id', tenantId),
      supabase.from('whatsapp_templates_config').delete().eq('tenant_id', tenantId),
    ])
    addLog('✅ Datos eliminados. Listo para nueva carga.')
    loadEstado()
  }

  async function ejecutarSeed() {
    if (!tenantId) {
      addLog('❌ Error: no se pudo obtener el tenant. Recarga la página e intenta de nuevo.')
      return
    }
    addLog(`🚀 Iniciando seed para ${CONFIG_PAIS[paisCodigo]?.nombre || paisCodigo}... tenant: ${tenantId.slice(0,8)}`)
    setSeedActivo(true)
    const cfg = CONFIG_PAIS[paisCodigo] || CONFIG_PAIS.COL
    const hoy = new Date()
    const pasos: Record<string, 'pendiente' | 'cargando' | 'ok' | 'error'> = {}
    PASOS_SEED.forEach(p => { pasos[p.key] = 'pendiente' })
    setProgreso({ ...pasos })
    // ── PRODUCTOS ──────────────────────────────────────────────
    setProgreso(p => ({ ...p, productos: 'cargando' }))
    addLog(`🛍️ Cargando ${cfg.productos.length} productos para ${cfg.nombre}...`)
    try {
      const { data: prodsInserted, error: prodsError } = await supabase.from('productos').insert(
        cfg.productos.map(p => ({
          tenant_id: tenantId,
          nombre: p.nombre,
          tipo: 'producto',
          estado: 'activo',
          modelo_negocio: 'dropshipping',
          descripcion: p.descripcion,
          costo_proveedor: p.costo,
          pvp_final: p.pvp,
          pvp: p.pvp,
          costo_flete_envio: Math.round(p.costo * 0.25),
          costo_flete: Math.round(p.costo * 0.25),
          costo_flete_dev: Math.round(p.costo * 0.3),
          costo_fulfillment: 0,
          costo_full_dev: 0,
          cf_pedido: Math.round(p.pvp * 0.03),
          pct_publicidad: 20,
          pct_pub_dev: 7,
          pct_pub_cancel: 4,
          pct_desc_popup: 2,
          pct_com_plataforma: 0,
          pct_pasarela: 3.49,
          pct_com_pasarela: 0,
          pct_com_ventas: 5,
          pct_com_admin: 2,
          pct_devolucion: 10,
          cpa_maximo: Math.round(p.pvp * 0.22),
          disponible_dropshippers: true,
        }))
      ).select('id, nombre, pvp_final, costo_proveedor')

      if (prodsError) {
        addLog(`❌ Error insertando productos: ${prodsError.message}`)
        setProgreso(p => ({ ...p, productos: 'error' }))
        setSeedActivo(false)
        return
      }

      const prodIds = (prodsInserted || []).map((p: {id:string;nombre:string;pvp_final:number;costo_proveedor:number}) => ({
        id: p.id,
        nombre: p.nombre,
        pvp: p.pvp_final,
        costo: p.costo_proveedor
      }))

      if (prodIds.length === 0) {
        addLog('❌ No se crearon productos. Verifica que no existan duplicados o que RLS lo permita.')
        setProgreso(p => ({ ...p, productos: 'error' }))
        setSeedActivo(false)
        return
      }
      setProgreso(p => ({ ...p, productos: 'ok' }))
      addLog(`✅ ${prodIds.length} productos creados`)

      // ── COSTOS FIJOS ──────────────────────────────────────────
      setProgreso(p => ({ ...p, costos: 'cargando' }))
      addLog('📊 Cargando costos fijos 6 meses...')
      const cfRows = []
      for (let i = 5; i >= 0; i--) {
        const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
        const periodo = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-01`
        for (const cf of cfg.cf_conceptos) {
          cfRows.push({ tenant_id: tenantId, periodo, categoria: cf.categoria, concepto: cf.concepto, cantidad: 1, valor_unitario: cf.valor, activo: true })
        }
      }
      const { error: cfErr } = await supabase.from('costos_fijos').insert(cfRows)
      if (cfErr) { addLog(`❌ Costos fijos: ${cfErr.message}`); setProgreso(p => ({ ...p, costos: 'error' })) }
      else { setProgreso(p => ({ ...p, costos: 'ok' })); addLog(`✅ ${cfRows.length} registros de costos fijos`) }

      // ── PEDIDOS ───────────────────────────────────────────────
      setProgreso(p => ({ ...p, pedidos: 'cargando' }))
      addLog('📦 Generando pedidos 6 meses...')
      let totalPedidos = 0
      let huboErrorPedidos = false
      for (let mes = 5; mes >= 0; mes--) {
        const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - mes, 1)
        const volumen = 60 + ((5 - mes) * 8)
        const pedidosBatch = []
        for (let i = 0; i < volumen; i++) {
          const prod = prodIds[rndInt(0, prodIds.length - 1)]
          const rand = Math.random()
          const estado = rand < 0.72 ? 'entregado' : rand < 0.90 ? 'cancelado' : 'devolucion'
          const margenBruto = (prod.pvp - prod.costo) / prod.pvp
          const ganancia = estado === 'entregado' ? Math.round(prod.pvp * margenBruto * 0.55) : 0
          const dia = rndInt(1, 28)
          const hora = rndInt(8, 20)
          const fecha_pedido = new Date(fecha.getFullYear(), fecha.getMonth(), dia, hora, rndInt(0, 59))
          pedidosBatch.push({
            tenant_id: tenantId,
            producto_id: prod.id,
            producto_nombre: prod.nombre,
            cliente_nombre: `${rnd(cfg.nombres)} ${rnd(cfg.apellidos)}`,
            cliente_telefono: `3${rndInt(1, 3)}${String(rndInt(1000000, 9999999))}`,
            cliente_ciudad: String(rnd(cfg.ciudades)),
            cliente_departamento: cfg.nombre,
            pvp: prod.pvp,
            ganancia,
            estado,
            fecha_pedido: fecha_pedido.toISOString(),
            transportadora: String(rnd(cfg.transportadoras)),
          })
        }
        const { error: pedErr } = await supabase.from('pedidos').insert(pedidosBatch)
        if (pedErr) { addLog(`❌ Pedidos: ${pedErr.message}`); setProgreso(p => ({ ...p, pedidos: 'error' })); huboErrorPedidos = true; break }
        totalPedidos += pedidosBatch.length
      }
      if (!huboErrorPedidos) { setProgreso(p => ({ ...p, pedidos: 'ok' })); addLog(`✅ ${totalPedidos} pedidos generados`) }

      // ── PAUTA ─────────────────────────────────────────────────
      setProgreso(p => ({ ...p, pauta: 'cargando' }))
      addLog('📡 Cargando campañas Meta Ads...')
      const pautaRows = []
      for (let mes = 5; mes >= 0; mes--) {
        const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - mes, 15)
        const inversion = Math.round((400000 + mes * 60000) * (paisCodigo === 'COL' ? 1 : paisCodigo === 'MEX' ? 0.065 : paisCodigo === 'CHL' ? 260 : paisCodigo === 'ARG' ? 300 : 0.11))
        const resultados = rndInt(18, 42)
        const impresiones = rndInt(40000, 95000)
        const clics = Math.round(impresiones * (rndInt(14, 18) / 1000))
        pautaRows.push({
          tenant_id: tenantId,
          fecha: `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-15`,
          plataforma: 'META',
          campana: `${cfg.productos[mes % 3].nombre.split(' ').slice(0, 2).join(' ')} - ${['Intereses', 'Lookalike 1%', 'Retargeting', 'Broad', 'Video VSL', 'UGC'][mes]}`,
          inversion, impresiones, clics, resultados,
          ctr: Math.round(clics / impresiones * 10000) / 100,
          cpm: Math.round(inversion / impresiones * 1000),
          cpc: Math.round(inversion / clics),
          cpa: Math.round(inversion / resultados),
        })
      }
      const { error: pautaErr } = await supabase.from('pauta').insert(pautaRows)
      if (pautaErr) { addLog(`❌ Pauta: ${pautaErr.message}`); setProgreso(p => ({ ...p, pauta: 'error' })) }
      else { setProgreso(p => ({ ...p, pauta: 'ok' })); addLog(`✅ ${pautaRows.length} campañas cargadas`) }

      // ── WALLET ────────────────────────────────────────────────
      setProgreso(p => ({ ...p, wallet: 'cargando' }))
      addLog('💳 Cargando movimientos de wallet...')
      const walletRows = []
      for (let mes = 5; mes >= 0; mes--) {
        const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - mes, 1)
        const entrada = Math.round(cfg.productos[0].pvp * (45 + mes * 6) * 0.72)
        const salida = Math.round(entrada * 0.45)
        walletRows.push({
          tenant_id: tenantId, tipo: 'ENTRADA', monto: entrada,
          descripcion: `Recaudo ${cfg.transportadoras[0]} - ${['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'][5 - mes]}`,
          categoria: 'ganancia_dropshipper', fuente: 'dropi',
          fecha: new Date(fecha.getFullYear(), fecha.getMonth(), 20).toISOString(),
        })
        if (mes < 5) {
          walletRows.push({
            tenant_id: tenantId, tipo: 'SALIDA', monto: salida,
            descripcion: `Retiro utilidades ${['Ene', 'Feb', 'Mar', 'Abr', 'May'][4 - mes]}`,
            categoria: 'retiro_socio', fuente: 'manual',
            fecha: new Date(fecha.getFullYear(), fecha.getMonth(), 28).toISOString(),
          })
        }
      }
      await insertarPaso('wallet_transacciones', walletRows, 'wallet', `✅ ${walletRows.length} movimientos de wallet`)

      // ── LIBRO DE CAJA ─────────────────────────────────────────
      setProgreso(p => ({ ...p, libro_caja: 'cargando' }))
      addLog('📒 Cargando libro de caja...')
      const cajaRows = []
      for (let mes = 5; mes >= 0; mes--) {
        const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - mes, 1)
        const ult = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0).toISOString().slice(0, 10)
        const ventas = Math.round(cfg.productos[0].pvp * (45 + mes * 6) * 0.72)
        const cfTotal = cfg.cf_conceptos.reduce((a, c) => a + c.valor, 0)
        const inv = Math.round((400000 + mes * 60000) * (paisCodigo === 'COL' ? 1 : 0.065))
        cajaRows.push(
          { tenant_id: tenantId, fecha: ult, concepto: `Ventas entregadas mes ${6 - mes}`, tipo: 'entrada', valor: ventas, origen: 'venta', categoria_flujo: 'operativo' },
          { tenant_id: tenantId, fecha: ult, concepto: `Pauta Meta Ads mes ${6 - mes}`, tipo: 'salida', valor: inv > 0 ? inv : 500000, origen: 'pauta', categoria_flujo: 'operativo' },
          { tenant_id: tenantId, fecha: ult, concepto: `Costos fijos mes ${6 - mes}`, tipo: 'salida', valor: cfTotal, origen: 'costos_fijos', categoria_flujo: 'operativo' },
        )
      }
      await insertarPaso('libro_caja', cajaRows, 'libro_caja', `✅ ${cajaRows.length} movimientos en libro de caja`)

      // ── METAS ─────────────────────────────────────────────────
      setProgreso(p => ({ ...p, metas: 'cargando' }))
      addLog('🎯 Cargando metas 6 meses...')
      const metasRows = []
      for (let mes = 5; mes >= 0; mes--) {
        const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - mes, 1)
        const periodo = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-01`
        const pedidosMeta = 70 + (5 - mes) * 10
        metasRows.push({
          tenant_id: tenantId, periodo,
          pedidos_meta: pedidosMeta,
          ventas_meta: Math.round(cfg.productos[0].pvp * pedidosMeta * 0.72),
          ganancia_meta: Math.round(cfg.productos[0].pvp * 0.18 * pedidosMeta * 0.72),
          entregados_meta: Math.round(pedidosMeta * 0.75),
          descripcion: `Meta ${fecha.toLocaleString('es-CO', { month: 'long', year: 'numeric' })}`,
        })
      }
      await insertarPaso('metas', metasRows, 'metas', `✅ ${metasRows.length} metas creadas`)

      // ── BODEGAS ───────────────────────────────────────────────
      setProgreso(p => ({ ...p, bodegas: 'cargando' }))
      addLog('🏭 Creando bodegas e inventario...')
      const { data: bodegasData, error: bodErr } = await supabase.from('bodegas').insert([
        { tenant_id: tenantId, nombre: `Bodega General ${cfg.nombre}`, tipo: 'general', pais_codigo: paisCodigo, ciudad: cfg.capital, orden_flujo: 2, activa: true },
        { tenant_id: tenantId, nombre: `Bodega ${cfg.capital}`, tipo: 'ciudad', pais_codigo: paisCodigo, ciudad: cfg.capital, orden_flujo: 3, activa: true },
      ]).select()
      if (bodErr) { addLog(`❌ Bodegas: ${bodErr.message}`); setProgreso(p => ({ ...p, bodegas: 'error' })) }
      else {
        if (bodegasData && prodIds.length > 0) {
          const invRows = []
          for (const bod of bodegasData) {
            for (const prod of prodIds) {
              invRows.push({ tenant_id: tenantId, producto_id: prod.id, bodega_id: bod.id, cantidad_disponible: rndInt(15, 80), cantidad_reservada: rndInt(0, 5), cantidad_dañada: rndInt(0, 2), stock_minimo: 10 })
            }
          }
          const { error: invErr } = await supabase.from('inventario').insert(invRows)
          if (invErr) addLog(`❌ Inventario: ${invErr.message}`)
        }
        setProgreso(p => ({ ...p, bodegas: 'ok' }))
        addLog(`✅ 2 bodegas + inventario inicial`)
      }

      // ── PQRSF ─────────────────────────────────────────────────
      // Mismo formato que crearNueva() en pqrsf/page.tsx: tipo es P/Q/R/S/F, numero_radicado
      // es obligatorio (DZ-YYYYMM-#####), estado es RECIBIDO/EN_GESTION/RESPONDIDO/CERRADO.
      setProgreso(p => ({ ...p, pqrsf: 'cargando' }))
      addLog('📬 Generando casos PQRSF...')
      const tiposPqrsf: Array<'P'|'Q'|'R'|'S'|'F'> = ['P', 'Q', 'R', 'S', 'F']
      const asuntos = ['¿Cuándo llega mi pedido?', 'Producto llegó dañado', 'No he recibido mi pedido', 'El producto no funciona', 'Quiero cambiar mi dirección', 'El producto es excelente', 'Demoran mucho en confirmar', 'Quiero devolver el producto']
      const pqrsfRows = Array.from({ length: 15 }, (_, i) => {
        const tipo = tiposPqrsf[i % tiposPqrsf.length]
        const diasAtras = rndInt(1, 45)
        const fechaCreacion = new Date(Date.now() - diasAtras * 86400000)
        return {
          tenant_id: tenantId,
          numero_radicado: `DZ-${fechaCreacion.getFullYear()}${String(fechaCreacion.getMonth() + 1).padStart(2, '0')}-${String(10000 + i)}`,
          tipo,
          asunto: asuntos[i % asuntos.length],
          descripcion: `Caso de demostración: ${asuntos[i % asuntos.length]}`,
          nombre_cliente: `${rnd(cfg.nombres)} ${rnd(cfg.apellidos)}`,
          email_cliente: `cliente${i + 1}@demo.com`,
          telefono: `3${rndInt(1, 3)}${String(rndInt(1000000, 9999999))}`,
          estado: i < 10 ? 'RECIBIDO' : 'CERRADO',
          created_at: fechaCreacion.toISOString(),
          fecha_limite: new Date(fechaCreacion.getTime() + 5 * 86400000).toISOString(),
        }
      })
      const { error: pqrsfErr } = await supabase.from('pqrsf').insert(pqrsfRows)
      if (pqrsfErr) { addLog(`❌ PQRSF: ${pqrsfErr.message}`); setProgreso(p => ({ ...p, pqrsf: 'error' })) }
      else { setProgreso(p => ({ ...p, pqrsf: 'ok' })); addLog(`✅ 15 casos PQRSF generados`) }

      // ── ALERTAS ───────────────────────────────────────────────
      setProgreso(p => ({ ...p, alertas: 'cargando' }))
      addLog('🚨 Generando alertas de demostración...')
      await insertarPaso('alertas', [
        { tenant_id: tenantId, tipo: 'critico', categoria: 'operativa', titulo: 'CPA por encima del máximo', mensaje: `CPA real supera el CPA máximo configurado en ${cfg.productos[0].nombre}. Revisa el módulo Precio & Costeo.`, modulo: 'PAUTA', icono: '🔴', accion: 'Revisar campaña y ajustar CPA máximo' },
        { tenant_id: tenantId, tipo: 'atencion', categoria: 'operativa', titulo: 'Tasa de entrega por debajo del 75%', mensaje: 'La tasa de entrega del mes es 70%. El benchmark Colombia es 75%-82%. Revisar confirmaciones y novedades.', modulo: 'PEDIDOS', icono: '🟡', accion: 'Activar confirmación previa al despacho' },
        { tenant_id: tenantId, tipo: 'critico', categoria: 'financiera', titulo: 'Stock crítico detectado', mensaje: `${cfg.productos[0].nombre} tiene menos de 10 unidades disponibles en ${cfg.capital}. Riesgo de quiebre.`, modulo: 'BODEGA', icono: '🚨', accion: 'Ordenar reposición urgente o traslado desde bodega general' },
        { tenant_id: tenantId, tipo: 'atencion', categoria: 'operativa', titulo: 'PQRSF vencidas sin respuesta', mensaje: '3 casos de PQRSF llevan más de 5 días sin respuesta. Riesgo legal y reputacional.', modulo: 'PQRSF', icono: '📬', accion: 'Resolver los 3 casos urgentes antes de que escalen' },
        { tenant_id: tenantId, tipo: 'oportunidad', categoria: 'comercial', titulo: 'Oportunidad: escalar campaña ganadora', mensaje: `Campaña "${cfg.productos[0].nombre.split(' ').slice(0, 2).join(' ')} - Video VSL" tiene ROAS > 3x. Duplicar presupuesto puede generar +${Math.round(cfg.productos[0].pvp * 12 * 0.18).toLocaleString()} en ganancias.`, modulo: 'PAUTA', icono: '💡', accion: 'Aumentar presupuesto 2x en la campaña ganadora' },
        { tenant_id: tenantId, tipo: 'atencion', categoria: 'financiera', titulo: 'Margen neto por debajo del 15%', mensaje: 'El margen neto del mes es 12%. El mínimo recomendado para sostenibilidad es 15%. Revisar estructura de costos.', modulo: 'P&G', icono: '📊', accion: 'Revisar costos fijos y renegociar con proveedor' },
        { tenant_id: tenantId, tipo: 'critico', categoria: 'operativa', titulo: 'Transportadora con bajo rendimiento', mensaje: `${cfg.transportadoras[1]} tiene tasa de entrega del 65% en el último mes. Impacto directo en rentabilidad.`, modulo: 'LOGÍSTICA', icono: '🚚', accion: 'Redirigir pedidos a otra transportadora temporalmente' },
        { tenant_id: tenantId, tipo: 'atencion', categoria: 'financiera', titulo: 'Meta del mes en riesgo', mensaje: 'Vas al 68% de la meta de ventas con el 75% del mes transcurrido. Necesitas acelerar para cumplir.', modulo: 'METAS', icono: '🎯', accion: 'Aumentar inversión en pauta los últimos días del mes' },
      ], 'alertas', `✅ 8 alertas de demostración creadas`)

      // ── NÓMINA — colaboradores + tasas por país ───────────────
      setProgreso(p => ({ ...p, nomina: 'cargando' }))
      addLog('👥 Cargando colaboradores y tasas de nómina...')

      const SALARIOS_PAIS: Record<string, { sm: number; aux: number; code_tel: string }> = {
        COL: { sm: 1423500, aux: 200000, code_tel: '+57' },
        ECU: { sm: 480, aux: 0, code_tel: '+593' },
        MEX: { sm: 7468, aux: 0, code_tel: '+52' },
        PER: { sm: 1025, aux: 0, code_tel: '+51' },
        CHL: { sm: 500000, aux: 0, code_tel: '+56' },
        ARG: { sm: 747000, aux: 0, code_tel: '+54' },
        PAN: { sm: 650, aux: 0, code_tel: '+507' },
        CRI: { sm: 380000, aux: 0, code_tel: '+506' },
        GTM: { sm: 3230, aux: 0, code_tel: '+502' },
        BOL: { sm: 2362, aux: 0, code_tel: '+591' },
        URY: { sm: 23000, aux: 0, code_tel: '+598' },
        VEN: { sm: 130, aux: 0, code_tel: '+58' },
        HND: { sm: 12000, aux: 0, code_tel: '+504' },
        SLV: { sm: 365, aux: 0, code_tel: '+503' },
        DOM: { sm: 21000, aux: 0, code_tel: '+1' },
        PRY: { sm: 2680373, aux: 0, code_tel: '+595' },
        ESP: { sm: 1184, aux: 0, code_tel: '+34' },
      }
      const sal = SALARIOS_PAIS[paisCodigo] || SALARIOS_PAIS.COL
      const hoyStr = new Date().toISOString().slice(0, 10)
      const ingresoDate = new Date(hoy.getFullYear(), hoy.getMonth() - 5, 1).toISOString().slice(0, 10)

      const { error: colabErr } = await supabase.from('colaboradores').insert([
        {
          tenant_id: tenantId,
          nombres: cfg.nombres[0], apellidos: cfg.apellidos[0],
          tipo_doc: 'CC', num_doc: `10${rndInt(1000000, 9999999)}`,
          pais_code: paisCodigo, ciudad: cfg.capital,
          cargo: 'Confirmador de Pedidos', tipo_contrato: 'Empleado',
          jornada: 'Medio tiempo', fecha_ingreso: ingresoDate,
          salario_base: Math.round(sal.sm * 1.0),
          aux_transporte: sal.aux,
          codigo_tel: sal.code_tel,
          celular: `${rndInt(300, 399)}${rndInt(1000000, 9999999)}`,
          email: `confirmador@demo-dizgo.com`,
          activo: true,
        },
        {
          tenant_id: tenantId,
          nombres: cfg.nombres[1], apellidos: cfg.apellidos[1],
          tipo_doc: 'CC', num_doc: `10${rndInt(1000000, 9999999)}`,
          pais_code: paisCodigo, ciudad: cfg.capital,
          cargo: 'Administrador E-commerce', tipo_contrato: 'Empleado',
          jornada: 'Tiempo completo', fecha_ingreso: ingresoDate,
          salario_base: Math.round(sal.sm * 1.8),
          aux_transporte: sal.aux,
          codigo_tel: sal.code_tel,
          celular: `${rndInt(300, 399)}${rndInt(1000000, 9999999)}`,
          email: `admin@demo-dizgo.com`,
          activo: true,
        },
      ])

      // Tasas de nómina por país
      const { error: tasasErr } = await supabase.from('nomina_tasas_historico').upsert({
        tenant_id: tenantId, pais_code: paisCodigo,
        anio_fiscal: hoy.getFullYear(),
        vigencia_inicio: `${hoy.getFullYear()}-01-01`,
        estado: 'activo',
        salario_minimo: sal.sm, aux_transporte: sal.aux,
        salud_emp: 8.5, pension_emp: 12,
        arl_nivel1: 0.522, arl_nivel2: 1.044, arl_nivel3: 2.436,
        sena: 2, icbf: 3, caja_comp: 4,
        cesantias: 8.33, intereses_ces: 1, prima: 8.33, vacaciones: 4.17,
        salud_trab: 4, pension_trab: 4, tope_exoneracion: 10,
      }, { onConflict: 'tenant_id,pais_code,anio_fiscal' })

      if (colabErr || tasasErr) {
        addLog(`❌ Nómina: ${colabErr?.message || tasasErr?.message}`)
        setProgreso(p => ({ ...p, nomina: 'error' }))
      } else {
        setProgreso(p => ({ ...p, nomina: 'ok' }))
        addLog('✅ 2 colaboradores + tasas de nómina cargadas')
      }

      // ── INVERSIÓN — activos fijos + crédito ───────────────────
      setProgreso(p => ({ ...p, inversion: 'cargando' }))
      addLog('💰 Cargando activos fijos e inversiones...')

      const precioCompuQ = cfg.productos[0].pvp * 8
      const precioCelQ = cfg.productos[0].pvp * 4
      const precioRouterQ = cfg.productos[0].pvp * 2

      const { error: activosErr } = await supabase.from('inversiones_activos').insert([
        { tenant_id: tenantId, nombre: 'Computador portátil', tipo: 'hardware', valor: Math.round(precioCompuQ), vida_util_meses: 36, fecha_compra: new Date(hoy.getFullYear(), hoy.getMonth() - 5, 15).toISOString().slice(0, 10), activo: true },
        { tenant_id: tenantId, nombre: 'Celular para operaciones', tipo: 'hardware', valor: Math.round(precioCelQ), vida_util_meses: 24, fecha_compra: new Date(hoy.getFullYear(), hoy.getMonth() - 3, 10).toISOString().slice(0, 10), activo: true },
        { tenant_id: tenantId, nombre: 'Router WiFi y equipos de red', tipo: 'hardware', valor: Math.round(precioRouterQ), vida_util_meses: 48, fecha_compra: new Date(hoy.getFullYear(), hoy.getMonth() - 5, 1).toISOString().slice(0, 10), activo: true },
      ])

      const montoCreditoQ = cfg.productos[0].pvp * 30
      const { error: creditoErr } = await supabase.from('inversiones_creditos').insert({
        tenant_id: tenantId,
        nombre: 'Capital de trabajo inicial',
        monto: Math.round(montoCreditoQ),
        tasa_mensual: 1.8,
        plazo_meses: 12,
        tipo_cuota: 'francesa',
        destino: 'capital_trabajo',
        fecha_inicio: new Date(hoy.getFullYear(), hoy.getMonth() - 4, 1).toISOString().slice(0, 10),
        estado: 'activo',
      })

      if (activosErr || creditoErr) {
        addLog(`❌ Inversión: ${activosErr?.message || creditoErr?.message}`)
        setProgreso(p => ({ ...p, inversion: 'error' }))
      } else {
        setProgreso(p => ({ ...p, inversion: 'ok' }))
        addLog('✅ 3 activos fijos + 1 crédito de capital de trabajo')
      }

      // ── CUENTAS POR PAGAR ────────────────────────────────────
      setProgreso(p => ({ ...p, cxp: 'cargando' }))
      addLog('📋 Cargando cuentas por pagar...')

      const fechaVenc5 = new Date(hoy.getFullYear(), hoy.getMonth(), 5).toISOString().slice(0, 10)
      const fechaVenc15 = new Date(hoy.getFullYear(), hoy.getMonth(), 15).toISOString().slice(0, 10)
      const fechaVenc28 = new Date(hoy.getFullYear(), hoy.getMonth(), 28).toISOString().slice(0, 10)
      const fechaVencPast = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 28).toISOString().slice(0, 10)

      await insertarPaso('cuentas_por_pagar', [
        { tenant_id: tenantId, tercero: cfg.transportadoras[0], tipo_tercero: 'proveedor', concepto: 'Fletes pendientes de pago', valor: Math.round(cfg.productos[0].pvp * 2.5), fecha_emision: hoyStr, fecha_vencimiento: fechaVenc15, estado: 'pendiente', categoria_flujo: 'operativo' },
        { tenant_id: tenantId, tercero: `${cfg.nombres[0]} ${cfg.apellidos[0]}`, tipo_tercero: 'nomina', concepto: 'Salario Confirmador de Pedidos', valor: Math.round(sal.sm), fecha_emision: hoyStr, fecha_vencimiento: fechaVenc5, estado: 'pendiente', categoria_flujo: 'operativo' },
        { tenant_id: tenantId, tercero: 'Meta Ads', tipo_tercero: 'proveedor', concepto: 'Inversión en pauta mes actual', valor: Math.round(cfg.productos[0].pvp * 7), fecha_emision: hoyStr, fecha_vencimiento: fechaVenc28, estado: 'pendiente', categoria_flujo: 'operativo' },
        { tenant_id: tenantId, tercero: 'Shopify / WooCommerce', tipo_tercero: 'prestador_servicios', concepto: 'Membresía plataforma e-commerce', valor: cfg.cf_conceptos[0].valor, fecha_emision: hoyStr, fecha_vencimiento: fechaVenc5, estado: 'pendiente', categoria_flujo: 'operativo' },
        { tenant_id: tenantId, tercero: cfg.transportadoras[1], tipo_tercero: 'proveedor', concepto: 'Fletes mes anterior pendientes', valor: Math.round(cfg.productos[0].pvp * 1.8), fecha_emision: fechaVencPast, fecha_vencimiento: fechaVencPast, estado: 'pendiente', categoria_flujo: 'operativo' },
      ], 'cxp', '✅ 5 cuentas por pagar (1 vencida para demo)')

      // ── METAS SEGUIMIENTO DIARIO — 30 días ───────────────────
      setProgreso(p => ({ ...p, metas_diarias: 'cargando' }))
      addLog('📅 Cargando seguimiento diario 30 días...')

      const metasDiarias = []
      const pedidosDiaMeta = 4
      for (let d = 29; d >= 0; d--) {
        const fecha = new Date(hoy.getTime() - d * 86400000)
        const esFinde = fecha.getDay() === 0 || fecha.getDay() === 6
        const generados = esFinde ? rndInt(2, 5) : rndInt(3, 8)
        const confirmados = Math.round(generados * (rndInt(60, 80) / 100))
        const despachados = Math.round(confirmados * (rndInt(75, 90) / 100))
        const entregados = Math.round(despachados * (rndInt(65, 85) / 100))
        const ventasDia = entregados * cfg.productos[0].pvp
        const pautaDia = Math.round(cfg.productos[0].pvp * rndInt(3, 7))
        const cpaDia = entregados > 0 ? Math.round(pautaDia / entregados) : 0
        const nivelPct = generados / pedidosDiaMeta * 100
        metasDiarias.push({
          tenant_id: tenantId,
          fecha: fecha.toISOString().slice(0, 10),
          pedidos_generados: generados,
          pedidos_confirmados: confirmados,
          pedidos_despachados: despachados,
          pedidos_entregados: entregados,
          ventas_dia: Math.round(ventasDia),
          cpa_real: cpaDia,
          pauta_dia: pautaDia,
          iso_dia: Math.round(nivelPct),
          alerta_nivel: nivelPct >= 100 ? 'verde' : nivelPct >= 70 ? 'amarillo' : 'rojo',
        })
      }
      await insertarPaso('metas_seguimiento_diario', metasDiarias, 'metas_diarias', `✅ 30 días de seguimiento diario cargados`)

      // ── NÓMINA — procesos organizacionales ───────────────────
      setProgreso(p => ({ ...p, nomina_procesos: 'cargando' }))
      addLog('🏢 Cargando procesos organizacionales...')
      await insertarPaso('nomina_procesos', [
        { tenant_id: tenantId, nombre: 'Operaciones', descripcion: 'Confirmación, despacho y seguimiento de pedidos', orden: 1, activo: true },
        { tenant_id: tenantId, nombre: 'Administración', descripcion: 'Gestión financiera, contable y administrativa', orden: 2, activo: true },
        { tenant_id: tenantId, nombre: 'Marketing', descripcion: 'Pauta, creativos y estrategia digital', orden: 3, activo: true },
      ], 'nomina_procesos', '✅ 3 procesos organizacionales creados')

      // ── INVERSIÓN — capital propio + socios ──────────────────
      setProgreso(p => ({ ...p, inversion_capital: 'cargando' }))
      addLog('💼 Cargando capital propio e inversión de socios...')
      const capitalInicial = Math.round(cfg.productos[0].pvp * 20)
      const { error: capitalErr } = await supabase.from('inversiones_capital').insert([
        { tenant_id: tenantId, concepto: 'Capital inicial de trabajo', categoria: 'capital_trabajo', valor: capitalInicial, tipo: 'propio', activo: true, notas: 'Aporte inicial para arranque de operaciones' },
        { tenant_id: tenantId, concepto: 'Inversión en infraestructura tecnológica', categoria: 'activo_fijo', valor: Math.round(capitalInicial * 0.3), tipo: 'propio', activo: true, notas: 'Computador, celular, router y software' },
      ])
      const { error: sociosErr } = await supabase.from('inversiones_socios').insert({
        tenant_id: tenantId, nombre: 'Socio Fundador', tipo_aporte: 'dinero',
        valor_aporte: capitalInicial, pct_participacion: 100,
        fecha_aporte: new Date(hoy.getFullYear(), hoy.getMonth() - 5, 1).toISOString().slice(0, 10),
        activo: true,
      })
      if (capitalErr || sociosErr) {
        addLog(`❌ Capital/socios: ${capitalErr?.message || sociosErr?.message}`)
        setProgreso(p => ({ ...p, inversion_capital: 'error' }))
      } else {
        setProgreso(p => ({ ...p, inversion_capital: 'ok' }))
        addLog('✅ Capital propio + socio fundador registrados')
      }

      // ── PUNTO DE EQUILIBRIO — configuración ──────────────────
      setProgreso(p => ({ ...p, equilibrio: 'cargando' }))
      addLog('⚖️ Configurando punto de equilibrio...')
      const cfTotalMes = cfg.cf_conceptos.reduce((a, c) => a + c.valor, 0)
      const margenProd = Math.round((cfg.productos[0].pvp - cfg.productos[0].costo) / cfg.productos[0].pvp * 55)
      const peMinimo = Math.ceil(cfTotalMes / (cfg.productos[0].pvp * margenProd / 100))
      for (let i = 5; i >= 0; i--) {
        const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
        const periodo = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-01`
        await supabase.from('pe_configuraciones').upsert({
          tenant_id: tenantId, periodo,
          modo_activo: 'rentabilidad',
          pe_minimo: peMinimo,
          pe_rentabilidad: Math.ceil(peMinimo * 1.3),
          pe_tiburon: Math.ceil(peMinimo * 2),
          tc_meta: 75, td_meta: 90, te_meta: 78, tdev_meta: 12,
          margen_ponderado: margenProd,
        }, { onConflict: 'tenant_id,periodo' })
      }
      setProgreso(p => ({ ...p, equilibrio: 'ok' }))
      addLog(`✅ PE configurado: mínimo ${peMinimo} pedidos/mes para ${cfg.nombre}`)

      // ── WHATSAPP / CENTRO CONTACTO ────────────────────────────
      setProgreso(p => ({ ...p, whatsapp: 'cargando' }))
      addLog('💬 Configurando Centro de Contacto WhatsApp...')

      await supabase.from('whatsapp_store_context').upsert({
        tenant_id: tenantId,
        nombre_tienda: `Tienda Demo DIZGO ${cfg.nombre}`,
        url_tienda: `https://demo-${paisCodigo.toLowerCase()}.dizgo.app`,
        politica_envio: `Envíos a todo ${cfg.nombre}. Tiempo de entrega 3-7 días hábiles según ciudad.`,
        tiempo_entrega: '3-7 días hábiles',
        telefono_soporte: `${cfg.nombres[0].toLowerCase()}@demo-dizgo.com`,
        numero_contacto: `+${rndInt(10, 99)}${rndInt(1000000000, 9999999999)}`,
      }, { onConflict: 'tenant_id' })

      await insertarPaso('whatsapp_templates_config', [
        {
          tenant_id: tenantId, tipo: 'confirmacion', nombre: 'Confirmar pedido',
          contenido: `Hola {{nombre}}, somos {{tienda}} 👋 Te confirmamos que recibimos tu pedido de {{producto}} por {{valor}}. ¿Confirmamos la dirección de entrega: {{direccion}}? Responde SÍ para procesar tu pedido 🚀`,
          variables: ['nombre', 'tienda', 'producto', 'valor', 'direccion'], activa: true,
        },
        {
          tenant_id: tenantId, tipo: 'novedad', nombre: 'Gestionar novedad',
          contenido: `Hola {{nombre}}, te contactamos de {{tienda}} sobre tu pedido de {{producto}}. La transportadora reporta: {{novedad}}. ¿Podemos ayudarte a resolverlo? Escríbenos 📦`,
          variables: ['nombre', 'tienda', 'producto', 'novedad'], activa: true,
        },
        {
          tenant_id: tenantId, tipo: 'entrega', nombre: 'Confirmar entrega',
          contenido: `¡Hola {{nombre}}! 🎉 Tu pedido de {{producto}} fue entregado hoy. Esperamos que lo disfrutes. Si tienes alguna pregunta, estamos aquí. ¡Gracias por confiar en {{tienda}}! ⭐`,
          variables: ['nombre', 'producto', 'tienda'], activa: true,
        },
        {
          tenant_id: tenantId, tipo: 'devolucion', nombre: 'Gestionar devolución',
          contenido: `Hola {{nombre}}, lamentamos los inconvenientes con tu pedido de {{producto}}. Queremos resolverlo. ¿Cuál es el motivo de la devolución? Estamos aquí para ayudarte 🤝`,
          variables: ['nombre', 'producto'], activa: true,
        },
        {
          tenant_id: tenantId, tipo: 'upsell', nombre: 'Oferta especial post-entrega',
          contenido: `¡Hola {{nombre}}! 🌟 Vimos que te encantó {{producto}}. Tenemos una oferta especial para ti: 15% de descuento en tu próxima compra. ¿Te interesa? Responde SÍ y te enviamos los detalles 🎁`,
          variables: ['nombre', 'producto'], activa: true,
        },
      ], 'whatsapp', '✅ 5 templates WhatsApp + contexto de tienda configurados')

      // ── LOGÍSTICA — transportadoras + novedades IA ────────────
      setProgreso(p => ({ ...p, logistica: 'cargando' }))
      addLog('🚚 Cargando transportadoras y scripts de novedades...')

      const TRANSPORTADORAS_CONFIG: Record<string, { tarMin: number; tarMax: number; recMin: number; recMax: number; cob: number }[]> = {
        COL: [
          { tarMin: 8500, tarMax: 14000, recMin: 8, recMax: 15, cob: 98 },
          { tarMin: 7500, tarMax: 13000, recMin: 10, recMax: 18, cob: 92 },
          { tarMin: 8000, tarMax: 13500, recMin: 8, recMax: 15, cob: 88 },
          { tarMin: 9000, tarMax: 15000, recMin: 7, recMax: 12, cob: 85 },
        ],
        ECU: [
          { tarMin: 3, tarMax: 6, recMin: 5, recMax: 10, cob: 90 },
          { tarMin: 2.5, tarMax: 5.5, recMin: 5, recMax: 12, cob: 85 },
          { tarMin: 3.5, tarMax: 7, recMin: 4, recMax: 9, cob: 80 },
          { tarMin: 2, tarMax: 5, recMin: 6, recMax: 12, cob: 75 },
        ],
        DEFAULT: [
          { tarMin: 5, tarMax: 12, recMin: 7, recMax: 15, cob: 88 },
          { tarMin: 4, tarMax: 10, recMin: 8, recMax: 18, cob: 82 },
          { tarMin: 6, tarMax: 14, recMin: 6, recMax: 12, cob: 78 },
          { tarMin: 3.5, tarMax: 9, recMin: 9, recMax: 20, cob: 72 },
        ],
      }

      const tConf = TRANSPORTADORAS_CONFIG[paisCodigo] || TRANSPORTADORAS_CONFIG.DEFAULT
      const transportadorasRows = cfg.transportadoras.map((t, i) => ({
        pais_codigo: paisCodigo, nombre: t,
        tarifa_min: tConf[i]?.tarMin || 5,
        tarifa_max: tConf[i]?.tarMax || 12,
        dias_recaudo_min: tConf[i]?.recMin || 7,
        dias_recaudo_max: tConf[i]?.recMax || 15,
        cobertura_pct: tConf[i]?.cob || 80,
        activo: true,
      }))

      // Solo insertar si no existen ya para este país
      const { count: transExist } = await supabase.from('transportadoras_pais')
        .select('id', { count: 'exact', head: true }).eq('pais_codigo', paisCodigo)
      if (!transExist || transExist === 0) {
        const { error: transErr } = await supabase.from('transportadoras_pais').insert(transportadorasRows)
        if (transErr) addLog(`❌ Transportadoras: ${transErr.message}`)
        else addLog(`✅ ${transportadorasRows.length} transportadoras de ${cfg.nombre}`)
      } else {
        addLog(`ℹ️ Transportadoras de ${cfg.nombre} ya existían — omitidas`)
      }

      // Novedades categorías IA — globales (sin tenant_id, solo una vez)
      const { count: novExist } = await supabase.from('novedades_categorias_ia')
        .select('id', { count: 'exact', head: true })
      if (!novExist || novExist === 0) {
        const { error: novErr } = await supabase.from('novedades_categorias_ia').insert([
          { categoria: 'direccion_incorrecta', nombre_visible: 'Dirección incorrecta', script_sugerido: 'Hola {{nombre}}, la transportadora reporta una novedad con tu dirección. ¿Puedes confirmarnos la dirección exacta de entrega? Necesitamos: calle, número, barrio y ciudad 📍', tono: 'empatico', tasa_exito_historica: 78, activo: true },
          { categoria: 'cliente_no_contesta', nombre_visible: 'Cliente no contesta', script_sugerido: 'Hola {{nombre}}, intentamos contactarte para tu pedido de {{producto}} pero no hemos podido comunicarnos. ¿Cuál es el mejor horario para llamarte? ⏰', tono: 'empatico', tasa_exito_historica: 65, activo: true },
          { categoria: 'coordinar_entrega', nombre_visible: 'Coordinar entrega', script_sugerido: 'Hola {{nombre}}, tu pedido de {{producto}} está listo para entrega. ¿En qué horario te encontramos en {{direccion}}? La transportadora puede ir en la mañana (8-12) o tarde (2-6) 📦', tono: 'profesional', tasa_exito_historica: 85, activo: true },
          { categoria: 'vecino_no_recibe', nombre_visible: 'Vecino no recibe', script_sugerido: 'Hola {{nombre}}, la transportadora intentó entregar tu pedido pero no había nadie. ¿Puedes indicarnos si hay alguien de confianza que pueda recibirlo? 🏠', tono: 'empatico', tasa_exito_historica: 72, activo: true },
          { categoria: 'direccion_no_existe', nombre_visible: 'Dirección no existe', script_sugerido: 'Hola {{nombre}}, la transportadora no encontró la dirección registrada. Necesitamos que nos confirmes la dirección completa para reprogramar la entrega. ¿Nos ayudas? 📍', tono: 'urgente', tasa_exito_historica: 58, activo: true },
          { categoria: 'devolucion_cliente', nombre_visible: 'Devolución por cliente', script_sugerido: 'Hola {{nombre}}, recibimos tu solicitud de devolución. ¿Puedes contarnos el motivo? Queremos mejorar y encontrar la mejor solución para ti 🤝', tono: 'empatico', tasa_exito_historica: 90, activo: true },
          { categoria: 'producto_dañado', nombre_visible: 'Producto dañado en tránsito', script_sugerido: 'Hola {{nombre}}, lamentamos que tu pedido llegó en mal estado. Vamos a gestionar el reenvío inmediatamente. ¿Puedes enviarnos una foto del producto recibido? 📸', tono: 'urgente', tasa_exito_historica: 95, activo: true },
        ])
        if (novErr) addLog(`❌ Novedades IA: ${novErr.message}`)
        else addLog('✅ 7 scripts de novedades IA configurados')
      } else {
        addLog('ℹ️ Scripts de novedades IA ya existían — omitidos')
      }

      setProgreso(p => ({ ...p, logistica: 'ok' }))

      addLog(`🎉 ¡Seed completo para ${cfg.nombre}! Todos los módulos tienen datos reales.`)
    } catch (err) {
      addLog(`❌ Error durante el seed: ${String(err)}`)
    }

    setSeedActivo(false)
    loadEstado()
  }

  const cfg = CONFIG_PAIS[paisCodigo] || CONFIG_PAIS.COL
  const estadoColor = (e: string) => e === 'ok' ? '#2DD4A0' : e === 'error' ? '#F05C5C' : e === 'cargando' ? '#F5A623' : '#5A6478'
  const estadoIcon = (e: string) => e === 'ok' ? '✅' : e === 'error' ? '❌' : e === 'cargando' ? '⏳' : '⬜'

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: '#8B96A8' }}>
      Cargando Superadmin...
    </div>
  )

  return (
    <div style={{ color: '#E8EDF5', fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '4px' }}>⚙️ Superadmin — Centro de Control</h1>
        <p style={{ fontSize: '13px', color: '#8B96A8' }}>Seed de datos por país · Simulación · Mantenimiento · Solo para administradores</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '8px', marginBottom: '16px' }}>
        {[
          { l: 'Productos', v: conteos.productos || 0, c: '#3D8EF0' },
          { l: 'Pedidos', v: conteos.pedidos || 0, c: '#2DD4A0' },
          { l: 'Campañas pauta', v: conteos.pauta || 0, c: '#9B6BFF' },
          { l: 'Metas', v: conteos.metas || 0, c: '#F5A623' },
        ].map((k, i) => (
          <div key={i} style={{ background: '#111520', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '14px', borderTop: `2px solid ${k.c}` }}>
            <div style={{ fontSize: '10px', color: '#8B96A8', marginBottom: '4px' }}>{k.l}</div>
            <div style={{ fontSize: '24px', fontWeight: '900', color: k.c }}>{k.v.toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="dz-grid-side-l" style={{ ['--side-w' as any]:'380px', gap: '16px' }}>
        <div style={{ background: '#111520', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#F5A623', marginBottom: '16px' }}>🌱 SEED DE DATOS DEMO</div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '11px', color: '#5A6478', display: 'block', marginBottom: '6px' }}>País del tenant</label>
            <select value={paisCodigo} onChange={e => setPaisCodigo(e.target.value)}
              style={{ width: '100%', background: '#0A0D14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#E8EDF5', padding: '9px 12px', fontSize: '13px', outline: 'none' }}>
              {Object.entries(CONFIG_PAIS).map(([code, c]) => (
                <option key={code} value={code}>{c.nombre} ({c.moneda})</option>
              ))}
            </select>
          </div>

          <div style={{ padding: '12px', background: 'rgba(45,212,160,0.06)', borderRadius: '10px', marginBottom: '14px', fontSize: '11px', color: '#8B96A8', lineHeight: '1.7' }}>
            <div style={{ fontWeight: '700', color: '#2DD4A0', marginBottom: '4px' }}>📦 Se cargarán datos para {cfg.nombre}:</div>
            <div>• 3 productos con precios en {cfg.moneda}</div>
            <div>• ~528 pedidos en: {cfg.ciudades.slice(0, 4).join(', ')}</div>
            <div>• Transportadoras: {cfg.transportadoras.slice(0, 2).join(', ')}</div>
            <div>• 6 meses de operación (Ene–Jun 2026)</div>
          </div>

          {yaHayDatos && (
            <div style={{ padding: '10px 12px', background: 'rgba(245,166,35,0.08)', borderRadius: '8px', marginBottom: '12px', fontSize: '11px', color: '#F5A623' }}>
              ⚠️ Ya hay {conteos.pedidos?.toLocaleString()} pedidos cargados. Si ejecutas el seed se agregarán más datos. Usa &quot;Limpiar&quot; primero si quieres empezar de cero.
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <button onClick={ejecutarSeed} disabled={seedActivo}
              style={{ flex: 2, padding: '11px', background: seedActivo ? 'rgba(45,212,160,0.15)' : '#2DD4A0', border: 'none', borderRadius: '9px', color: seedActivo ? '#2DD4A0' : '#0A0D14', fontWeight: '800', cursor: seedActivo ? 'wait' : 'pointer', fontSize: '13px' }}>
              {seedActivo ? '⏳ Cargando datos...' : '🌱 Cargar datos demo'}
            </button>
            <button onClick={limpiarDatos} disabled={seedActivo}
              style={{ flex: 1, padding: '11px', background: 'rgba(240,92,92,0.1)', border: '1px solid rgba(240,92,92,0.3)', borderRadius: '9px', color: '#F05C5C', fontWeight: '700', cursor: seedActivo ? 'not-allowed' : 'pointer', fontSize: '13px' }}>
              🗑️ Limpiar
            </button>
          </div>

          <div style={{ marginTop: '14px' }}>
            <div style={{ fontSize: '11px', color: '#5A6478', marginBottom: '8px' }}>PROGRESO POR MÓDULO:</div>
            {PASOS_SEED.map(paso => (
              <div key={paso.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <span style={{ fontSize: '13px' }}>{estadoIcon(progreso[paso.key] || 'pendiente')}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: estadoColor(progreso[paso.key] || 'pendiente') }}>{paso.label}</div>
                  <div style={{ fontSize: '10px', color: '#5A6478' }}>{paso.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#111520', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontWeight: '700', fontSize: '13px' }}>
            🖥️ Log de operaciones
          </div>
          <div style={{ padding: '12px 16px', height: '480px', overflowY: 'auto', fontFamily: 'monospace' }}>
            {log.length === 0 ? (
              <div style={{ color: '#5A6478', fontSize: '12px', textAlign: 'center', padding: '40px' }}>
                El log aparecerá aquí cuando ejecutes el seed...
              </div>
            ) : log.map((l, i) => (
              <div key={i} style={{ fontSize: '11px', color: l.includes('✅') ? '#2DD4A0' : l.includes('❌') ? '#F05C5C' : l.includes('🎉') ? '#F5A623' : '#8B96A8', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                {l}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
