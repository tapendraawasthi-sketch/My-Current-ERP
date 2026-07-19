"""MAI-50 slice 2 — Nepali/English speech channel candidate consume."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.nepali_english_speech_channel_consume_service import (
    RUNTIME_VERSION,
    assert_nepali_english_speech_channel_consume_authority,
    build_nepali_english_speech_channel_candidate,
    nepali_english_speech_channel_consume_observability,
    resolve_nepali_english_speech_channel_consume_mode,
)
from src.oip.modules.conversation.application.nepali_english_speech_channel_service import (
    assert_nepali_english_speech_channel_authority,
    attach_nepali_english_speech_channel_to_request,
)


def _pipeline(text: str):
    req = CanonicalAIRequestV1(
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id="conv-1",
        message_id="msg-1",
        raw_text=text,
        mode=InteractionModeV1.ASK,
        created_at=datetime.now(timezone.utc),
        trusted_scope=TrustedScopeV1(
            principal_id="user-1",
            tenant_id="tenant-a",
            company_id="co-1",
            authentication_method="test",
            policy_version="test",
        ),
    )
    return attach_nepali_english_speech_channel_to_request(req)


def test_runtime_slice2() -> None:
    assert RUNTIME_VERSION == "mai-50.0.2-slice2"


def test_speech_candidate_only() -> None:
    req = _pipeline(
        "Nepali speech and English speech with speech-to-text and text-to-speech"
    )
    bundle = req.nepali_english_speech_channel_bundle
    assert_nepali_english_speech_channel_authority(bundle)
    mode = resolve_nepali_english_speech_channel_consume_mode(
        bundle, allow_asr=False, allow_tts=False
    )
    assert mode == "CANDIDATE_ONLY"
    built = build_nepali_english_speech_channel_candidate(bundle)
    assert (
        built["nepali_english_speech_channel_consume_mode"]
        == "CANDIDATE_ONLY"
    )
    assert built["nepali_english_speech_channel_consume_ready"] is True
    cand = built["nepali_english_speech_channel_candidate"]
    assert cand is not None
    assert "NEPALI_SPEECH" in cand["in_scope_topics"]
    assert cand["asr_plan"] is None
    assert cand["tts_plan"] is None
    assert cand["nepali_speech_plan"] is None
    assert cand["english_speech_plan"] is None
    assert cand["bilingual_speech_plan"] is None
    assert cand["voice_channel_plan"] is None
    assert cand["microphone_plan"] is None
    assert cand["definitive_answer"] is None
    assert cand["speech_channel_enabled"] is False
    assert cand["asr_live"] is False
    assert cand["tts_live"] is False
    assert cand["microphone_armed"] is False
    assert cand["gap_p2_008_status"] == "OPEN"
    obs = nepali_english_speech_channel_consume_observability(req)
    assert_nepali_english_speech_channel_consume_authority(obs)
    assert obs["allow_asr"] is False
    assert obs["allow_tts"] is False


def test_authority_blocks() -> None:
    meta = {
        "analysis_status": "COMPLETE",
        "nepali_english_speech_channel_readiness": "POLICY_DECLARED",
        "in_scope_topics": ["SPEECH_INPUT"],
        "pilot_scope": "NEPALI_ENGLISH_SPEECH_CHANNEL_CANDIDATE_ONLY",
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "gap_p2_008_status": "OPEN",
        "specialist_signoff_status": "NOT_SIGNED",
        "asr_live": True,
        "is_execution_authority": False,
    }
    assert (
        resolve_nepali_english_speech_channel_consume_mode(meta)
        == "BLOCKED"
    )


def test_purchase_skips() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    assert (
        resolve_nepali_english_speech_channel_consume_mode(
            req.nepali_english_speech_channel_bundle
        )
        == "SKIP"
    )


def test_invoke_label_only_not_live() -> None:
    req = _pipeline(
        "Nepali speech and English speech with speech-to-text and text-to-speech"
    )
    assert (
        resolve_nepali_english_speech_channel_consume_mode(
            req.nepali_english_speech_channel_bundle,
            allow_asr=True,
        )
        == "INVOKE_ASR"
    )
    assert (
        resolve_nepali_english_speech_channel_consume_mode(
            req.nepali_english_speech_channel_bundle,
            allow_tts=True,
        )
        == "INVOKE_TTS"
    )
    obs = nepali_english_speech_channel_consume_observability(
        req, allow_asr=False, allow_tts=False
    )
    assert (
        obs["nepali_english_speech_channel_consume_mode"]
        == "CANDIDATE_ONLY"
    )
    assert obs["allow_asr"] is False
    assert obs["asr_live"] is False
    assert obs["tts_live"] is False
    assert obs["speech_channel_enabled"] is False


def test_adapter_metadata_consume() -> None:
    req = _pipeline(
        "Nepali speech and English speech with speech-to-text and text-to-speech"
    )
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    meta = (dto.metadata or {}).get("nepali_english_speech_channel") or {}
    assert (
        meta.get("nepali_english_speech_channel_consume_mode")
        == "CANDIDATE_ONLY"
    )
    assert (
        meta.get("nepali_english_speech_channel_consume_ready") is True
    )
    assert meta.get("speech_channel_enabled") is False
    assert meta.get("asr_live") is False
    assert meta.get("gap_p2_008_status") == "OPEN"
    assert meta.get("allow_asr") is False
    assert meta.get("is_execution_authority") is False
    cand = meta.get("nepali_english_speech_channel_candidate") or {}
    assert cand.get("asr_plan") is None
    assert cand.get("definitive_answer") is None


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai50"
        / "frozen"
        / "nepali_english_speech_channel_consume_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        if case.get("synthetic_meta"):
            mode = resolve_nepali_english_speech_channel_consume_mode(
                case["synthetic_meta"],
                allow_asr=bool(case.get("allow_asr", False)),
                allow_tts=bool(case.get("allow_tts", False)),
            )
        else:
            req = _pipeline(case["text"])
            mode = resolve_nepali_english_speech_channel_consume_mode(
                req.nepali_english_speech_channel_bundle,
                allow_asr=bool(case.get("allow_asr", False)),
                allow_tts=bool(case.get("allow_tts", False)),
            )
        if case.get("expected_mode"):
            assert mode == case["expected_mode"], case["case_id"]
