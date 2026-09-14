import math
import secrets
import statistics
from collections import Counter
from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from .auth import current_user, hash_password, require_permission, verify_password
from .database import get_db
from .models import (
    AuditLog,
    CatalogItem,
    CorrectiveAction,
    LotEvent,
    NonConformity,
    Notification,
    NotificationRead,
    ProductionLot,
    QualityRecord,
    Role,
    RolePermission,
    Supplier,
    User,
    utcnow,
)
from .permissions import ALL_PERMISSION_KEYS, DEFAULT_ROLE_PERMISSIONS, PERMISSIONS
from .schemas import (
    CatalogItemCreate,
    CatalogItemOut,
    CatalogItemUpdate,
    CorrectiveActionCreate,
    CorrectiveActionUpdate,
    LotCreate,
    LotEventCreate,
    LotUpdate,
    NonConformityCreate,
    NonConformityUpdate,
    PasswordChange,
    ProfileUpdate,
    RolePermissionsUpdate,
    UserOut,
)

router = APIRouter(prefix="/api")


def audit(db: Session, request: Request, user: User, action: str, entity: str, entity_id: str | None = None, details: dict | None = None) -> None:
    db.add(AuditLog(
        user_id=user.id,
        action=action,
        entity=entity,
        entity_id=entity_id,
        details=details or {},
        ip_address=request.client.host if request.client else None,
    ))


def lot_dict(item: ProductionLot, db: Session, *, detail: bool = False) -> dict:
    record_count = db.scalar(select(func.count()).select_from(QualityRecord).where(QualityRecord.lot == item.code)) or 0
    nc_count = db.scalar(select(func.count()).select_from(NonConformity).where(NonConformity.lot_code == item.code, NonConformity.status != "Cerrada")) or 0
    data = {
        "id": item.id, "code": item.code, "supplier_id": item.supplier_id,
        "supplier_name": item.supplier.name if item.supplier else None,
        "product": item.product, "certification_type": item.certification_type,
        "harvest_date": item.harvest_date, "received_at": item.received_at,
        "quantity_kg": item.quantity_kg, "current_stage": item.current_stage,
        "status": item.status, "observations": item.observations,
        "record_count": record_count, "open_nonconformities": nc_count,
        "created_by_id": item.created_by_id, "created_at": item.created_at,
        "updated_at": item.updated_at,
    }
    if detail:
        events = db.scalars(select(LotEvent).where(LotEvent.lot_id == item.id).order_by(LotEvent.occurred_at)).all()
        records = db.scalars(select(QualityRecord).where(QualityRecord.lot == item.code).order_by(QualityRecord.created_at)).all()
        data["events"] = [{
            "id": event.id, "stage": event.stage, "event_type": event.event_type,
            "description": event.description, "record_code": event.record_code,
            "occurred_at": event.occurred_at, "created_by_id": event.created_by_id,
            "created_by_name": event.created_by.full_name,
        } for event in events]
        data["records"] = [{
            "id": record.id, "record_code": record.record_code, "module_code": record.module_code,
            "status": record.status.value, "conformity_percent": record.conformity_percent,
            "created_at": record.created_at,
        } for record in records]
    return data


def nc_dict(item: NonConformity) -> dict:
    return {
        "id": item.id, "code": item.code, "record_id": item.record_id,
        "module_code": item.module_code, "lot_code": item.lot_code,
        "category": item.category, "severity": item.severity,
        "description": item.description, "quantity": item.quantity,
        "status": item.status, "root_cause": item.root_cause,
        "disposition": item.disposition, "detected_at": item.detected_at,
        "detected_by_id": item.detected_by_id,
        "detected_by_name": item.detected_by.full_name,
        "closed_at": item.closed_at, "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


def action_dict(item: CorrectiveAction) -> dict:
    effective_status = "Vencida" if item.status not in ("Completada", "Vencida") and item.due_date < date.today() else item.status
    return {
        "id": item.id, "code": item.code, "nonconformity_id": item.nonconformity_id,
        "nonconformity_code": item.nonconformity.code if item.nonconformity else None,
        "title": item.title, "plan": item.plan, "do_action": item.do_action,
        "check_result": item.check_result, "act_standardization": item.act_standardization,
        "responsible_id": item.responsible_id, "responsible_name": item.responsible.full_name,
        "due_date": item.due_date, "phase": item.phase, "status": effective_status,
        "effectiveness_percent": item.effectiveness_percent, "completed_at": item.completed_at,
        "created_by_id": item.created_by_id, "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


@router.patch("/profile", response_model=UserOut, tags=["Perfil"])
def update_profile(body: ProfileUpdate, request: Request, db: Session = Depends(get_db), actor: User = Depends(current_user)):
    duplicate = db.scalar(select(User).where(User.email == str(body.email).lower(), User.id != actor.id))
    if duplicate:
        raise HTTPException(409, "El correo ya está registrado")
    actor.full_name = body.full_name.strip()
    actor.email = str(body.email).lower()
    audit(db, request, actor, "UPDATE", "profile", str(actor.id), {"fields": ["full_name", "email"]})
    db.commit(); db.refresh(actor)
    return actor


@router.get("/auth/permissions", tags=["Autenticación"])
def my_permissions(db: Session = Depends(get_db), actor: User = Depends(current_user)):
    configured = db.scalars(select(RolePermission).where(RolePermission.role == actor.role)).all()
    mapping = {item.permission: item.allowed for item in configured}
    return {
        "role": actor.role.value,
        "permissions": [key for key, _ in PERMISSIONS if mapping.get(key, key in DEFAULT_ROLE_PERMISSIONS[actor.role])],
    }


@router.post("/profile/password", tags=["Perfil"])
def change_password(body: PasswordChange, request: Request, db: Session = Depends(get_db), actor: User = Depends(current_user)):
    if not verify_password(body.current_password, actor.hashed_password):
        raise HTTPException(400, "La contraseña actual no es correcta")
    if body.current_password == body.new_password:
        raise HTTPException(400, "La nueva contraseña debe ser diferente")
    actor.hashed_password = hash_password(body.new_password)
    audit(db, request, actor, "CHANGE_PASSWORD", "profile", str(actor.id))
    db.commit()
    return {"ok": True}


@router.get("/roles", tags=["Roles y permisos"])
def list_roles(db: Session = Depends(get_db), _: User = Depends(require_permission("roles.manage"))):
    configured = db.scalars(select(RolePermission)).all()
    mapping = {(item.role, item.permission): item.allowed for item in configured}
    return {
        "permission_catalog": [{"key": key, "label": label} for key, label in PERMISSIONS],
        "roles": [{
            "role": role.value,
            "permissions": [key for key, _ in PERMISSIONS if mapping.get((role, key), key in DEFAULT_ROLE_PERMISSIONS[role])],
        } for role in Role],
    }


@router.put("/roles/{role_name}/permissions", tags=["Roles y permisos"])
def update_role_permissions(role_name: str, body: RolePermissionsUpdate, request: Request, db: Session = Depends(get_db), actor: User = Depends(require_permission("roles.manage"))):
    try:
        role = Role(role_name)
    except ValueError:
        raise HTTPException(404, "Rol no encontrado")
    unknown = set(body.permissions) - ALL_PERMISSION_KEYS
    if unknown:
        raise HTTPException(422, "Permisos no reconocidos: " + ", ".join(sorted(unknown)))
    if role == Role.ADMINISTRADOR and not {"roles.manage", "users.manage"}.issubset(body.permissions):
        raise HTTPException(400, "El rol Administrador debe conservar la gestión de usuarios, roles y permisos")
    selected = set(body.permissions)
    for key, _ in PERMISSIONS:
        item = db.scalar(select(RolePermission).where(RolePermission.role == role, RolePermission.permission == key))
        if item:
            item.allowed = key in selected
        else:
            db.add(RolePermission(role=role, permission=key, allowed=key in selected))
    audit(db, request, actor, "UPDATE", "role_permissions", role.value, {"permissions": sorted(selected)})
    db.commit()
    return {"role": role.value, "permissions": sorted(selected)}


@router.get("/catalogs", response_model=list[CatalogItemOut], tags=["Catálogos maestros"])
def list_catalogs(catalog_type: str | None = None, include_inactive: bool = False, q: str | None = None, db: Session = Depends(get_db), _: User = Depends(current_user)):
    query = select(CatalogItem).order_by(CatalogItem.catalog_type, CatalogItem.name)
    if catalog_type:
        query = query.where(CatalogItem.catalog_type == catalog_type)
    if not include_inactive:
        query = query.where(CatalogItem.is_active.is_(True))
    if q:
        query = query.where(or_(CatalogItem.name.ilike(f"%{q}%"), CatalogItem.code.ilike(f"%{q}%")))
    return db.scalars(query).all()


@router.post("/catalogs", response_model=CatalogItemOut, status_code=201, tags=["Catálogos maestros"])
def create_catalog(body: CatalogItemCreate, request: Request, db: Session = Depends(get_db), actor: User = Depends(require_permission("catalogs.manage"))):
    code = body.code.strip().upper()
    if db.scalar(select(CatalogItem).where(CatalogItem.catalog_type == body.catalog_type, CatalogItem.code == code)):
        raise HTTPException(409, "El código ya existe en ese catálogo")
    item = CatalogItem(**body.model_dump(exclude={"code"}), code=code)
    db.add(item); db.flush(); audit(db, request, actor, "CREATE", "catalog_item", str(item.id), {"type": item.catalog_type})
    db.commit(); db.refresh(item)
    return item


@router.patch("/catalogs/{item_id}", response_model=CatalogItemOut, tags=["Catálogos maestros"])
def update_catalog(item_id: int, body: CatalogItemUpdate, request: Request, db: Session = Depends(get_db), actor: User = Depends(require_permission("catalogs.manage"))):
    item = db.get(CatalogItem, item_id)
    if not item:
        raise HTTPException(404, "Elemento no encontrado")
    changes = body.model_dump(exclude_none=True)
    for key, value in changes.items():
        setattr(item, key, value)
    audit(db, request, actor, "UPDATE", "catalog_item", str(item.id), {"fields": list(changes)})
    db.commit(); db.refresh(item)
    return item


@router.get("/lots", tags=["Trazabilidad de lotes"])
def list_lots(status: str | None = None, q: str | None = None, limit: int = Query(100, ge=1, le=500), db: Session = Depends(get_db), _: User = Depends(current_user)):
    query = select(ProductionLot).order_by(ProductionLot.created_at.desc())
    if status:
        query = query.where(ProductionLot.status == status)
    if q:
        query = query.where(or_(ProductionLot.code.ilike(f"%{q}%"), ProductionLot.product.ilike(f"%{q}%")))
    return [lot_dict(item, db) for item in db.scalars(query.limit(limit)).all()]


@router.post("/lots", status_code=201, tags=["Trazabilidad de lotes"])
def create_lot(body: LotCreate, request: Request, db: Session = Depends(get_db), actor: User = Depends(require_permission("lots.manage"))):
    code = body.code.strip().upper()
    if db.scalar(select(ProductionLot).where(ProductionLot.code == code)):
        raise HTTPException(409, "El lote ya existe")
    if body.supplier_id and not db.get(Supplier, body.supplier_id):
        raise HTTPException(422, "Proveedor no encontrado")
    values = body.model_dump(exclude={"code", "received_at"})
    item = ProductionLot(**values, code=code, received_at=body.received_at or utcnow(), created_by_id=actor.id)
    db.add(item); db.flush()
    db.add(LotEvent(lot_id=item.id, stage=item.current_stage, event_type="Creación", description="Lote registrado en el sistema", occurred_at=item.received_at, created_by_id=actor.id))
    audit(db, request, actor, "CREATE", "production_lot", str(item.id), {"code": code})
    db.commit(); db.refresh(item)
    return lot_dict(item, db, detail=True)


@router.get("/lots/{lot_id}", tags=["Trazabilidad de lotes"])
def get_lot(lot_id: int, db: Session = Depends(get_db), _: User = Depends(current_user)):
    item = db.get(ProductionLot, lot_id)
    if not item:
        raise HTTPException(404, "Lote no encontrado")
    return lot_dict(item, db, detail=True)


@router.patch("/lots/{lot_id}", tags=["Trazabilidad de lotes"])
def update_lot(lot_id: int, body: LotUpdate, request: Request, db: Session = Depends(get_db), actor: User = Depends(require_permission("lots.manage"))):
    item = db.get(ProductionLot, lot_id)
    if not item:
        raise HTTPException(404, "Lote no encontrado")
    changes = body.model_dump(exclude_none=True)
    old_stage = item.current_stage
    for key, value in changes.items():
        setattr(item, key, value)
    if item.current_stage != old_stage:
        db.add(LotEvent(lot_id=item.id, stage=item.current_stage, event_type="Cambio de etapa", description=f"Avance desde {old_stage}", created_by_id=actor.id))
    audit(db, request, actor, "UPDATE", "production_lot", str(item.id), {"fields": list(changes)})
    db.commit(); db.refresh(item)
    return lot_dict(item, db, detail=True)


@router.post("/lots/{lot_id}/events", status_code=201, tags=["Trazabilidad de lotes"])
def create_lot_event(lot_id: int, body: LotEventCreate, request: Request, db: Session = Depends(get_db), actor: User = Depends(require_permission("lots.manage"))):
    item = db.get(ProductionLot, lot_id)
    if not item:
        raise HTTPException(404, "Lote no encontrado")
    event = LotEvent(lot_id=item.id, **body.model_dump(exclude={"occurred_at"}), occurred_at=body.occurred_at or utcnow(), created_by_id=actor.id)
    item.current_stage = body.stage
    db.add(event); db.flush(); audit(db, request, actor, "CREATE", "lot_event", str(event.id), {"lot": item.code, "stage": body.stage})
    db.commit(); db.refresh(event)
    return {"id": event.id, "lot_id": item.id, "stage": event.stage, "event_type": event.event_type, "description": event.description, "record_code": event.record_code, "occurred_at": event.occurred_at}


@router.get("/nonconformities", tags=["No conformidades"])
def list_nonconformities(status: str | None = None, severity: str | None = None, lot_code: str | None = None, db: Session = Depends(get_db), _: User = Depends(current_user)):
    query = select(NonConformity).order_by(NonConformity.detected_at.desc())
    if status:
        query = query.where(NonConformity.status == status)
    if severity:
        query = query.where(NonConformity.severity == severity)
    if lot_code:
        query = query.where(NonConformity.lot_code == lot_code)
    return [nc_dict(item) for item in db.scalars(query).all()]


@router.post("/nonconformities", status_code=201, tags=["No conformidades"])
def create_nonconformity(body: NonConformityCreate, request: Request, db: Session = Depends(get_db), actor: User = Depends(require_permission("nonconformities.manage"))):
    if body.record_id:
        record = db.get(QualityRecord, body.record_id)
        if not record:
            raise HTTPException(422, "Registro de calidad no encontrado")
    now = utcnow()
    item = NonConformity(code=f"TMP-{secrets.token_hex(6)}", detected_by_id=actor.id, detected_at=body.detected_at or now, **body.model_dump(exclude={"detected_at"}))
    db.add(item); db.flush(); item.code = f"NC-{now.year}-{item.id:05d}"
    db.add(Notification(title="Nueva no conformidad", message=f"{item.code} · {item.category} · {item.severity}", level="error" if item.severity == "Crítica" else "warning"))
    audit(db, request, actor, "CREATE", "non_conformity", str(item.id), {"code": item.code, "severity": item.severity})
    db.commit(); db.refresh(item)
    return nc_dict(item)


@router.patch("/nonconformities/{item_id}", tags=["No conformidades"])
def update_nonconformity(item_id: int, body: NonConformityUpdate, request: Request, db: Session = Depends(get_db), actor: User = Depends(require_permission("nonconformities.manage"))):
    item = db.get(NonConformity, item_id)
    if not item:
        raise HTTPException(404, "No conformidad no encontrada")
    changes = body.model_dump(exclude_none=True)
    for key, value in changes.items():
        setattr(item, key, value)
    if item.status == "Cerrada" and not item.closed_at:
        if not item.root_cause or not item.disposition:
            raise HTTPException(422, "Para cerrar debe registrar causa raíz y disposición")
        item.closed_at = utcnow()
    elif item.status != "Cerrada":
        item.closed_at = None
    audit(db, request, actor, "UPDATE", "non_conformity", str(item.id), {"fields": list(changes)})
    db.commit(); db.refresh(item)
    return nc_dict(item)


@router.get("/corrective-actions", tags=["Acciones correctivas PHVA"])
def list_corrective_actions(status: str | None = None, phase: str | None = None, responsible_id: int | None = None, db: Session = Depends(get_db), _: User = Depends(current_user)):
    query = select(CorrectiveAction).order_by(CorrectiveAction.due_date, CorrectiveAction.created_at.desc())
    if status:
        query = query.where(CorrectiveAction.status == status)
    if phase:
        query = query.where(CorrectiveAction.phase == phase)
    if responsible_id:
        query = query.where(CorrectiveAction.responsible_id == responsible_id)
    return [action_dict(item) for item in db.scalars(query).all()]


@router.post("/corrective-actions", status_code=201, tags=["Acciones correctivas PHVA"])
def create_corrective_action(body: CorrectiveActionCreate, request: Request, db: Session = Depends(get_db), actor: User = Depends(require_permission("phva.manage"))):
    if not db.get(User, body.responsible_id):
        raise HTTPException(422, "Responsable no encontrado")
    nc = db.get(NonConformity, body.nonconformity_id) if body.nonconformity_id else None
    if body.nonconformity_id and not nc:
        raise HTTPException(422, "No conformidad no encontrada")
    now = utcnow()
    item = CorrectiveAction(code=f"TMP-{secrets.token_hex(6)}", created_by_id=actor.id, **body.model_dump())
    db.add(item); db.flush(); item.code = f"AC-{now.year}-{item.id:05d}"
    if nc and nc.status == "Abierta":
        nc.status = "En tratamiento"
    db.add(Notification(user_id=item.responsible_id, title="Nueva acción correctiva", message=f"{item.code} vence el {item.due_date:%d/%m/%Y}", level="warning"))
    audit(db, request, actor, "CREATE", "corrective_action", str(item.id), {"code": item.code, "responsible_id": item.responsible_id})
    db.commit(); db.refresh(item)
    return action_dict(item)


@router.patch("/corrective-actions/{item_id}", tags=["Acciones correctivas PHVA"])
def update_corrective_action(item_id: int, body: CorrectiveActionUpdate, request: Request, db: Session = Depends(get_db), actor: User = Depends(require_permission("phva.manage"))):
    item = db.get(CorrectiveAction, item_id)
    if not item:
        raise HTTPException(404, "Acción correctiva no encontrada")
    changes = body.model_dump(exclude_none=True)
    if "responsible_id" in changes and not db.get(User, changes["responsible_id"]):
        raise HTTPException(422, "Responsable no encontrado")
    for key, value in changes.items():
        setattr(item, key, value)
    if item.status == "Completada":
        if not item.check_result or item.effectiveness_percent is None:
            raise HTTPException(422, "Para completar debe verificar el resultado y registrar la eficacia")
        item.phase = "Actuar"
        item.completed_at = item.completed_at or utcnow()
    else:
        item.completed_at = None
    audit(db, request, actor, "UPDATE", "corrective_action", str(item.id), {"fields": list(changes)})
    db.commit(); db.refresh(item)
    return action_dict(item)


@router.get("/spc", tags=["Análisis estadístico SPC"])
def statistical_process_control(
    module_code: str | None = None,
    field: str = "conformity_percent",
    start: date | None = None,
    end: date | None = None,
    lower_spec: float | None = None,
    upper_spec: float | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("spc.view")),
):
    query = select(QualityRecord).order_by(QualityRecord.created_at)
    if module_code:
        query = query.where(QualityRecord.module_code == module_code)
    if start:
        query = query.where(QualityRecord.created_at >= datetime.combine(start, time.min, tzinfo=timezone.utc))
    if end:
        query = query.where(QualityRecord.created_at < datetime.combine(end + timedelta(days=1), time.min, tzinfo=timezone.utc))
    rows = db.scalars(query).all()
    points: list[dict] = []
    numeric_fields: Counter[str] = Counter()
    for record in rows:
        for key, raw in record.payload.items():
            if isinstance(raw, (int, float)) and not isinstance(raw, bool):
                numeric_fields[key] += 1
        raw_value = record.conformity_percent if field == "conformity_percent" else record.payload.get(field)
        try:
            value = float(raw_value)
            if math.isfinite(value):
                points.append({"record_code": record.record_code, "date": record.created_at, "value": value})
        except (TypeError, ValueError):
            pass
    values = [point["value"] for point in points]
    mean = statistics.fmean(values) if values else None
    deviation = statistics.stdev(values) if len(values) > 1 else 0.0 if values else None
    ucl = mean + 3 * deviation if mean is not None and deviation is not None else None
    lcl = mean - 3 * deviation if mean is not None and deviation is not None else None
    for point in points:
        point["out_of_control"] = bool(ucl is not None and lcl is not None and (point["value"] > ucl or point["value"] < lcl))
    cp = None
    cpk = None
    if deviation and lower_spec is not None and upper_spec is not None:
        cp = (upper_spec - lower_spec) / (6 * deviation)
        cpk = min((upper_spec - mean) / (3 * deviation), (mean - lower_spec) / (3 * deviation))
    return {
        "field": field, "count": len(values),
        "mean": round(mean, 4) if mean is not None else None,
        "std_dev": round(deviation, 4) if deviation is not None else None,
        "min": round(min(values), 4) if values else None,
        "max": round(max(values), 4) if values else None,
        "lcl": round(lcl, 4) if lcl is not None else None,
        "ucl": round(ucl, 4) if ucl is not None else None,
        "cp": round(cp, 4) if cp is not None else None,
        "cpk": round(cpk, 4) if cpk is not None else None,
        "out_of_control": sum(point["out_of_control"] for point in points),
        "points": points,
        "available_fields": [{"field": key, "count": count} for key, count in numeric_fields.most_common()],
    }


@router.patch("/notifications/actions/read-all", tags=["Notificaciones"])
def read_all_notifications(db: Session = Depends(get_db), actor: User = Depends(current_user)):
    items = db.scalars(select(Notification).where(or_(Notification.user_id == actor.id, Notification.user_id.is_(None)))).all()
    existing_global_reads = set(db.scalars(select(NotificationRead.notification_id).where(NotificationRead.user_id == actor.id)).all())
    updated = 0
    for item in items:
        if item.user_id is None and item.id not in existing_global_reads:
            db.add(NotificationRead(notification_id=item.id, user_id=actor.id)); updated += 1
        elif item.user_id == actor.id and not item.is_read:
            item.is_read = True; updated += 1
    db.commit()
    return {"updated": updated}
