from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from core.database import get_db, User, Organization, AnalysisRecord
from api.auth import get_current_user, require_admin, hash_password
from datetime import datetime, timedelta
import uuid

router = APIRouter(prefix="/api/v1/org", tags=["organization"])


class InviteUserRequest(BaseModel):
    email: EmailStr
    full_name: str
    role: str = "member"
    password: str


@router.get("/dashboard")
def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Org-level usage dashboard."""
    org = db.query(Organization).filter(
        Organization.id == current_user.org_id
    ).first()

    total_analyses = db.query(AnalysisRecord).filter(
        AnalysisRecord.org_id == current_user.org_id
    ).count()

    completed = db.query(AnalysisRecord).filter(
        AnalysisRecord.org_id == current_user.org_id,
        AnalysisRecord.status == "complete",
    ).count()

    recent = db.query(AnalysisRecord).filter(
        AnalysisRecord.org_id == current_user.org_id,
    ).order_by(AnalysisRecord.created_at.desc()).limit(5).all()

    avg_score = db.query(AnalysisRecord).filter(
        AnalysisRecord.org_id == current_user.org_id,
        AnalysisRecord.overall_score.isnot(None),
    ).all()

    score_avg = (
        round(sum(r.overall_score for r in avg_score) / len(avg_score), 1)
        if avg_score else None
    )

    member_count = db.query(User).filter(
        User.org_id == current_user.org_id,
        User.is_active == True,
    ).count()

    return {
        "org": {
            "id": org.id,
            "name": org.name,
            "slug": org.slug,
            "created_at": org.created_at.isoformat(),
        },
        "usage": {
            "total_analyses": total_analyses,
            "completed_analyses": completed,
            "avg_epistemic_score": score_avg,
            "member_count": member_count,
        },
        "recent_analyses": [
            {
                "id": r.id,
                "job_id": r.job_id,
                "content_type": r.content_type,
                "content_preview": r.content_preview,
                "overall_score": r.overall_score,
                "status": r.status,
                "created_at": r.created_at.isoformat(),
            }
            for r in recent
        ],
    }


@router.get("/members")
def list_members(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all members of the current org."""
    members = db.query(User).filter(
        User.org_id == current_user.org_id,
        User.is_active == True,
    ).all()

    return {
        "org_id": current_user.org_id,
        "member_count": len(members),
        "members": [
            {
                "user_id": m.id,
                "email": m.email,
                "full_name": m.full_name,
                "role": m.role,
                "created_at": m.created_at.isoformat(),
            }
            for m in members
        ],
    }


@router.post("/members/invite")
def invite_member(
    request: InviteUserRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin only: invite a new member to the org."""
    if db.query(User).filter(User.email == request.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(
        email=request.email,
        hashed_password=hash_password(request.password),
        full_name=request.full_name,
        role=request.role,
        org_id=current_user.org_id,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "status": "invited",
        "user_id": new_user.id,
        "email": new_user.email,
        "role": new_user.role,
        "org_id": current_user.org_id,
    }


@router.delete("/members/{user_id}")
def remove_member(
    user_id: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin only: deactivate a member."""
    user = db.query(User).filter(
        User.id == user_id,
        User.org_id == current_user.org_id,
    ).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found in your org")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself")

    user.is_active = False
    db.commit()
    return {"status": "deactivated", "user_id": user_id}


@router.get("/analyses")
def list_analyses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 20,
    offset: int = 0,
):
    """List all analyses for the current org with pagination."""
    total = db.query(AnalysisRecord).filter(
        AnalysisRecord.org_id == current_user.org_id
    ).count()

    records = db.query(AnalysisRecord).filter(
        AnalysisRecord.org_id == current_user.org_id
    ).order_by(
        AnalysisRecord.created_at.desc()
    ).offset(offset).limit(limit).all()

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "analyses": [
            {
                "id": r.id,
                "job_id": r.job_id,
                "content_type": r.content_type,
                "content_preview": r.content_preview,
                "claim_count": r.claim_count,
                "fallacy_count": r.fallacy_count,
                "overall_score": r.overall_score,
                "status": r.status,
                "created_at": r.created_at.isoformat(),
            }
            for r in records
        ],
    }
