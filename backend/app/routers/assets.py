import os, hashlib, threading
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Asset, PdfUpload, ExtractionRun, AuditEvent
from app.auth import get_current_user
from app.schemas import AssetCreate, AssetOut, AssetStatusOut
from app.config import get_settings

settings = get_settings()
router = APIRouter(prefix="/api/v1/assets", tags=["assets"])

STATUS_ORDER = [
    "draft", "pdf_processing", "awaiting_intermediary_review",
    "submitted_for_compliance", "changes_requested", "compliance_approved",
    "contract_generating", "awaiting_contract_approval", "contract_approved",
    "deploying", "deployed", "rejected", "withdrawn"
]


def _ref_number(db: Session) -> str:
    count = db.query(Asset).count() + 1
    return f"EQ-{datetime.utcnow().year}-{count:04d}"


def _audit(db, asset_id, actor_id, event_type, payload):
    db.add(AuditEvent(asset_id=asset_id, actor_id=actor_id,
                      event_type=event_type, payload=payload))
    db.commit()


@router.get("", response_model=list[AssetOut])
def list_assets(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == "compliance_reviewer":
        assets = db.query(Asset).order_by(Asset.updated_at.desc()).all()
    else:
        assets = db.query(Asset).filter(
            Asset.firm_id == current_user.firm_id
        ).order_by(Asset.updated_at.desc()).all()
    result = []
    for a in assets:
        out = AssetOut.model_validate(a)
        out.firm_name = a.firm.name if a.firm else None
        result.append(out)
    return result


@router.post("", response_model=AssetOut)
def create_asset(payload: AssetCreate, current_user=Depends(get_current_user),
                 db: Session = Depends(get_db)):
    if current_user.firm.kyb_status != "verified":
        raise HTTPException(status_code=403, detail="Firm KYB verification required")
    asset = Asset(
        firm_id=current_user.firm_id,
        created_by=current_user.id,
        ref_number=_ref_number(db),
        name=payload.name,
        company_name=payload.company_name,
        est_valuation=payload.est_valuation,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    _audit(db, asset.id, current_user.id, "asset_created",
           {"name": asset.name, "ref": asset.ref_number})
    out = AssetOut.model_validate(asset)
    out.firm_name = asset.firm.name
    return out


@router.get("/{asset_id}", response_model=AssetOut)
def get_asset(asset_id: str, current_user=Depends(get_current_user),
              db: Session = Depends(get_db)):
    asset = _get_asset(asset_id, current_user, db)
    out = AssetOut.model_validate(asset)
    out.firm_name = asset.firm.name if asset.firm else None
    return out


@router.get("/{asset_id}/status", response_model=AssetStatusOut)
def get_status(asset_id: str, current_user=Depends(get_current_user),
               db: Session = Depends(get_db)):
    asset = _get_asset(asset_id, current_user, db)
    return AssetStatusOut(id=asset.id, status=asset.status, updated_at=asset.updated_at)


@router.post("/{asset_id}/upload")
def upload_pdf(asset_id: str, file: UploadFile = File(...),
               current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    asset = _get_asset(asset_id, current_user, db)
    if asset.status not in ("draft", "changes_requested"):
        raise HTTPException(400, "Cannot upload PDF in current status")
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files accepted")

    content = file.file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 20MB)")

    sha256 = hashlib.sha256(content).hexdigest()
    os.makedirs(settings.upload_dir, exist_ok=True)
    stored_path = os.path.join(settings.upload_dir, f"{asset_id}_{sha256[:8]}.pdf")
    with open(stored_path, "wb") as f:
        f.write(content)

    upload = PdfUpload(
        asset_id=asset_id,
        original_name=file.filename,
        stored_path=stored_path,
        file_size_bytes=len(content),
        sha256_hash=sha256,
        uploaded_by=current_user.id,
    )
    db.add(upload)
    db.flush()  # assign upload.id before referencing it

    run = ExtractionRun(asset_id=asset_id, pdf_upload_id=upload.id,
                        status="queued", claude_model="claude-sonnet-4-6")
    db.add(run)

    asset.status = "pdf_processing"
    asset.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(upload)
    db.refresh(run)

    _audit(db, asset_id, current_user.id, "pdf_uploaded",
           {"filename": file.filename, "size": len(content)})

    # Run extraction in background thread
    from services.extraction import run_extraction
    t = threading.Thread(target=run_extraction, args=(run.id, stored_path, asset_id), daemon=True)
    t.start()

    return {"message": "Upload received, extraction started", "run_id": run.id}


@router.post("/{asset_id}/submit")
def submit_for_compliance(asset_id: str, current_user=Depends(get_current_user),
                          db: Session = Depends(get_db)):
    asset = _get_asset(asset_id, current_user, db)
    if asset.status not in ("awaiting_intermediary_review", "changes_requested"):
        raise HTTPException(400, f"Cannot submit from status: {asset.status}")

    # Check all low-confidence fields are confirmed
    latest_run = (db.query(ExtractionRun)
                  .filter(ExtractionRun.asset_id == asset_id, ExtractionRun.status == "completed")
                  .order_by(ExtractionRun.created_at.desc()).first())
    if latest_run:
        from app.models import ExtractedField
        unconfirmed = db.query(ExtractedField).filter(
            ExtractedField.extraction_run_id == latest_run.id,
            ExtractedField.requires_review == True,
            ExtractedField.confirmed_at == None
        ).all()
        if unconfirmed:
            raise HTTPException(422, {
                "detail": "Unconfirmed low-confidence fields",
                "fields": [f.field_label for f in unconfirmed]
            })

    asset.status = "submitted_for_compliance"
    asset.updated_at = datetime.utcnow()
    db.commit()
    _audit(db, asset_id, current_user.id, "submitted_for_compliance", {})
    return {"message": "Submitted for compliance review"}


@router.delete("/{asset_id}")
def withdraw_asset(asset_id: str, current_user=Depends(get_current_user),
                   db: Session = Depends(get_db)):
    asset = _get_asset(asset_id, current_user, db)
    if asset.status in ("deployed", "rejected", "withdrawn"):
        raise HTTPException(400, "Cannot withdraw asset in current status")
    asset.status = "withdrawn"
    asset.updated_at = datetime.utcnow()
    db.commit()
    _audit(db, asset_id, current_user.id, "asset_withdrawn", {})
    return {"message": "Asset withdrawn"}


def _get_asset(asset_id: str, current_user, db: Session) -> Asset:
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(404, "Asset not found")
    if current_user.role != "compliance_reviewer" and asset.firm_id != current_user.firm_id:
        raise HTTPException(403, "Access denied")
    return asset
