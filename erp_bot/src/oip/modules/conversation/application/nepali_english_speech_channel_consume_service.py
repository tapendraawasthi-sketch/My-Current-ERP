"""MAI-50 slice 2 — consume Nepali/English speech channel into candidates.

Default: CANDIDATE_ONLY (build speech candidate; never enables live speech).
Optional allow_* flags are for unit-test labeling only — live ingress always
forces false. Never ASR/TTS live, microphone arming, or audio persistence.
"""

from __future__ import annotations

from typing import Any, Mapping

from ....contracts.nepali_english_speech_channel import (
    NepaliEnglishSpeechChannelBundleV1,
    NepaliEnglishSpeechChannelReadiness,
    NepaliEnglishSpeechChannelStatus,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-50.0.2-slice2"
AUTHORITY = "ADR_0067"


def _as_speech_meta(
    bundle: Mapping[str, Any] | NepaliEnglishSpeechChannelBundleV1 | None,
) -> dict[str, Any] | None:
    if bundle is None:
        return None
    if isinstance(bundle, NepaliEnglishSpeechChannelBundleV1):
        from .nepali_english_speech_channel_service import (
            nepali_english_speech_channel_to_metadata,
        )

        return nepali_english_speech_channel_to_metadata(bundle)
    if isinstance(bundle, Mapping):
        return dict(bundle)
    return None


def _authority_blocks(data: Mapping[str, Any]) -> bool:
    return (
        data.get("is_execution_authority") is True
        or data.get("mutation_tools_allowed") is True
        or data.get("speech_authority_claimed") is True
        or data.get("speech_channel_enabled") is True
        or data.get("asr_live") is True
        or data.get("tts_live") is True
        or data.get("microphone_armed") is True
        or data.get("audio_persisted") is True
        or data.get("transcript_authoritative") is True
        or data.get("voice_channel_released") is True
        or data.get("speech_verified") is True
        or data.get("production_approved") is True
        or data.get("current_law_definitive") is True
        or data.get("legal_effective_dates_proven") is True
        or data.get("claims_verified") is True
        or data.get("legal_proof_claimed") is True
        or data.get("kb_retrieval_invoked") is True
        or int(data.get("documents_retrieved") or 0) != 0
        or int(data.get("draft_mutations") or 0) != 0
        or int(data.get("posting_mutations") or 0) != 0
        or str(data.get("gap_p2_008_status") or "OPEN") != "OPEN"
        or str(data.get("specialist_signoff_status") or "NOT_SIGNED")
        != "NOT_SIGNED"
        or str(data.get("release_status") or "NOT_RELEASED") != "NOT_RELEASED"
        or str(data.get("gold_questions_status") or "NOT_RELEASED")
        != "NOT_RELEASED"
        or str(
            data.get("pilot_scope")
            or "NEPALI_ENGLISH_SPEECH_CHANNEL_CANDIDATE_ONLY"
        )
        != "NEPALI_ENGLISH_SPEECH_CHANNEL_CANDIDATE_ONLY"
    )


def resolve_nepali_english_speech_channel_consume_mode(
    bundle: Mapping[str, Any] | NepaliEnglishSpeechChannelBundleV1 | None,
    *,
    allow_asr: bool = False,
    allow_tts: bool = False,
) -> str:
    """Return consume mode (never implies ASR/TTS live on default path)."""
    data = _as_speech_meta(bundle)
    if data is None:
        return "UNCHANGED"
    if _authority_blocks(data):
        return "BLOCKED"
    status = str(data.get("analysis_status") or "")
    if status != NepaliEnglishSpeechChannelStatus.COMPLETE.value:
        return "SKIP"
    readiness = str(
        data.get("nepali_english_speech_channel_readiness") or ""
    )
    if readiness == NepaliEnglishSpeechChannelReadiness.BLOCKED.value:
        return "BLOCKED"
    if (
        readiness
        == NepaliEnglishSpeechChannelReadiness.NOT_APPLICABLE.value
    ):
        return "SKIP"
    if readiness not in {
        NepaliEnglishSpeechChannelReadiness.POLICY_DECLARED.value,
        NepaliEnglishSpeechChannelReadiness.SCOPE_PARTIAL.value,
    }:
        return "SKIP"
    topics = data.get("in_scope_topics") or ()
    if not topics:
        return "BLOCKED"
    if allow_asr:
        return "INVOKE_ASR"
    if allow_tts:
        return "INVOKE_TTS"
    return "CANDIDATE_ONLY"


def build_nepali_english_speech_channel_candidate(
    bundle: Mapping[str, Any] | NepaliEnglishSpeechChannelBundleV1 | None,
    *,
    field_overrides: Mapping[str, Any] | None = None,
    allow_asr: bool = False,
    allow_tts: bool = False,
) -> dict[str, Any]:
    """Build Nepali/English speech channel candidate (never enables live)."""
    data = _as_speech_meta(bundle)
    mode = resolve_nepali_english_speech_channel_consume_mode(
        data,
        allow_asr=allow_asr,
        allow_tts=allow_tts,
    )
    overrides = dict(field_overrides or {})
    base: dict[str, Any] = {
        "nepali_english_speech_channel_consume_mode": mode,
        "nepali_english_speech_channel_consume_ready": False,
        "nepali_english_speech_channel_candidate": None,
        "mutation_tools_allowed": False,
        "speech_authority_claimed": False,
        "speech_channel_enabled": False,
        "asr_live": False,
        "tts_live": False,
        "microphone_armed": False,
        "audio_persisted": False,
        "transcript_authoritative": False,
        "voice_channel_released": False,
        "speech_verified": False,
        "production_approved": False,
        "current_law_definitive": False,
        "legal_effective_dates_proven": False,
        "claims_verified": False,
        "legal_proof_claimed": False,
        "kb_retrieval_invoked": False,
        "documents_retrieved": 0,
        "draft_mutations": 0,
        "posting_mutations": 0,
        "gap_p2_008_status": "OPEN",
        "specialist_signoff_status": "NOT_SIGNED",
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "is_execution_authority": False,
        "runtime_version": RUNTIME_VERSION,
        "allow_asr": False,
        "allow_tts": False,
    }
    if data is None or mode in {"UNCHANGED", "SKIP", "BLOCKED"}:
        return base

    topics = data.get("in_scope_topics") or ()
    if isinstance(topics, tuple):
        topics = list(topics)
    unsupported = data.get("unsupported_topics") or ()
    if isinstance(unsupported, tuple):
        unsupported = list(unsupported)

    candidate = {
        "pilot_scope": "NEPALI_ENGLISH_SPEECH_CHANNEL_CANDIDATE_ONLY",
        "nepali_english_speech_channel_readiness": data.get(
            "nepali_english_speech_channel_readiness"
        ),
        "in_scope_topics": topics,
        "unsupported_topics": unsupported,
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "asr_plan": None,
        "tts_plan": None,
        "nepali_speech_plan": None,
        "english_speech_plan": None,
        "bilingual_speech_plan": None,
        "voice_channel_plan": None,
        "microphone_plan": None,
        "definitive_answer": None,
        "specialist_signoff_status": "NOT_SIGNED",
        "speech_authority_claimed": False,
        "speech_channel_enabled": False,
        "asr_live": False,
        "tts_live": False,
        "microphone_armed": False,
        "audio_persisted": False,
        "transcript_authoritative": False,
        "voice_channel_released": False,
        "speech_verified": False,
        "production_approved": False,
        "field_overrides": overrides,
        "gap_p2_008_status": "OPEN",
        "ready": True,
    }
    ready = mode == "CANDIDATE_ONLY" and bool(candidate["in_scope_topics"])
    base.update(
        {
            "nepali_english_speech_channel_consume_ready": ready,
            "nepali_english_speech_channel_candidate": candidate,
        }
    )
    return base


def nepali_english_speech_channel_consume_observability(
    request: CanonicalAIRequestV1,
    *,
    allow_asr: bool = False,
    allow_tts: bool = False,
) -> dict[str, Any]:
    """Merge consume observability; live path forces allow flags false."""
    del allow_asr, allow_tts
    built = build_nepali_english_speech_channel_candidate(
        request.nepali_english_speech_channel_bundle,
        field_overrides={},
        allow_asr=False,
        allow_tts=False,
    )
    return {
        "nepali_english_speech_channel_consume_mode": built[
            "nepali_english_speech_channel_consume_mode"
        ],
        "nepali_english_speech_channel_consume_ready": bool(
            built["nepali_english_speech_channel_consume_ready"]
        ),
        "nepali_english_speech_channel_candidate": built.get(
            "nepali_english_speech_channel_candidate"
        ),
        "mutation_tools_allowed": False,
        "speech_authority_claimed": False,
        "speech_channel_enabled": False,
        "asr_live": False,
        "tts_live": False,
        "microphone_armed": False,
        "audio_persisted": False,
        "transcript_authoritative": False,
        "voice_channel_released": False,
        "speech_verified": False,
        "production_approved": False,
        "current_law_definitive": False,
        "legal_effective_dates_proven": False,
        "claims_verified": False,
        "legal_proof_claimed": False,
        "kb_retrieval_invoked": False,
        "documents_retrieved": 0,
        "draft_mutations": 0,
        "posting_mutations": 0,
        "gap_p2_008_status": "OPEN",
        "specialist_signoff_status": "NOT_SIGNED",
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "is_execution_authority": False,
        "runtime_version": RUNTIME_VERSION,
        "allow_asr": False,
        "allow_tts": False,
    }


def assert_nepali_english_speech_channel_consume_authority(
    obs: Mapping[str, Any] | None,
) -> None:
    if not obs:
        return
    if (
        obs.get("is_execution_authority") is True
        or obs.get("mutation_tools_allowed") is True
        or obs.get("speech_authority_claimed") is True
        or obs.get("speech_channel_enabled") is True
        or obs.get("asr_live") is True
        or obs.get("tts_live") is True
        or obs.get("microphone_armed") is True
        or obs.get("audio_persisted") is True
        or obs.get("transcript_authoritative") is True
        or obs.get("voice_channel_released") is True
        or obs.get("speech_verified") is True
        or obs.get("production_approved") is True
        or obs.get("current_law_definitive") is True
        or obs.get("legal_effective_dates_proven") is True
        or obs.get("claims_verified") is True
        or obs.get("legal_proof_claimed") is True
        or obs.get("kb_retrieval_invoked") is True
        or int(obs.get("documents_retrieved") or 0) != 0
        or int(obs.get("draft_mutations") or 0) != 0
        or int(obs.get("posting_mutations") or 0) != 0
        or obs.get("allow_asr") is True
        or obs.get("allow_tts") is True
        or str(obs.get("gap_p2_008_status") or "OPEN") != "OPEN"
        or str(obs.get("specialist_signoff_status") or "NOT_SIGNED")
        != "NOT_SIGNED"
        or str(obs.get("release_status") or "NOT_RELEASED") != "NOT_RELEASED"
    ):
        raise RuntimeError("NEPALI_ENGLISH_SPEECH_CHANNEL_CONSUME_AUTHORITY")


def enrich_speech_metadata_with_consume(
    speech_meta: dict[str, Any],
    request: CanonicalAIRequestV1,
) -> dict[str, Any]:
    out = dict(speech_meta)
    obs = nepali_english_speech_channel_consume_observability(
        request,
        allow_asr=False,
        allow_tts=False,
    )
    out.update(obs)
    out["runtime_version"] = RUNTIME_VERSION
    return out
