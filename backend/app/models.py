import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base


def new_uuid():
    return str(uuid.uuid4())


def now():
    return datetime.utcnow()


class Firm(Base):
    __tablename__ = "firms"
    id = Column(String, primary_key=True, default=new_uuid)
    name = Column(String, nullable=False)
    kyb_status = Column(String, default="verified")  # pending/verified/rejected
    kyb_verified_at = Column(DateTime)
    created_at = Column(DateTime, default=now)
    users = relationship("User", back_populates="firm")
    assets = relationship("Asset", back_populates="firm")


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=new_uuid)
    firm_id = Column(String, ForeignKey("firms.id"), nullable=False)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)  # intermediary / compliance_reviewer
    full_name = Column(String)
    created_at = Column(DateTime, default=now)
    firm = relationship("Firm", back_populates="users")


class Asset(Base):
    __tablename__ = "assets"
    id = Column(String, primary_key=True, default=new_uuid)
    firm_id = Column(String, ForeignKey("firms.id"), nullable=False)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    ref_number = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    company_name = Column(String, nullable=False)
    asset_type = Column(String, default="equity")
    jurisdiction = Column(String, default="us")
    est_valuation = Column(Integer)  # USD cents
    status = Column(String, default="draft")
    created_at = Column(DateTime, default=now)
    updated_at = Column(DateTime, default=now, onupdate=now)
    firm = relationship("Firm", back_populates="assets")
    pdf_uploads = relationship("PdfUpload", back_populates="asset")
    extraction_runs = relationship("ExtractionRun", back_populates="asset")
    compliance_reviews = relationship("ComplianceReview", back_populates="asset")
    generated_contracts = relationship("GeneratedContract", back_populates="asset")
    deployments = relationship("Deployment", back_populates="asset")
    audit_events = relationship("AuditEvent", back_populates="asset")


class PdfUpload(Base):
    __tablename__ = "pdf_uploads"
    id = Column(String, primary_key=True, default=new_uuid)
    asset_id = Column(String, ForeignKey("assets.id"), nullable=False)
    original_name = Column(String, nullable=False)
    stored_path = Column(String, nullable=False)
    file_size_bytes = Column(Integer)
    sha256_hash = Column(String)
    uploaded_by = Column(String, ForeignKey("users.id"), nullable=False)
    uploaded_at = Column(DateTime, default=now)
    asset = relationship("Asset", back_populates="pdf_uploads")


class ExtractionRun(Base):
    __tablename__ = "extraction_runs"
    id = Column(String, primary_key=True, default=new_uuid)
    asset_id = Column(String, ForeignKey("assets.id"), nullable=False)
    pdf_upload_id = Column(String, ForeignKey("pdf_uploads.id"), nullable=False)
    status = Column(String, default="queued")  # queued/running/completed/failed
    claude_model = Column(String)
    prompt_tokens = Column(Integer)
    completion_tokens = Column(Integer)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    error_message = Column(Text)
    created_at = Column(DateTime, default=now)
    asset = relationship("Asset", back_populates="extraction_runs")
    extracted_fields = relationship("ExtractedField", back_populates="extraction_run")


class ExtractedField(Base):
    __tablename__ = "extracted_fields"
    id = Column(String, primary_key=True, default=new_uuid)
    extraction_run_id = Column(String, ForeignKey("extraction_runs.id"), nullable=False)
    field_key = Column(String, nullable=False)
    field_label = Column(String, nullable=False)
    section = Column(String, nullable=False)
    ai_value = Column(Text)
    display_value = Column(Text)  # current value (after overrides)
    confidence = Column(Float, default=0.0)
    confidence_tier = Column(String, default="low")  # high/medium/low
    source_page = Column(Integer)
    source_quote = Column(Text)
    requires_review = Column(Boolean, default=False)
    confirmed_at = Column(DateTime)
    confirmed_by = Column(String, ForeignKey("users.id"))
    extraction_run = relationship("ExtractionRun", back_populates="extracted_fields")
    overrides = relationship("FieldOverride", back_populates="field")


class FieldOverride(Base):
    __tablename__ = "field_overrides"
    id = Column(String, primary_key=True, default=new_uuid)
    extracted_field_id = Column(String, ForeignKey("extracted_fields.id"), nullable=False)
    overridden_by = Column(String, ForeignKey("users.id"), nullable=False)
    previous_value = Column(Text)
    new_value = Column(Text, nullable=False)
    reason = Column(Text)
    created_at = Column(DateTime, default=now)
    field = relationship("ExtractedField", back_populates="overrides")


class ComplianceReview(Base):
    __tablename__ = "compliance_reviews"
    id = Column(String, primary_key=True, default=new_uuid)
    asset_id = Column(String, ForeignKey("assets.id"), nullable=False)
    reviewer_id = Column(String, ForeignKey("users.id"), nullable=False)
    review_type = Column(String, nullable=False)  # extraction_review/contract_review
    decision = Column(String, nullable=False)  # approved/changes_requested/rejected
    comments = Column(JSON)
    created_at = Column(DateTime, default=now)
    asset = relationship("Asset", back_populates="compliance_reviews")


class GeneratedContract(Base):
    __tablename__ = "generated_contracts"
    id = Column(String, primary_key=True, default=new_uuid)
    asset_id = Column(String, ForeignKey("assets.id"), nullable=False)
    template_used = Column(String, nullable=False)
    solidity_source = Column(Text, nullable=False)
    abi = Column(JSON)
    bytecode = Column(Text)
    human_summary = Column(Text)
    parameter_snapshot = Column(JSON)
    intermediary_approved = Column(Boolean, default=False)
    intermediary_approved_at = Column(DateTime)
    reviewer_approved = Column(Boolean, default=False)
    reviewer_approved_at = Column(DateTime)
    generated_at = Column(DateTime, default=now)
    asset = relationship("Asset", back_populates="generated_contracts")
    deployments = relationship("Deployment", back_populates="contract")


class Deployment(Base):
    __tablename__ = "deployments"
    id = Column(String, primary_key=True, default=new_uuid)
    asset_id = Column(String, ForeignKey("assets.id"), nullable=False)
    contract_id = Column(String, ForeignKey("generated_contracts.id"), nullable=False)
    network = Column(String, default="sepolia")
    contract_address = Column(String)
    tx_hash = Column(String)
    block_number = Column(Integer)
    gas_used = Column(Integer)
    status = Column(String, default="pending")  # pending/confirmed/failed
    attempt_count = Column(Integer, default=1)
    error_message = Column(Text)
    deployed_at = Column(DateTime, default=now)
    confirmed_at = Column(DateTime)
    asset = relationship("Asset", back_populates="deployments")
    contract = relationship("GeneratedContract", back_populates="deployments")


class AuditEvent(Base):
    __tablename__ = "audit_events"
    id = Column(String, primary_key=True, default=new_uuid)
    asset_id = Column(String, ForeignKey("assets.id"))
    actor_id = Column(String, ForeignKey("users.id"))
    event_type = Column(String, nullable=False)
    payload = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=now)
    asset = relationship("Asset", back_populates="audit_events")
