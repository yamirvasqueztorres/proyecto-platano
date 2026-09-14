from datetime import date, datetime
from typing import Any, Literal
from pydantic import AwareDatetime, BaseModel, ConfigDict, EmailStr, Field
from .models import Role


class LoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=128)


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    role: Role
    is_active: bool
    model_config = ConfigDict(from_attributes=True)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9._-]+$")
    email: EmailStr
    full_name: str = Field(min_length=3, max_length=160)
    role: Role
    password: str = Field(min_length=10, max_length=128)


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    full_name: str | None = Field(default=None, min_length=3, max_length=160)
    role: Role | None = None
    password: str | None = Field(default=None, min_length=10, max_length=128)


class ProfileUpdate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=3, max_length=160)


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=10, max_length=128)


class SupplierCreate(BaseModel):
    code: str = Field(min_length=2, max_length=30)
    name: str = Field(min_length=3, max_length=180)
    origin: str = Field(min_length=2, max_length=180)
    certification_type: Literal["Convencional", "Comercio justo"]
    observations: str | None = Field(default=None, max_length=1000)


class SupplierOut(SupplierCreate):
    id: int
    is_active: bool
    model_config = ConfigDict(from_attributes=True)


class CarrierCreate(BaseModel):
    name: str = Field(min_length=3, max_length=180)
    document: str | None = Field(default=None, max_length=30)
    plate: str | None = Field(default=None, max_length=20)
    phone: str | None = Field(default=None, max_length=30)


class CarrierOut(CarrierCreate):
    id: int
    is_active: bool
    model_config = ConfigDict(from_attributes=True)


class RecordCreate(BaseModel):
    module_code: str
    supplier_id: int | None = Field(default=None, gt=0)
    carrier_id: int | None = Field(default=None, gt=0)
    lot: str | None = Field(default=None, max_length=80)
    certification_type: Literal["Convencional", "Comercio justo"] = "Convencional"
    payload: dict[str, Any]
    started_at: AwareDatetime


class RecordOut(BaseModel):
    id: int
    record_code: str
    module_code: str
    supplier_id: int | None
    carrier_id: int | None
    lot: str | None
    certification_type: str
    status: str
    payload: dict[str, Any]
    conformity_percent: float | None
    alerts: list
    started_at: datetime
    completed_at: datetime
    duration_seconds: int
    created_by_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ValidationCreate(BaseModel):
    decision: Literal["Aprobado", "Observado", "Rechazado"]
    observations: str | None = Field(default=None, max_length=2000)


class ParameterUpdate(BaseModel):
    value: float


class ImportResult(BaseModel):
    rows_received: int
    rows_imported: int
    rows_rejected: int
    errors: list[dict]


class RolePermissionsUpdate(BaseModel):
    permissions: list[str]


class CatalogItemCreate(BaseModel):
    catalog_type: str = Field(min_length=2, max_length=60, pattern=r"^[a-z0-9_-]+$")
    code: str = Field(min_length=1, max_length=40)
    name: str = Field(min_length=2, max_length=180)
    description: str | None = Field(default=None, max_length=1000)
    extra_data: dict[str, Any] = Field(default_factory=dict)


class CatalogItemUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=180)
    description: str | None = Field(default=None, max_length=1000)
    extra_data: dict[str, Any] | None = None
    is_active: bool | None = None


class CatalogItemOut(CatalogItemCreate):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class LotCreate(BaseModel):
    code: str = Field(min_length=3, max_length=80)
    supplier_id: int | None = None
    product: str = Field(default="Plátano verde", min_length=2, max_length=160)
    certification_type: Literal["Convencional", "Comercio justo"] = "Convencional"
    harvest_date: date | None = None
    received_at: datetime | None = None
    quantity_kg: float | None = Field(default=None, ge=0)
    current_stage: str = Field(default="Recepción", min_length=2, max_length=80)
    status: Literal["Activo", "Retenido", "Liberado", "Despachado", "Cerrado"] = "Activo"
    observations: str | None = Field(default=None, max_length=2000)


class LotUpdate(BaseModel):
    supplier_id: int | None = None
    product: str | None = Field(default=None, min_length=2, max_length=160)
    certification_type: Literal["Convencional", "Comercio justo"] | None = None
    harvest_date: date | None = None
    quantity_kg: float | None = Field(default=None, ge=0)
    current_stage: str | None = Field(default=None, min_length=2, max_length=80)
    status: Literal["Activo", "Retenido", "Liberado", "Despachado", "Cerrado"] | None = None
    observations: str | None = Field(default=None, max_length=2000)


class LotEventCreate(BaseModel):
    stage: str = Field(min_length=2, max_length=80)
    event_type: str = Field(default="Avance", min_length=2, max_length=80)
    description: str = Field(min_length=3, max_length=2000)
    record_code: str | None = Field(default=None, max_length=30)
    occurred_at: datetime | None = None


class NonConformityCreate(BaseModel):
    record_id: int | None = None
    module_code: str | None = Field(default=None, max_length=20)
    lot_code: str | None = Field(default=None, max_length=80)
    category: str = Field(min_length=2, max_length=100)
    severity: Literal["Leve", "Mayor", "Crítica"] = "Mayor"
    description: str = Field(min_length=5, max_length=3000)
    quantity: float | None = Field(default=None, ge=0)
    root_cause: str | None = Field(default=None, max_length=3000)
    disposition: str | None = Field(default=None, max_length=3000)
    detected_at: datetime | None = None


class NonConformityUpdate(BaseModel):
    category: str | None = Field(default=None, min_length=2, max_length=100)
    severity: Literal["Leve", "Mayor", "Crítica"] | None = None
    description: str | None = Field(default=None, min_length=5, max_length=3000)
    quantity: float | None = Field(default=None, ge=0)
    status: Literal["Abierta", "En tratamiento", "Cerrada"] | None = None
    root_cause: str | None = Field(default=None, max_length=3000)
    disposition: str | None = Field(default=None, max_length=3000)


class CorrectiveActionCreate(BaseModel):
    nonconformity_id: int | None = None
    title: str = Field(min_length=3, max_length=180)
    plan: str = Field(min_length=5, max_length=3000)
    do_action: str | None = Field(default=None, max_length=3000)
    check_result: str | None = Field(default=None, max_length=3000)
    act_standardization: str | None = Field(default=None, max_length=3000)
    responsible_id: int
    due_date: date
    phase: Literal["Planificar", "Hacer", "Verificar", "Actuar"] = "Planificar"
    status: Literal["Pendiente", "En curso", "Vencida", "Completada"] = "Pendiente"
    effectiveness_percent: float | None = Field(default=None, ge=0, le=100)


class CorrectiveActionUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=180)
    plan: str | None = Field(default=None, min_length=5, max_length=3000)
    do_action: str | None = Field(default=None, max_length=3000)
    check_result: str | None = Field(default=None, max_length=3000)
    act_standardization: str | None = Field(default=None, max_length=3000)
    responsible_id: int | None = None
    due_date: date | None = None
    phase: Literal["Planificar", "Hacer", "Verificar", "Actuar"] | None = None
    status: Literal["Pendiente", "En curso", "Vencida", "Completada"] | None = None
    effectiveness_percent: float | None = Field(default=None, ge=0, le=100)
