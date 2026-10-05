import { z } from 'zod';
import { evaluarLocalidad } from './src/engine/riskEvaluator.js';

console.log('========================================================================');
console.log('   SUITE DE TESTS DE REGRESIÓN - FASE 1 (CI/CD GATE)                   ');
console.log('========================================================================\n');

let testsAprobados = 0;
let testsTotales = 0;

function afirmativo(nombreTest, condicion) {
  testsTotales++;
  if (condicion) {
    console.log(`✅ [PASS] ${nombreTest}`);
    testsAprobados++;
  } else {
    console.error(`❌ [FAIL] ${nombreTest}`);
    process.exitCode = 1;
  }
}

// Mock de comunidad serrana vulnerable (Huauchinango / Zihuateutla)
const localidadSierraMock = {
  id: "HUA_ZIH_01",
  nombre: "La Unión",
  municipio: "Zihuateutla",
  estado: "Puebla",
  zona_id: "HUA",
  topografia: { altitud_msnm: 660, pendiente_max_deg: 42.3, relieve: "LADERA", twi: 12.8 },
  hidrologia: { subcuenca_cve: "RH27Bb", subcuenca_nom: "R. Necaxa", posicion: "BAJA", distancia_cauce_km: 19.4, tc_horas: 12.5, poblacion_aguas_arriba: 141415 },
  vulnerabilidad: { poblacion: 1658, marginacion: "ALTO", acceso_vial: "CAMINO_TERRACERIA", dist_hospital_km: 8.4 }
};

// Mock de comunidad de Altiplano protegida (Apan / Tizayuca)
const localidadAltiplanoMock = {
  id: "APN_APN_01",
  nombre: "Apan",
  municipio: "Apan",
  estado: "Hidalgo",
  zona_id: "APN",
  topografia: { altitud_msnm: 2488, pendiente_max_deg: 8.2, relieve: "LLANURA_COSTERA", twi: 12.9 },
  hidrologia: { subcuenca_cve: "RH26Du", subcuenca_nom: "L. Tochac", posicion: "BAJA", distancia_cauce_km: 0.4, tc_horas: 4.7, poblacion_aguas_arriba: 32925 },
  vulnerabilidad: { poblacion: 28792, marginacion: "ALTO", acceso_vial: "CAMINO_TERRACERIA", dist_hospital_km: 0.05 }
};

// 1. TEST DE REGRESIÓN: Si alertaSMN tiene firma rota, NO debe degradar silenciosamente a verde
const alertaSMNRota = { titulo: "Aviso", rango_lluvia_min_mm: 75 }; // Sin estados_afectados
const resFirmaRota = evaluarLocalidad(localidadSierraMock, [{ lluvia_mm: 1.3 }], { alertaSMN: alertaSMNRota });
afirmativo(
  "Test 1: Si alertaSMN carece de estados_afectados válidos, el motor rechaza firma rota y aplica precaución",
  resFirmaRota.nivel_alerta >= 2 // Jamás Nivel 1 silencioso
);

// 2. TEST DE DISCREPANCIA (PRINCIPIO PRECAUTORIO): SMN dice 75-150mm y Open-Meteo dice 1.3mm en Sierra
const alertaSMNOficial = {
  activo: true,
  titulo: "Frente Frío Núm. 1",
  rango_lluvia_min_mm: 75,
  rango_lluvia_max_mm: 150,
  estados_afectados: ["PUE", "HGO", "VER"],
  vigencia_fin_iso: new Date(Date.now() + 86400000).toISOString()
};
const resDiscrepancia = evaluarLocalidad(localidadSierraMock, [{ lluvia_mm: 1.3 }], { alertaSMN: alertaSMNOficial });
afirmativo(
  "Test 2: Principio Precautorio: Ante discrepancia (SMN 75mm vs Open-Meteo 1.3mm en Sierra), gana SMN (Nivel >= 3)",
  resDiscrepancia.nivel_alerta >= 3
);

// 3. TEST DE DISCRIMINACIÓN ALTIPLANO: Altiplano plano con lluvia baja NO debe entrar a crisis
const resAltiplano = evaluarLocalidad(localidadAltiplanoMock, [{ lluvia_mm: 1.3 }], { alertaSMN: alertaSMNOficial });
afirmativo(
  "Test 3: Discriminación Territorial: Altiplano plano con lluvia 1.3mm permanece en Nivel 1 (Estable)",
  resAltiplano.nivel_alerta === 1
);

// 4. TEST DE AVISO SMN EXPIRADO: Si vigencia_fin ya pasó, purga la elevación artificial
const alertaSMNVencida = {
  ...alertaSMNOficial,
  vigencia_fin_iso: "2024-01-01T00:00:00Z" // Expirada hace meses
};
const resExpirada = evaluarLocalidad(localidadSierraMock, [{ lluvia_mm: 1.3 }], { alertaSMN: alertaSMNVencida });
afirmativo(
  "Test 4: Aviso SMN Expirado: Si vigencia_fin es pasada, no eleva artificialmente por aviso vencido",
  resExpirada.impactoSistemico.lluviaEvento24hMm < 75
);

// 5. TEST DE VALIDACIÓN ZOD: El esquema rechaza payloads sin estructura
const EstadoDiocesanoSchema = z.object({
  schema_version: z.string(),
  hora_mexico: z.string(),
  semaforo: z.object({
    totalNivel4: z.number().nonnegative(),
    totalNivel3: z.number().nonnegative(),
    totalNivel2: z.number().nonnegative(),
    totalNivel1: z.number().nonnegative()
  }),
  evaluaciones: z.array(z.object({
    localidad_id: z.string(),
    nivel_alerta: z.number().min(1).max(4)
  })).min(1)
});

const payloadInvalido = { semaforo: { totalNivel4: -5 } }; // Roto
const validacion = EstadoDiocesanoSchema.safeParse(payloadInvalido);
afirmativo(
  "Test 5: Validación Zod en Runtime: Rechaza payloads corruptos con safeParse sin romper ejecución",
  !validacion.success
);

console.log('------------------------------------------------------------------------');
console.log(`Resultados: ${testsAprobados} / ${testsTotales} tests aprobados.`);
if (testsAprobados === testsTotales) {
  console.log('🎉 [CI GATE APROBADO] Los 5 tests de regresión pasaron con éxito.');
} else {
  console.error('🚨 [CI GATE RECHAZADO] Existen regresiones críticas en el código.');
}
console.log('========================================================================\n');