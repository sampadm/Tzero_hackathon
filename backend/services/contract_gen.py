"""Background contract generation task."""
import sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from datetime import datetime
from jinja2 import Environment, FileSystemLoader
from app.database import SessionLocal
from app.models import Asset, ExtractionRun, ExtractedField, GeneratedContract, AuditEvent
from services.ai_service import generate_contract_summary

TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "..", "templates")

# Pre-compiled ABI for TzeroSecurityToken (matches the Solidity template)
TOKEN_ABI = [
    {"inputs": [{"name": "_name","type": "string"},{"name": "_symbol","type": "string"},
                {"name": "_preMoneyValuation","type": "uint256"},{"name": "_lockUpMonths","type": "uint256"},
                {"name": "_requiresAccredited","type": "bool"},{"name": "_owner","type": "address"}],
     "stateMutability": "nonpayable","type": "constructor"},
    {"inputs": [{"name": "account","type": "address"}],"name": "whitelist","outputs": [],"stateMutability": "nonpayable","type": "function"},
    {"inputs": [{"name": "to","type": "address"},{"name": "amount","type": "uint256"}],"name": "mint","outputs": [],"stateMutability": "nonpayable","type": "function"},
    {"inputs": [],"name": "lockUpEnd","outputs": [{"type": "uint256"}],"stateMutability": "view","type": "function"},
    {"inputs": [],"name": "preMoneyValuation","outputs": [{"type": "uint256"}],"stateMutability": "view","type": "function"},
    {"inputs": [],"name": "requiresAccreditedInvestors","outputs": [{"type": "bool"}],"stateMutability": "view","type": "function"},
    {"inputs": [{"name": "account","type": "address"}],"name": "balanceOf","outputs": [{"type": "uint256"}],"stateMutability": "view","type": "function"},
    {"inputs": [],"name": "name","outputs": [{"type": "string"}],"stateMutability": "view","type": "function"},
    {"inputs": [],"name": "symbol","outputs": [{"type": "string"}],"stateMutability": "view","type": "function"},
    {"inputs": [],"name": "totalSupply","outputs": [{"type": "uint256"}],"stateMutability": "view","type": "function"},
]


def run_contract_generation(asset_id: str):
    db = SessionLocal()
    try:
        asset = db.query(Asset).filter(Asset.id == asset_id).first()
        if not asset:
            return

        # Get latest completed extraction
        run = (db.query(ExtractionRun)
               .filter(ExtractionRun.asset_id == asset_id, ExtractionRun.status == "completed")
               .order_by(ExtractionRun.created_at.desc()).first())
        if not run:
            asset.status = "changes_requested"
            db.commit()
            return

        fields = db.query(ExtractedField).filter(
            ExtractedField.extraction_run_id == run.id
        ).all()
        field_map = {f.field_key: f.display_value or f.ai_value for f in fields}

        # Select template
        liq_multiple = field_map.get("liquidation_preference_multiple", "")
        conversion = field_map.get("conversion_ratio", "")
        if conversion and conversion not in ("null", "None", ""):
            template_name = "convertible_equity"
        elif liq_multiple and liq_multiple not in ("null", "None", "", "0"):
            template_name = "preferred_equity"
        else:
            template_name = "standard_equity"

        # Build parameters
        valuation_raw = field_map.get("pre_money_valuation", "0") or "0"
        valuation_cents = _parse_valuation(valuation_raw)

        lock_up_raw = field_map.get("lock_up_period_months", "12") or "12"
        try:
            lock_up_months = int(str(lock_up_raw).strip())
        except (ValueError, TypeError):
            lock_up_months = 12

        investor_type = (field_map.get("investor_type") or "").lower()
        requires_accredited = "accredited" in investor_type

        liq_mult_str = str(liq_multiple or "1").strip()
        try:
            liq_mult_float = float(liq_mult_str.replace("x", "").strip())
            liq_mult_int = int(liq_mult_float * 10)  # e.g. 1.5x → 15
        except (ValueError, TypeError):
            liq_mult_int = 10

        participation = (field_map.get("liquidation_participation") or "").lower()
        is_participating = "non" not in participation

        company_symbol = "".join(c for c in asset.company_name.upper() if c.isalpha())[:5] or "TKN"

        params = {
            "contract_name": f"TZ{company_symbol}Token",
            "asset_name": asset.name,
            "token_symbol": company_symbol,
            "pre_money_valuation_cents": valuation_cents,
            "lock_up_months": lock_up_months,
            "requires_accredited": str(requires_accredited).lower(),
            "liquidation_multiple": liq_mult_int,
            "is_participating": str(is_participating).lower(),
            "conversion_ratio": field_map.get("conversion_ratio", "1"),
            "dividend_rate": field_map.get("dividend_rate", "0"),
        }

        # Render template
        env = Environment(loader=FileSystemLoader(TEMPLATES_DIR))
        try:
            template = env.get_template(f"{template_name}.sol.j2")
        except Exception:
            template = env.get_template("preferred_equity.sol.j2")

        solidity_source = template.render(**params)

        # Generate human summary via Claude
        try:
            human_summary = generate_contract_summary(
                {**params, "template": template_name, **field_map},
                asset.name
            )
        except Exception as e:
            human_summary = f"Contract generated from {template_name} template. Parameters: {json.dumps(params, indent=2)}"

        contract = GeneratedContract(
            asset_id=asset_id,
            template_used=template_name,
            solidity_source=solidity_source,
            abi=TOKEN_ABI,
            bytecode=None,  # Will be set after Hardhat compile; deployment uses pre-compiled bytecode
            human_summary=human_summary,
            parameter_snapshot={**params, **field_map},
        )
        db.add(contract)

        asset.status = "awaiting_contract_approval"
        asset.updated_at = datetime.utcnow()

        db.add(AuditEvent(
            asset_id=asset_id,
            actor_id=None,
            event_type="contract_generated",
            payload={"template": template_name, "params": params},
        ))
        db.commit()

    except Exception as e:
        db.rollback()
        try:
            asset = db.query(Asset).filter(Asset.id == asset_id).first()
            if asset:
                asset.status = "compliance_approved"  # roll back so they can retry
                asset.updated_at = datetime.utcnow()
            db.add(AuditEvent(
                asset_id=asset_id,
                actor_id=None,
                event_type="contract_generation_failed",
                payload={"error": str(e)},
            ))
            db.commit()
        except Exception:
            pass
    finally:
        db.close()


def _parse_valuation(raw: str) -> int:
    """Parse valuation string like '$42,000,000' to cents."""
    if not raw or raw in ("null", "None"):
        return 0
    cleaned = str(raw).replace("$", "").replace(",", "").replace(" ", "").lower()
    try:
        multipliers = {"m": 1_000_000, "b": 1_000_000_000, "k": 1_000}
        for suffix, mult in multipliers.items():
            if cleaned.endswith(suffix):
                return int(float(cleaned[:-1]) * mult * 100)
        return int(float(cleaned) * 100)
    except (ValueError, TypeError):
        return 0
