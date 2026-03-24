from neo4j import GraphDatabase
from core.config import get_settings
from core.models import AnalysisResult, ArgumentGraph, Fallacy, FactCheckResult
import logging

logger = logging.getLogger(__name__)
settings = get_settings()


class KnowledgeGraphService:
    """
    Persists every analysis into Neo4j as a connected graph.
    Enables cross-analysis queries:
    - Which claims appear across multiple documents?
    - Which fallacies are most common in this org?
    - Which sources contradict each other?
    """

    def __init__(self):
        self._driver = None

    def connect(self):
        try:
            self._driver = GraphDatabase.driver(
                settings.neo4j_uri,
                auth=(settings.neo4j_user, settings.neo4j_password),
            )
            self._driver.verify_connectivity()
            logger.info("Knowledge graph: connected to Neo4j")
            self._create_indexes()
        except Exception as e:
            logger.warning(f"Knowledge graph: Neo4j unavailable ({e}) — running without graph")
            self._driver = None

    def _create_indexes(self):
        if not self._driver:
            return
        with self._driver.session() as session:
            session.run("CREATE INDEX claim_idx IF NOT EXISTS FOR (c:Claim) ON (c.id)")
            session.run("CREATE INDEX fallacy_idx IF NOT EXISTS FOR (f:Fallacy) ON (f.name)")
            session.run("CREATE INDEX analysis_idx IF NOT EXISTS FOR (a:Analysis) ON (a.id)")
            session.run("CREATE INDEX org_idx IF NOT EXISTS FOR (o:Org) ON (o.id)")

    def store_analysis(
        self,
        analysis_result: AnalysisResult,
        org_id: str,
        user_id: str,
    ) -> bool:
        if not self._driver:
            logger.warning("Knowledge graph: skipping store — Neo4j not connected")
            return False

        try:
            with self._driver.session() as session:
                session.execute_write(
                    self._write_analysis,
                    analysis_result,
                    org_id,
                    user_id,
                )
            return True
        except Exception as e:
            logger.error(f"Knowledge graph: failed to store analysis: {e}")
            return False

    @staticmethod
    def _write_analysis(tx, analysis_result, org_id, user_id):
        # Create org node
        tx.run(
            "MERGE (o:Org {id: $org_id})",
            org_id=org_id,
        )

        # Create analysis node
        tx.run(
            """
            CREATE (a:Analysis {
                id: $id,
                org_id: $org_id,
                user_id: $user_id,
                overall_score: $score,
                created_at: datetime()
            })
            WITH a
            MATCH (o:Org {id: $org_id})
            CREATE (o)-[:HAS_ANALYSIS]->(a)
            """,
            id=analysis_result.id,
            org_id=org_id,
            user_id=user_id,
            score=analysis_result.epistemic_score.overall_score,
        )

        # Create claim nodes and link to analysis
        for claim in analysis_result.claim_tree.claims:
            tx.run(
                """
                MERGE (c:Claim {id: $id})
                ON CREATE SET c.text = $text, c.claim_type = $claim_type
                WITH c
                MATCH (a:Analysis {id: $analysis_id})
                CREATE (a)-[:CONTAINS_CLAIM]->(c)
                """,
                id=claim.id,
                text=claim.text,
                claim_type=claim.claim_type,
                analysis_id=analysis_result.id,
            )

        # Create argument graph edges
        for edge in analysis_result.argument_graph.edges:
            tx.run(
                """
                MATCH (s:Claim {id: $source_id})
                MATCH (t:Claim {id: $target_id})
                MERGE (s)-[:RELATES_TO {relation: $relation}]->(t)
                """,
                source_id=edge.source_id,
                target_id=edge.target_id,
                relation=edge.relation,
            )

        # Create fallacy nodes and link to affected claims
        for fallacy in analysis_result.fallacies:
            tx.run(
                """
                MERGE (f:Fallacy {name: $name})
                WITH f
                MATCH (c:Claim {id: $claim_id})
                CREATE (c)-[:HAS_FALLACY {severity: $severity, explanation: $explanation}]->(f)
                """,
                name=fallacy.name,
                claim_id=fallacy.affected_claim_id,
                severity=fallacy.severity,
                explanation=fallacy.explanation,
            )

        # Create fact check result nodes
        for fc in analysis_result.fact_checks:
            tx.run(
                """
                MATCH (c:Claim {id: $claim_id})
                CREATE (c)-[:FACT_CHECKED {
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
        if not self._driver:
            return []
        with self._driver.session() as session:
            result = session.run(
                """
                MATCH (o:Org {id: $org_id})-[:HAS_ANALYSIS]->(a:Analysis)
                -[:CONTAINS_CLAIM]->(c:Claim)-[hf:HAS_FALLACY]->(f:Fallacy)
                RETURN f.name AS fallacy, count(*) AS count,
                       collect(DISTINCT hf.severity) AS severities
                ORDER BY count DESC
                LIMIT $limit
                """,
                org_id=org_id,
                limit=limit,
            )
            return [dict(r) for r in result]

    def query_related_claims(self, claim_text: str, limit: int = 5) -> list:
        if not self._driver:
            return []
        with self._driver.session() as session:
            result = session.run(
                """
                MATCH (c:Claim)
                WHERE toLower(c.text) CONTAINS toLower($search)
                RETURN c.id AS id, c.text AS text, c.claim_type AS claim_type
                LIMIT $limit
                """,
                search=claim_text[:100],
                limit=limit,
            )
            return [dict(r) for r in result]

    def query_score_trend(self, org_id: str) -> list:
        if not self._driver:
            return []
        with self._driver.session() as session:
            result = session.run(
                """
                MATCH (o:Org {id: $org_id})-[:HAS_ANALYSIS]->(a:Analysis)
                RETURN a.id AS analysis_id,
                       a.overall_score AS score,
                       a.created_at AS created_at
                ORDER BY a.created_at DESC
                LIMIT 20
                """,
                org_id=org_id,
            )
            return [dict(r) for r in result]

    def get_graph_stats(self, org_id: str) -> dict:
        if not self._driver:
            return {"connected": False}
        with self._driver.session() as session:
            result = session.run(
                """
                MATCH (o:Org {id: $org_id})-[:HAS_ANALYSIS]->(a:Analysis)
                OPTIONAL MATCH (a)-[:CONTAINS_CLAIM]->(c:Claim)
                OPTIONAL MATCH (c)-[:HAS_FALLACY]->(f:Fallacy)
                RETURN
                    count(DISTINCT a) AS total_analyses,
                    count(DISTINCT c) AS total_claims,
                    count(DISTINCT f) AS unique_fallacy_types
                """,
                org_id=org_id,
            )
            record = result.single()
            return {
                "connected": True,
                "total_analyses": record["total_analyses"],
                "total_claims": record["total_claims"],
                "unique_fallacy_types": record["unique_fallacy_types"],
            }

    def close(self):
        if self._driver:
            self._driver.close()


knowledge_graph = KnowledgeGraphService()
