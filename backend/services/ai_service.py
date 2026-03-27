import json
import anthropic
from app.config import get_settings

settings = get_settings()

FIELD_LABELS = {
    "pre_money_valuation": "Pre-Money Valuation",
    "investment_amount": "Investment Amount",
    "post_money_valuation": "Post-Money Valuation",
    "option_pool_pct": "Option Pool %",
    "dividend_rate": "Dividend Rate",
    "dividend_type": "Dividend Type",
    "liquidation_preference_multiple": "Liquidation Preference Multiple",
    "liquidation_participation": "Liquidation Participation",
    "conversion_ratio": "Conversion Ratio",
    "auto_conversion_threshold": "Auto-Conversion Threshold",
    "pro_rata_rights": "Pro-Rata Rights",
    "anti_dilution_type": "Anti-Dilution Type",
    "board_seats": "Board Seats",
    "information_rights": "Information Rights",
    "investor_type": "Investor Type",
    "offering_type": "Offering Type",
    "lock_up_period_months": "Lock-Up Period (months)",
    "transfer_restriction_details": "Transfer Restriction Details",
}

EXTRACTION_TOOL = {
    "name": "extract_term_sheet_fields",
    "description": "Extract all financial and legal parameters from an NVCA equity term sheet.",
    "input_schema": {
        "type": "object",
        "properties": {
            field_key: {
                "type": "object",
                "properties": {
                    "value": {"type": ["string", "null"], "description": "Extracted value, or null if not found"},
                    "confidence": {"type": "number", "description": "Confidence 0.0-1.0"},
                    "source_quote": {"type": ["string", "null"], "description": "Verbatim text from document"},
                    "source_page": {"type": ["integer", "null"]},
                    "notes": {"type": ["string", "null"], "description": "Reasoning for low confidence"},
                },
                "required": ["value", "confidence"],
            }
            for field_key in FIELD_LABELS
        },
        "required": list(FIELD_LABELS.keys()),
    },
}

SYSTEM_PROMPT = """You are a financial document analyst specializing in NVCA-format equity term sheets.
Extract the requested fields precisely as stated in the document.
- Set confidence 0.9+ only when the value is explicitly and unambiguously stated.
- Set confidence 0.5-0.89 when the value requires interpretation or inference.
- Set confidence below 0.5 when the field is ambiguous, missing, or references an external document.
- For source_quote, copy the exact sentence(s) from the document that support your extraction.
- Never fabricate values. If a field is absent, set value to null.
- For offering_type, use: reg_d_506b, reg_d_506c, reg_s, or other.
- For investor_type, use: accredited, qualified_institutional, or other.
- For liquidation_participation, use: participating or non_participating.
- For anti_dilution_type, use: broad_based_weighted_avg, narrow_based_weighted_avg, full_ratchet, or none."""


def extract_fields(pdf_text: str) -> dict:
    """Call Claude API to extract term sheet fields. Returns raw extraction dict."""
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        tools=[EXTRACTION_TOOL],
        tool_choice={"type": "tool", "name": "extract_term_sheet_fields"},
        messages=[{
            "role": "user",
            "content": f"Extract all financial parameters from this equity term sheet:\n\n{pdf_text[:15000]}"
        }],
    )

    usage = response.usage
    for block in response.content:
        if block.type == "tool_use":
            return {
                "fields": block.input,
                "prompt_tokens": usage.input_tokens,
                "completion_tokens": usage.output_tokens,
                "model": "claude-sonnet-4-6",
            }

    raise ValueError("Claude did not return tool_use response")


def generate_contract_summary(parameter_snapshot: dict, asset_name: str) -> str:
    """Generate a plain-English contract summary."""
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    params_text = json.dumps(parameter_snapshot, indent=2)
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": f"""Write a concise plain-English summary (3-5 paragraphs) of an ERC-3643 security token
smart contract for the asset "{asset_name}" with these parameters:

{params_text}

Explain what the contract does, the key financial terms, investor restrictions, and transfer rules.
Write for a non-technical legal professional audience."""
        }],
    )
    return response.content[0].text
