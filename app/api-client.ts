/// <reference types="vite/client" />

// Demo is an explicit build/dev option; unavailable APIs never enable it.
export const DEMO_ENABLED = import.meta.env.VITE_ENABLE_DEMO === "true";

export type ApiRole = "Administrador" | "Coordinador" | "Inspector" | "Revisor";
export type ApiUser = { id: number; username: string; email: string; full_name: string; role: ApiRole; is_active: boolean };
export type ApiRecord = { id: number; record_code: string; module_code: string; supplier_id?: number; lot?: string; status: string; payload: Record<string, unknown>; conformity_percent?: number; alerts: string[]; duration_seconds: number; created_at: string; started_at: string; completed_at: string; created_by_id: number };
export type ApiNonConformity = { id: number; code: string; record_id?: number | null; module_code?: string | null; lot_code?: string | null; category: string; severity: "Leve" | "Mayor" | "Crítica"; description: string; quantity?: number | null; status: "Abierta" | "En tratamiento" | "Cerrada"; root_cause?: string | null; disposition?: string | null; detected_at: string; detected_by_id: number; detected_by_name: string; closed_at?: string | null; updated_at: string };
export type ApiCorrectiveAction = { id: number; code: string; nonconformity_id?: number | null; nonconformity_code?: string | null; title: string; plan: string; do_action?: string | null; check_result?: string | null; act_standardization?: string | null; responsible_id: number; responsible_name: string; due_date: string; phase: "Planificar" | "Hacer" | "Verificar" | "Actuar"; status: "Pendiente" | "En curso" | "Vencida" | "Completada"; effectiveness_percent?: number | null; completed_at?: string | null; updated_at: string };
export type ApiLotEvent = { id: number; stage: string; event_type: string; description: string; record_code?: string; occurred_at: string; created_by_name?: string };
export type ApiLot = { id: number; code: string; supplier_id?: number; supplier_name?: string; product: string; certification_type: string; harvest_date?: string; received_at: string; quantity_kg?: number; current_stage: string; status: string; observations?: string; record_count: number; open_nonconformities: number; events?: ApiLotEvent[]; records?: Array<{id:number;record_code:string;module_code:string;status:string;conformity_percent?:number;created_at:string}> };
export type ApiNotification = { id: number; title: string; message: string; level: string; is_read: boolean; created_at: string };
export type ApiCatalog = { id: number; catalog_type: string; code: string; name: string; description?: string; extra_data: Record<string, unknown>; is_active: boolean; created_at: string; updated_at: string };
export type ApiParameter = { id: number; key: string; value: number; unit: string; description: string; updated_at: string };
export type ApiAudit = { id: number; user_id?: number; action: string; entity: string; entity_id?: string; details: Record<string, unknown>; ip_address?: string; created_at: string };
export type ApiSpc = { field: string; count: number; mean?: number; std_dev?: number; min?: number; max?: number; lcl?: number; ucl?: number; cp?: number; cpk?: number; out_of_control: number; points: Array<{record_code:string;date:string;value:number;out_of_control:boolean}>; available_fields: Array<{field:string;count:number}> };
export type ApiSupplier = { id:number; code:string; name:string; origin:string; certification_type:string; observations?:string|null; is_active:boolean };
export type ApiCarrier = { id:number; name:string; document?:string|null; plate?:string|null; phone?:string|null; is_active:boolean };
export type ApiDashboard = { conformity_percent?:number|null; average_weight_g?:number|null; pending_validations:number; average_entry_seconds?:number|null; records_total:number; open_nonconformities:number; overdue_actions:number; active_lots:number; trend:Array<{date:string;conformity:number}>; top_defects:Array<{field:string;count:number}> };

const tokenKey = "calidad360_access_token";

async function apiFetch(path: string, options: RequestInit): Promise<Response> {
  try {
    return await fetch(path, { ...options, signal: options.signal ?? AbortSignal.timeout(20000) });
  } catch {
    throw new Error("No se pudo conectar con el servidor. Verifica que la API local esté iniciada e inténtalo otra vez.");
  }
}

async function responseError(response: Response): Promise<Error> {
  const data = await response.json().catch(() => ({}));
  if (typeof data.detail === "string") return new Error(data.detail);
  if (Array.isArray(data.detail)) return new Error(data.detail.map((item: { msg?: string }) => item.msg || "Dato inválido").join(". "));
  return new Error(response.status >= 500
    ? "El servidor no pudo completar la operación. Verifica que la API y PostgreSQL estén iniciados."
    : "No se pudo completar la operación");
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? sessionStorage.getItem(tokenKey) : null;
  const isForm = typeof FormData !== "undefined" && options.body instanceof FormData;
  const response = await apiFetch(path, {
    ...options,
    headers: {
      ...(!isForm ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw await responseError(response);
  if (response.status === 204) return undefined as T;
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("La API no está disponible. Verifica la conexión del frontend con el servidor local.");
  }
  return response.json() as Promise<T>;
}

export async function apiLogin(username: string, password: string): Promise<ApiUser> {
  const result = await apiRequest<{ access_token: string; user: ApiUser }>("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
  sessionStorage.setItem(tokenKey, result.access_token);
  return result.user;
}

export function apiLogout() { sessionStorage.removeItem(tokenKey); }
export function apiRecords() { return apiRequest<ApiRecord[]>("/api/records?limit=100"); }
export function apiDashboard() { return apiRequest<ApiDashboard>("/api/dashboard"); }
export function apiMyPermissions() { return apiRequest<{role:ApiRole;permissions:string[]}>("/api/auth/permissions"); }
export function apiCreateRecord(module_code: string, payload: Record<string,string>, started_at: string, supplier_id?: number, carrier_id?: number) { return apiRequest<ApiRecord>("/api/records", { method: "POST", body: JSON.stringify({ module_code, certification_type: payload.tipo || "Convencional", lot: payload.lote || null, supplier_id: supplier_id || null, carrier_id: carrier_id || null, payload, started_at }) }); }
export function apiImportRecords(file: File) { const form=new FormData();form.append("file",file);return apiRequest<{rows_received:number;rows_imported:number;rows_rejected:number;errors:Array<Record<string,unknown>>}>("/api/import/records",{method:"POST",body:form}); }
export function apiValidate(recordId: number, decision: string, observations = "") { return apiRequest(`/api/records/${recordId}/validate`, { method: "POST", body: JSON.stringify({ decision, observations }) }); }
export function apiUsers() { return apiRequest<ApiUser[]>("/api/users"); }
export function apiCreateUser(data: Record<string, unknown>) { return apiRequest<ApiUser>("/api/users", { method: "POST", body: JSON.stringify(data) }); }
export function apiUpdateUser(id: number, data: Record<string, unknown>) { return apiRequest<ApiUser>(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }); }
export function apiUserStatus(id: number, active: boolean) { return apiRequest<ApiUser>(`/api/users/${id}/status?active=${active}`, { method: "PATCH" }); }
export function apiSuppliers() { return apiRequest<ApiSupplier[]>("/api/suppliers"); }
export function apiCreateSupplier(data: Record<string, unknown>) { return apiRequest<ApiSupplier>("/api/suppliers", { method:"POST", body:JSON.stringify(data) }); }
export function apiUpdateSupplier(id:number,data:Record<string, unknown>) { return apiRequest<ApiSupplier>(`/api/suppliers/${id}`, { method:"PATCH", body:JSON.stringify(data) }); }
export function apiDeleteSupplier(id:number) { return apiRequest<void>(`/api/suppliers/${id}`, { method:"DELETE" }); }
export function apiCarriers() { return apiRequest<ApiCarrier[]>("/api/carriers"); }
export function apiCreateCarrier(data: Record<string, unknown>) { return apiRequest<ApiCarrier>("/api/carriers", { method:"POST", body:JSON.stringify(data) }); }
export function apiUpdateCarrier(id:number,data:Record<string, unknown>) { return apiRequest<ApiCarrier>(`/api/carriers/${id}`, { method:"PATCH", body:JSON.stringify(data) }); }
export function apiDeleteCarrier(id:number) { return apiRequest<void>(`/api/carriers/${id}`, { method:"DELETE" }); }
export function apiNonConformities() { return apiRequest<ApiNonConformity[]>("/api/nonconformities"); }
export function apiCreateNonConformity(data: Record<string, unknown>) { return apiRequest<ApiNonConformity>("/api/nonconformities", { method: "POST", body: JSON.stringify(data) }); }
export function apiUpdateNonConformity(id: number, data: Record<string, unknown>) { return apiRequest<ApiNonConformity>(`/api/nonconformities/${id}`, { method: "PATCH", body: JSON.stringify(data) }); }
export function apiActions() { return apiRequest<ApiCorrectiveAction[]>("/api/corrective-actions"); }
export function apiCreateAction(data: Record<string, unknown>) { return apiRequest<ApiCorrectiveAction>("/api/corrective-actions", { method: "POST", body: JSON.stringify(data) }); }
export function apiUpdateAction(id: number, data: Record<string, unknown>) { return apiRequest<ApiCorrectiveAction>(`/api/corrective-actions/${id}`, { method: "PATCH", body: JSON.stringify(data) }); }
export function apiLots() { return apiRequest<ApiLot[]>("/api/lots"); }
export function apiLot(id: number) { return apiRequest<ApiLot>(`/api/lots/${id}`); }
export function apiCreateLot(data: Record<string, unknown>) { return apiRequest<ApiLot>("/api/lots", { method: "POST", body: JSON.stringify(data) }); }
export function apiUpdateLot(id: number, data: Record<string, unknown>) { return apiRequest<ApiLot>(`/api/lots/${id}`, { method: "PATCH", body: JSON.stringify(data) }); }
export function apiCreateLotEvent(id: number, data: Record<string, unknown>) { return apiRequest<ApiLotEvent>(`/api/lots/${id}/events`, { method: "POST", body: JSON.stringify(data) }); }
export function apiNotifications() { return apiRequest<ApiNotification[]>("/api/notifications"); }
export function apiReadNotification(id: number) { return apiRequest(`/api/notifications/${id}/read`, { method: "PATCH" }); }
export function apiReadAllNotifications() { return apiRequest<{updated:number}>("/api/notifications/actions/read-all", { method: "PATCH" }); }
export function apiCatalogs() { return apiRequest<ApiCatalog[]>("/api/catalogs?include_inactive=true"); }
export function apiCreateCatalog(data: Record<string, unknown>) { return apiRequest<ApiCatalog>("/api/catalogs", { method: "POST", body: JSON.stringify(data) }); }
export function apiUpdateCatalog(id: number, data: Record<string, unknown>) { return apiRequest<ApiCatalog>(`/api/catalogs/${id}`, { method: "PATCH", body: JSON.stringify(data) }); }
export function apiParameters() { return apiRequest<ApiParameter[]>("/api/parameters"); }
export function apiUpdateParameter(key: string, value: number) { return apiRequest<ApiParameter>(`/api/parameters/${key}`, { method: "PATCH", body: JSON.stringify({ value }) }); }
export function apiAudit() { return apiRequest<ApiAudit[]>("/api/audit?limit=300"); }
export function apiRoles() { return apiRequest<{permission_catalog:Array<{key:string;label:string}>;roles:Array<{role:ApiRole;permissions:string[]}>}>("/api/roles"); }
export function apiUpdateRole(role: ApiRole, permissions: string[]) { return apiRequest(`/api/roles/${encodeURIComponent(role)}/permissions`, { method: "PUT", body: JSON.stringify({ permissions }) }); }
export function apiSpc(moduleCode = "", field = "conformity_percent") { const params = new URLSearchParams({ field }); if(moduleCode) params.set("module_code", moduleCode); return apiRequest<ApiSpc>(`/api/spc?${params}`); }
export function apiUpdateProfile(data: {full_name:string;email:string}) { return apiRequest<ApiUser>("/api/profile", { method: "PATCH", body: JSON.stringify(data) }); }
export function apiChangePassword(current_password: string, new_password: string) { return apiRequest("/api/profile/password", { method: "POST", body: JSON.stringify({ current_password, new_password }) }); }

export async function apiDownload(path: string, filename: string) {
  const token = sessionStorage.getItem(tokenKey);
  const response = await apiFetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!response.ok) throw await responseError(response);
  const expectedType = filename.endsWith(".pdf") ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (!response.headers.get("content-type")?.includes(expectedType)) throw new Error("El servidor no devolvió un reporte válido");
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(await response.blob());
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}
