"""Seed the database with demo firm and users."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal, init_db
from app.models import Firm, User
from app.auth import hash_password
from datetime import datetime

def seed():
    init_db()
    db = SessionLocal()

    # Check already seeded
    if db.query(User).filter(User.email == "intermediary@gunderson.com").first():
        print("[OK] Database already seeded")
        db.close()
        return

    # Create firm
    firm = Firm(name="Gunderson Dettmer LLP", kyb_status="verified",
                kyb_verified_at=datetime.utcnow())
    db.add(firm)
    db.flush()

    # Create intermediary user
    intermediary = User(
        firm_id=firm.id,
        email="intermediary@gunderson.com",
        password_hash=hash_password("localdev123"),
        role="intermediary",
        full_name="Alex Rivera",
    )
    db.add(intermediary)

    # Compliance reviewer has its own firm
    tzero_firm = Firm(name="Tzero", kyb_status="verified",
                      kyb_verified_at=datetime.utcnow())
    db.add(tzero_firm)
    db.flush()

    reviewer = User(
        firm_id=tzero_firm.id,
        email="reviewer@tzero.com",
        password_hash=hash_password("localdev123"),
        role="compliance_reviewer",
        full_name="Jordan Kim",
    )
    db.add(reviewer)
    db.commit()
    db.close()

    print("[OK] Seeded database")
    print("  intermediary@gunderson.com / localdev123")
    print("  reviewer@tzero.com / localdev123")


if __name__ == "__main__":
    seed()
