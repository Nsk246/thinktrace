from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum
import uuid
from datetime import datetime


class ContentType(str, Enum):
    TEXT = "text"
    PDF = "pdf"
    URL = "url"
    YOUTUBE = "youtube"


class Claim(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    claim_type: str  # premise | conclusion | sub_claim
    position: int    # character position in original text
    confidence: float = 1.0


class ClaimTree(BaseModel):
    claims: List[Claim]
    raw_text: str
    source_type: ContentType


class Fallacy(BaseModel):
    name: str
    description: str
    affected_claim_id: str
    severity: str   # low | medium | high
    explanation: str


class FactCheckResult(BaseModel):
    claim_id: str
    verdict: str    # supported | contradicted | unverifiable | contested
    confidence: float
    sources: List[str]
    explanation: str


class ArgumentNode(BaseModel):
    id: str
    text: str
    node_type: str  # premise | conclusion | evidence


class ArgumentEdge(BaseModel):
    source_id: str
    target_id: str
    relation: str   # supports | contradicts | qualifies


class ArgumentGraph(BaseModel):
    nodes: List[ArgumentNode]
    edges: List[ArgumentEdge]


class EpistemicScore(BaseModel):
    evidence_score: float   # 0-100
    logic_score: float      # 0-100
    overall_score: float    # 0-100
    summary: str


class AnalysisResult(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    claim_tree: ClaimTree
    argument_graph: ArgumentGraph
    fallacies: List[Fallacy]
    fact_checks: List[FactCheckResult]
    epistemic_score: EpistemicScore
    status: str = "pending"  # pending | processing | complete | failed


class AnalysisRequest(BaseModel):
    content: str
    content_type: ContentType = ContentType.TEXT
    org_id: str = "default"