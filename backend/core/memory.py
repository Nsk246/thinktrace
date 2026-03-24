from neo4j import GraphDatabase, AsyncGraphDatabase
from core.config import get_settings
from core.models import AnalysisResult
import logging

logger = logging.getLogger(__name__)
settings = get_settings()


class KnowledgeGraphService:
    def __init__(self):
        self._driver = None

    def connect(self):
        try:
            # Try neo4j+s (encrypted) first — required for Aura
            uri = settings.neo4j_uri
            if not uri.startswith("neo4j+s"):
                uri = uri.replace("neo4j://", "neo4j+s://").replace("bolt://", "neo4j+s://")

            self._driver = GraphDatabase.driver(
                uri,
                auth=(settings.neo4j_user, settings.neo4j_password),
                max_connection_lifetime=3600,
                max_connection_pool_size=5,
                connection_acquisition_timeout=30,
                keep_alive=True,
            )
            self._driver.verify_connectivity()
            logger.info(f"Knowledge graph: connected to Neo4j at {uri}")
            self._create_indexes()
        except Exception as e:
            logger.warning(f"Knowledge graph: Neo4j unavailable ({e}) — running without graph")
            self._driver = None

    def _create_indexes(self):
        if not self._driver:
            return
        try:
            with self._driver.session() as session:
                session.run("CREATE INDEX claim_idx IF NOT EXISTS FOR (c:Claim) ON (c.id)")
                session.run("CREATE INDEX fallacy_idx IF NOT EXISTS FOR (f:Fallacy) ON (f.name)")
                session.run("CREATE INDEX analysis_idx IF NOT EXISTS FOR (a:Analysis) ON (a.id)")
                session.run("CREATE INDEX org_idx IF NOT EXISTS FOR (o:Org) ON (o.id)")
                session.run("CREATE INDEX user_idx IF NOT EXISTS FOR (u:User) ON (u.id)")
            logger.info("Neo4j indexes created")
        except Exception as e:
            logger.error(f"Neo4j index creation failed: {e}")

    def store_analysis(self, analysis_result: AnalysisResult, org_id: str, user_id: str = "anonymous") -> bool:
        if not self._driver:
            return False
        try:
            with self._driver.session() as session:
                session.execute_write(self._write_analysis, analysis_result, org_id, user_id)
            logger.info(f"Neo4j: stored analysis {analysis_result.id} for org {org_id}")
            return True
        except Exception as e:
            logger.error(f"Neo4j store error: {e}")
            return False

    @staticmethod
    def _write_analysis(tx, analysis_result, org_id, user_id):
        # Ensure Org node exists
        tx.run("MERGE (o:Org {id: $org_id})", org_id=org_id)

        # Ensure User node exists and link to org
        tx.run("""
            MERGE (u:User {id: $user_id})
            WITH u
            MATCH (o:Org {id: $org_id})
            MERGE (u)-[:BELONGS_TO]->(o)
        """, user_id=user_id, org_id=org_id)

        # Create Analysis node linked to both Org and User
        tx.run("""
            CREATE (a:Analysis {
                id: $id,
                org_id: $org_id,
                user_id: $user_id,
                overall_score: $score,
                evidence_score: $evidence_score,
                logic_score: $logic_score,
                claim_count: $claim_count,
                fallacy_count: $fallacy_count,
                created_at: datetime()
            })
            WITH a
            MATCH (o:Org {id: $org_id})
            CREATE (o)-[:HAS_ANALYSIS]->(a)
            WITH a
            MATCH (u:User {id: $user_id})
            CREATE (u)-[:RAN_ANALYSIS]->(a)
        """,
            id=analysis_result.id,
            org_id=org_id,
            user_id=user_id,
            score=analysis_result.epistemic_score.overall_score,
            evidence_score=analysis_result.epistemic_score.evidence_score,
            logic_score=analysis_result.epistemic_score.logic_score,
            claim_count=len(analysis_result.claim_tree.claims),
            fallacy_count=len(analysis_result.fallacies),
        )

        # Create Claim nodes linked to Analysis
        for claim in analysis_result.claim_tree.claims:
            tx.run("""
                MERGE (c:Claim {id: $id})
                ON CREATE SET c.text = $text, c.claim_type = $claim_type,
                              c.confidence = $confidence
                WITH c
                MATCH (a:Analysis {id: $analysis_id})
                CREATE (a)-[:CONTAINS_CLAIM]->(c)
            """,
                id=claim.id,
                text=claim.text,
                claim_type=claim.claim_type,
                confidence=claim.confidence,
                analysis_id=analysis_result.id,
            )

        # Create argument graph edges between claims
        for edge in analysis_result.argument_graph.edges:
            tx.run("""
                MATCH (s:Claim {id: $source_id})
                MATCH (t:Claim {id: $target_id})
                MERGE (s)-[:RELATES_TO {relation: $relation}]->(t)
            """,
                source_id=edge.source_id,
                target_id=edge.target_id,
                relation=edge.relation,
            )

        # Create Fallacy nodes and link to Claims
        for fallacy in analysis_result.fallacies:
            tx.run("""
                MERGE (f:Fallacy {name: $name})
                ON CREATE SET f.description = $description
                WITH f
                MATCH (c:Claim {id: $claim_id})
                MERGE (c)-[:HAS_FALLACY {
                    severity: $severity,
                    explanation: $explanation
                }]->(f)
            """,
                name=fallacy.name,
                description=fallacy.description if hasattr(fallacy, "description") else "",
                claim_id=fallacy.affected_claim_id,
                severity=fallacy.severity,
                explanation=fallacy.explanation,
            )

        # Create FactCheck results
        for fc in analysis_result.fact_checks:
            tx.run("""
                MATCH (c:Claim {id: $claim_id})
                MERGE (c)-[:FACT_CHECKED {
                    verdict: $verdict,
                    confidence: $confidence,
                    explanation: $explanation
                }]->(c)
            """,
                claim_id=fc.claim_id,
                verdict=fc.verdict,
                confidence=fc.confidence,
                explanation=fc.explanation,
            )

    def query_common_fallacies(self, org_id: str, limit: int = 10) -> list:
        """Get most common fallacies for a specific org."""
        if not self._driver:
            return []
        with self._driver.session() as session:
            result = session.run("""
                MATCH (o:Org {id: $org_id})-[:HAS_ANALYSIS]->(a:Analysis)
                      -[:CONTAINS_CLAIM]->(c:Claim)-[hf:HAS_FALLACY]->(f:Fallacy)
                RETURN f.name AS fallacy, count(*) AS count,
                       collect(DISTINCT hf.severity) AS severities
                ORDER BY count DESC LIMIT $limit
            """, org_id=org_id, limit=limit)
            return [dict(r) for r in result]

    def query_user_analyses(self, user_id: str, limit: int = 10) -> list:
        """Get analyses for a specific user."""
        if not self._driver:
            return []
        with self._driver.session() as session:
            result = session.run("""
                MATCH (u:User {id: $user_id})-[:RAN_ANALYSIS]->(a:Analysis)
                RETURN a.id AS id, a.overall_score AS score,
                       a.claim_count AS claims, a.created_at AS created_at
                ORDER BY a.created_at DESC LIMIT $limit
            """, user_id=user_id, limit=limit)
            return [dict(r) for r in result]

    def query_score_trend(self, org_id: str) -> list:
        """Get score trends for an org over time."""
        if not self._driver:
            return []
        with self._driver.session() as session:
            result = session.run("""
                MATCH (o:Org {id: $org_id})-[:HAS_ANALYSIS]->(a:Analysis)
                RETURN a.id AS analysis_id, a.overall_score AS score,
                       a.evidence_score AS evidence, a.logic_score AS logic,
                       a.created_at AS created_at
                ORDER BY a.created_at DESC LIMIT 20
            """, org_id=org_id)
            return [dict(r) for r in result]

    def get_graph_stats(self, org_id: str) -> dict:
        """Get stats for a specific org."""
        if not self._driver:
            return {"connected": False}
        try:
            with self._driver.session() as session:
                result = session.run("""
                    MATCH (o:Org {id: $org_id})
                    OPTIONAL MATCH (o)-[:HAS_ANALYSIS]->(a:Analysis)
                    OPTIONAL MATCH (a)-[:CONTAINS_CLAIM]->(c:Claim)
                    OPTIONAL MATCH (c)-[:HAS_FALLACY]->(f:Fallacy)
                    RETURN
                        count(DISTINCT a) AS total_analyses,
                        count(DISTINCT c) AS total_claims,
                        count(DISTINCT f) AS unique_fallacy_types
                """, org_id=org_id)
                record = result.single()
                if not record:
                    return {"connected": True, "total_analyses": 0, "total_claims": 0, "unique_fallacy_types": 0}
                return {
                    "connected": True,
                    "total_analyses": record["total_analyses"],
                    "total_claims": record["total_claims"],
                    "unique_fallacy_types": record["unique_fallacy_types"],
                }
        except Exception as e:
            logger.error(f"Neo4j stats error: {e}")
            return {"connected": False}

    def close(self):
        if self._driver:
            self._driver.close()


knowledge_graph = KnowledgeGraphService()
