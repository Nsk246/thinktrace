from langgraph.graph import StateGraph, END
from typing import TypedDict, Optional
from core.models import (
    ClaimTree, ArgumentGraph, Fallacy,
    FactCheckResult, EpistemicScore, AnalysisResult
)
from agents.logic_mapper import LogicMapperAgent
from agents.fallacy_hunter import FallacyHunterAgent
from agents.fact_checker import FactCheckerAgent
from agents.epistemic_scorer import EpistemicScorerAgent
import asyncio
import concurrent.futures

logic_mapper = LogicMapperAgent()
fallacy_hunter = FallacyHunterAgent()
fact_checker = FactCheckerAgent()
epistemic_scorer = EpistemicScorerAgent()


class AnalysisState(TypedDict):
    claim_tree: ClaimTree
    argument_graph: Optional[ArgumentGraph]
    fallacies: Optional[list[Fallacy]]
    fact_checks: Optional[list[FactCheckResult]]
    epistemic_score: Optional[EpistemicScore]
    status: str
    error: Optional[str]


def run_logic_mapper(state: AnalysisState) -> AnalysisState:
    try:
        result = logic_mapper.run(state["claim_tree"])
        return {**state, "argument_graph": result}
    except Exception as e:
        return {**state, "argument_graph": ArgumentGraph(nodes=[], edges=[]), "error": str(e)}


def run_fallacy_hunter(state: AnalysisState) -> AnalysisState:
    try:
        result = fallacy_hunter.run(state["claim_tree"])
        return {**state, "fallacies": result}
    except Exception as e:
        return {**state, "fallacies": [], "error": str(e)}


def run_fact_checker(state: AnalysisState) -> AnalysisState:
    try:
        result = fact_checker.run(state["claim_tree"])
        return {**state, "fact_checks": result}
    except Exception as e:
        return {**state, "fact_checks": [], "error": str(e)}


def run_parallel_agents(state: AnalysisState) -> AnalysisState:
    """Run Logic Mapper, Fallacy Hunter, and Fact Checker in parallel threads."""
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        future_logic = executor.submit(logic_mapper.run, state["claim_tree"])
        future_fallacy = executor.submit(fallacy_hunter.run, state["claim_tree"])
        future_facts = executor.submit(fact_checker.run, state["claim_tree"])

        try:
            argument_graph = future_logic.result(timeout=60)
        except Exception as e:
            argument_graph = ArgumentGraph(nodes=[], edges=[])

        try:
            fallacies = future_fallacy.result(timeout=60)
        except Exception as e:
            fallacies = []

        try:
            fact_checks = future_facts.result(timeout=60)
        except Exception as e:
            fact_checks = []

    return {
        **state,
        "argument_graph": argument_graph,
        "fallacies": fallacies,
        "fact_checks": fact_checks,
        "status": "agents_complete",
    }


def run_epistemic_scorer(state: AnalysisState) -> AnalysisState:
    try:
        score = epistemic_scorer.run(
            claim_tree=state["claim_tree"],
            fallacies=state["fallacies"],
            fact_checks=state["fact_checks"],
        )
        return {**state, "epistemic_score": score, "status": "complete"}
    except Exception as e:
        return {
            **state,
            "epistemic_score": EpistemicScore(
                evidence_score=0,
                logic_score=0,
                overall_score=0,
                summary=f"Scoring failed: {str(e)}",
            ),
            "status": "complete",
        }


def build_analysis_graph():
    graph = StateGraph(AnalysisState)

    graph.add_node("parallel_agents", run_parallel_agents)
    graph.add_node("epistemic_scorer", run_epistemic_scorer)

    graph.set_entry_point("parallel_agents")
    graph.add_edge("parallel_agents", "epistemic_scorer")
    graph.add_edge("epistemic_scorer", END)

    return graph.compile()


analysis_graph = build_analysis_graph()


def run_with_retry(fn, *args, max_retries=2, **kwargs):
    """Run a function with retry logic — catches transient failures."""
    last_error = None
    for attempt in range(max_retries + 1):
        try:
            return fn(*args, **kwargs)
        except Exception as e:
            last_error = e
            if attempt < max_retries:
                import time
                time.sleep(2 ** attempt)  # exponential backoff: 1s, 2s
                logging.getLogger(__name__).warning(
                    f"Attempt {attempt + 1} failed: {e}. Retrying..."
                )
    raise last_error


def run_full_analysis(claim_tree: ClaimTree) -> AnalysisResult:
    initial_state: AnalysisState = {
        "claim_tree": claim_tree,
        "argument_graph": None,
        "fallacies": None,
        "fact_checks": None,
        "epistemic_score": None,
        "status": "processing",
        "error": None,
    }

    final_state = analysis_graph.invoke(initial_state)

    return AnalysisResult(
        claim_tree=final_state["claim_tree"],
        argument_graph=final_state["argument_graph"],
        fallacies=final_state["fallacies"],
        fact_checks=final_state["fact_checks"],
        epistemic_score=final_state["epistemic_score"],
        status=final_state["status"],
    )
