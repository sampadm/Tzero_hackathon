from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Asset, GeneratedContract, AuditEvent
from app.auth import get_current_user
from app.schemas import GeneratedContractOut

router = APIRouter(prefix="/api/v1/assets", tags=["contracts"])


@router.get("/{asset_id}/contract", response_model=GeneratedContractOut)
def get_contract(asset_id: str, current_user=Depends(get_current_user),
                 db: Session = Depends(get_db)):
    _check_access(asset_id, current_user, db)
    contract = (db.query(GeneratedContract)
                .filter(GeneratedContract.asset_id == asset_id)
                .order_by(GeneratedContract.generated_at.desc()).first())
    if not contract:
        raise HTTPException(404, "Contract not yet generated")
    return contract


@router.post("/{asset_id}/contract/approve")
def approve_contract(asset_id: str, current_user=Depends(get_current_user),
                     db: Session = Depends(get_db)):
    asset = _check_access(asset_id, current_user, db)
    if asset.status != "awaiting_contract_approval":
        raise HTTPException(400, f"Cannot approve contract in status: {asset.status}")

    contract = (db.query(GeneratedContract)
                .filter(GeneratedContract.asset_id == asset_id)
                .order_by(GeneratedContract.generated_at.desc()).first())
    if not contract:
        raise HTTPException(404, "No contract found")

    if current_user.role == "intermediary":
        contract.intermediary_approved = True
        contract.intermediary_approved_at = datetime.utcnow()
    elif current_user.role == "compliance_reviewer":
        contract.reviewer_approved = True
        contract.reviewer_approved_at = datetime.utcnow()

    db.add(AuditEvent(
        asset_id=asset_id,
        actor_id=current_user.id,
        event_type="contract_approved",
        payload={"role": current_user.role},
    ))

    # If both approved, trigger deployment
    if contract.intermediary_approved and contract.reviewer_approved:
        asset.status = "contract_approved"
        asset.updated_at = datetime.utcnow()
        db.commit()
        import threading
        from services.deploy import run_deployment
        t = threading.Thread(target=run_deployment, args=(asset_id,), daemon=True)
        t.start()
    else:
        db.commit()

    return {"message": "Contract approval recorded",
            "both_approved": contract.intermediary_approved and contract.reviewer_approved}


def _check_access(asset_id, current_user, db):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(404, "Asset not found")
    if current_user.role != "compliance_reviewer" and asset.firm_id != current_user.firm_id:
        raise HTTPException(403, "Access denied")
    return asset
