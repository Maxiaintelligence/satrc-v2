import React from 'react';
import { Bot } from 'lucide-react';

export default function ReporteSara() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-black text-white">Reporte Diario SARA</h2>
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl flex flex-col items-center justify-center text-center gap-3">
        <Bot className="w-12 h-12 text-amber-500" />
        <p className="text-slate-400">Vista de reporte público en construcción (Próximo Commit)</p>
      </div>
    </div>
  );
}