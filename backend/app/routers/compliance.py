from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Asset, ComplianceReview, AuditEvent
from app.auth import get_current_user, require_reviewer
from app.schemas import ComplianceDecisionRequest

router = APIRouter(prefix="/api/v1/compliance", tags=["compliance"])


@router.get("/queue")
def get_queue(current_user=Depends(require_reviewer), db: Session = Depends(get_db)):
    assets = db.query(Asset).filter(
        Asset.status.in_(["submitted_for_compliance", "awaiting_contract_approval"])
    ).order_by(Asset.updated_at.asc()).all()
    return [
        {
            "id": a.id,
            "ref_number": a.ref_number,
            "name": a.name,
            "company_name": a.company_name,
            "status": a.status,
            "firm_name": a.firm.name if a.firm else None,
            "submitted_at": a.updated_at,
        }
        for a in assets
    ]


@router.get("/{asset_id}")
def get_review_detail(asset_id: str, current_user=Depends(require_reviewer),
                      db: Session = Depends(get_db)):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(404, "Asset not found")

    from app.models import ExtractionRun, ExtractedField, FieldOverride
    run = (db.query(ExtractionRun)
           .filter(ExtractionRun.asset_id == asset_id, ExtractionRun.status == "completed")
           .order_by(ExtractionRun.created_at.desc()).first())

    fields = []
    if run:
        raw_fields = db.query(ExtractedField).filter(
            ExtractedField.extraction_run_id == run.id
        ).all()
        for f in raw_fields:
            overrides = db.query(FieldOverride).filter(
                FieldOverride.extracted_field_id == f.id
            ).all()
            fields.append({
                "id": f.id,
                "field_key": f.field_key,
                "field_label": f.field_label,
                "section": f.section,
                "ai_value": f.ai_value,
                "display_value": f.display_value,
                "confidence": f.confidence,
                "confidence_tier": f.confidence_tier,
                "source_quote": f.source_quote,
                "requires_review": f.requires_review,
                "confirmed_at": f.confirmed_at,
                "overrides": [{"previous": o.previous_value, "new": o.new_value,
                               "created_at": o.created_at} for o in overrides],
            })

    reviews = db.query(ComplianceReview).filter(
        ComplianceReview.asset_id == asset_id
    ).order_by(ComplianceReview.created_at.desc()).all()

    return {
        "asset": {
            "id": asset.id,
            "ref_number": asset.ref_number,
            "name": asset.name,
            "company_name": asset.company_name,
            "status": asset.status,
            "est_valuation": asset.est_valuation,
            "firm_name": asset.firm.name if asset.firm else None,
        },
        "fields": fields,
        "reviews": [{"decision": r.decision, "review_type": r.review_type,
                     "comments": r.comments, "created_at": r.created_at} for r in reviews],
    }


@router.post("/{asset_id}/decision")
def submit_decision(asset_id: str, payload: ComplianceDecisionRequest,
                    current_user=Depends(require_reviewer), db: Session = Depends(get_db)):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(404, "Asset not found")

    valid = {"approved", "changes_requested", "rejected"}
    if payload.decision not in valid:
        raise HTTPException(400, f"Decision must be one of: {valid}")

    review = ComplianceReview(
        asset_id=asset_id,
        reviewer_id=current_user.id,
        review_type=payload.review_type,
        decision=payload.decision,
        comments=payload.comments,
    )
    db.add(review)

    if payload.decision == "approved":
        if payload.review_type == "extraction_review":
            asset.status = "compliance_approved"
            # Auto-trigger contract generation
            _trigger_contract_generation(asset_id, db)
        else:
            # contract_review — reviewer approved, check if intermediary also approved
            from app.models import GeneratedContract
            contract = (db.query(GeneratedContract)
                        .filter(GeneratedContract.asset_id == asset_id)
                        .order_by(GeneratedContract.generated_at.desc()).first())
            if contract:
                contract.reviewer_approved = True
                contract.reviewer_approved_at = datetime.utcnow()
                if contract.intermediary_approved:
                    asset.status = "contract_approved"
                    _trigger_deployment(asset_id, db)
    elif payload.decision == "changes_requested":
        asset.status = "changes_requested"
    elif payload.decision == "rejected":
        asset.status = "rejected"

    asset.updated_at = datetime.utcnow()
    db.add(AuditEvent(
        asset_id=asset_id,
        actor_id=current_user.id,
        event_type="compliance_decision",
        payload={"decision": payload.decision, "review_type": payload.review_type,
                 "comments": payload.comments},
    ))
    db.commit()
    return {"message": f"Decision '{payload.decision}' recorded"}


def _trigger_contract_generation(asset_id: str, db: Session):
    import threading
    from services.contract_gen import run_contract_generation
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    asset.status = "contract_generating"
    asset.updated_at = datetime.utcnow()
    db.commit()
    t = threading.Thread(target=run_contract_generation, args=(asset_id,), daemon=True)
    t.start()


def _trigger_deployment(asset_id: str, db: Session):
    import threading
    from services.deploy import run_deployment
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    asset.status = "deploying"
    asset.updated_at = datetime.utcnow()
    db.commit()
    t = threading.Thread(target=run_deployment, args=(asset_id,), daemon=True)
    t.start()
