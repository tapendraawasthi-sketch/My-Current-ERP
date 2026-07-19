"""MAI-50 slice 1 — Nepali/English speech channel (never enables live speech)."""

from __future__ import annotations

from datetime import datetime, timezone

from src.oip.contracts.adapters.canonical_oip import CanonicalOipRequestAdapter
from src.oip.contracts.nepali_english_speech_channel import (
    NepaliEnglishSpeechChannelReadiness,
    NepaliEnglishSpeechChannelStatus,
)
from src.oip.contracts.request import (
    CanonicalAIRequestV1,
    InteractionModeV1,
    TrustedScopeV1,
)
from src.oip.modules.conversation.application.nepali_english_speech_channel_service import (
    RUNTIME_VERSION,
    assert_nepali_english_speech_channel_authority,
    attach_nepali_english_speech_channel_to_request,
    build_nepali_english_speech_channel_bundle,
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


def test_runtime_version() -> None:
    assert RUNTIME_VERSION.startswith("mai-50.")


def test_speech_channel_policy_declared() -> None:
    req = _pipeline(
        "Nepali speech and English speech with speech-to-text and text-to-speech"
    )
    bundle = req.nepali_english_speech_channel_bundle
    assert bundle is not None
    assert (
        bundle.analysis_status == NepaliEnglishSpeechChannelStatus.COMPLETE
    )
    assert (
        bundle.nepali_english_speech_channel_readiness
        == NepaliEnglishSpeechChannelReadiness.POLICY_DECLARED
    )
    assert "NEPALI_SPEECH" in bundle.in_scope_topics
    assert "ENGLISH_SPEECH" in bundle.in_scope_topics
    assert "SPEECH_INPUT" in bundle.in_scope_topics
    assert "SPEECH_OUTPUT" in bundle.in_scope_topics
    assert (
        bundle.pilot_scope
        == "NEPALI_ENGLISH_SPEECH_CHANNEL_CANDIDATE_ONLY"
    )
    assert bundle.release_status == "NOT_RELEASED"
    assert bundle.speech_channel_enabled is False
    assert bundle.asr_live is False
    assert bundle.tts_live is False
    assert bundle.microphone_armed is False
    assert bundle.audio_persisted is False
    assert bundle.transcript_authoritative is False
    assert bundle.voice_channel_released is False
    assert bundle.speech_verified is False
    assert bundle.production_approved is False
    assert bundle.gap_p2_008_status == "OPEN"
    assert bundle.is_execution_authority is False
    assert (
        "PILOT_SCOPE_NEPALI_ENGLISH_SPEECH_CHANNEL_CANDIDATE_ONLY"
        in bundle.reason_codes
    )
    assert "SPEECH_CHANNEL_NOT_ENABLED" in bundle.reason_codes
    assert_nepali_english_speech_channel_authority(bundle)


def test_voice_channel_and_microphone() -> None:
    req = _pipeline(
        "voice channel with microphone capture for bilingual speech"
    )
    bundle = req.nepali_english_speech_channel_bundle
    assert bundle is not None
    assert (
        bundle.analysis_status == NepaliEnglishSpeechChannelStatus.COMPLETE
    )
    assert "VOICE_CHANNEL" in bundle.in_scope_topics
    assert "MICROPHONE_CAPTURE" in bundle.in_scope_topics
    assert "BILINGUAL_SPEECH" in bundle.in_scope_topics
    assert bundle.speech_channel_enabled is False
    assert bundle.microphone_armed is False
    assert bundle.asr_live is False


def test_purchase_skips() -> None:
    req = _pipeline("Ram bata 500 ko saman kine")
    bundle = req.nepali_english_speech_channel_bundle
    assert bundle is not None
    assert bundle.analysis_status == NepaliEnglishSpeechChannelStatus.SKIP


def test_production_release_without_speech_skips() -> None:
    req = _pipeline(
        "production capability release with residual risk and owner sign-off"
    )
    bundle = req.nepali_english_speech_channel_bundle
    assert bundle is not None
    assert bundle.analysis_status == NepaliEnglishSpeechChannelStatus.SKIP


def test_adapter_metadata() -> None:
    req = _pipeline(
        "Nepali speech and English speech with speech-to-text and text-to-speech"
    )
    dto = CanonicalOipRequestAdapter().to_intelligence_dto(req, module="orbix")
    meta = (dto.metadata or {}).get("nepali_english_speech_channel") or {}
    assert meta.get("speech_channel_enabled") is False
    assert meta.get("asr_live") is False
    assert meta.get("tts_live") is False
    assert meta.get("microphone_armed") is False
    assert meta.get("production_approved") is False
    assert meta.get("gap_p2_008_status") == "OPEN"
    assert meta.get("is_execution_authority") is False


def test_build_direct() -> None:
    req = CanonicalAIRequestV1(
        request_id="req-1",
        correlation_id="corr-1",
        conversation_id="conv-1",
        message_id="msg-1",
        raw_text="ASR speech-to-text with TTS text-to-speech on speech channel",
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
    bundle = build_nepali_english_speech_channel_bundle(req)
    assert (
        bundle.analysis_status == NepaliEnglishSpeechChannelStatus.COMPLETE
    )
    assert "SPEECH_INPUT" in bundle.in_scope_topics
    assert "SPEECH_OUTPUT" in bundle.in_scope_topics
    assert "VOICE_CHANNEL" in bundle.in_scope_topics
    assert bundle.speech_channel_enabled is False


def test_frozen_eval_fixtures() -> None:
    import json
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[4]
        / "evals"
        / "mai50"
        / "frozen"
        / "nepali_english_speech_channel_v1.jsonl"
    )
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        case = json.loads(line)
        req = _pipeline(case["text"])
        bundle = req.nepali_english_speech_channel_bundle
        assert bundle is not None
        assert bundle.speech_channel_enabled is False
        assert bundle.asr_live is False
        assert bundle.tts_live is False
        assert bundle.microphone_armed is False
        assert bundle.gap_p2_008_status == "OPEN"
        assert bundle.is_execution_authority is False
        if case.get("expected_status"):
            assert bundle.analysis_status.value == case["expected_status"], case[
                "case_id"
            ]
        if case.get("expected_readiness"):
            assert (
                bundle.nepali_english_speech_channel_readiness.value
                == case["expected_readiness"]
            ), case["case_id"]
        if case.get("expected_topic"):
            assert case["expected_topic"] in bundle.in_scope_topics, case[
                "case_id"
            ]
