"""Create one demo user per role. Run with: python -m app.seed

Password comes from SEED_PASSWORD; if unset, a random one is generated and printed once.
"""

import os
import secrets

from sqlalchemy.orm import Session

from app.db import SessionLocal, create_all
from app.models import Role, User
from app.passwords import hash_password

SEED_USERS = [
    {"name": "Meera Joshi", "email": "architect@siteflow.local", "role": Role.architect},
    {"name": "Parvez", "email": "parvez@siteflow.local", "role": Role.team_lead, "is_principal": True},
    {"name": "Farhan Shaikh", "email": "engineer@siteflow.local", "role": Role.civil_engineer},
    {"name": "Office Coordinator", "email": "admin@siteflow.local", "role": Role.admin},
    {"name": "Rahul Deshpande", "email": "structural@siteflow.local", "role": Role.structural_consultant},
    {"name": "Sana Mirza", "email": "mep@siteflow.local", "role": Role.mep_consultant},
    {"name": "Aditi Rao", "email": "interiors@siteflow.local", "role": Role.interior_designer},
    {"name": "Vikram Mehta", "email": "accounts@siteflow.local", "role": Role.accounts},
    {"name": "Neha Patil", "email": "office@siteflow.local", "role": Role.office_coordinator},
]


def seed(db: Session, password: str) -> list[User]:
    users = []
    for spec in SEED_USERS:
        user = db.query(User).filter_by(email=spec["email"]).one_or_none()
        if user is None:
            user = User(**spec, password_hash=hash_password(password))
            db.add(user)
        users.append(user)
    db.commit()
    return users


def main() -> None:
    create_all()
    password = os.environ.get("SEED_PASSWORD")
    generated = password is None
    if generated:
        password = secrets.token_urlsafe(12)
    with SessionLocal() as db:
        users = seed(db, password)
    for u in users:
        print(f"{u.role.value:15} {u.email}")
    if generated:
        print(f"Password for new users (shown once): {password}")


if __name__ == "__main__":
    main()
