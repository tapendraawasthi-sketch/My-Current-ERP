"""OrbixAgentEngine — plan -> act -> observe -> reflect -> verify -> answer.

This is the real brain. It replaces one-shot pattern dispatch with a bounded
agentic loop that must ground every factual claim in tool evidence before the
verifier lets an answer through.
"""

from __future__ import annotations

from typing import Any

from ..config import OrbixConfig
from ..llm.ollama_client import OllamaClient
from ..memory.store import MemoryStore
from ..prompts import DECISION_PROMPT, KHATA_EXTRACTION_PROMPT, ORBIX_SYSTEM_PROMPT
from ..schemas import (
    AgentAction,
    EvidenceRef,
    OrbixChatRequest,
    OrbixChatResponse,
    ToolCallRecord,
)
from ..tools.registry import ToolRegistry
from ..llm.reasoning_filter import strip_reasoning
from . import answerer, planner, verifier


class OrbixAgentEngine:
    def __init__(
        self,
        config: OrbixConfig,
        agent_llm: OllamaClient,
        verifier_llm: OllamaClient,
        router_llm: OllamaClient,
        tools: ToolRegistry,
        memory: MemoryStore,
    ):
        self.config = config
        self.llm = agent_llm
        self.verifier_llm = verifier_llm
        self.router_llm = router_llm
        self.tools = tools
        self.memory = memory

    # ── public entrypoint ─────────────────────────────────────────────────────
    async def chat(self, req: OrbixChatRequest) -> OrbixChatResponse:
        # Confirmation handshake: user approved a previously proposed voucher.
        if req.confirm_token and req.confirmation_payload:
            return await self._handle_confirmation(req)

        working_memory = await self.memory.get_working_memory(req.session_id)
        recalled = await self.memory.search_episodes(
            query=req.message, user_id=req.user_id, session_id=req.session_id, k=5
        )

        tool_list = self.tools.describe_for_prompt()
        plan = await planner.create_plan(
            self.router_llm, req, tool_list, working_memory, recalled
        )

        # Accounting entries take the deterministic ledger path.
        if plan.intent == "khata_entry" or self._looks_like_entry(req.message):
            return await self._handle_khata(req, plan.intent or "khata_entry")

        return await self._run_loop(req, plan.intent, tool_list, working_memory, recalled, plan)

    # ── main reasoning loop ────────────────────────────────────────────────────
    async def _run_loop(
        self,
        req: OrbixChatRequest,
        intent: str,
        tool_list: str,
        working_memory: dict[str, Any],
        recalled: list[dict],
        plan,
    ) -> OrbixChatResponse:
        evidence: list[EvidenceRef] = []
        tool_trace: list[ToolCallRecord] = []
        observations: list[dict] = []

        # Seed observations with planner intent so the decider has direction.
        plan_hint = "; ".join(f"{s.tool}:{s.goal}" for s in plan.steps) or "(no plan steps)"

        for _step in range(self.config.max_tool_steps):
            action = await self._decide_next_action(
                req, intent, tool_list, plan_hint, observations, evidence
            )

            if action.type == "ask_clarification":
                return OrbixChatResponse(
                    answer=action.question or "Could you clarify what you need?",
                    intent=intent,
                    confidence=0.6,
                    evidence=evidence,
                    tool_trace=tool_trace,
                    session_id=req.session_id,
                )

            if action.type == "final_answer":
                candidate = action.answer or await answerer.compose_answer(
                    self.llm, req, intent, observations, evidence
                )
                result = await self._verify_and_finalize(
                    req, intent, candidate, evidence, tool_trace, observations
                )
                if result is not None:
                    return result
                # Verification failed — feed back and keep looping.
                observations.append(
                    {"tool": "verifier", "summary": "verification failed; gather more evidence"}
                )
                continue

            # tool_call
            tool = self.tools.get(action.tool_name or "")
            if tool is None:
                observations.append(
                    {"tool": action.tool_name, "summary": f"unknown tool {action.tool_name}"}
                )
                continue

            if tool.spec.requires_confirmation:
                # Never auto-run mutations; surface a confirmation request.
                payload = {
                    "tool": action.tool_name,
                    "args": action.args,
                    "reason": action.reason or "This action modifies data.",
                }
                return OrbixChatResponse(
                    answer=action.reason
                    or "This will modify your data. Please confirm to proceed.",
                    intent=intent,
                    confidence=0.7,
                    evidence=evidence,
                    tool_trace=tool_trace,
                    needs_confirmation=True,
                    confirmation_payload=payload,
                    session_id=req.session_id,
                )

            result = await self.tools.call(action.tool_name, action.args)
            record = result.to_record(action.tool_name, action.args)
            tool_trace.append(record)
            evidence.extend(result.evidence)
            observations.append(
                {
                    "tool": action.tool_name,
                    "summary": result.summary,
                    "data": result.data,
                    "ok": result.ok,
                }
            )
            await self.memory.log_tool_call(
                req.session_id, action.tool_name, action.args, result.model_dump(), result.ok
            )

        # Max steps reached — compose a limited, honest answer.
        candidate = await answerer.compose_limited_answer(
            self.llm, req, intent, observations, evidence
        )
        v = await verifier.verify_answer(
            self.verifier_llm, candidate, evidence, tool_trace, intent
        )
        await self._write_episode(req, intent, candidate, tool_trace, evidence)
        return OrbixChatResponse(
            answer=candidate,
            intent=intent,
            confidence=min(v.score, 0.6),
            evidence=evidence,
            tool_trace=tool_trace,
            warnings=(v.warnings or []) + ["max reasoning steps reached"],
            session_id=req.session_id,
        )

    async def _verify_and_finalize(
        self, req, intent, candidate, evidence, tool_trace, observations
    ) -> OrbixChatResponse | None:
        v = await verifier.verify_answer(
            self.verifier_llm, candidate, evidence, tool_trace, intent
        )
        if not v.passed:
            return None
        await self._write_episode(req, intent, candidate, tool_trace, evidence)
        return OrbixChatResponse(
            answer=candidate,
            intent=intent,
            confidence=v.score,
            evidence=evidence,
            tool_trace=tool_trace,
            warnings=v.warnings,
            session_id=req.session_id,
        )

    # ── decision step ──────────────────────────────────────────────────────────
    async def _decide_next_action(
        self, req, intent, tool_list, plan_hint, observations, evidence
    ) -> AgentAction:
        obs_text = "\n".join(
            f"- {o.get('tool')}: {o.get('summary','')}" for o in observations
        ) or "(none yet)"
        ev_text = "\n".join(f"[{e.id}] {e.uri}" for e in evidence) or "(none yet)"

        messages = [
            {"role": "system", "content": ORBIX_SYSTEM_PROMPT},
            {"role": "system", "content": DECISION_PROMPT.format(tool_list=tool_list)},
            {
                "role": "user",
                "content": (
                    f"User request: {req.message}\n"
                    f"Intent: {intent}\n"
                    f"Plan hint: {plan_hint}\n\n"
                    f"Observations so far:\n{obs_text}\n\n"
                    f"Evidence gathered:\n{ev_text}\n\n"
                    "Decide the next action as JSON."
                ),
            },
        ]
        parsed = None
        try:
            parsed = await self.llm.chat_json(messages, temperature=self.config.agent_temperature)
        except Exception:
            parsed = None

        if not isinstance(parsed, dict):
            # If evidence exists, compose a final answer; else clarify.
            if evidence:
                return AgentAction(type="final_answer")
            return AgentAction(
                type="ask_clarification",
                question="I couldn't process that. Could you rephrase your question?",
            )

        atype = parsed.get("type", "final_answer")
        if atype == "tool_call":
            return AgentAction(
                type="tool_call",
                thought=parsed.get("thought"),
                tool_name=parsed.get("tool_name"),
                args=parsed.get("args", {}) or {},
                reason=parsed.get("reason"),
            )
        if atype == "ask_clarification":
            return AgentAction(type="ask_clarification", question=parsed.get("question"))
        return AgentAction(type="final_answer", answer=strip_reasoning(parsed.get("answer") or ""))

    # ── accounting (khata) path ─────────────────────────────────────────────────
    def _looks_like_entry(self, message: str) -> bool:
        m = message.lower()
        signals = (
            "udhaar", "udharo", "becheko", "bech", "tiryo", "tirey", "diye", "diyo",
            "kinya", "kine", "payment", "discount", "bill", "voucher",
            "बेचे", "तिर्", "दिए", "किन",
        )
        return any(s in m for s in signals)

    async def _extract_event(self, message: str) -> dict[str, Any]:
        messages = [
            {"role": "system", "content": KHATA_EXTRACTION_PROMPT},
            {"role": "user", "content": message},
        ]
        try:
            parsed = await self.llm.chat_json(messages, temperature=0.0)
        except Exception:
            parsed = None
        return parsed if isinstance(parsed, dict) else {}

    async def _handle_khata(self, req: OrbixChatRequest, intent: str) -> OrbixChatResponse:
        event = await self._extract_event(req.message)
        tool_trace: list[ToolCallRecord] = []
        evidence: list[EvidenceRef] = []

        # If the model gave us nothing usable, ask for clarification.
        if not event or not event.get("event_type"):
            return OrbixChatResponse(
                answer="I couldn't identify the transaction. Please state the party, amount, and whether it is a sale, purchase, or payment.",
                intent="khata_entry",
                confidence=0.5,
                session_id=req.session_id,
            )

        sim = await self.tools.call("simulate_voucher", {"event": event})
        tool_trace.append(sim.to_record("simulate_voucher", {"event": event}))
        evidence.extend(sim.evidence)
        await self.memory.log_tool_call(
            req.session_id, "simulate_voucher", {"event": event}, sim.model_dump(), sim.ok
        )

        if not sim.ok:
            return OrbixChatResponse(
                answer=f"I could not build a balanced entry: {sim.error}",
                intent="khata_entry",
                confidence=0.4,
                tool_trace=tool_trace,
                warnings=[sim.error or "ledger error"],
                session_id=req.session_id,
            )

        lines = sim.data.get("lines", [])
        # Deterministic math guard.
        math_errors = verifier.verify_ledger_math(lines)
        preview = self._format_journal(lines, sim.data)
        confirmation_payload = sim.data.get("confirmation_payload")

        await self.memory.update_working_memory(
            req.session_id, {"last_parsed_entry": event, "pending_confirmation": confirmation_payload}
        )
        await self._write_episode(
            req, "khata_entry", preview, tool_trace, evidence,
            summary=f"Proposed {event.get('event_type')} for {event.get('party')}",
        )

        return OrbixChatResponse(
            answer=preview,
            intent="khata_entry",
            confidence=0.9 if not math_errors else 0.4,
            evidence=evidence,
            tool_trace=tool_trace,
            needs_confirmation=True,
            confirmation_payload=confirmation_payload,
            warnings=math_errors,
            session_id=req.session_id,
        )

    def _format_journal(self, lines: list[dict], data: dict) -> str:
        rows = []
        for l in lines:
            if l.get("debit"):
                rows.append(f"DEBIT  {l['account']}: {float(l['debit']):,.2f}")
        for l in lines:
            if l.get("credit"):
                rows.append(f"CREDIT {l['account']}: {float(l['credit']):,.2f}")
        body = "\n".join(rows)
        dt = data.get("debit_total", 0)
        ct = data.get("credit_total", 0)
        balanced = "balanced" if data.get("balanced") else "NOT balanced"
        return (
            "Proposed journal entry:\n"
            f"{body}\n\n"
            f"Debit total: {dt:,.2f} | Credit total: {ct:,.2f} ({balanced})\n\n"
            "Confirm to post this entry."
        )

    async def _handle_confirmation(self, req: OrbixChatRequest) -> OrbixChatResponse:
        result = await self.tools.call(
            "post_confirmed_voucher",
            {"confirmed": True, "confirmation_payload": req.confirmation_payload},
        )
        await self.memory.update_working_memory(req.session_id, {"pending_confirmation": None})
        await self.memory.log_tool_call(
            req.session_id,
            "post_confirmed_voucher",
            {"confirmed": True},
            result.model_dump(),
            result.ok,
        )
        if not result.ok:
            return OrbixChatResponse(
                answer=f"Could not post: {result.error}",
                intent="khata_entry",
                confidence=0.4,
                session_id=req.session_id,
            )
        return OrbixChatResponse(
            answer="Entry confirmed. The ledger will be updated.",
            intent="khata_entry",
            confidence=0.95,
            confirmation_payload=req.confirmation_payload,
            session_id=req.session_id,
        )

    # ── memory write ────────────────────────────────────────────────────────────
    async def _write_episode(
        self, req, intent, answer, tool_trace, evidence, summary: str | None = None
    ) -> None:
        try:
            await self.memory.write_episode(
                {
                    "session_id": req.session_id,
                    "user_id": req.user_id,
                    "company_id": req.company_id,
                    "user_message": req.message,
                    "agent_answer": answer,
                    "intent": intent,
                    "tool_trace": [t.model_dump() for t in tool_trace],
                    "evidence": [e.model_dump() for e in evidence],
                    "summary": summary,
                }
            )
        except Exception:
            pass
