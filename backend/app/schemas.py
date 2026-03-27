from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any
from datetime import datetime


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    role: str
    full_name: Optional[str]
    firm_name: Optional[str]


class AssetCreate(BaseModel):
    name: str
    company_name: str
    est_valuation: Optional[int] = None  # USD cents


class AssetOut(BaseModel):
    id: str
    ref_number: str
    name: str
    company_name: str
    asset_type: str
    jurisdiction: str
    est_valuation: Optional[int]
    status: str
    created_at: datetime
    updated_at: datetime
    firm_name: Optional[str] = None

    class Config:
        from_attributes = True


class AssetStatusOut(BaseModel):
    id: str
    status: str
    updated_at: datetime


class ExtractionFieldOut(BaseModel):
    id: str
    field_key: str
    field_label: str
    section: str
    ai_value: Optional[str]
    display_value: Optional[str]
    confidence: float
    confidence_tier: str
    source_quote: Optional[str]
    source_page: Optional[int]
    requires_review: bool
    confirmed_at: Optional[datetime]

    class Config:
        from_attributes = True


class FieldOverrideRequest(BaseModel):
    new_value: str
    reason: Optional[str] = None


class ComplianceDecisionRequest(BaseModel):
    decision: str  # approved / changes_requested / rejected
    review_type: str  # extraction_review / contract_review
    comments: Optional[List[dict]] = None


class ContractApproveRequest(BaseModel):
    role: str  # intermediary / reviewer


class DeploymentOut(BaseModel):
    id: str
    network: str
    contract_address: Optional[str]
    tx_hash: Optional[str]
    block_number: Optional[int]
    gas_used: Optional[int]
    status: str
    attempt_count: int
    deployed_at: datetime
    confirmed_at: Optional[datetime]
    error_message: Optional[str]

    class Config:
        from_attributes = True


class GeneratedContractOut(BaseModel):
    id: str
    template_used: str
    solidity_source: str
    human_summary: Optional[str]
    parameter_snapshot: Optional[dict]
    intermediary_approved: bool
    reviewer_approved: bool
    generated_at: datetime

    class Config:
        from_attributes = True


class AuditEventOut(BaseModel):
    id: str
    actor_id: Optional[str]
    event_type: str
    payload: dict
    created_at: datetime

    class Config:
        from_attributes = True
