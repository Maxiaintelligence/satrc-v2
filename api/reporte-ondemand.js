/**
 * SatRC V2.0 - Reporte Diocesano de Situación "On-Demand" (Groq Llama-3.3-70B)
 * Genera el documento formal de 6 secciones en tiempo real al hacer clic.
 */

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");

  const ahora = new Date();
  const fechaHoyStr = ahora.toLocaleDateString('es-MX', { 
    timeZone: 'America/Mexico_City', 
    day: '2-digit', 
    month: 'long', 
    year: 'numeric' 
  });
  const horaMexicoStr = ahora.toLocaleTimeString('es-MX', { 
    timeZone: 'America/Mexico_City', 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: true 
  });

  const { alertaSMN, resumenSeveridad, focosCriticos } = req.body || {};
  const apiKeyGroq = process.env.GROQ_API_KEY;

  if (!apiKeyGroq) {
    return res.status(500).json({ error: "Falta configurar GROQ_API_KEY en Vercel" });
  }

  const systemPrompt = `Eres SARA (Sistema de Alerta y Respuesta Automatizada), Oficial Meteoróloga de Guardia de Cáritas Pastoral Social en la Arquidiócesis de Tulancingo (Hidalgo y Sierra Norte de Puebla).
Tu misión es redactar el "REPORTE DIOCESANO DE SITUACIÓN METEOROLÓGICA ON-DEMAND".
Voz: Meteoróloga profesional de montaña, rigurosa, serena, objetiva y pastoral.
REGLAS OBLIGATORIAS:
1. No inventes albergues ni ubicaciones que no conoces. Las recomendaciones tácticas deben ser de autoprotección comunitaria según el fenómeno activo (lluvia, deslaves, niebla o frío).
2. Reconoce que el Altiplano (Apan, Tizayuca, Pachuca) está en calma por sombra orográfica y que la Sierra (Huauchinango, Pahuatlán, Zihuateutla) concentra la tensión.
3. Responde ÚNICAMENTE un objeto JSON con las 6 secciones exactas:
{
  "seccion_I_atmosfera": "Párrafo sobre los sistemas sinópticos y vientos",
  "seccion_II_focos_sierra": "Párrafo explicando la física de laderas y cuencas bajo tensión",
  "seccion_III_altiplano_calma": "Párrafo explicando por qué las planicies están seguras",
  "seccion_IV_evolucion": "Pronóstico de las próximas 12 a 24 horas",
  "seccion_V_recomendaciones_pastorales": "Recomendaciones prácticas para párrocos y comunidades ante los fenómenos presentes",
  "seccion_VI_deslinde": "Texto formal de subordinación a Protección Civil y CONAGUA"
}`;

  const userPrompt = `Emitido hoy: ${fechaHoyStr} a las ${horaMexicoStr}.
Aviso oficial CONAGUA/SMN: ${alertaSMN ? alertaSMN.titulo + " (" + alertaSMN.rango_lluvia_min_mm + "-" + alertaSMN.rango_lluvia_max_mm + " mm)" : "Sin aviso extraordinario"}.
Emergencias Nivel 4 (Laderas >= 45°): ${resumenSeveridad?.totalNivel4 || 0}.
Alertas Nivel 3 (Laderas 25°-44°): ${resumenSeveridad?.totalNivel3 || 0}.
Estables Nivel 1 (Altiplano): ${resumenSeveridad?.totalNivel1 || 300}.
Comunidades prioritarias: ${JSON.stringify(focosCriticos || [])}.`;

  try {
    const respuestaGroq = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKeyGroq.trim()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });

    if (!respuestaGroq.ok) {
      throw new Error(`Groq API HTTP ${respuestaGroq.status}`);
    }

    const data = await respuestaGroq.json();
    const reporteJSON = JSON.parse(data.choices[0].message.content);

    return res.json({
      exito: true,
      fecha_emision: fechaHoyStr,
      hora_emision: horaMexicoStr,
      consenso_modelos: "GFS (EE.UU.) • ICON (Alemania) • GEM (Canadá)",
      reporte: reporteJSON
    });

  } catch (error) {
    console.error("Fallo generando reporte On-Demand:", error);
    return res.status(500).json({ error: "No se pudo generar el reporte con Groq" });
  }
}