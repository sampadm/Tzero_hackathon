from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Asset, Deployment, AuditEvent
from app.auth import get_current_user
from app.schemas import DeploymentOut

router = APIRouter(prefix="/api/v1/assets", tags=["deployments"])


@router.get("/{asset_id}/deployment", response_model=DeploymentOut)
def get_deployment(asset_id: str, current_user=Depends(get_current_user),
                   db: Session = Depends(get_db)):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(404, "Asset not found")
    if current_user.role != "compliance_reviewer" and asset.firm_id != current_user.firm_id:
        raise HTTPException(403, "Access denied")

    deployment = (db.query(Deployment)
                  .filter(Deployment.asset_id == asset_id)
                  .order_by(Deployment.deployed_at.desc()).first())
    if not deployment:
        raise HTTPException(404, "No deployment found")
    return deployment


@router.get("/{asset_id}/audit")
def get_audit_log(asset_id: str, current_user=Depends(get_current_user),
                  db: Session = Depends(get_db)):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(404, "Asset not found")
    if current_user.role != "compliance_reviewer" and asset.firm_id != current_user.firm_id:
        raise HTTPException(403, "Access denied")

    events = (db.query(AuditEvent)
              .filter(AuditEvent.asset_id == asset_id)
              .order_by(AuditEvent.created_at.asc()).all())
    return [{"event_type": e.event_type, "payload": e.payload,
             "actor_id": e.actor_id, "created_at": e.created_at} for e in events]
