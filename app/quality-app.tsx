"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, Archive, BarChart3, Bell, Check, CheckCircle2,
  ChevronDown, ClipboardCheck, Clock3, Download, Edit3, Eye, FileCheck2,
  FileSpreadsheet, Gauge, History, Leaf, LockKeyhole, LogOut, Menu,
  PackageCheck, Plus, RefreshCw, Search, Settings, ShieldCheck, Sprout,
  Truck, UserCog, Users, Weight, X,
} from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ApiCarrier, ApiDashboard, ApiRecord, ApiSupplier, DEMO_ENABLED, apiCarriers, apiCreateRecord, apiDashboard, apiDownload, apiImportRecords, apiLogin, apiLogout, apiMyPermissions, apiRecords, apiSuppliers, apiValidate } from "./api-client";
import {
  AlertsPage, AuditFullPage, CatalogsPage, CorrectiveActionsPage, LotsPage,
  NonConformitiesPage, ParametersPage, ProfileDialog, RolesPage, SessionUser,
  SpcPage, SuppliersCarriersPage, UsersAdminPage,
} from "./feature-pages";

type Role = "Administrador" | "Coordinador" | "Inspector" | "Revisor";
type Field = { key: string; label: string; type?: "text" | "number" | "date" | "time" | "select" | "textarea"; required?: boolean; options?: string[]; hint?: string; limit?: string };
type ModuleDef = { code: string; title: string; short: string; icon: typeof Truck; tone: string; fields: Field[] };
type RecordRow = { id: string; backendId?: number; module: string; code: string; provider: string; lot: string; result: string; state: string; inspector: string; time: string; date: string };

const select = (key: string, label: string, options: string[], required = true): Field => ({ key, label, type: "select", options, required });
const number = (key: string, label: string, required = false, limit?: string): Field => ({ key, label, type: "number", required, limit });
const observations: Field[] = [
  { key: "observaciones", label: "Observaciones", type: "textarea" },
  { key: "medidas_correctivas", label: "Medidas correctivas", type: "textarea" },
];
const typeField = select("tipo", "Tipo de certificación", ["Convencional", "Comercio justo"]);

const modules: ModuleDef[] = [
  {
    code: "FOR-CCD-001", title: "Inspección de vehículos", short: "Vehículos", icon: Truck, tone: "blue",
    fields: [
      { key: "fecha_ingreso", label: "Fecha de ingreso", type: "date", required: true },
      { key: "agricultor", label: "Agricultor", required: true }, { key: "producto", label: "Producto", required: true },
      { key: "codigo_agricultor", label: "Código de agricultor", required: true }, { key: "procedencia", label: "Procedencia" },
      { key: "transportista", label: "Transportista", required: true }, number("cantidad", "Cantidad"), { key: "placa", label: "Placa", required: true }, typeField,
      ...["Olores extraños", "Suciedad en el vehículo", "Presencia de animales", "Materia extraña", "Residuos químicos", "Estado deficiente de carrocería", "Ausencia de malla", "Falta formato de limpieza y desinfección", "Otros"].map((label, i) => select(`condicion_${i}`, label, ["Ausencia", "Presencia"])),
      ...observations,
    ],
  },
  {
    code: "FOR-CCD-002", title: "Control de materia prima", short: "Materia prima", icon: Sprout, tone: "green",
    fields: [
      { key: "fecha_cosecha", label: "Fecha de cosecha", type: "date", required: true }, { key: "fecha_ingreso", label: "Fecha de ingreso", type: "date", required: true }, { key: "hora", label: "Hora", type: "time", required: true },
      { key: "proveedor_codigo", label: "Código del proveedor", required: true }, { key: "proveedor", label: "Apellidos y nombres", required: true },
      { ...number("brix", "°Brix", true), hint: "El rango se administra en Configuración" }, number("humedad", "% Humedad", true),
      select("bpa_vehiculo", "Cumplimiento BPA - vehículo", ["Cumple", "No cumple"]), select("bpa_materia", "Cumplimiento BPA - materia prima", ["Cumple", "No cumple"]),
      number("calidad_1", "Calidad 1ra (und.)"), number("calidad_2", "Calidad 2da (und.)"), number("calidad_3", "Calidad 3ra (und.)"),
      ...["Mellizo", "Pequeño", "Pintón", "Pulpa expuesta", "Curvo", "Daño mecánico", "Otro"].map((label, i) => number(`nc_${i}`, `${label} (und.)`)),
      number("peso_promedio", "Peso promedio por unidad (g)", true), number("peso_raquiz", "Peso de raquis (kg)"), typeField, ...observations,
    ],
  },
  {
    code: "FOR-CCD-005", title: "Peso promedio por unidad", short: "Peso promedio", icon: Weight, tone: "violet",
    fields: [
      { key: "fecha", label: "Fecha", type: "date", required: true }, { key: "proveedor", label: "Proveedor", required: true },
      number("peso_bruto", "Peso bruto (kg)", true), number("jabas", "N.º de jabas", true), number("peso_neto", "Peso neto (kg)", true), number("unidades", "N.º de unidades", true),
      { ...number("peso_promedio", "Peso promedio/unidad (g)"), hint: "Se calcula automáticamente" }, typeField,
    ],
  },
  {
    code: "FOR-CCD-007", title: "Control de calidad en pelado", short: "Pelado", icon: ClipboardCheck, tone: "amber",
    fields: [
      { key: "fecha", label: "Fecha", type: "date", required: true }, { key: "hora", label: "Hora", type: "time", required: true }, { key: "proveedor_codigo", label: "Código proveedor", required: true }, { key: "pelador_codigo", label: "Código pelador", required: true },
      number("brix", "°Brix", true), number("muestra", "Total muestra (und.)", true), number("conforme", "Total conforme (und.)", true), number("defectos", "Total defectos (und.)", true),
      ...[
        ["Restos de cáscara adherida < 2 cm", "5% máx."], ["Restos de cáscara adherida > 2 cm", "0%"], ["Plátanos partidos (≥ 9 cm)", "1% máx."], ["Trozos (< 9 cm)", "1 por 100 und."], ["Cortes de pulpa", "1% máx."], ["Contaminación (cabello, barro, etc.)", "Ausencia"], ["Frutos maduros", "0%"], ["Frutos pintones", "1% máx."], ["Frutos siameses", "0%"], ["Frutos perfilados", "1% máx."], ["Pulpa arrancada", "1% máx."], ["Frutos pardeados por oxidación", "0.5% máx."], ["Puntos negros", "1% máx."], ["Frutos con centro blanco", "0.5% máx."], ["Materias extrañas", "Ausencia"], ["Otros", "—"],
      ].map(([label, limit], i) => number(`defecto_${i}`, `${label} (und.)`, false, limit)),
      { key: "acciones", label: "Acciones a realizar", type: "textarea" }, typeField,
    ],
  },
  {
    code: "FOR-CCD-010", title: "Control de descarte", short: "Descarte", icon: Archive, tone: "red",
    fields: [
      { key: "fecha", label: "Fecha de proceso", type: "date", required: true }, { key: "hora", label: "Hora", type: "time", required: true }, { key: "codigo", label: "Código", required: true },
      number("kg", "Kilogramos", true), number("total", "Total (und.)", true), number("conforme", "Conforme (und.)", true),
      ...["Mellizo", "Pequeño", "Pintón", "Pulpa expuesta", "Daño mecánico", "Magullado", "Curvo", "Delgado", "Otro"].map((label, i) => number(`nc_${i}`, `${label} (und.)`)),
      ...observations, typeField,
    ],
  },
  {
    code: "FOR-CCD-018", title: "Selección de materia prima pelada", short: "Selección", icon: FileCheck2, tone: "cyan",
    fields: [
      { key: "fecha", label: "Fecha", type: "date", required: true }, { key: "hora", label: "Hora de evaluación", type: "time", required: true }, { key: "codigo", label: "Código", required: true },
      select("calidad", "Calidad", ["1ra", "2da"]), number("total", "Total evaluado (und.)", true), number("primera", "1ra (> 151 g)"), number("segunda", "2da (141–150 g)"), number("tercera", "3ra (120–140 g)"),
      number("no_conformes", "No conformes (%)"), number("desviacion", "% Desviación"), { key: "operario", label: "Nombre del operario", required: true }, ...observations, typeField,
    ],
  },
  {
    code: "FOR-CCD-019", title: "Control de calidad en embolsado", short: "Embolsado", icon: PackageCheck, tone: "indigo",
    fields: [
      { key: "producto", label: "Producto", required: true }, { key: "fecha", label: "Fecha", type: "date", required: true }, { key: "hora", label: "Hora", type: "time", required: true }, { key: "proveedor_codigo", label: "Código proveedor", required: true },
      select("calidad", "Calidad", ["1ra", "2da", "3ra"]), { key: "lote", label: "Lote", required: true }, number("temperatura", "Temperatura de pulpa (°C)", true),
      number("muestra", "Total muestra (und.)", true), number("conforme", "Total conforme (und.)", true), number("defectos", "Total defectos (und.)", true),
      ...[["Restos de cáscara < 2 cm", "5% máx."], ["Restos de cáscara > 2 cm", "0%"], ["Plátanos partidos (≥ 9 cm)", "1% máx."], ["Trozos (< 9 cm)", "1 por 100 und."], ["Frutos perfilados", "1% máx."], ["Pulpa arrancada", "1% máx."], ["Materias extrañas", "Ausencia"], ["Otros", "—"]].map(([label, limit], i) => number(`defecto_${i}`, `${label} (und.)`, false, limit)),
      number("primera", "1ra > 170 g (65%)"), number("segunda", "2da 141–170 g (30%)"), number("tercera", "3ra 120–140 g (5%)"), number("inferior", "Calidad inferior"),
      { key: "observacion_accion", label: "Observación / acción correctiva", type: "textarea" }, typeField,
    ],
  },
  {
    code: "FOR-CCD-023", title: "Control de producto terminado", short: "Producto terminado", icon: CheckCircle2, tone: "teal",
    fields: [
      { key: "fecha", label: "Fecha", type: "date", required: true }, { key: "hora", label: "Hora", type: "time", required: true }, typeField,
      { key: "agricultor_codigo", label: "Código agricultor", required: true }, number("brix", "°Brix", true), number("temperatura", "Temperatura de pulpa (°C)", true),
      ...["Textura", "Color", "Olor", "Apariencia"].map((label, i) => select(`caracteristica_${i}`, label, ["Conforme", "No conforme"])),
      { key: "observaciones", label: "Observaciones", type: "textarea" }, { key: "acciones", label: "Acciones a realizar", type: "textarea" },
    ],
  },
];

const demoUsers: Record<string, SessionUser & { password: string }> = {
  admin: { id:1, username:"admin", email:"ana.salazar@tropical.pe", full_name:"Ana Salazar", password: "Calidad2026!", name: "Ana Salazar", role: "Administrador", initials: "AS", is_active:true },
  coordinador: { id:2, username:"coordinador", email:"carlos.medina@tropical.pe", full_name:"Carlos Medina", password: "Calidad2026!", name: "Carlos Medina", role: "Coordinador", initials: "CM", is_active:true },
  inspector: { id:3, username:"inspector", email:"lucia.ramos@tropical.pe", full_name:"Lucía Ramos", password: "Calidad2026!", name: "Lucía Ramos", role: "Inspector", initials: "LR", is_active:true },
  revisor: { id:4, username:"revisor", email:"marco.vega@tropical.pe", full_name:"Marco Vega", password: "Calidad2026!", name: "Marco Vega", role: "Revisor", initials: "MV", is_active:true },
};

const trend = [
  { day: "Lun", conformidad: 91.4 }, { day: "Mar", conformidad: 93.2 }, { day: "Mié", conformidad: 92.7 },
  { day: "Jue", conformidad: 95.1 }, { day: "Vie", conformidad: 94.6 }, { day: "Sáb", conformidad: 96.2 },
];
const defects = [
  { name: "Pequeño", value: 42 }, { name: "Curvo", value: 31 }, { name: "Pintón", value: 23 },
  { name: "Daño mec.", value: 17 }, { name: "Pulpa exp.", value: 9 },
];
const initialRecords: RecordRow[] = [
  { id: "REG-2026-0084", module: "Materia prima", code: "FOR-CCD-002", provider: "AGR-014 · José Paredes", lot: "L-0309-04", result: "94.6%", state: "Pendiente", inspector: "Lucía Ramos", time: "7m 08s", date: "03/09/2026 · 10:42" },
  { id: "REG-2026-0083", module: "Pelado", code: "FOR-CCD-007", provider: "AGR-009 · Rosa Flores", lot: "L-0309-03", result: "97.1%", state: "Aprobado", inspector: "Diego Soto", time: "6m 45s", date: "03/09/2026 · 09:58" },
  { id: "REG-2026-0082", module: "Embolsado", code: "FOR-CCD-019", provider: "AGR-021 · Luis Torres", lot: "L-0309-02", result: "91.8%", state: "Observado", inspector: "Lucía Ramos", time: "8m 11s", date: "03/09/2026 · 09:16" },
  { id: "REG-2026-0081", module: "Vehículos", code: "FOR-CCD-001", provider: "AGR-014 · José Paredes", lot: "—", result: "Conforme", state: "Aprobado", inspector: "Diego Soto", time: "4m 20s", date: "03/09/2026 · 08:34" },
  { id: "REG-2026-0080", module: "Selección", code: "FOR-CCD-018", provider: "AGR-006 · Elena Ríos", lot: "L-0209-08", result: "93.5%", state: "Aprobado", inspector: "Lucía Ramos", time: "7m 52s", date: "02/09/2026 · 16:47" },
];

function toRecordRow(record: ApiRecord): RecordRow {
  const seconds = Math.max(0, Math.round(record.duration_seconds));
  return {
    id: record.record_code,
    backendId: record.id,
    module: modules.find(module => module.code === record.module_code)?.short || record.module_code,
    code: record.module_code,
    provider: String(record.payload.proveedor || record.payload.agricultor || record.payload.proveedor_codigo || "Sin proveedor"),
    lot: record.lot || "—",
    result: record.conformity_percent == null ? "Registrado" : `${record.conformity_percent}%`,
    state: record.status,
    inspector: `Usuario ${record.created_by_id}`,
    time: `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`,
    date: new Date(record.created_at).toLocaleString("es-PE"),
  };
}

type View = "dashboard" | "new" | "records" | "validations" | "suppliers" | "nonconformities" | "actions" | "spc" | "lots" | "reports" | "alerts" | "users" | "roles" | "catalogs" | "settings" | "audit";
const nav: { id: View; section: string; label: string; icon: typeof Leaf; permission:string; roles: Role[]; badge?: number }[] = [
  { id: "dashboard", section:"OPERACIÓN", label: "Resumen", icon: BarChart3, permission:"dashboard.view", roles: ["Administrador", "Coordinador", "Inspector", "Revisor"] },
  { id: "new", section:"OPERACIÓN", label: "Nuevo registro", icon: Plus, permission:"records.create", roles: ["Administrador", "Coordinador", "Inspector"] },
  { id: "records", section:"OPERACIÓN", label: "Registros de calidad", icon: ClipboardCheck, permission:"records.view", roles: ["Administrador", "Coordinador", "Inspector", "Revisor"] },
  { id: "validations", section:"OPERACIÓN", label: "Validaciones", icon: ShieldCheck, permission:"records.validate", roles: ["Administrador", "Coordinador"], badge: 5 },
  { id: "nonconformities", section:"MEJORA CONTINUA", label: "No conformidades", icon: AlertTriangle, permission:"nonconformities.manage", roles: ["Administrador", "Coordinador", "Inspector"] },
  { id: "actions", section:"MEJORA CONTINUA", label: "Acciones correctivas (PHVA)", icon: RefreshCw, permission:"phva.manage", roles: ["Administrador", "Coordinador"] },
  { id: "spc", section:"MEJORA CONTINUA", label: "Análisis estadístico (SPC)", icon: Activity, permission:"spc.view", roles: ["Administrador", "Coordinador", "Revisor"] },
  { id: "lots", section:"MEJORA CONTINUA", label: "Trazabilidad de lotes", icon: History, permission:"lots.manage", roles: ["Administrador", "Coordinador", "Inspector"] },
  { id: "reports", section:"INFORMACIÓN", label: "Reportes e indicadores", icon: FileSpreadsheet, permission:"reports.export", roles: ["Administrador", "Coordinador", "Revisor"] },
  { id: "alerts", section:"INFORMACIÓN", label: "Alertas y notificaciones", icon: Bell, permission:"alerts.view", roles: ["Administrador", "Coordinador", "Inspector", "Revisor"], badge: 2 },
  { id: "suppliers", section:"ADMINISTRACIÓN", label: "Proveedores", icon: Sprout, permission:"catalogs.manage", roles: ["Administrador", "Coordinador"] },
  { id: "users", section:"ADMINISTRACIÓN", label: "Usuarios", icon: Users, permission:"users.manage", roles: ["Administrador"] },
  { id: "roles", section:"ADMINISTRACIÓN", label: "Roles y permisos", icon: ShieldCheck, permission:"roles.manage", roles: ["Administrador"] },
  { id: "catalogs", section:"ADMINISTRACIÓN", label: "Catálogos maestros", icon: Archive, permission:"catalogs.manage", roles: ["Administrador", "Coordinador"] },
  { id: "settings", section:"ADMINISTRACIÓN", label: "Parámetros de calidad", icon: Settings, permission:"parameters.manage", roles: ["Administrador", "Coordinador"] },
  { id: "audit", section:"ADMINISTRACIÓN", label: "Bitácora de auditoría", icon: History, permission:"audit.view", roles: ["Administrador", "Coordinador", "Revisor"] },
];

function StatusBadge({ state }: { state: string }) {
  const cls = state === "Aprobado" ? "status-approved" : state === "Observado" || state === "Rechazado" ? "status-rejected" : "status-pending";
  return <Badge variant="outline" className={`status-badge ${cls}`}>{state === "Aprobado" ? <Check size={12} /> : state === "Pendiente" ? <Clock3 size={12} /> : <AlertTriangle size={12} />}{state}</Badge>;
}

function Logo({ compact = false }: { compact?: boolean }) {
  return <div className="brand"><div className="brand-mark"><Leaf /></div>{!compact && <div><strong>CALIDAD 360</strong><span>Procesadora Tropical S.A.C.</span></div>}</div>;
}

function Login({ onLogin, onConnected, onPermissions }: { onLogin: (u: SessionUser) => void; onConnected: (value:boolean)=>void; onPermissions:(permissions:string[])=>void }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState(DEMO_ENABLED ? "Calidad2026!" : "");
  const [showDemo, setShowDemo] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (DEMO_ENABLED) {
      const user = demoUsers[username.trim().toLowerCase()];
      if (!user || user.password !== password) return toast.error("Usuario o contraseña incorrectos");
      apiLogout();
      onConnected(false);
      onLogin(user);
      toast.info("Modo demostración: los cambios de esta sesión no se guardan en PostgreSQL.");
      return;
    }
    setSubmitting(true);
    try {
      const remote = await apiLogin(username.trim().toLowerCase(), password);
      const access = await apiMyPermissions();
      onPermissions(access.permissions);
      onConnected(true);
      onLogin({ ...remote, name: remote.full_name, initials: remote.full_name.split(" ").map(n=>n[0]).slice(0,2).join("") });
      toast.success(`Bienvenido, ${remote.full_name}`);
    } catch (error) {
      apiLogout();
      toast.error(error instanceof Error ? error.message : "No se pudo iniciar sesión");
    } finally {
      setSubmitting(false);
    }
  };
  return <div className="login-shell">
    <section className="login-brand-panel">
      <Logo />
      <div className="login-message">
        <div className="eyebrow"><span /> CONTROL DIGITAL DE CALIDAD</div>
        <h1>Cada dato impulsa una <em>mejor cosecha.</em></h1>
        <p>Inspección, trazabilidad y decisiones de mejora continua en una sola plataforma.</p>
        <div className="login-metrics"><div><b>8</b><span>módulos integrados</span></div><div><b>100%</b><span>trazabilidad digital</span></div><div><b>&lt; 2s</b><span>respuesta objetivo</span></div></div>
      </div>
      <div className="login-orb"><Sprout /><span>Mejora continua</span></div>
    </section>
    <section className="login-form-panel">
      <div className="mobile-logo"><Logo /></div>
      <form className="login-card" onSubmit={submit}>
        <div className="login-icon"><LockKeyhole /></div><h2>Bienvenido</h2><p>Ingresa tus credenciales para continuar.</p>
        <label>Usuario<Input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" /></label>
        <label>Contraseña<Input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" /></label>
        <Button type="submit" size="lg" className="login-button" disabled={submitting}>{submitting ? "Conectando…" : "Ingresar al sistema"}</Button>
        {DEMO_ENABLED && <button type="button" className="demo-toggle" onClick={() => setShowDemo(v => !v)}>Credenciales de demostración <ChevronDown className={showDemo ? "rotated" : ""} /></button>}
        {DEMO_ENABLED && showDemo && <div className="demo-credentials"><code>admin</code><span>Contraseña:</span><code>Calidad2026!</code><small>También puedes usar: coordinador, inspector o revisor. Los cambios no se guardan.</small></div>}
        <div className="secure-note"><ShieldCheck /> Sesión protegida y acceso según rol</div>
      </form>
    </section>
  </div>;
}

function PageHeading({ eyebrow, title, text, action }: { eyebrow: string; title: string; text: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div><span className="eyebrow dark">{eyebrow}</span><h1>{title}</h1><p>{text}</p></div>{action}</div>;
}

function Dashboard({ setView, connected, records }: { setView: (v: View) => void; connected: boolean; records:RecordRow[] }) {
  const [stats,setStats]=useState<ApiDashboard|null>(null);
  useEffect(()=>{if(connected)apiDashboard().then(setStats).catch(e=>toast.error(e.message));},[connected,records]);
  const chartTrend=connected?(stats?.trend||[]).map(p=>({day:new Date(p.date).toLocaleDateString("es-PE",{weekday:"short"}),conformidad:p.conformity})):trend;
  const chartDefects=connected?(stats?.top_defects||[]).slice(0,5).map(p=>({name:p.field.replace(/^(defecto_|nc_)/,"").replaceAll("_"," "),value:p.count})):defects;
  const seconds=connected?stats?.average_entry_seconds:432;
  const duration=seconds==null?"—":`${Math.floor(seconds/60)}m ${String(Math.round(seconds%60)).padStart(2,"0")}s`;
  return <>
    <PageHeading eyebrow={`OPERACIÓN DE HOY · ${new Date().toLocaleDateString("es-PE",{day:"2-digit",month:"short",year:"numeric"}).toUpperCase()}`} title="Resumen de calidad" text="Indicadores consolidados del procesamiento de plátano verde." action={<Button onClick={() => setView("new")}><Plus /> Nuevo registro</Button>} />
    <div className={`demo-banner ${connected?"connected":""}`}><Gauge /><span><b>{connected?"PostgreSQL conectado.":"Entorno demostrativo."}</b> {connected?"Los indicadores se alimentan con los datos operativos.":"Los datos son referenciales y los cambios de esta sesión son temporales."}</span></div>
    <section className="kpi-grid">
      <article className="kpi-card"><div className="kpi-icon mint"><CheckCircle2 /></div><div><span>Conformidad global</span><b>{connected?(stats?.conformity_percent!=null?`${stats.conformity_percent}%`:"—"):"94.6%"}</b><small className="up">{connected?(stats?.records_total??"…"):84} registros analizados</small></div><div className="spark"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartTrend}><defs><linearGradient id="mint" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#169c75" stopOpacity={.28}/><stop offset="100%" stopColor="#169c75" stopOpacity={0}/></linearGradient></defs><Area dataKey="conformidad" stroke="#169c75" fill="url(#mint)" strokeWidth={2}/></AreaChart></ResponsiveContainer></div></article>
      <article className="kpi-card"><div className="kpi-icon yellow"><Weight /></div><div><span>Peso promedio</span><b>{connected?(stats?.average_weight_g!=null?`${stats.average_weight_g} g`:"—"):"164 g"}</b><small>Meta operativa: ≥ 151 g</small></div></article>
      <article className="kpi-card"><div className="kpi-icon orange"><AlertTriangle /></div><div><span>No conformidades abiertas</span><b>{connected?(stats?.open_nonconformities??"…"):2}</b><small className="down">Requieren seguimiento</small></div></article>
      <article className="kpi-card"><div className="kpi-icon blue"><Clock3 /></div><div><span>Tiempo por registro</span><b>{duration}</b><small>{connected?(stats?.pending_validations??"…"):5} validaciones pendientes</small></div></article>
    </section>
    <section className="operational-pulse"><button onClick={()=>setView("lots")}><History/><span><b>{connected?(stats?.active_lots??"…"):3} lotes activos</b><small>Ver trazabilidad completa</small></span></button><button onClick={()=>setView("actions")}><RefreshCw/><span><b>{connected?(stats?.overdue_actions??"…"):0} acciones vencidas</b><small>Revisar compromisos PHVA</small></span></button><button onClick={()=>setView("validations")}><ShieldCheck/><span><b>{connected?(stats?.pending_validations??"…"):5} por validar</b><small>Firma y decisión pendiente</small></span></button></section>
    <section className="chart-grid">
      <article className="panel chart-panel"><div className="panel-title"><div><h2>Tendencia de conformidad</h2><p>Registros del periodo disponible</p></div><Badge variant="outline">Datos operativos</Badge></div><div className="big-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartTrend} margin={{ left: -20, right: 12 }}><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#169c75" stopOpacity={.25}/><stop offset="1" stopColor="#169c75" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e6ece9"/><XAxis dataKey="day" axisLine={false} tickLine={false}/><YAxis domain={["auto","auto"]} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`}/><Tooltip formatter={(v) => `${v}%`}/><Area type="monotone" dataKey="conformidad" stroke="#12805f" strokeWidth={3} fill="url(#area)"/></AreaChart></ResponsiveContainer></div></article>
      <article className="panel chart-panel"><div className="panel-title"><div><h2>Principales defectos</h2><p>Pareto de incidencias registradas</p></div><button className="link-button" onClick={() => setView("spc")}>Abrir SPC</button></div><div className="big-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartDefects} layout="vertical" margin={{ left: 15, right: 15 }}><CartesianGrid strokeDasharray="4 4" horizontal={false} stroke="#e6ece9"/><XAxis type="number" axisLine={false} tickLine={false}/><YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={78}/><Tooltip/><Bar dataKey="value" radius={[0,6,6,0]}>{chartDefects.map((_,i)=><Cell key={i} fill={i===0?"#e9ad2b":i===1?"#f0c764":"#9ecfc1"}/>)}</Bar></BarChart></ResponsiveContainer></div></article>
    </section>
    <section className="panel"><div className="panel-title"><div><h2>Registros recientes</h2><p>Actividad operativa y estado de revisión</p></div><button className="link-button" onClick={() => setView("records")}>Ver todos</button></div><RecordsTable rows={records.slice(0,4)} compact /></section>
  </>;
}

function RecordsTable({ rows, compact = false, onView }: { rows: RecordRow[]; compact?: boolean; onView?:(row:RecordRow)=>void }) {
  return <div className="table-wrap"><Table><TableHeader><TableRow><TableHead>Registro</TableHead><TableHead>Módulo / proveedor</TableHead><TableHead>Resultado</TableHead><TableHead>Estado</TableHead>{!compact && <TableHead>Inspector / tiempo</TableHead>}<TableHead className="text-right">Acción</TableHead></TableRow></TableHeader><TableBody>{rows.map(row => <TableRow key={row.id}><TableCell><strong>{row.id}</strong><span className="cell-meta">{row.date}</span></TableCell><TableCell><strong>{row.module}</strong><span className="cell-meta">{row.provider}</span></TableCell><TableCell><b>{row.result}</b><span className="cell-meta">{row.lot}</span></TableCell><TableCell><StatusBadge state={row.state}/></TableCell>{!compact && <TableCell><span>{row.inspector}</span><span className="cell-meta"><Clock3 size={12}/>{row.time}</span></TableCell>}<TableCell className="text-right"><Button variant="ghost" size="icon-sm" aria-label={`Ver ${row.id}`} onClick={() => onView?onView(row):toast.info(`${row.id} · ${row.state}`)}><Eye /></Button></TableCell></TableRow>)}</TableBody></Table></div>;
}

function ModulePicker({ onSelect }: { onSelect: (m: ModuleDef) => void }) {
  return <><PageHeading eyebrow="CAPTURA EN TIEMPO REAL" title="Nuevo registro de calidad" text="Selecciona la etapa que deseas inspeccionar."/><div className="module-grid">{modules.map(m => { const Icon=m.icon; return <button key={m.code} className="module-card" onClick={() => onSelect(m)}><div className={`module-icon ${m.tone}`}><Icon/></div><div><span>{m.code}</span><h2>{m.title}</h2><p>{m.fields.length} campos con validación automática</p></div><Plus className="module-plus"/></button>; })}</div></>;
}

function FieldControl({ field, value, onChange, values }: { field: Field; value: string; onChange: (v: string) => void; values: Record<string,string> }) {
  const calculated = field.key === "peso_promedio" && values.peso_neto && values.unidades ? String(Math.round((+values.peso_neto * 1000) / +values.unidades)) : value;
  if (field.type === "textarea") return <Textarea value={value} onChange={e => onChange(e.target.value)} rows={3}/>;
  if (field.type === "select") return <NativeSelect value={value} onChange={e => onChange(e.target.value)} className="w-full"><NativeSelectOption value="">Seleccionar</NativeSelectOption>{field.options?.map(o => <NativeSelectOption key={o} value={o}>{o}</NativeSelectOption>)}</NativeSelect>;
  return <Input type={field.type || "text"} value={calculated} readOnly={calculated !== value} onChange={e => onChange(e.target.value)} min={field.type === "number" ? 0 : undefined} step={field.type === "number" ? "any" : undefined}/>;
}

function RegisterDialog({ module, startedAt, connected, onClose, onSaved }: { module: ModuleDef | null; startedAt:number; connected:boolean; onClose: () => void; onSaved: (r: RecordRow) => void }) {
  const [values, setValues] = useState<Record<string,string>>({producto:"Plátano verde"}); const [step,setStep]=useState(1);
  const [saving, setSaving] = useState(false);
  const [masterSuppliers,setMasterSuppliers]=useState<ApiSupplier[]>([]);const [masterCarriers,setMasterCarriers]=useState<ApiCarrier[]>([]);const [supplierId,setSupplierId]=useState<number>();const [carrierId,setCarrierId]=useState<number>();
  useEffect(()=>{if(!module||!connected)return;Promise.all([apiSuppliers(),apiCarriers()]).then(([supplierRows,carrierRows])=>{setMasterSuppliers(supplierRows);setMasterCarriers(carrierRows);}).catch(error=>toast.error(error instanceof Error?error.message:"No se pudieron cargar los datos maestros"));},[module,connected]);
  if (!module) return null;
  const halfway = Math.ceil(module.fields.length/2); const visible = step===1 ? module.fields.slice(0,halfway) : module.fields.slice(halfway); const requiredMissing = module.fields.filter(f => f.required && !values[f.key]);
  const needsSupplier=module.code!=="FOR-CCD-010";const needsCarrier=module.code==="FOR-CCD-001";
  const selectSupplier=(raw:string)=>{const id=Number(raw)||undefined;setSupplierId(id);const item=masterSuppliers.find(row=>row.id===id);if(!item)return;setValues(current=>({...current,proveedor:item.name,agricultor:item.name,proveedor_codigo:item.code,codigo_agricultor:item.code,agricultor_codigo:item.code,tipo:item.certification_type}));};
  const selectCarrier=(raw:string)=>{const id=Number(raw)||undefined;setCarrierId(id);const item=masterCarriers.find(row=>row.id===id);if(!item)return;setValues(current=>({...current,transportista:item.name,placa:item.plate||current.placa||""}));};
  const finish = async () => {
    if (saving) return;
    if (requiredMissing.length) { toast.error(`Completa ${requiredMissing.length} campo(s) obligatorio(s)`); setStep(requiredMissing.some(f=>module.fields.indexOf(f)<halfway)?1:2); return; }
    setSaving(true);
    try {
      if (connected) {
        const saved = await apiCreateRecord(module.code, values, new Date(startedAt).toISOString(), supplierId, carrierId);
        onSaved(toRecordRow(saved));
      } else if (DEMO_ENABLED) {
        const secs = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
        onSaved({ id: `REG-DEMO-${Date.now()}`, module:module.short, code:module.code, provider:values.proveedor || values.agricultor || values.proveedor_codigo || "Sin proveedor", lot:values.lote || "—", result:values.conforme&&values.muestra?`${((+values.conforme/+values.muestra)*100).toFixed(1)}%`:"Registrado", state:"Pendiente", inspector:"Usuario actual", time:`${Math.floor(secs/60)}m ${String(secs%60).padStart(2,"0")}s`, date:new Date().toLocaleString("es-PE") });
      } else {
        throw new Error("Inicia sesión para guardar el registro en PostgreSQL.");
      }
      toast.success("Registro enviado para validación");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };
  const Icon=module.icon;
  return <Dialog open={!!module} onOpenChange={open => !open && onClose()}><DialogContent className="record-dialog"><DialogHeader><div className="dialog-heading"><div className={`module-icon ${module.tone}`}><Icon/></div><div><DialogTitle>{module.title}</DialogTitle><DialogDescription>{module.code} · Paso {step} de 2</DialogDescription></div></div></DialogHeader><div className="step-bar"><Progress value={step*50}/><span>{step*50}%</span></div>{connected&&step===1&&(needsSupplier||needsCarrier)&&<div className="form-grid master-fields">{needsSupplier&&<label><span>Proveedor registrado</span><NativeSelect value={supplierId?String(supplierId):""} onChange={e=>selectSupplier(e.target.value)}><NativeSelectOption value="">Seleccionar proveedor</NativeSelectOption>{masterSuppliers.map(item=><NativeSelectOption key={item.id} value={String(item.id)}>{item.code} · {item.name}</NativeSelectOption>)}</NativeSelect></label>}{needsCarrier&&<label><span>Transportista registrado</span><NativeSelect value={carrierId?String(carrierId):""} onChange={e=>selectCarrier(e.target.value)}><NativeSelectOption value="">Seleccionar transportista</NativeSelectOption>{masterCarriers.map(item=><NativeSelectOption key={item.id} value={String(item.id)}>{item.name}{item.plate?` · ${item.plate}`:""}</NativeSelectOption>)}</NativeSelect></label>}</div>}<div className="form-grid">{visible.map(f => <label key={f.key} className={f.type==="textarea"?"full-field":""}><span>{f.label}{f.required && <b>*</b>}{f.limit && <em>{f.limit}</em>}</span><FieldControl field={f} value={values[f.key]||""} values={values} onChange={v=>setValues(s=>({...s,[f.key]:v}))}/>{f.hint && <small>{f.hint}</small>}</label>)}</div><DialogFooter><Button variant="outline" onClick={step===1?onClose:()=>setStep(1)}>{step===1?"Cancelar":"Anterior"}</Button>{step===1?<Button onClick={()=>setStep(2)}>Continuar</Button>:<Button onClick={finish} disabled={saving}><FileCheck2/> {saving ? "Guardando…" : "Guardar y enviar"}</Button>}</DialogFooter></DialogContent></Dialog>;
}

function RecordsPage({ records, connected, onRefresh }: { records: RecordRow[]; connected:boolean; onRefresh:()=>Promise<void> }) {
  const [query,setQuery]=useState(""); const [state,setState]=useState("Todos"); const [selected,setSelected]=useState<RecordRow|null>(null); const fileRef=useRef<HTMLInputElement>(null);
  const rows=records.filter(r=>(state==="Todos"||r.state===state)&&`${r.id} ${r.module} ${r.provider}`.toLowerCase().includes(query.toLowerCase()));
  const importFile=async(file?:File)=>{if(!file)return;if(!connected){toast.info("La importación persistente se habilita al conectar PostgreSQL");return;}try{const result=await apiImportRecords(file);toast.success(`${result.rows_imported} filas importadas; ${result.rows_rejected} rechazadas`);await onRefresh();}catch(error){toast.error(error instanceof Error?error.message:"No se pudo importar");}finally{if(fileRef.current)fileRef.current.value="";}};
  return <><PageHeading eyebrow="TRAZABILIDAD OPERATIVA" title="Registros de calidad" text="Consulta, filtra y revisa toda la información capturada." action={<div className="heading-actions"><input ref={fileRef} className="hidden-import" type="file" accept=".xlsx,.xls,.csv" onChange={e=>importFile(e.target.files?.[0])}/><Button variant="outline" onClick={()=>fileRef.current?.click()}><FileSpreadsheet/> Importar histórico</Button><Button variant="outline" onClick={()=>exportCSV(rows)}><Download/> Exportar CSV</Button></div>}/><section className="panel"><div className="filters"><div className="search-box"><Search/><Input placeholder="Buscar por código, módulo o proveedor..." value={query} onChange={e=>setQuery(e.target.value)}/></div><NativeSelect value={state} onChange={e=>setState(e.target.value)}><NativeSelectOption>Todos</NativeSelectOption><NativeSelectOption>Pendiente</NativeSelectOption><NativeSelectOption>Aprobado</NativeSelectOption><NativeSelectOption>Observado</NativeSelectOption></NativeSelect><Button variant="outline" size="icon" aria-label="Actualizar" onClick={()=>onRefresh().then(()=>toast.success("Listado actualizado")).catch(error=>toast.error(error.message))}><RefreshCw/></Button></div><RecordsTable rows={rows} onView={setSelected}/><div className="table-footer">Mostrando {rows.length} de {records.length} registros <span>Página 1 de 1</span></div></section><Dialog open={!!selected} onOpenChange={open=>!open&&setSelected(null)}><DialogContent><DialogHeader><DialogTitle>{selected?.id}</DialogTitle><DialogDescription>{selected?.code} · detalle del registro de calidad</DialogDescription></DialogHeader>{selected&&<div className="record-detail-grid"><div><span>Módulo</span><b>{selected.module}</b></div><div><span>Estado</span><StatusBadge state={selected.state}/></div><div><span>Proveedor</span><b>{selected.provider}</b></div><div><span>Lote</span><b>{selected.lot}</b></div><div><span>Resultado</span><b>{selected.result}</b></div><div><span>Captura</span><b>{selected.inspector} · {selected.time}</b></div><div className="full-field"><span>Fecha y hora</span><b>{selected.date}</b></div></div>}<DialogFooter><Button onClick={()=>setSelected(null)}>Cerrar</Button></DialogFooter></DialogContent></Dialog></>;
}

function ValidationsPage({ records, onUpdate }: { records: RecordRow[]; onUpdate: (row:RecordRow,state:string,observations?:string)=>Promise<boolean> }) {
  const pending=records.filter(r=>r.state==="Pendiente"||r.state==="Observado");const [selected,setSelected]=useState<RecordRow|null>(null);const [decision,setDecision]=useState("Observado");const [observationsText,setObservationsText]=useState("");
  const [saving, setSaving] = useState(false);
  const review=(row:RecordRow)=>{setSelected(row);setDecision("Observado");setObservationsText("");};
  const submit = async () => {
    if (!selected || saving) return;
    if (decision !== "Aprobado" && !observationsText.trim()) return toast.error("Registre el motivo de la decisión");
    setSaving(true);
    try {
      if (await onUpdate(selected, decision, observationsText)) setSelected(null);
    } finally {
      setSaving(false);
    }
  };
  return <><PageHeading eyebrow="FIRMA Y CONTROL" title="Validaciones pendientes" text="Revisa los registros, firma su conformidad o devuelve observaciones."/><div className="validation-list">{pending.map(r=><article className="validation-card" key={r.id}><div className="validation-main"><div className="record-symbol"><ClipboardCheck/></div><div><div className="record-title"><h2>{r.id}</h2><StatusBadge state={r.state}/></div><p>{r.module} · {r.code}</p><div className="record-meta"><span><Sprout/>{r.provider}</span><span><Clock3/>{r.date}</span><span><UserCog/>{r.inspector}</span></div></div></div><div className="validation-result"><span>Resultado</span><b>{r.result}</b><small>Tiempo: {r.time}</small></div><div className="validation-actions"><Button variant="outline" onClick={()=>review(r)}><Edit3/> Revisar</Button><Button onClick={()=>onUpdate(r,"Aprobado","Conforme")}><ShieldCheck/> Aprobar y firmar</Button></div></article>)}</div>{pending.length===0&&<div className="empty-state"><CheckCircle2/><h2>Todo está validado</h2><p>No hay registros pendientes de revisión.</p></div>}<Dialog open={!!selected} onOpenChange={open=>!open&&setSelected(null)}><DialogContent><DialogHeader><DialogTitle>Revisar {selected?.id}</DialogTitle><DialogDescription>La decisión quedará firmada con usuario, fecha, código único y observación.</DialogDescription></DialogHeader><div className="dialog-form"><label>Decisión<NativeSelect value={decision} onChange={e=>setDecision(e.target.value)}><NativeSelectOption>Observado</NativeSelectOption><NativeSelectOption>Rechazado</NativeSelectOption><NativeSelectOption>Aprobado</NativeSelectOption></NativeSelect></label><label>Observaciones<Textarea value={observationsText} onChange={e=>setObservationsText(e.target.value)} placeholder="Fundamento de la revisión"/></label></div><DialogFooter><Button variant="outline" onClick={()=>setSelected(null)}>Cancelar</Button><Button onClick={submit} disabled={saving}><ShieldCheck/> {saving ? "Guardando…" : "Firmar decisión"}</Button></DialogFooter></DialogContent></Dialog></>;
}

const suppliers:ApiSupplier[]=[
  { id:1,code:"AGR-014",name:"José Paredes Huamán",origin:"Valle del Chira · Sullana",certification_type:"Comercio justo",is_active:true },
  { id:2,code:"AGR-009",name:"Rosa Flores Mendoza",origin:"Querecotillo · Sullana",certification_type:"Convencional",is_active:true },
  { id:3,code:"AGR-021",name:"Luis Torres Castillo",origin:"Marcavelica · Sullana",certification_type:"Comercio justo",is_active:true },
  { id:4,code:"AGR-006",name:"Elena Ríos León",origin:"Salitral · Sullana",certification_type:"Convencional",is_active:true },
];
function ReportsPage({connected}:{connected:boolean}){
  const today=new Date().toISOString().slice(0,10);const month=`${today.slice(0,8)}01`;const [start,setStart]=useState(month);const [end,setEnd]=useState(today);const [module,setModule]=useState("");const [supplier,setSupplier]=useState("");const [reportSuppliers,setReportSuppliers]=useState<ApiSupplier[]>(DEMO_ENABLED && !connected ? suppliers : []);
  useEffect(()=>{if(connected)apiSuppliers().then(setReportSuppliers).catch(error=>toast.error(error instanceof Error?error.message:"No se cargaron los proveedores"));},[connected]);
  const query=()=>{const params=new URLSearchParams();if(start)params.set("start",start);if(end)params.set("end",end);if(module)params.set("module_code",module);if(supplier)params.set("supplier_id",supplier);return params.toString()};
  const download = async (kind: "excel" | "pdf") => {
    if (!connected) return toast.info("Los reportes Excel y PDF requieren una sesión conectada a PostgreSQL.");
    if (start && end && start > end) return toast.error("La fecha inicial debe ser anterior o igual a la fecha final.");
    try {
      await apiDownload(`/api/reports/${kind}?${query()}`, `reporte_calidad.${kind === "excel" ? "xlsx" : "pdf"}`);
      toast.success("Reporte generado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo generar el reporte");
    }
  };
  return <><PageHeading eyebrow="ANÁLISIS Y MEJORA CONTINUA" title="Reportes e indicadores" text="Genera informes filtrados y archivos listos para auditoría."/><section className="report-builder panel"><div className="report-filters"><label>Desde<Input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label><label>Hasta<Input type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label><label>Módulo<NativeSelect className="w-full" value={module} onChange={e=>setModule(e.target.value)}><NativeSelectOption value="">Todos los módulos</NativeSelectOption>{modules.map(m=><NativeSelectOption value={m.code} key={m.code}>{m.short}</NativeSelectOption>)}</NativeSelect></label><label>Proveedor<NativeSelect className="w-full" value={supplier} onChange={e=>setSupplier(e.target.value)}><NativeSelectOption value="">Todos los proveedores</NativeSelectOption>{reportSuppliers.map(s=><NativeSelectOption value={String(s.id)} key={s.code}>{s.code} · {s.name}</NativeSelectOption>)}</NativeSelect></label></div><div className="report-actions"><Button onClick={()=>download("excel")}><FileSpreadsheet/> Descargar Excel</Button><Button variant="outline" onClick={()=>download("pdf")}><Download/> Generar PDF</Button></div></section><div className="report-cards"><article><div className="report-icon"><BarChart3/></div><h3>Resumen ejecutivo</h3><p>Conformidad, tendencias, defectos críticos y acciones correctivas.</p><button onClick={()=>download("pdf")}>Generar informe PDF</button></article><article><div className="report-icon"><Sprout/></div><h3>Desempeño por proveedor</h3><p>Filtra un proveedor y genera el detalle de calidad en Excel.</p><button onClick={()=>download("excel")}>Exportar datos</button></article><article><div className="report-icon"><Activity/></div><h3>Tiempos y productividad</h3><p>Duración de captura por módulo, inspector y turno.</p><button onClick={()=>download("excel")}>Exportar productividad</button></article></div></>
}

function exportCSV(rows: RecordRow[]){const header="ID,Módulo,Proveedor,Lote,Resultado,Estado,Inspector,Tiempo,Fecha\n";const csv=header+rows.map(r=>[r.id,r.module,r.provider,r.lot,r.result,r.state,r.inspector,r.time,r.date].map(v=>`\"${v}\"`).join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));a.download="registros_calidad.csv";a.click();URL.revokeObjectURL(a.href);toast.success("Reporte descargado");}

export function QualityApp(){
  const [user,setUser]=useState<SessionUser | null>(null); const [connected,setConnected]=useState(false); const [permissions,setPermissions]=useState<string[]|null>(null); const [view,setView]=useState<View>("dashboard"); const [mobileOpen,setMobileOpen]=useState(false); const [activeModule,setActiveModule]=useState<ModuleDef|null>(null); const [captureStarted,setCaptureStarted]=useState(0); const [records,setRecords]=useState<RecordRow[]>(DEMO_ENABLED ? initialRecords : []); const [userMenuOpen,setUserMenuOpen]=useState(false); const [profileOpen,setProfileOpen]=useState(false);
  const allowed=useMemo(()=>user?nav.filter(n=>permissions?permissions.includes(n.permission):n.roles.includes(user.role)).map(item=>({...item,badge:connected?undefined:item.badge})):[],[user,permissions,connected]);
  const refreshRecords=useCallback(async()=>{
    if(!connected)return;
    const rows=await apiRecords();
    setRecords(rows.map(toRecordRow));
  },[connected]);
  useEffect(() => {
    if (!user || !connected || !permissions?.includes("records.view")) return;
    let active = true;
    apiRecords().then(rows => { if (active) setRecords(rows.map(toRecordRow)); }).catch(error => { if (active) toast.error(error.message); });
    return () => { active = false; };
  }, [user, connected, permissions]);
  if(!user) return <><Login onLogin={setUser} onConnected={setConnected} onPermissions={setPermissions}/><Toaster richColors position="top-right"/></>;
  const current=allowed.find(n=>n.id===view) || allowed[0]; const navigate=(v:View)=>{setView(v);setMobileOpen(false)};
  const sections=Array.from(new Set(allowed.map(item=>item.section)));
  const logout=()=>{apiLogout();setUser(null);setConnected(false);setPermissions(null);setView("dashboard");setUserMenuOpen(false);setRecords(DEMO_ENABLED ? initialRecords : [])};
  const updateRecord = async (row: RecordRow, state: string, observations = ""): Promise<boolean> => {
    try {
      if (connected) {
        if (!row.backendId) throw new Error("El registro no tiene un identificador en PostgreSQL. Actualiza el listado.");
        await apiValidate(row.backendId, state, observations);
      } else if (!DEMO_ENABLED) {
        throw new Error("Inicia sesión para validar el registro en PostgreSQL.");
      }
      setRecords(rows => rows.map(record => record.id === row.id ? { ...record, state } : record));
      toast.success(state === "Aprobado" ? "Registro firmado y aprobado" : "Decisión registrada");
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo validar");
      return false;
    }
  };
  if(!current)return <><p>Tu cuenta no tiene módulos habilitados. Contacta al administrador.</p><Button onClick={logout}>Cerrar sesión</Button><Toaster richColors position="top-right"/></>;
  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen?"open":""}`}><div className="sidebar-top"><Logo/><button className="sidebar-close" onClick={()=>setMobileOpen(false)}><X/></button></div><nav>{sections.map(section=><div className="nav-section" key={section}><span>{section}</span>{allowed.filter(item=>item.section===section).map(item=>{const Icon=item.icon;return <button key={item.id} className={current.id===item.id?"active":""} onClick={()=>navigate(item.id)}><Icon/><em>{item.label}</em>{item.badge&&<b>{item.badge}</b>}</button>})}</div>)}</nav><div className="sidebar-bottom"><div className="help-card"><ShieldCheck/><div><b>{connected?"PostgreSQL conectado":"Modo demostración"}</b><span>{connected?"Persistencia en base de datos":"Cambios temporales"}</span></div></div><button className="user-mini" onClick={()=>setProfileOpen(true)}><span>{user.initials}</span><div><b>{user.name}</b><small>{user.role}</small></div><Settings/></button><button className="logout" onClick={logout}><LogOut/> Cerrar sesión</button></div></aside>
    {mobileOpen&&<button className="sidebar-overlay" aria-label="Cerrar menú" onClick={()=>setMobileOpen(false)}/>}
    <main className="main-area"><header className="topbar"><button className="menu-button" onClick={()=>setMobileOpen(true)}><Menu/></button><div className="breadcrumb"><span>Calidad 360</span><b>/</b><strong>{current.label}</strong></div><div className="top-actions"><button className="notification" onClick={()=>navigate("alerts")} aria-label="Abrir notificaciones"><Bell/>{DEMO_ENABLED && <i/>}</button><div className="user-menu-wrap"><button className="user-trigger" onClick={()=>setUserMenuOpen(v=>!v)}><span>{user.initials}</span><div><b>{user.name}</b><small>{user.role}</small></div><ChevronDown/></button>{userMenuOpen&&<div className="user-popover"><header><b>{user.name}</b><span>Gerencia de Calidad</span><Badge>{user.role}</Badge></header><button onClick={()=>{setProfileOpen(true);setUserMenuOpen(false)}}><UserCog/>Mi perfil</button>{user.role==="Administrador"&&<button onClick={()=>{navigate("settings");setUserMenuOpen(false)}}><Settings/>Parámetros de calidad</button>}<button onClick={logout}><LogOut/>Cerrar sesión</button></div>}</div></div></header><div className="content">
      {current.id==="dashboard"&&<Dashboard setView={setView} connected={connected} records={records}/>} {current.id==="new"&&<ModulePicker onSelect={module=>{setCaptureStarted(Date.now());setActiveModule(module)}}/>} {current.id==="records"&&<RecordsPage records={records} connected={connected} onRefresh={refreshRecords}/>} {current.id==="validations"&&<ValidationsPage records={records} onUpdate={updateRecord}/>} {current.id==="suppliers"&&<SuppliersCarriersPage connected={connected}/>}
      {current.id==="nonconformities"&&<NonConformitiesPage connected={connected} modules={modules}/>} {current.id==="actions"&&<CorrectiveActionsPage connected={connected}/>} {current.id==="spc"&&<SpcPage connected={connected} modules={modules}/>} {current.id==="lots"&&<LotsPage connected={connected}/>}
      {current.id==="reports"&&<ReportsPage connected={connected}/>} {current.id==="alerts"&&<AlertsPage connected={connected}/>} {current.id==="users"&&<UsersAdminPage connected={connected}/>} {current.id==="roles"&&<RolesPage connected={connected}/>} {current.id==="catalogs"&&<CatalogsPage connected={connected}/>} {current.id==="settings"&&<ParametersPage connected={connected}/>}
      {current.id==="audit"&&<AuditFullPage connected={connected}/>}
    </div></main>
    <nav className="mobile-nav">{allowed.slice(0,4).map(item=>{const Icon=item.icon;return <button key={item.id} className={current.id===item.id?"active":""} onClick={()=>navigate(item.id)}><Icon/><span>{item.label.split(" ")[0]}</span>{item.badge&&<b>{item.badge}</b>}</button>})}</nav>
    <RegisterDialog key={activeModule?`${activeModule.code}-${captureStarted}`:"closed"} module={activeModule} startedAt={captureStarted} connected={connected} onClose={()=>setActiveModule(null)} onSaved={r=>setRecords(rs=>[r,...rs])}/><ProfileDialog key={`${user.id}-${user.email}`} open={profileOpen} onOpenChange={setProfileOpen} user={user} connected={connected} onUpdated={setUser}/><Toaster richColors position="top-right"/>
  </div>;
}
