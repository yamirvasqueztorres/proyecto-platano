import enum
from datetime import date, datetime, timezone
from sqlalchemy import Boolean, Date, DateTime, Enum, Float, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Role(str, enum.Enum):
    ADMINISTRADOR = "Administrador"
    COORDINADOR = "Coordinador"
    INSPECTOR = "Inspector"
    REVISOR = "Revisor"


class RecordStatus(str, enum.Enum):
    BORRADOR = "Borrador"
    PENDIENTE = "Pendiente"
    APROBADO = "Aprobado"
    OBSERVADO = "Observado"
    RECHAZADO = "Rechazado"


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(160))
    role: Mapped[Role] = mapped_column(Enum(Role))
    hashed_password: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Supplier(Base):
    __tablename__ = "suppliers"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(180), index=True)
    origin: Mapped[str] = mapped_column(String(180))
    certification_type: Mapped[str] = mapped_column(String(40), default="Convencional")
    observations: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Carrier(Base):
    __tablename__ = "carriers"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(180), index=True)
    document: Mapped[str | None] = mapped_column(String(30), nullable=True)
    plate: Mapped[str | None] = mapped_column(String(20), index=True, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class QualityRecord(Base):
    __tablename__ = "quality_records"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    record_code: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    module_code: Mapped[str] = mapped_column(String(20), index=True)
    supplier_id: Mapped[int | None] = mapped_column(ForeignKey("suppliers.id"), nullable=True, index=True)
    carrier_id: Mapped[int | None] = mapped_column(ForeignKey("carriers.id"), nullable=True)
    lot: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    certification_type: Mapped[str] = mapped_column(String(40), default="Convencional")
    status: Mapped[RecordStatus] = mapped_column(Enum(RecordStatus), default=RecordStatus.PENDIENTE, index=True)
    payload: Mapped[dict] = mapped_column(JSON)
    conformity_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    alerts: Mapped[list] = mapped_column(JSON, default=list)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    created_by: Mapped[User] = relationship()
    supplier: Mapped[Supplier | None] = relationship()
    validations: Mapped[list["Validation"]] = relationship(back_populates="record", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_quality_records_module_created", "module_code", "created_at"),
        Index("idx_quality_records_status_created", "status", "created_at"),
    )


class Validation(Base):
    __tablename__ = "validations"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    record_id: Mapped[int] = mapped_column(ForeignKey("quality_records.id"), index=True)
    decision: Mapped[str] = mapped_column(String(20))
    observations: Mapped[str | None] = mapped_column(Text, nullable=True)
    validation_code: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    signature_hash: Mapped[str] = mapped_column(String(128))
    validated_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    validated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    record: Mapped[QualityRecord] = relationship(back_populates="validations")
    validated_by: Mapped[User] = relationship()


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(160))
    message: Mapped[str] = mapped_column(Text)
    level: Mapped[str] = mapped_column(String(20), default="info")
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class NotificationRead(Base):
    __tablename__ = "notification_reads"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    notification_id: Mapped[int] = mapped_column(ForeignKey("notifications.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    read_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (UniqueConstraint("notification_id", "user_id", name="uq_notification_read_user"),)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(100), index=True)
    entity: Mapped[str] = mapped_column(String(80), index=True)
    entity_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    ip_address: Mapped[str | None] = mapped_column(String(60), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class QualityParameter(Base):
    __tablename__ = "quality_parameters"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(80), unique=True)
    value: Mapped[float] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String(20))
    description: Mapped[str] = mapped_column(String(220))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class RolePermission(Base):
    __tablename__ = "role_permissions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    role: Mapped[Role] = mapped_column(Enum(Role), index=True)
    permission: Mapped[str] = mapped_column(String(80), index=True)
    allowed: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    __table_args__ = (UniqueConstraint("role", "permission", name="uq_role_permission"),)


class CatalogItem(Base):
    __tablename__ = "catalog_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    catalog_type: Mapped[str] = mapped_column(String(60), index=True)
    code: Mapped[str] = mapped_column(String(40), index=True)
    name: Mapped[str] = mapped_column(String(180), index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    extra_data: Mapped[dict] = mapped_column(JSON, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    __table_args__ = (UniqueConstraint("catalog_type", "code", name="uq_catalog_type_code"),)


class ProductionLot(Base):
    __tablename__ = "production_lots"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    supplier_id: Mapped[int | None] = mapped_column(ForeignKey("suppliers.id"), nullable=True, index=True)
    product: Mapped[str] = mapped_column(String(160), default="Plátano verde")
    certification_type: Mapped[str] = mapped_column(String(40), default="Convencional")
    harvest_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    quantity_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    current_stage: Mapped[str] = mapped_column(String(80), default="Recepción", index=True)
    status: Mapped[str] = mapped_column(String(30), default="Activo", index=True)
    observations: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    supplier: Mapped[Supplier | None] = relationship()
    events: Mapped[list["LotEvent"]] = relationship(back_populates="lot", cascade="all, delete-orphan")


class LotEvent(Base):
    __tablename__ = "lot_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lot_id: Mapped[int] = mapped_column(ForeignKey("production_lots.id", ondelete="CASCADE"), index=True)
    stage: Mapped[str] = mapped_column(String(80), index=True)
    event_type: Mapped[str] = mapped_column(String(80), default="Avance")
    description: Mapped[str] = mapped_column(Text)
    record_code: Mapped[str | None] = mapped_column(String(30), nullable=True, index=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    lot: Mapped[ProductionLot] = relationship(back_populates="events")
    created_by: Mapped[User] = relationship()


class NonConformity(Base):
    __tablename__ = "non_conformities"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    record_id: Mapped[int | None] = mapped_column(ForeignKey("quality_records.id"), nullable=True, index=True)
    module_code: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    lot_code: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    category: Mapped[str] = mapped_column(String(100), index=True)
    severity: Mapped[str] = mapped_column(String(20), default="Mayor", index=True)
    description: Mapped[str] = mapped_column(Text)
    quantity: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="Abierta", index=True)
    root_cause: Mapped[str | None] = mapped_column(Text, nullable=True)
    disposition: Mapped[str | None] = mapped_column(Text, nullable=True)
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    detected_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    detected_by: Mapped[User] = relationship()


class CorrectiveAction(Base):
    __tablename__ = "corrective_actions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    nonconformity_id: Mapped[int | None] = mapped_column(ForeignKey("non_conformities.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(180))
    plan: Mapped[str] = mapped_column(Text)
    do_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    check_result: Mapped[str | None] = mapped_column(Text, nullable=True)
    act_standardization: Mapped[str | None] = mapped_column(Text, nullable=True)
    responsible_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    due_date: Mapped[date] = mapped_column(Date, index=True)
    phase: Mapped[str] = mapped_column(String(30), default="Planificar", index=True)
    status: Mapped[str] = mapped_column(String(30), default="Pendiente", index=True)
    effectiveness_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    nonconformity: Mapped[NonConformity | None] = relationship()
    responsible: Mapped[User] = relationship(foreign_keys=[responsible_id])
    created_by: Mapped[User] = relationship(foreign_keys=[created_by_id])
