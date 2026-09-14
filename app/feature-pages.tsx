"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Activity, AlertTriangle, Boxes, Check, CheckCircle2, ClipboardList,
  Clock3, Edit3, Gauge, Layers3, LockKeyhole, Package,
  Plus, Save, Search, Settings2, ShieldCheck, Trash2, UserCog, Users, XCircle,
} from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ApiAudit, ApiCatalog, ApiCorrectiveAction, ApiLot, ApiNonConformity,
  ApiCarrier, ApiNotification, ApiParameter, ApiRole, ApiSpc, ApiSupplier, ApiUser,
  DEMO_ENABLED, apiActions, apiAudit, apiCatalogs, apiChangePassword, apiCreateAction,
  apiCarriers, apiCreateCarrier, apiCreateCatalog, apiCreateLot, apiCreateLotEvent, apiCreateNonConformity,
  apiCreateSupplier, apiCreateUser, apiDeleteCarrier, apiDeleteSupplier, apiLot, apiLots, apiNonConformities, apiNotifications,
  apiParameters, apiReadAllNotifications, apiReadNotification, apiRoles, apiSpc,
  apiUpdateAction, apiUpdateCatalog, apiUpdateLot, apiUpdateNonConformity,
  apiSuppliers, apiUpdateCarrier, apiUpdateParameter, apiUpdateProfile, apiUpdateRole, apiUpdateSupplier, apiUpdateUser, apiUsers,
  apiUserStatus,
} from "./api-client";

export type SessionUser = ApiUser & { initials: string; name: string };
export type ModuleOption = { code: string; short: string; title: string };

const nowIso = new Date().toISOString();
const futureDate = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const fmtDate = (value?: string) => value ? new Date(value).toLocaleString("es-PE", { dateStyle: "short", timeStyle: value.includes("T") ? "short" : undefined }) : "—";

const demoNc: ApiNonConformity[] = [
  { id: 1, code: "NC-2026-00001", module_code: "FOR-CCD-019", lot_code: "L-0309-04", category: "Fruto pequeño", severity: "Mayor", description: "Incidencia de frutos pequeños por encima del límite de control.", quantity: 42, status: "En tratamiento", root_cause: "Variación de calibre en la materia prima recibida.", detected_at: nowIso, detected_by_id: 1, detected_by_name: "Ana Salazar", updated_at: nowIso },
  { id: 2, code: "NC-2026-00002", module_code: "FOR-CCD-007", lot_code: "L-0309-03", category: "Restos de cáscara", severity: "Leve", description: "Cinco unidades con restos de cáscara adherida.", quantity: 5, status: "Abierta", detected_at: nowIso, detected_by_id: 3, detected_by_name: "Lucía Ramos", updated_at: nowIso },
  { id: 3, code: "NC-2026-00003", module_code: "FOR-CCD-023", lot_code: "L-0209-08", category: "Temperatura", severity: "Crítica", description: "Temperatura de pulpa fuera de especificación.", status: "Cerrada", root_cause: "Demora en ingreso a cámara", disposition: "Producto segregado y reevaluado", detected_at: nowIso, detected_by_id: 2, detected_by_name: "Carlos Medina", closed_at: nowIso, updated_at: nowIso },
];

const demoActions: ApiCorrectiveAction[] = [
  { id: 1, code: "AC-2026-00001", nonconformity_id: 1, nonconformity_code: "NC-2026-00001", title: "Reducir incidencia de calibre bajo", plan: "Reforzar segregación por calibre desde recepción.", do_action: "Capacitar al equipo y colocar patrón visual.", responsible_id: 2, responsible_name: "Carlos Medina", due_date: futureDate(7), phase: "Hacer", status: "En curso", updated_at: nowIso },
  { id: 2, code: "AC-2026-00002", nonconformity_id: 3, nonconformity_code: "NC-2026-00003", title: "Acortar traslado a cámara", plan: "Definir tiempo máximo de traslado.", do_action: "Reordenar ruta interna.", check_result: "Tiempo promedio reducido a 8 minutos.", act_standardization: "Incorporar ruta al POE.", responsible_id: 1, responsible_name: "Ana Salazar", due_date: futureDate(-2), phase: "Actuar", status: "Completada", effectiveness_percent: 96, completed_at: nowIso, updated_at: nowIso },
];

const demoLots: ApiLot[] = [
  { id: 1, code: "L-0309-04", supplier_name: "José Paredes Huamán", product: "Plátano verde", certification_type: "Comercio justo", harvest_date: "2026-09-02", received_at: nowIso, quantity_kg: 1280, current_stage: "Embolsado", status: "Activo", record_count: 4, open_nonconformities: 1, events: [
    { id: 1, stage: "Recepción", event_type: "Ingreso", description: "Ingreso y pesaje de materia prima", occurred_at: nowIso, created_by_name: "Ana Salazar" },
    { id: 2, stage: "Selección", event_type: "Avance", description: "Clasificación de primera y segunda", occurred_at: nowIso, created_by_name: "Lucía Ramos" },
    { id: 3, stage: "Pelado", event_type: "Avance", description: "Control de calidad en proceso", occurred_at: nowIso, created_by_name: "Lucía Ramos" },
    { id: 4, stage: "Embolsado", event_type: "Avance", description: "Lote en acondicionamiento", occurred_at: nowIso, created_by_name: "Carlos Medina" },
  ] },
  { id: 2, code: "L-0309-03", supplier_name: "Rosa Flores Mendoza", product: "Plátano verde", certification_type: "Convencional", received_at: nowIso, quantity_kg: 960, current_stage: "Producto terminado", status: "Liberado", record_count: 5, open_nonconformities: 1 },
  { id: 3, code: "L-0209-08", supplier_name: "Elena Ríos León", product: "Plátano pelado", certification_type: "Convencional", received_at: nowIso, quantity_kg: 740, current_stage: "Despacho", status: "Despachado", record_count: 6, open_nonconformities: 0 },
];

const demoUsers: ApiUser[] = [
  { id: 1, username: "admin", email: "ana.salazar@tropical.pe", full_name: "Ana Salazar", role: "Administrador", is_active: true },
  { id: 2, username: "coordinador", email: "carlos.medina@tropical.pe", full_name: "Carlos Medina", role: "Coordinador", is_active: true },
  { id: 3, username: "inspector", email: "lucia.ramos@tropical.pe", full_name: "Lucía Ramos", role: "Inspector", is_active: true },
  { id: 4, username: "revisor", email: "marco.vega@tropical.pe", full_name: "Marco Vega", role: "Revisor", is_active: true },
];

function PageTitle({ eyebrow, title, text, action }: { eyebrow: string; title: string; text: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div><span className="eyebrow dark">{eyebrow}</span><h1>{title}</h1><p>{text}</p></div>{action}</div>;
}

function ModeNote({ connected }: { connected: boolean }) {
  return <div className={`connection-note ${connected ? "online" : ""}`}><span /><b>{connected ? "PostgreSQL conectado" : "Modo demostración"}</b>{connected ? "Los cambios se guardan en la base de datos." : "Los cambios de esta sesión son temporales y no se guardan en PostgreSQL."}</div>;
}

function DialogField({ label, children, full = false }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <label className={full ? "full-field" : ""}>{label}{children}</label>;
}

export function NonConformitiesPage({ connected, modules }: { connected: boolean; modules: ModuleOption[] }) {
  const [items, setItems] = useState<ApiNonConformity[]>(DEMO_ENABLED && !connected ? demoNc : []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ApiNonConformity | null>(null);
  const [filter, setFilter] = useState("Todas");
  const [form, setForm] = useState({ module_code: modules[0]?.code || "FOR-CCD-001", lot_code: "", category: "", severity: "Mayor", description: "", quantity: "", status: "Abierta", root_cause: "", disposition: "" });
  useEffect(() => { if (connected) apiNonConformities().then(setItems).catch(e => toast.error(e.message)); }, [connected]);
  const visible = items.filter(item => filter === "Todas" || item.status === filter);
  const start = (item?: ApiNonConformity) => {
    setEditing(item || null);
    setForm(item ? { module_code: item.module_code || modules[0]?.code || "", lot_code: item.lot_code || "", category: item.category, severity: item.severity, description: item.description, quantity: item.quantity?.toString() || "", status: item.status, root_cause: item.root_cause || "", disposition: item.disposition || "" } : { module_code: modules[0]?.code || "", lot_code: "", category: "", severity: "Mayor", description: "", quantity: "", status: "Abierta", root_cause: "", disposition: "" });
    setOpen(true);
  };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    const payload = { ...form, quantity: form.quantity ? Number(form.quantity) : null };
    try {
      let saved: ApiNonConformity;
      if (editing) {
        saved = connected ? await apiUpdateNonConformity(editing.id, payload) : { ...editing, ...payload, severity: payload.severity as ApiNonConformity["severity"], status: payload.status as ApiNonConformity["status"], updated_at: nowIso };
        setItems(rows => rows.map(row => row.id === saved.id ? saved : row));
      } else {
        saved = connected ? await apiCreateNonConformity(payload) : { ...payload, id: Date.now(), code: `NC-DEMO-${String(items.length + 1).padStart(3, "0")}`, severity: payload.severity as ApiNonConformity["severity"], status: payload.status as ApiNonConformity["status"], detected_at: nowIso, detected_by_id: 1, detected_by_name: "Usuario actual", updated_at: nowIso };
        setItems(rows => [saved, ...rows]);
      }
      setOpen(false); toast.success(editing ? "No conformidad actualizada" : "No conformidad registrada");
    } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo guardar"); }
  };
  return <>
    <PageTitle eyebrow="MEJORA CONTINUA" title="No conformidades" text="Registra, investiga y cierra desviaciones vinculadas a módulos y lotes." action={<Button onClick={() => start()}><Plus /> Nueva no conformidad</Button>} />
    <ModeNote connected={connected} />
    <section className="summary-strip">
      {["Abierta", "En tratamiento", "Cerrada"].map(status => <article key={status}><span>{status}</span><b>{items.filter(i => i.status === status).length}</b></article>)}
      <article className="critical"><span>Críticas activas</span><b>{items.filter(i => i.severity === "Crítica" && i.status !== "Cerrada").length}</b></article>
    </section>
    <section className="panel">
      <div className="filters"><div className="search-box"><Search /><Input placeholder="Buscar por código, lote o categoría" /></div><NativeSelect value={filter} onChange={e => setFilter(e.target.value)}><NativeSelectOption>Todas</NativeSelectOption><NativeSelectOption>Abierta</NativeSelectOption><NativeSelectOption>En tratamiento</NativeSelectOption><NativeSelectOption>Cerrada</NativeSelectOption></NativeSelect></div>
      <div className="data-cards">{visible.map(item => <article key={item.id} className="data-card"><div className={`severity-dot severity-${item.severity.toLowerCase().replace("í", "i")}`} /><div className="data-main"><div className="record-title"><h2>{item.code}</h2><Badge variant="outline">{item.severity}</Badge><Badge className={item.status === "Cerrada" ? "status-approved" : item.status === "En tratamiento" ? "status-pending" : "status-rejected"}>{item.status}</Badge></div><h3>{item.category}</h3><p>{item.description}</p><div className="record-meta"><span><Package />{item.lot_code || "Sin lote"}</span><span><ClipboardList />{item.module_code || "Registro manual"}</span><span><Clock3 />{fmtDate(item.detected_at)}</span><span><Users />{item.detected_by_name}</span></div></div><Button variant="outline" size="sm" onClick={() => start(item)}><Edit3 /> Gestionar</Button></article>)}</div>
    </section>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="workflow-dialog"><form onSubmit={save}><DialogHeader><DialogTitle>{editing ? `Gestionar ${editing.code}` : "Nueva no conformidad"}</DialogTitle><DialogDescription>Documenta la desviación y su tratamiento con trazabilidad de usuario y fecha.</DialogDescription></DialogHeader><div className="form-grid dialog-form"><DialogField label="Módulo"><NativeSelect value={form.module_code} onChange={e => setForm({...form,module_code:e.target.value})}>{modules.map(m => <NativeSelectOption key={m.code} value={m.code}>{m.code} · {m.short}</NativeSelectOption>)}</NativeSelect></DialogField><DialogField label="Lote"><Input value={form.lot_code} onChange={e => setForm({...form,lot_code:e.target.value})} placeholder="L-AAAA-NN" /></DialogField><DialogField label="Categoría"><Input required value={form.category} onChange={e => setForm({...form,category:e.target.value})} /></DialogField><DialogField label="Severidad"><NativeSelect value={form.severity} onChange={e => setForm({...form,severity:e.target.value})}><NativeSelectOption>Leve</NativeSelectOption><NativeSelectOption>Mayor</NativeSelectOption><NativeSelectOption>Crítica</NativeSelectOption></NativeSelect></DialogField><DialogField label="Descripción" full><Textarea required value={form.description} onChange={e => setForm({...form,description:e.target.value})} /></DialogField><DialogField label="Cantidad afectada"><Input type="number" min="0" value={form.quantity} onChange={e => setForm({...form,quantity:e.target.value})} /></DialogField>{editing && <DialogField label="Estado"><NativeSelect value={form.status} onChange={e => setForm({...form,status:e.target.value})}><NativeSelectOption>Abierta</NativeSelectOption><NativeSelectOption>En tratamiento</NativeSelectOption><NativeSelectOption>Cerrada</NativeSelectOption></NativeSelect></DialogField>}{editing && <><DialogField label="Causa raíz" full><Textarea value={form.root_cause} onChange={e => setForm({...form,root_cause:e.target.value})} /></DialogField><DialogField label="Disposición / cierre" full><Textarea value={form.disposition} onChange={e => setForm({...form,disposition:e.target.value})} /></DialogField></>}</div><DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit"><Save /> Guardar</Button></DialogFooter></form></DialogContent></Dialog>
  </>;
}

export function CorrectiveActionsPage({ connected }: { connected: boolean }) {
  const [items, setItems] = useState<ApiCorrectiveAction[]>(DEMO_ENABLED && !connected ? demoActions : []);
  const [users, setUsers] = useState<ApiUser[]>(DEMO_ENABLED && !connected ? demoUsers : []);
  const [ncs, setNcs] = useState<ApiNonConformity[]>(DEMO_ENABLED && !connected ? demoNc : []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ApiCorrectiveAction | null>(null);
  const blank = { nonconformity_id: "", title: "", plan: "", do_action: "", check_result: "", act_standardization: "", responsible_id: "1", due_date: futureDate(7), phase: "Planificar", status: "Pendiente", effectiveness_percent: "" };
  const [form, setForm] = useState(blank);
  useEffect(() => { if (connected) Promise.all([apiActions(), apiUsers().catch(error => { toast.error(error.message); return []; }), apiNonConformities()]).then(([a,u,n]) => { setItems(a); setUsers(u); setNcs(n); }).catch(e => toast.error(e.message)); }, [connected]);
  const start = (item?: ApiCorrectiveAction) => { setEditing(item || null); setForm(item ? { nonconformity_id: item.nonconformity_id?.toString() || "", title: item.title, plan: item.plan, do_action: item.do_action || "", check_result: item.check_result || "", act_standardization: item.act_standardization || "", responsible_id: String(item.responsible_id), due_date: item.due_date, phase: item.phase, status: item.status, effectiveness_percent: item.effectiveness_percent?.toString() || "" } : blank); setOpen(true); };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    const payload = { ...form, nonconformity_id: form.nonconformity_id ? Number(form.nonconformity_id) : null, responsible_id: Number(form.responsible_id), effectiveness_percent: form.effectiveness_percent ? Number(form.effectiveness_percent) : null };
    try {
      let saved: ApiCorrectiveAction;
      if (editing) {
        saved = connected ? await apiUpdateAction(editing.id, payload) : { ...editing, ...payload, phase: payload.phase as ApiCorrectiveAction["phase"], status: payload.status as ApiCorrectiveAction["status"], responsible_name: users.find(u => u.id === payload.responsible_id)?.full_name || "Responsable", updated_at: nowIso };
        setItems(rows => rows.map(row => row.id === saved.id ? saved : row));
      } else {
        saved = connected ? await apiCreateAction(payload) : { ...payload, id: Date.now(), code: `AC-DEMO-${items.length + 1}`, phase: payload.phase as ApiCorrectiveAction["phase"], status: payload.status as ApiCorrectiveAction["status"], responsible_name: users.find(u => u.id === payload.responsible_id)?.full_name || "Responsable", updated_at: nowIso };
        setItems(rows => [saved, ...rows]);
      }
      setOpen(false); toast.success("Acción correctiva guardada");
    } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo guardar"); }
  };
  const phases: ApiCorrectiveAction["phase"][] = ["Planificar", "Hacer", "Verificar", "Actuar"];
  return <>
    <PageTitle eyebrow="CICLO PHVA" title="Acciones correctivas" text="Planifica, ejecuta, verifica y estandariza mejoras hasta comprobar su eficacia." action={<Button onClick={() => start()}><Plus /> Nueva acción</Button>} />
    <ModeNote connected={connected} />
    <div className="phva-board">{phases.map(phase => <section key={phase} className="phva-column"><header><span>{phase.slice(0,1)}</span><b>{phase}</b><small>{items.filter(i => i.phase === phase).length}</small></header>{items.filter(i => i.phase === phase).map(item => <article key={item.id} className="phva-card"><div><Badge className={item.status === "Completada" ? "status-approved" : item.status === "Vencida" ? "status-rejected" : "status-pending"}>{item.status}</Badge><button onClick={() => start(item)} aria-label="Editar"><Edit3 /></button></div><strong>{item.code}</strong><h3>{item.title}</h3><p>{item.plan}</p><footer><span><Users />{item.responsible_name}</span><span><Clock3 />{item.due_date}</span></footer>{item.effectiveness_percent != null && <div className="effectiveness"><span style={{width:`${item.effectiveness_percent}%`}} /><b>{item.effectiveness_percent}% eficaz</b></div>}</article>)}</section>)}</div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="workflow-dialog"><form onSubmit={save}><DialogHeader><DialogTitle>{editing ? `Editar ${editing.code}` : "Nueva acción correctiva PHVA"}</DialogTitle><DialogDescription>Cada etapa queda vinculada al responsable, plazo y evidencia de eficacia.</DialogDescription></DialogHeader><div className="form-grid dialog-form"><DialogField label="No conformidad"><NativeSelect value={form.nonconformity_id} onChange={e => setForm({...form,nonconformity_id:e.target.value})}><NativeSelectOption value="">Acción preventiva / sin vínculo</NativeSelectOption>{ncs.map(n => <NativeSelectOption key={n.id} value={String(n.id)}>{n.code} · {n.category}</NativeSelectOption>)}</NativeSelect></DialogField><DialogField label="Título"><Input required value={form.title} onChange={e => setForm({...form,title:e.target.value})} /></DialogField><DialogField label="Planificar" full><Textarea required value={form.plan} onChange={e => setForm({...form,plan:e.target.value})} /></DialogField><DialogField label="Hacer" full><Textarea value={form.do_action} onChange={e => setForm({...form,do_action:e.target.value})} /></DialogField><DialogField label="Verificar" full><Textarea value={form.check_result} onChange={e => setForm({...form,check_result:e.target.value})} /></DialogField><DialogField label="Actuar / estandarizar" full><Textarea value={form.act_standardization} onChange={e => setForm({...form,act_standardization:e.target.value})} /></DialogField><DialogField label="Responsable"><NativeSelect value={form.responsible_id} onChange={e => setForm({...form,responsible_id:e.target.value})}>{users.map(u => <NativeSelectOption key={u.id} value={String(u.id)}>{u.full_name}</NativeSelectOption>)}</NativeSelect></DialogField><DialogField label="Fecha límite"><Input type="date" required value={form.due_date} onChange={e => setForm({...form,due_date:e.target.value})} /></DialogField><DialogField label="Fase"><NativeSelect value={form.phase} onChange={e => setForm({...form,phase:e.target.value})}>{phases.map(p => <NativeSelectOption key={p}>{p}</NativeSelectOption>)}</NativeSelect></DialogField><DialogField label="Estado"><NativeSelect value={form.status} onChange={e => setForm({...form,status:e.target.value})}><NativeSelectOption>Pendiente</NativeSelectOption><NativeSelectOption>En curso</NativeSelectOption><NativeSelectOption>Vencida</NativeSelectOption><NativeSelectOption>Completada</NativeSelectOption></NativeSelect></DialogField><DialogField label="Eficacia (%)"><Input type="number" min="0" max="100" value={form.effectiveness_percent} onChange={e => setForm({...form,effectiveness_percent:e.target.value})} /></DialogField></div><DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit"><Save /> Guardar PHVA</Button></DialogFooter></form></DialogContent></Dialog>
  </>;
}

const demoSpcPoints = [
  { record_code: "REG-078", date: "2026-09-01", value: 92.4, out_of_control: false },
  { record_code: "REG-079", date: "2026-09-01", value: 94.1, out_of_control: false },
  { record_code: "REG-080", date: "2026-09-02", value: 93.5, out_of_control: false },
  { record_code: "REG-081", date: "2026-09-02", value: 96.1, out_of_control: false },
  { record_code: "REG-082", date: "2026-09-03", value: 88.2, out_of_control: true },
  { record_code: "REG-083", date: "2026-09-03", value: 97.1, out_of_control: false },
  { record_code: "REG-084", date: "2026-09-03", value: 94.6, out_of_control: false },
];

const demoSpc: ApiSpc = { field: "conformity_percent", count: 7, mean: 93.71, std_dev: 2.91, min: 88.2, max: 97.1, lcl: 84.98, ucl: 102.44, cp: 1.21, cpk: 1.05, out_of_control: 1, points: demoSpcPoints, available_fields: [{field:"conformity_percent",count:7},{field:"brix",count:5},{field:"peso_promedio",count:4},{field:"temperatura",count:3}] };

export function SpcPage({ connected, modules }: { connected: boolean; modules: ModuleOption[] }) {
  const [module, setModule] = useState("");
  const [field, setField] = useState("conformity_percent");
  const [data, setData] = useState<ApiSpc>(DEMO_ENABLED && !connected ? demoSpc : {field: "conformity_percent", count: 0, out_of_control: 0, points: [], available_fields: []});
  const load = () => { if (!connected && DEMO_ENABLED) return setData({...demoSpc,field}); apiSpc(module, field).then(setData).catch(e => toast.error(e.message)); };
  useEffect(() => { if (connected) apiSpc(module, field).then(setData).catch(e => toast.error(e.message)); }, [connected, module, field]);
  const chart = data.points.map((p, index) => ({ ...p, sample: index + 1, media: data.mean, lcs: data.ucl, lci: data.lcl }));
  return <>
    <PageTitle eyebrow="CONTROL ESTADÍSTICO DEL PROCESO" title="Análisis estadístico (SPC)" text="Detecta variaciones, puntos fuera de control y capacidad del proceso." />
    <ModeNote connected={connected} />
    <section className="panel spc-filters"><label>Módulo<NativeSelect value={module} onChange={e => setModule(e.target.value)}><NativeSelectOption value="">Todos los módulos</NativeSelectOption>{modules.map(m => <NativeSelectOption key={m.code} value={m.code}>{m.code} · {m.short}</NativeSelectOption>)}</NativeSelect></label><label>Variable<NativeSelect value={field} onChange={e => setField(e.target.value)}><NativeSelectOption value="conformity_percent">Conformidad (%)</NativeSelectOption><NativeSelectOption value="brix">°Brix</NativeSelectOption><NativeSelectOption value="peso_promedio">Peso promedio</NativeSelectOption><NativeSelectOption value="temperatura">Temperatura</NativeSelectOption></NativeSelect></label><Button variant="outline" onClick={load}><Activity /> Actualizar análisis</Button></section>
    <section className="metric-grid">
      <article><span>Muestras</span><b>{data.count}</b><small>datos válidos</small></article>
      <article><span>Media</span><b>{data.mean ?? "—"}</b><small>{field === "conformity_percent" ? "%" : field}</small></article>
      <article><span>Desviación</span><b>{data.std_dev ?? "—"}</b><small>σ muestral</small></article>
      <article className={data.out_of_control ? "metric-alert" : ""}><span>Fuera de control</span><b>{data.out_of_control}</b><small>requieren investigación</small></article>
      <article><span>Cpk</span><b>{data.cpk ?? "N/D"}</b><small>{data.cpk == null ? "defina límites" : data.cpk >= 1.33 ? "capaz" : "revisar capacidad"}</small></article>
    </section>
    <section className="panel spc-panel"><div className="panel-title"><div><h2>Carta de control</h2><p>Media y límites naturales calculados como ±3σ.</p></div><Badge variant="outline">LCS {data.ucl ?? "—"} · LCI {data.lcl ?? "—"}</Badge></div><div className="spc-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={chart} margin={{left:0,right:18,top:8,bottom:4}}><CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e5ece9"/><XAxis dataKey="sample" tickLine={false} axisLine={false}/><YAxis domain={["auto","auto"]} tickLine={false} axisLine={false}/><Tooltip labelFormatter={v => `Muestra ${v}`}/><Legend/><Line type="monotone" dataKey="value" name="Valor" stroke="#087a5d" strokeWidth={3} dot={(props: {cx?:number;cy?:number;payload?:{out_of_control:boolean}}) => <circle cx={props.cx} cy={props.cy} r={props.payload?.out_of_control ? 6 : 4} fill={props.payload?.out_of_control ? "#dc5a45" : "#087a5d"} stroke="#fff" strokeWidth={2}/>} /><Line type="monotone" dataKey="media" name="Media" stroke="#55756b" dot={false} strokeDasharray="6 5"/><Line type="monotone" dataKey="lcs" name="LCS" stroke="#db725e" dot={false}/><Line type="monotone" dataKey="lci" name="LCI" stroke="#db725e" dot={false}/></LineChart></ResponsiveContainer></div></section>
    <section className="panel spc-findings"><div><Gauge /><span><b>Interpretación automática</b><small>{data.count === 0 ? "A?n no hay muestras para interpretar el proceso." : data.out_of_control ? `Hay ${data.out_of_control} punto(s) fuera de los límites naturales. Abra una no conformidad y verifique causa especial.` : "El proceso no presenta puntos fuera de los límites naturales en el periodo."}</small></span></div><div><ShieldCheck /><span><b>Capacidad</b><small>{data.cpk == null ? "Configure límites de especificación para calcular Cp y Cpk." : data.cpk >= 1.33 ? "La capacidad estimada es adecuada." : "La capacidad estimada requiere una acción de mejora."}</small></span></div></section>
  </>;
}

export function LotsPage({ connected }: { connected: boolean }) {
  const [items, setItems] = useState<ApiLot[]>(DEMO_ENABLED && !connected ? demoLots : []);
  const [selected, setSelected] = useState<ApiLot | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [form, setForm] = useState({ code: "", product: "Plátano verde", certification_type: "Convencional", harvest_date: "", quantity_kg: "", current_stage: "Recepción", status: "Activo", observations: "" });
  const [event, setEvent] = useState({ stage: "Selección", event_type: "Avance", description: "", record_code: "" });
  useEffect(() => { if (connected) apiLots().then(setItems).catch(e => toast.error(e.message)); }, [connected]);
  const openDetail = async (lot: ApiLot) => { setSelected(lot); if (connected) try { setSelected(await apiLot(lot.id)); } catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo cargar"); } };
  const saveLot = async (e: FormEvent) => {
    e.preventDefault(); const payload = {...form, harvest_date: form.harvest_date || null, quantity_kg: form.quantity_kg ? Number(form.quantity_kg) : null};
    try { const saved = connected ? await apiCreateLot(payload) : {...payload,id:Date.now(),received_at:nowIso,record_count:0,open_nonconformities:0,events:[]} as ApiLot; setItems(rows => [saved,...rows]); setCreateOpen(false); toast.success("Lote registrado"); } catch(error){toast.error(error instanceof Error?error.message:"No se pudo guardar");}
  };
  const saveEvent = async (e: FormEvent) => {
    e.preventDefault(); if(!selected)return;
    try { const saved = connected ? await apiCreateLotEvent(selected.id,event) : {id:Date.now(),...event,occurred_at:nowIso,created_by_name:"Usuario actual"}; const updated={...selected,current_stage:event.stage,events:[...(selected.events||[]),saved]}; setSelected(updated); setItems(rows=>rows.map(r=>r.id===updated.id?{...r,current_stage:event.stage}:r));setEventOpen(false);toast.success("Evento agregado a la trazabilidad"); }catch(error){toast.error(error instanceof Error?error.message:"No se pudo guardar");}
  };
  const changeStatus=async(status:string)=>{if(!selected)return;try{const saved=connected?await apiUpdateLot(selected.id,{status}):{...selected,status};setSelected(saved);setItems(rows=>rows.map(r=>r.id===saved.id?{...r,status:saved.status}:r));toast.success(`Lote marcado como ${status.toLowerCase()}`);}catch(error){toast.error(error instanceof Error?error.message:"No se pudo actualizar");}};
  return <>
    <PageTitle eyebrow="CADENA DE CUSTODIA" title="Trazabilidad de lotes" text="Sigue cada lote desde la recepción hasta el despacho y relaciona controles y desviaciones." action={<Button onClick={() => setCreateOpen(true)}><Plus /> Nuevo lote</Button>} />
    <ModeNote connected={connected} />
    <section className="lot-layout"><div className="lot-list">{items.map(lot => <button key={lot.id} className={`lot-card ${selected?.id===lot.id?"selected":""}`} onClick={() => openDetail(lot)}><div className="lot-icon"><Package /></div><div><span>{lot.certification_type}</span><h2>{lot.code}</h2><p>{lot.product} · {lot.supplier_name || "Proveedor no asignado"}</p><div><Badge className={lot.status==="Retenido"?"status-rejected":"status-approved"}>{lot.status}</Badge><small>{lot.quantity_kg?.toLocaleString("es-PE") || "—"} kg</small><small>{lot.record_count} controles</small></div></div><strong>{lot.current_stage}</strong>{lot.open_nonconformities>0&&<i>{lot.open_nonconformities} NC</i>}</button>)}</div><section className="panel lot-detail">{selected ? <><div className="panel-title"><div><h2>{selected.code} · recorrido</h2><p>Eventos cronológicos y documentos relacionados.</p></div><div className="lot-tools"><Button variant="outline" size="sm" onClick={()=>changeStatus(selected.status==="Retenido"?"Liberado":"Retenido")}>{selected.status==="Retenido"?"Liberar":"Retener"}</Button><Button size="sm" onClick={() => setEventOpen(true)}><Plus /> Agregar evento</Button></div></div><div className="trace-progress">{["Recepción","Selección","Pelado","Embolsado","Producto terminado","Despacho"].map(stage=><div key={stage} className={(selected.events||[]).some(e=>e.stage===stage)||selected.current_stage===stage?"done":""}><span><Check/></span><small>{stage}</small></div>)}</div><div className="trace-timeline">{(selected.events||[]).map(event=><article key={event.id}><span/><div><b>{event.stage}</b><small>{event.event_type} · {fmtDate(event.occurred_at)}</small><p>{event.description}</p>{event.record_code&&<Badge variant="outline">{event.record_code}</Badge>}</div></article>)}{!(selected.events||[]).length&&<div className="mini-empty">Seleccione “Agregar evento” para construir el recorrido.</div>}</div></>:<div className="empty-selection"><Layers3/><h2>Seleccione un lote</h2><p>Visualice su recorrido, controles y no conformidades.</p></div>}</section></section>
    <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent className="workflow-dialog"><form onSubmit={saveLot}><DialogHeader><DialogTitle>Nuevo lote de producción</DialogTitle><DialogDescription>El código será único y enlazará todos los registros de calidad.</DialogDescription></DialogHeader><div className="form-grid dialog-form"><DialogField label="Código de lote"><Input required value={form.code} onChange={e=>setForm({...form,code:e.target.value})}/></DialogField><DialogField label="Producto"><Input required value={form.product} onChange={e=>setForm({...form,product:e.target.value})}/></DialogField><DialogField label="Certificación"><NativeSelect value={form.certification_type} onChange={e=>setForm({...form,certification_type:e.target.value})}><NativeSelectOption>Convencional</NativeSelectOption><NativeSelectOption>Comercio justo</NativeSelectOption></NativeSelect></DialogField><DialogField label="Fecha de cosecha"><Input type="date" value={form.harvest_date} onChange={e=>setForm({...form,harvest_date:e.target.value})}/></DialogField><DialogField label="Cantidad (kg)"><Input type="number" min="0" value={form.quantity_kg} onChange={e=>setForm({...form,quantity_kg:e.target.value})}/></DialogField><DialogField label="Estado"><NativeSelect value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><NativeSelectOption>Activo</NativeSelectOption><NativeSelectOption>Retenido</NativeSelectOption><NativeSelectOption>Liberado</NativeSelectOption><NativeSelectOption>Despachado</NativeSelectOption></NativeSelect></DialogField><DialogField label="Observaciones" full><Textarea value={form.observations} onChange={e=>setForm({...form,observations:e.target.value})}/></DialogField></div><DialogFooter><Button type="button" variant="outline" onClick={()=>setCreateOpen(false)}>Cancelar</Button><Button type="submit">Crear lote</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog open={eventOpen} onOpenChange={setEventOpen}><DialogContent><form onSubmit={saveEvent}><DialogHeader><DialogTitle>Agregar evento · {selected?.code}</DialogTitle><DialogDescription>Actualiza la etapa actual y conserva la evidencia cronológica.</DialogDescription></DialogHeader><div className="form-grid dialog-form"><DialogField label="Etapa"><NativeSelect value={event.stage} onChange={e=>setEvent({...event,stage:e.target.value})}>{["Recepción","Selección","Pelado","Embolsado","Producto terminado","Despacho"].map(s=><NativeSelectOption key={s}>{s}</NativeSelectOption>)}</NativeSelect></DialogField><DialogField label="Tipo"><Input value={event.event_type} onChange={e=>setEvent({...event,event_type:e.target.value})}/></DialogField><DialogField label="Registro relacionado"><Input value={event.record_code} onChange={e=>setEvent({...event,record_code:e.target.value})} placeholder="REG-2026-000001"/></DialogField><DialogField label="Descripción" full><Textarea required value={event.description} onChange={e=>setEvent({...event,description:e.target.value})}/></DialogField></div><DialogFooter><Button type="button" variant="outline" onClick={()=>setEventOpen(false)}>Cancelar</Button><Button type="submit">Agregar evento</Button></DialogFooter></form></DialogContent></Dialog>
  </>;
}

const demoNotifications: ApiNotification[] = [
  {id:1,title:"No conformidad crítica",message:"NC-2026-00003 · Temperatura fuera de especificación",level:"error",is_read:false,created_at:nowIso},
  {id:2,title:"Acción próxima a vencer",message:"AC-2026-00001 vence en 2 días",level:"warning",is_read:false,created_at:nowIso},
  {id:3,title:"Registro aprobado",message:"REG-2026-0083 fue firmado por Carlos Medina",level:"success",is_read:true,created_at:nowIso},
];

export function AlertsPage({ connected }: { connected: boolean }) {
  const [items,setItems]=useState<ApiNotification[]>(DEMO_ENABLED && !connected ? demoNotifications : []);
  const [filter,setFilter]=useState("Todas");
  useEffect(()=>{if(connected)apiNotifications().then(setItems).catch(e=>toast.error(e.message));},[connected]);
  const mark=async(id:number)=>{try{if(connected)await apiReadNotification(id);setItems(rows=>rows.map(r=>r.id===id?{...r,is_read:true}:r));}catch(e){toast.error(e instanceof Error?e.message:"No se pudo actualizar");}};
  const markAll=async()=>{try{if(connected)await apiReadAllNotifications();setItems(rows=>rows.map(r=>({...r,is_read:true})));toast.success("Todas las alertas se marcaron como leídas");}catch(e){toast.error(e instanceof Error?e.message:"No se pudo actualizar");}};
  const visible=items.filter(i=>filter==="Todas"||(filter==="No leídas"?!i.is_read:i.level===filter));
  return <><PageTitle eyebrow="CENTRO DE INFORMACIÓN" title="Alertas y notificaciones" text="Prioriza desviaciones, vencimientos y resultados de validación." action={<Button variant="outline" onClick={markAll}><Check/> Marcar todo como leído</Button>}/><ModeNote connected={connected}/><section className="panel"><div className="notification-tabs">{["Todas","No leídas","error","warning","success"].map(t=><button key={t} className={filter===t?"active":""} onClick={()=>setFilter(t)}>{t==="error"?"Críticas":t==="warning"?"Advertencias":t==="success"?"Informativas":t}<b>{t==="Todas"?items.length:t==="No leídas"?items.filter(i=>!i.is_read).length:items.filter(i=>i.level===t).length}</b></button>)}</div><div className="notification-list">{visible.map(item=><button key={item.id} className={item.is_read?"read":""} onClick={()=>mark(item.id)}><span className={`notification-level ${item.level}`}>{item.level==="error"?<AlertTriangle/>:item.level==="warning"?<Clock3/>:<CheckCircle2/>}</span><div><h3>{item.title}</h3><p>{item.message}</p><small>{fmtDate(item.created_at)}</small></div>{!item.is_read&&<i/>}</button>)}</div></section></>;
}

const demoSuppliers:ApiSupplier[]=[
  {id:1,code:"AGR-014",name:"José Paredes Huamán",origin:"Valle del Chira · Sullana",certification_type:"Comercio justo",is_active:true},
  {id:2,code:"AGR-009",name:"Rosa Flores Mendoza",origin:"Querecotillo · Sullana",certification_type:"Convencional",is_active:true},
  {id:3,code:"AGR-021",name:"Luis Torres Castillo",origin:"Marcavelica · Sullana",certification_type:"Comercio justo",is_active:true},
];
const demoCarriers:ApiCarrier[]=[
  {id:1,name:"Luis Peña Vílchez",document:"44123890",plate:"P3A-201",phone:"987 441 230",is_active:true},
  {id:2,name:"Transportes del Chira",document:"20608123451",plate:"T8K-942",phone:"073 441 902",is_active:true},
];

export function SuppliersCarriersPage({connected}:{connected:boolean}){
  const [mode,setMode]=useState<"supplier"|"carrier">("supplier");const [suppliers,setSuppliers]=useState(DEMO_ENABLED && !connected ? demoSuppliers : []);const [carriers,setCarriers]=useState(DEMO_ENABLED && !connected ? demoCarriers : []);const [open,setOpen]=useState(false);const [editing,setEditing]=useState<ApiSupplier|ApiCarrier|null>(null);
  const [form,setForm]=useState({code:"",name:"",origin:"",certification_type:"Convencional",observations:"",document:"",plate:"",phone:""});
  useEffect(()=>{if(connected)Promise.all([apiSuppliers(),apiCarriers()]).then(([s,c])=>{setSuppliers(s);setCarriers(c)}).catch(e=>toast.error(e.message));},[connected]);
  const start=(item?:ApiSupplier|ApiCarrier)=>{setEditing(item||null);setForm(item?(mode==="supplier"?{code:(item as ApiSupplier).code,name:item.name,origin:(item as ApiSupplier).origin,certification_type:(item as ApiSupplier).certification_type,observations:(item as ApiSupplier).observations||"",document:"",plate:"",phone:""}:{code:"",name:item.name,origin:"",certification_type:"Convencional",observations:"",document:(item as ApiCarrier).document||"",plate:(item as ApiCarrier).plate||"",phone:(item as ApiCarrier).phone||""}):{code:"",name:"",origin:"",certification_type:"Convencional",observations:"",document:"",plate:"",phone:""});setOpen(true)};
  const save=async(e:FormEvent)=>{e.preventDefault();try{if(mode==="supplier"){const payload={code:form.code,name:form.name,origin:form.origin,certification_type:form.certification_type,observations:form.observations||null};const saved=editing?(connected?await apiUpdateSupplier(editing.id,payload):{...(editing as ApiSupplier),...payload}):(connected?await apiCreateSupplier(payload):{...payload,id:Date.now(),is_active:true});setSuppliers(rows=>editing?rows.map(r=>r.id===saved.id?saved:r):[...rows,saved]);}else{const payload={name:form.name,document:form.document||null,plate:form.plate||null,phone:form.phone||null};const saved=editing?(connected?await apiUpdateCarrier(editing.id,payload):{...(editing as ApiCarrier),...payload}):(connected?await apiCreateCarrier(payload):{...payload,id:Date.now(),is_active:true});setCarriers(rows=>editing?rows.map(r=>r.id===saved.id?saved:r):[...rows,saved]);}setOpen(false);toast.success(mode==="supplier"?"Proveedor guardado":"Transportista guardado");}catch(error){toast.error(error instanceof Error?error.message:"No se pudo guardar");}};
  const deactivate=async(item:ApiSupplier|ApiCarrier)=>{try{if(connected){if(mode==="supplier")await apiDeleteSupplier(item.id);else await apiDeleteCarrier(item.id);}if(mode==="supplier")setSuppliers(rows=>rows.filter(r=>r.id!==item.id));else setCarriers(rows=>rows.filter(r=>r.id!==item.id));toast.success("Elemento desactivado");}catch(error){toast.error(error instanceof Error?error.message:"No se pudo desactivar");}};
  return <><PageTitle eyebrow="LISTAS PERMANENTES" title="Proveedores y transportistas" text="Administra los actores que alimentan los formularios y la trazabilidad." action={<Button onClick={()=>start()}><Plus/> {mode==="supplier"?"Nuevo proveedor":"Nuevo transportista"}</Button>}/><ModeNote connected={connected}/><div className="entity-tabs"><button className={mode==="supplier"?"active":""} onClick={()=>setMode("supplier")}><Users/>Proveedores <b>{suppliers.length}</b></button><button className={mode==="carrier"?"active":""} onClick={()=>setMode("carrier")}><Package/>Transportistas <b>{carriers.length}</b></button></div><section className="entity-grid">{mode==="supplier"?suppliers.map(item=><article className="panel entity-card" key={item.id}><div className="entity-avatar">{item.code.slice(-3)}</div><div><Badge variant="outline">{item.certification_type}</Badge><h3>{item.name}</h3><p>{item.origin}</p><small>{item.code}</small></div><div className="entity-actions"><button onClick={()=>start(item)}><Edit3/></button><button onClick={()=>deactivate(item)}><Trash2/></button></div></article>):carriers.map(item=><article className="panel entity-card" key={item.id}><div className="entity-avatar">{item.name.split(" ").map(n=>n[0]).slice(0,2).join("")}</div><div><Badge variant="outline">{item.plate||"Sin placa"}</Badge><h3>{item.name}</h3><p>{item.document||"Sin documento"} · {item.phone||"Sin teléfono"}</p></div><div className="entity-actions"><button onClick={()=>start(item)}><Edit3/></button><button onClick={()=>deactivate(item)}><Trash2/></button></div></article>)}</section><Dialog open={open} onOpenChange={setOpen}><DialogContent><form onSubmit={save}><DialogHeader><DialogTitle>{editing?"Editar":"Nuevo"} {mode==="supplier"?"proveedor":"transportista"}</DialogTitle><DialogDescription>Los datos estarán disponibles en los formularios de control.</DialogDescription></DialogHeader><div className="form-grid dialog-form">{mode==="supplier"?<><DialogField label="Código"><Input required value={form.code} onChange={e=>setForm({...form,code:e.target.value})}/></DialogField><DialogField label="Nombre completo"><Input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></DialogField><DialogField label="Procedencia"><Input required value={form.origin} onChange={e=>setForm({...form,origin:e.target.value})}/></DialogField><DialogField label="Certificación"><NativeSelect value={form.certification_type} onChange={e=>setForm({...form,certification_type:e.target.value})}><NativeSelectOption>Convencional</NativeSelectOption><NativeSelectOption>Comercio justo</NativeSelectOption></NativeSelect></DialogField><DialogField label="Observaciones" full><Textarea value={form.observations} onChange={e=>setForm({...form,observations:e.target.value})}/></DialogField></>:<><DialogField label="Nombre / razón social" full><Input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></DialogField><DialogField label="Documento"><Input value={form.document} onChange={e=>setForm({...form,document:e.target.value})}/></DialogField><DialogField label="Placa"><Input value={form.plate} onChange={e=>setForm({...form,plate:e.target.value})}/></DialogField><DialogField label="Teléfono"><Input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></DialogField></>}</div><DialogFooter><Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancelar</Button><Button type="submit">Guardar</Button></DialogFooter></form></DialogContent></Dialog></>;
}

export function UsersAdminPage({ connected }: { connected: boolean }) {
  const [items,setItems]=useState<ApiUser[]>(DEMO_ENABLED && !connected ? demoUsers : []);
  const [open,setOpen]=useState(false);
  const [editing,setEditing]=useState<ApiUser|null>(null);
  const [form,setForm]=useState({username:"",email:"",full_name:"",role:"Inspector" as ApiRole,password:""});
  useEffect(()=>{if(connected)apiUsers().then(setItems).catch(e=>toast.error(e.message));},[connected]);
  const start=(item?:ApiUser)=>{setEditing(item||null);setForm(item?{username:item.username,email:item.email,full_name:item.full_name,role:item.role,password:""}:{username:"",email:"",full_name:"",role:"Inspector",password:"Calidad2026!"});setOpen(true)};
  const save=async(e:FormEvent)=>{e.preventDefault();const payload=editing?{email:form.email,full_name:form.full_name,role:form.role,...(form.password?{password:form.password}:{})}:form;try{let saved:ApiUser;if(editing){saved=connected?await apiUpdateUser(editing.id,payload):{...editing,...payload};setItems(rows=>rows.map(r=>r.id===saved.id?saved:r));}else{saved=connected?await apiCreateUser(payload):{id:Date.now(),username:form.username,email:form.email,full_name:form.full_name,role:form.role,is_active:true};setItems(rows=>[...rows,saved]);}setOpen(false);toast.success("Usuario guardado");}catch(error){toast.error(error instanceof Error?error.message:"No se pudo guardar");}};
  const toggle=async(item:ApiUser)=>{try{const saved=connected?await apiUserStatus(item.id,!item.is_active):{...item,is_active:!item.is_active};setItems(rows=>rows.map(r=>r.id===item.id?saved:r));toast.success(saved.is_active?"Usuario activado":"Usuario desactivado");}catch(error){toast.error(error instanceof Error?error.message:"No se pudo cambiar el estado");}};
  return <><PageTitle eyebrow="ADMINISTRACIÓN" title="Usuarios" text="Gestiona cuentas, roles, contraseñas iniciales y estado de acceso." action={<Button onClick={()=>start()}><Plus/> Nuevo usuario</Button>}/><ModeNote connected={connected}/><section className="panel"><div className="admin-table"><div className="admin-row admin-head"><span>Usuario</span><span>Rol</span><span>Estado</span><span>Acciones</span></div>{items.map(item=><div className="admin-row" key={item.id}><div className="user-cell"><span>{item.full_name.split(" ").map(n=>n[0]).slice(0,2).join("")}</span><div><b>{item.full_name}</b><small>@{item.username} · {item.email}</small></div></div><Badge variant="outline">{item.role}</Badge><span className={`account-state ${item.is_active?"active":""}`}><i/>{item.is_active?"Activo":"Inactivo"}</span><div className="row-actions"><Button variant="outline" size="sm" onClick={()=>start(item)}><Edit3/> Editar</Button><Button variant="ghost" size="sm" onClick={()=>toggle(item)}>{item.is_active?<XCircle/>:<CheckCircle2/>}{item.is_active?"Desactivar":"Activar"}</Button></div></div>)}</div></section><Dialog open={open} onOpenChange={setOpen}><DialogContent><form onSubmit={save}><DialogHeader><DialogTitle>{editing?"Editar usuario":"Nuevo usuario"}</DialogTitle><DialogDescription>El acceso quedará limitado por la matriz de permisos del rol.</DialogDescription></DialogHeader><div className="form-grid dialog-form"><DialogField label="Usuario"><Input required disabled={!!editing} value={form.username} onChange={e=>setForm({...form,username:e.target.value})}/></DialogField><DialogField label="Nombre completo"><Input required value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})}/></DialogField><DialogField label="Correo"><Input required type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></DialogField><DialogField label="Rol"><NativeSelect value={form.role} onChange={e=>setForm({...form,role:e.target.value as ApiRole})}>{["Administrador","Coordinador","Inspector","Revisor"].map(r=><NativeSelectOption key={r}>{r}</NativeSelectOption>)}</NativeSelect></DialogField><DialogField label={editing?"Nueva contraseña (opcional)":"Contraseña inicial"} full><Input type="password" required={!editing} minLength={10} value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></DialogField></div><DialogFooter><Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancelar</Button><Button type="submit">Guardar usuario</Button></DialogFooter></form></DialogContent></Dialog></>;
}

const permissionCatalog=[
  {key:"dashboard.view",label:"Ver resumen e indicadores"},{key:"records.view",label:"Consultar registros"},{key:"records.create",label:"Crear registros"},{key:"records.validate",label:"Validar registros"},{key:"records.import",label:"Importar históricos"},{key:"nonconformities.manage",label:"Gestionar no conformidades"},{key:"phva.manage",label:"Gestionar PHVA"},{key:"spc.view",label:"Consultar SPC"},{key:"lots.manage",label:"Gestionar lotes"},{key:"reports.export",label:"Exportar reportes"},{key:"alerts.view",label:"Ver alertas"},{key:"users.manage",label:"Administrar usuarios"},{key:"roles.manage",label:"Configurar permisos"},{key:"catalogs.manage",label:"Administrar catálogos"},{key:"parameters.manage",label:"Modificar parámetros"},{key:"audit.view",label:"Ver auditoría"},
];
const defaultRoleRows:{role:ApiRole;permissions:string[]}[]=[
  {role:"Administrador",permissions:permissionCatalog.map(p=>p.key)},
  {role:"Coordinador",permissions:permissionCatalog.filter(p=>!["users.manage","roles.manage"].includes(p.key)).map(p=>p.key)},
  {role:"Inspector",permissions:["dashboard.view","records.view","records.create","nonconformities.manage","lots.manage","alerts.view"]},
  {role:"Revisor",permissions:["dashboard.view","records.view","spc.view","reports.export","alerts.view","audit.view"]},
];

export function RolesPage({ connected }: { connected:boolean }) {
  const [catalog,setCatalog]=useState(DEMO_ENABLED && !connected ? permissionCatalog : []);
  const [roles,setRoles]=useState(DEMO_ENABLED && !connected ? defaultRoleRows : []);
  const [active,setActive]=useState<ApiRole>("Administrador");
  useEffect(()=>{if(connected)apiRoles().then(data=>{setCatalog(data.permission_catalog);setRoles(data.roles);}).catch(e=>toast.error(e.message));},[connected]);
  const row=roles.find(r=>r.role===active);
  const toggle=(key:string)=>{if(active==="Administrador"&&["roles.manage","users.manage"].includes(key))return toast.warning("Este permiso es obligatorio para Administrador");setRoles(rows=>rows.map(r=>r.role===active?{...r,permissions:r.permissions.includes(key)?r.permissions.filter(p=>p!==key):[...r.permissions,key]}:r));};
  const save=async()=>{if(!row)return;try{if(connected)await apiUpdateRole(active,row.permissions);toast.success(`Permisos de ${active} guardados`);}catch(e){toast.error(e instanceof Error?e.message:"No se pudo guardar");}};
  if (!row) return <><PageTitle eyebrow="ADMINISTRACIÓN" title="Roles y permisos" text="La matriz de permisos se carga desde el servidor."/><ModeNote connected={connected}/><section className="panel"><p>Esperando los permisos del servidor. Si aparece un error de conexión, vuelve a abrir esta sección cuando la API esté disponible.</p></section></>;
  return <><PageTitle eyebrow="ADMINISTRACIÓN" title="Roles y permisos" text="Define capacidades efectivas en el servidor para cada perfil del sistema." action={<Button onClick={save}><Save/> Guardar permisos</Button>}/><ModeNote connected={connected}/><div className="roles-layout"><section className="role-tabs">{roles.map(r=><button key={r.role} className={active===r.role?"active":""} onClick={()=>setActive(r.role)}><span><ShieldCheck/></span><div><b>{r.role}</b><small>{r.permissions.length} permisos habilitados</small></div></button>)}</section><section className="panel permission-panel"><div className="panel-title"><div><h2>Permisos de {active}</h2><p>Los cambios se aplican al siguiente acceso protegido por la API.</p></div><Badge>{row.permissions.length}/{catalog.length}</Badge></div><div className="permission-grid">{catalog.map(permission=><label key={permission.key} className={row.permissions.includes(permission.key)?"checked":""}><input type="checkbox" checked={row.permissions.includes(permission.key)} onChange={()=>toggle(permission.key)}/><span>{row.permissions.includes(permission.key)?<Check/>:null}</span><div><b>{permission.label}</b><small>{permission.key}</small></div></label>)}</div></section></div></>;
}

const demoCatalogs:ApiCatalog[]=[
  {id:1,catalog_type:"producto",code:"PLV",name:"Plátano verde",description:"Materia prima principal",extra_data:{},is_active:true,created_at:nowIso,updated_at:nowIso},
  {id:2,catalog_type:"defecto",code:"PEQ",name:"Fruto pequeño",description:"Clasificación dimensional",extra_data:{},is_active:true,created_at:nowIso,updated_at:nowIso},
  {id:3,catalog_type:"defecto",code:"MEC",name:"Daño mecánico",description:"Golpe o corte visible",extra_data:{},is_active:true,created_at:nowIso,updated_at:nowIso},
  {id:4,catalog_type:"etapa",code:"REC",name:"Recepción",description:"Ingreso y control de materia prima",extra_data:{},is_active:true,created_at:nowIso,updated_at:nowIso},
  {id:5,catalog_type:"turno",code:"MAN",name:"Mañana",description:"06:00 a 14:00",extra_data:{},is_active:true,created_at:nowIso,updated_at:nowIso},
];

export function CatalogsPage({connected}:{connected:boolean}){
  const [items,setItems]=useState<ApiCatalog[]>(DEMO_ENABLED && !connected ? demoCatalogs : []);const [type,setType]=useState("producto");const [open,setOpen]=useState(false);const [editing,setEditing]=useState<ApiCatalog|null>(null);const [form,setForm]=useState({catalog_type:"producto",code:"",name:"",description:""});
  useEffect(()=>{if(connected)apiCatalogs().then(setItems).catch(e=>toast.error(e.message));},[connected]);
  const types=Array.from(new Set(["producto","defecto","etapa","turno",...items.map(i=>i.catalog_type)]));
  const start=(item?:ApiCatalog)=>{setEditing(item||null);setForm(item?{catalog_type:item.catalog_type,code:item.code,name:item.name,description:item.description||""}:{catalog_type:type,code:"",name:"",description:""});setOpen(true)};
  const save=async(e:FormEvent)=>{e.preventDefault();try{let saved:ApiCatalog;if(editing){saved=connected?await apiUpdateCatalog(editing.id,{name:form.name,description:form.description}):{...editing,name:form.name,description:form.description,updated_at:nowIso};setItems(rows=>rows.map(r=>r.id===saved.id?saved:r));}else{saved=connected?await apiCreateCatalog(form):{...form,id:Date.now(),extra_data:{},is_active:true,created_at:nowIso,updated_at:nowIso};setItems(rows=>[...rows,saved]);}setOpen(false);toast.success(editing?"Elemento actualizado":"Elemento agregado al catálogo");}catch(error){toast.error(error instanceof Error?error.message:"No se pudo guardar");}};
  const toggle=async(item:ApiCatalog)=>{try{const saved=connected?await apiUpdateCatalog(item.id,{is_active:!item.is_active}):{...item,is_active:!item.is_active};setItems(rows=>rows.map(r=>r.id===item.id?saved:r));}catch(error){toast.error(error instanceof Error?error.message:"No se pudo actualizar");}};
  return <><PageTitle eyebrow="ADMINISTRACIÓN" title="Catálogos maestros" text="Centraliza productos, defectos, etapas, turnos y listas operativas." action={<Button onClick={()=>start()}><Plus/> Nuevo elemento</Button>}/><ModeNote connected={connected}/><section className="catalog-layout"><nav>{types.map(t=><button key={t} className={type===t?"active":""} onClick={()=>setType(t)}><Boxes/><span>{t.charAt(0).toUpperCase()+t.slice(1)}</span><b>{items.filter(i=>i.catalog_type===t).length}</b></button>)}</nav><div className="panel catalog-list"><div className="admin-row admin-head"><span>Código y nombre</span><span>Descripción</span><span>Estado</span><span>Acción</span></div>{items.filter(i=>i.catalog_type===type).map(item=><div className="admin-row" key={item.id}><div><Badge variant="outline">{item.code}</Badge><b className="catalog-name">{item.name}</b></div><span>{item.description||"—"}</span><span className={`account-state ${item.is_active?"active":""}`}><i/>{item.is_active?"Activo":"Inactivo"}</span><div className="row-actions"><Button variant="ghost" size="sm" onClick={()=>start(item)}><Edit3/>Editar</Button><Button variant="ghost" size="sm" onClick={()=>toggle(item)}>{item.is_active?"Desactivar":"Activar"}</Button></div></div>)}</div></section><Dialog open={open} onOpenChange={setOpen}><DialogContent><form onSubmit={save}><DialogHeader><DialogTitle>{editing?"Editar elemento maestro":"Nuevo elemento maestro"}</DialogTitle><DialogDescription>El código será único dentro del catálogo seleccionado.</DialogDescription></DialogHeader><div className="form-grid dialog-form"><DialogField label="Catálogo"><NativeSelect disabled={!!editing} value={form.catalog_type} onChange={e=>setForm({...form,catalog_type:e.target.value})}>{types.map(t=><NativeSelectOption key={t}>{t}</NativeSelectOption>)}</NativeSelect></DialogField><DialogField label="Código"><Input disabled={!!editing} required value={form.code} onChange={e=>setForm({...form,code:e.target.value})}/></DialogField><DialogField label="Nombre" full><Input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></DialogField><DialogField label="Descripción" full><Textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></DialogField></div><DialogFooter><Button type="button" variant="outline" onClick={()=>setOpen(false)}>Cancelar</Button><Button type="submit">Guardar</Button></DialogFooter></form></DialogContent></Dialog></>;
}

const demoParameters:ApiParameter[]=[
  {id:1,key:"brix_min",value:7,unit:"°Brix",description:"Límite inferior de sólidos solubles",updated_at:nowIso},
  {id:2,key:"brix_max",value:15,unit:"°Brix",description:"Límite superior de sólidos solubles",updated_at:nowIso},
  {id:3,key:"humedad_min",value:55,unit:"%",description:"Humedad mínima aceptada",updated_at:nowIso},
  {id:4,key:"humedad_max",value:75,unit:"%",description:"Humedad máxima aceptada",updated_at:nowIso},
  {id:5,key:"peso_primera_min",value:151,unit:"g",description:"Peso mínimo de primera calidad",updated_at:nowIso},
  {id:6,key:"temperatura_pulpa_max",value:18,unit:"°C",description:"Temperatura máxima de pulpa",updated_at:nowIso},
];

export function ParametersPage({connected}:{connected:boolean}){
  const [items,setItems]=useState<ApiParameter[]>(DEMO_ENABLED && !connected ? demoParameters : []);const [dirty,setDirty]=useState<Record<string,number>>({});
  useEffect(()=>{if(connected)apiParameters().then(setItems).catch(e=>toast.error(e.message));},[connected]);
  const save=async()=>{try{if(connected)await Promise.all(Object.entries(dirty).map(([key,value])=>apiUpdateParameter(key,value)));setItems(rows=>rows.map(r=>dirty[r.key]!=null?{...r,value:dirty[r.key],updated_at:nowIso}:r));setDirty({});toast.success("Parámetros actualizados");}catch(e){toast.error(e instanceof Error?e.message:"No se pudo guardar");}};
  return <><PageTitle eyebrow="ADMINISTRACIÓN" title="Parámetros de calidad" text="Define rangos que activan validaciones y alertas automáticas." action={<Button disabled={!Object.keys(dirty).length} onClick={save}><Save/> Guardar cambios</Button>}/><ModeNote connected={connected}/><div className="parameter-grid">{items.map(item=><article className="panel parameter-card" key={item.key}><div><Settings2/><span><b>{item.description}</b><small>{item.key}</small></span></div><label><Input type="number" step="0.01" value={dirty[item.key]??item.value} onChange={e=>setDirty({...dirty,[item.key]:Number(e.target.value)})}/><strong>{item.unit}</strong></label><footer>Actualizado {fmtDate(item.updated_at)}</footer></article>)}</div><section className="panel safeguard"><ShieldCheck/><div><b>Salvaguarda de configuración</b><p>Cada cambio queda en la bitácora con valor anterior, valor nuevo, usuario, fecha e IP. Valide los límites con Control de Calidad antes de operar.</p></div></section></>;
}

const demoAudit:ApiAudit[]=[
  {id:1,user_id:2,action:"VALIDATE",entity:"quality_record",entity_id:"83",details:{decision:"Aprobado",validation_code:"VAL-20260903-A1B2C3"},ip_address:"192.168.1.24",created_at:nowIso},
  {id:2,user_id:3,action:"CREATE",entity:"quality_record",entity_id:"84",details:{module:"FOR-CCD-002"},ip_address:"192.168.1.32",created_at:nowIso},
  {id:3,user_id:1,action:"UPDATE",entity:"quality_parameter",entity_id:"brix_max",details:{before:14,after:15},ip_address:"192.168.1.10",created_at:nowIso},
];

export function AuditFullPage({connected}:{connected:boolean}){
  const [items,setItems]=useState<ApiAudit[]>(DEMO_ENABLED && !connected ? demoAudit : []);const [query,setQuery]=useState("");
  useEffect(()=>{if(connected)apiAudit().then(setItems).catch(e=>toast.error(e.message));},[connected]);
  const visible=items.filter(i=>JSON.stringify(i).toLowerCase().includes(query.toLowerCase()));
  const exportRows=()=>{const body=["Fecha,Acción,Entidad,Entidad ID,Usuario,IP,Detalle",...visible.map(i=>[i.created_at,i.action,i.entity,i.entity_id||"",i.user_id||"",i.ip_address||"",JSON.stringify(i.details)].map(v=>`"${String(v).replaceAll('"','""')}"`).join(","))].join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([body],{type:"text/csv;charset=utf-8"}));a.download="bitacora_auditoria.csv";a.click();URL.revokeObjectURL(a.href);};
  return <><PageTitle eyebrow="ADMINISTRACIÓN" title="Bitácora de auditoría" text="Consulta eventos de seguridad y cambios trazables sin alterar su contenido." action={<Button variant="outline" onClick={exportRows}><Save/>Exportar CSV</Button>}/><ModeNote connected={connected}/><section className="panel"><div className="filters"><div className="search-box"><Search/><Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar acción, entidad, IP o detalle"/></div><Badge variant="outline">{visible.length} eventos</Badge></div><div className="audit-table"><div className="audit-row audit-head"><span>Fecha</span><span>Acción</span><span>Entidad</span><span>Usuario / IP</span><span>Detalle</span></div>{visible.map(item=><div className="audit-row" key={item.id}><time>{fmtDate(item.created_at)}</time><Badge variant="outline">{item.action}</Badge><div><b>{item.entity}</b><small>#{item.entity_id||"—"}</small></div><div><b>Usuario {item.user_id||"sistema"}</b><small>{item.ip_address||"—"}</small></div><code>{JSON.stringify(item.details)}</code></div>)}</div></section></>;
}

export function ProfileDialog({open,onOpenChange,user,connected,onUpdated}:{open:boolean;onOpenChange:(value:boolean)=>void;user:SessionUser;connected:boolean;onUpdated:(user:SessionUser)=>void}){
  const [tab,setTab]=useState<"profile"|"password">("profile");const [name,setName]=useState(user.full_name);const [email,setEmail]=useState(user.email);const [current,setCurrent]=useState("");const [next,setNext]=useState("");
  const saveProfile=async(e:FormEvent)=>{e.preventDefault();try{const updated=connected?await apiUpdateProfile({full_name:name,email}):{...user,full_name:name,email};onUpdated({...updated,name:updated.full_name,initials:updated.full_name.split(" ").map(n=>n[0]).slice(0,2).join("")});toast.success("Perfil actualizado");onOpenChange(false);}catch(error){toast.error(error instanceof Error?error.message:"No se pudo guardar");}};
  const savePassword=async(e:FormEvent)=>{e.preventDefault();if(next.length<10)return toast.error("La nueva contraseña debe tener al menos 10 caracteres");try{if(connected)await apiChangePassword(current,next);setCurrent("");setNext("");toast.success("Contraseña actualizada");onOpenChange(false);}catch(error){toast.error(error instanceof Error?error.message:"No se pudo cambiar");}};
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Mi perfil</DialogTitle><DialogDescription>Administra tus datos personales y credenciales.</DialogDescription></DialogHeader><div className="profile-tabs"><button className={tab==="profile"?"active":""} onClick={()=>setTab("profile")}><UserCog/>Datos personales</button><button className={tab==="password"?"active":""} onClick={()=>setTab("password")}><LockKeyhole/>Contraseña</button></div>{tab==="profile"?<form onSubmit={saveProfile}><div className="dialog-form"><DialogField label="Nombre completo"><Input required value={name} onChange={e=>setName(e.target.value)}/></DialogField><DialogField label="Correo electrónico"><Input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></DialogField><div className="profile-role"><ShieldCheck/><span><b>{user.role}</b><small>Los permisos se administran por rol.</small></span></div></div><DialogFooter><Button type="button" variant="outline" onClick={()=>onOpenChange(false)}>Cancelar</Button><Button type="submit">Guardar perfil</Button></DialogFooter></form>:<form onSubmit={savePassword}><div className="dialog-form"><DialogField label="Contraseña actual"><Input type="password" required value={current} onChange={e=>setCurrent(e.target.value)}/></DialogField><DialogField label="Nueva contraseña"><Input type="password" minLength={10} required value={next} onChange={e=>setNext(e.target.value)}/></DialogField><small>Use al menos 10 caracteres y evite reutilizar la contraseña inicial.</small></div><DialogFooter><Button type="button" variant="outline" onClick={()=>onOpenChange(false)}>Cancelar</Button><Button type="submit">Cambiar contraseña</Button></DialogFooter></form>}<ModeNote connected={connected}/></DialogContent></Dialog>;
}
