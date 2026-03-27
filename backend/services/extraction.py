"""Background extraction task — runs in a separate thread."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from datetime import datetime
from app.database import SessionLocal
from app.models import ExtractionRun, ExtractedField, Asset, AuditEvent
from services.pdf_service import extract_text
from services.ai_service import extract_fields, FIELD_LABELS

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

REQUIRED_FIELDS = {"pre_money_valuation", "investment_amount",
                   "liquidation_preference_multiple", "offering_type"}


def assign_tier(confidence: float) -> str:
    if confidence >= 0.85:
        return "high"
    if confidence >= 0.60:
        return "medium"
    return "low"


def requires_review_check(field_key: str, confidence: float, source_quote: str) -> bool:
    if field_key in REQUIRED_FIELDS and confidence < 0.85:
        return True
    if confidence < 0.60:
        return True
    if not source_quote:
        return True
    low_confidence_phrases = ["see schedule", "as defined in", "to be determined", "tbd"]
    if source_quote and any(p in source_quote.lower() for p in low_confidence_phrases):
        return True
    return False


def run_extraction(run_id: str, pdf_path: str, asset_id: str):
    db = SessionLocal()
    try:
        run = db.query(ExtractionRun).filter(ExtractionRun.id == run_id).first()
        if not run:
            return

        run.status = "running"
        run.started_at = datetime.utcnow()
        db.commit()

        # Step 1: Extract PDF text
        pdf_result = extract_text(pdf_path)
        if pdf_result.get("is_image_pdf"):
            run.status = "failed"
            run.error_message = "Please upload a text-based PDF. Scanned images are not supported."
            run.completed_at = datetime.utcnow()
            db.commit()
            asset = db.query(Asset).filter(Asset.id == asset_id).first()
            if asset:
                asset.status = "draft"
                asset.updated_at = datetime.utcnow()
                db.commit()
            return

        if pdf_result.get("error"):
            run.status = "failed"
            run.error_message = f"PDF parsing error: {pdf_result['error']}"
            run.completed_at = datetime.utcnow()
            db.commit()
            return

        full_text = pdf_result["full_text"]

        # Step 2: Call Claude API
        extraction_result = extract_fields(full_text)
        run.claude_model = extraction_result["model"]
        run.prompt_tokens = extraction_result["prompt_tokens"]
        run.completion_tokens = extraction_result["completion_tokens"]

        raw_fields = extraction_result["fields"]

        # Step 3: Persist extracted fields
        for field_key, field_data in raw_fields.items():
            if not isinstance(field_data, dict):
                continue
            confidence = float(field_data.get("confidence", 0))
            source_quote = field_data.get("source_quote")
            value = field_data.get("value")
            if value is not None:
                value = str(value)

            tier = assign_tier(confidence)
            needs_review = requires_review_check(field_key, confidence, source_quote)

            ef = ExtractedField(
                extraction_run_id=run_id,
                field_key=field_key,
                field_label=FIELD_LABELS.get(field_key, field_key.replace("_", " ").title()),
                section=FIELD_SECTIONS.get(field_key, "Other"),
                ai_value=value,
                display_value=value,
                confidence=confidence,
                confidence_tier=tier,
                source_page=field_data.get("source_page"),
                source_quote=source_quote,
                requires_review=needs_review,
            )
            db.add(ef)

        run.status = "completed"
        run.completed_at = datetime.utcnow()

        asset = db.query(Asset).filter(Asset.id == asset_id).first()
        if asset:
            asset.status = "awaiting_intermediary_review"
            asset.updated_at = datetime.utcnow()

        db.add(AuditEvent(
            asset_id=asset_id,
            actor_id=None,
            event_type="extraction_completed",
            payload={"run_id": run_id, "field_count": len(raw_fields)},
        ))
        db.commit()

    except Exception as e:
        print(f"[EXTRACTION ERROR] run_id={run_id}: {type(e).__name__}: {e}", flush=True)
        import traceback; traceback.print_exc()
        db.rollback()
        try:
            run = db.query(ExtractionRun).filter(ExtractionRun.id == run_id).first()
            if run:
                run.status = "failed"
                run.error_message = str(e)
                run.completed_at = datetime.utcnow()
            asset = db.query(Asset).filter(Asset.id == asset_id).first()
            if asset:
                asset.status = "draft"
                asset.updated_at = datetime.utcnow()
            db.commit()
        except Exception:
            pass
    finally:
        db.close()
