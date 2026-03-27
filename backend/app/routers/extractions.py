from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import ExtractionRun, ExtractedField, FieldOverride, AuditEvent, Asset
from app.auth import get_current_user
from app.schemas import ExtractionFieldOut, FieldOverrideRequest

router = APIRouter(prefix="/api/v1", tags=["extractions"])

FIELD_SECTIONS = {
    "pre_money_valuation": "Valuation & Economics",
    "investment_amount": "Valuation & Economics",
    "post_money_valuation": "Valuation & Economics",
    "option_pool_pct": "Valuation & Economics",
    "dividend_rate": "Valuation & Economics",
    "dividend_type": "Valuation & Economics",
    "liquidation_preference_multiple": "Liquidation & Conversion",
    "liquidation_participation": "Liquidation & Conversion",
    "conversion_ratio": "Liquidation & Conversion",
    "auto_conversion_threshold": "Liquidation & Conversion",
    "pro_rata_rights": "Investor Rights",
    "anti_dilution_type": "Investor Rights",
    "board_seats": "Investor Rights",
    "information_rights": "Investor Rights",
    "investor_type": "Compliance",
    "offering_type": "Compliance",
    "lock_up_period_months": "Compliance",
    "transfer_restriction_details": "Compliance",
}


@router.get("/assets/{asset_id}/extraction")
def get_extraction(asset_id: str, current_user=Depends(get_current_user),
                   db: Session = Depends(get_db)):
    asset = _get_asset(asset_id, current_user, db)
    run = (db.query(ExtractionRun)
           .filter(ExtractionRun.asset_id == asset_id)
           .order_by(ExtractionRun.created_at.desc()).first())
    if not run:
        return {"status": "no_extraction", "sections": {}}

    fields = db.query(ExtractedField).filter(
        ExtractedField.extraction_run_id == run.id
    ).all()

    sections = {}
    for f in fields:
        sec = f.section or FIELD_SECTIONS.get(f.field_key, "Other")
        if sec not in sections:
            sections[sec] = []
        sections[sec].append(ExtractionFieldOut.model_validate(f))

    # Build compliance flags
    compliance_flags = _detect_compliance_flags(fields)

    counts = {
        "total": len(fields),
        "high": sum(1 for f in fields if f.confidence_tier == "high"),
        "medium": sum(1 for f in fields if f.confidence_tier == "medium"),
        "needs_review": sum(1 for f in fields if f.requires_review and not f.confirmed_at),
        "overridden": sum(1 for f in fields if f.overrides),
    }

    return {
        "run_id": run.id,
        "status": run.status,
        "error_message": run.error_message,
        "sections": sections,
        "compliance_flags": compliance_flags,
        "counts": counts,
    }


@router.patch("/extractions/fields/{field_id}")
def override_field(field_id: str, payload: FieldOverrideRequest,
                   current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    field = db.query(ExtractedField).filter(ExtractedField.id == field_id).first()
    if not field:
        raise HTTPException(404, "Field not found")

    override = FieldOverride(
        extracted_field_id=field_id,
        overridden_by=current_user.id,
        previous_value=field.display_value,
        new_value=payload.new_value,
        reason=payload.reason,
    )
    db.add(override)

    field.display_value = payload.new_value
    if field.requires_review:
        field.confirmed_at = datetime.utcnow()
        field.confirmed_by = current_user.id

    # Log audit
    run = db.query(ExtractionRun).filter(ExtractionRun.id == field.extraction_run_id).first()
    db.add(AuditEvent(
        asset_id=run.asset_id if run else None,
        actor_id=current_user.id,
        event_type="field_override",
        payload={"field_key": field.field_key, "from": override.previous_value, "to": payload.new_value},
    ))
    db.commit()
    return {"message": "Field overridden", "field_id": field_id}


@router.post("/extractions/fields/{field_id}/confirm")
def confirm_field(field_id: str, current_user=Depends(get_current_user),
                  db: Session = Depends(get_db)):
    field = db.query(ExtractedField).filter(ExtractedField.id == field_id).first()
    if not field:
        raise HTTPException(404, "Field not found")
    field.confirmed_at = datetime.utcnow()
    field.confirmed_by = current_user.id
    db.commit()
    return {"message": "Field confirmed"}


def _get_asset(asset_id, current_user, db):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(404, "Asset not found")
    if current_user.role != "compliance_reviewer" and asset.firm_id != current_user.firm_id:
        raise HTTPException(403, "Access denied")
    return asset


def _detect_compliance_flags(fields):
    flags = []
    field_map = {f.field_key: f.display_value or f.ai_value for f in fields}

    investor_type = (field_map.get("investor_type") or "").lower()
    if "accredited" in investor_type:
        flags.append({
            "id": "reg_d_506b",
            "label": "Regulation D / Rule 506(b) — Accredited Investors Only",
            "description": "The AI detected an accredited investor restriction. The generated contract will enforce identity verification before any token transfer.",
            "auto_encoded": True,
        })

    lock_up = field_map.get("lock_up_period_months") or ""
    offering = (field_map.get("offering_type") or "").lower()
    if lock_up or "reg d" in offering or "506" in offering:
        flags.append({
            "id": "reg_d_lockup",
            "label": f"Transfer Restriction — {lock_up or '12'}-Month Lock-Up",
            "description": "Standard Reg D Rule 144 lock-up will be encoded as a time-lock in the contract transfer module.",
            "auto_encoded": True,
        })

    return flags
