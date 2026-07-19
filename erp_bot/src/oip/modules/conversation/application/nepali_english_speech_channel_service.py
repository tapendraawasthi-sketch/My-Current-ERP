"""MAI-50 — Nepali/English speech channel policy (never enables live speech).

Slice 1: declare candidate speech-channel policy from cue detection.
Slice 2 consume is in nepali_english_speech_channel_consume_service.
Never claims speech enabled, ASR/TTS live, microphone armed, or audio persisted.
"""

from __future__ import annotations

import re
from typing import Any

from ....contracts.nepali_english_speech_channel import (
    NepaliEnglishSpeechChannelBundleV1,
    NepaliEnglishSpeechChannelReadiness,
    NepaliEnglishSpeechChannelStatus,
    NepaliEnglishSpeechChannelTopic,
)
from ....contracts.request import CanonicalAIRequestV1

RUNTIME_VERSION = "mai-50.0.2-slice2"
AUTHORITY = "ADR_0067"

_VOICE = re.compile(
    r"\b(?:voice\s+channel|speech\s+channel)\b",
    re.I,
)
_ASR = re.compile(
    r"\b(?:speech[- ]?to[- ]?text|speech\s+input|\basr\b|\bstt\b)\b",
    re.I,
)
_TTS = re.compile(
    r"\b(?:text[- ]?to[- ]?speech|speech\s+output|\btts\b)\b",
    re.I,
)
_NEPALI = re.compile(
    r"\b(?:nepali\s+(?:speech|voice)|नेपाली\s*(?:बोली|आवाज))\b",
    re.I,
)
_ENGLISH = re.compile(
    r"\b(?:english\s+(?:speech|voice))\b",
    re.I,
)
_BILINGUAL = re.compile(
    r"\b(?:bilingual\s+(?:speech|voice)|code[- ]?mix(?:ed)?\s+speech)\b",
    re.I,
)
_MIC = re.compile(
    r"\b(?:microphone(?:\s+capture)?|\bmic\s+capture\b)\b",
    re.I,
)
_UNSUPPORTED = re.compile(
    r"\b(?:customs|excise|भन्सार|अन्तःशुल्क|telephony\s+ivr)\b",
    re.I,
)


def _detect_topics(text: str) -> tuple[list[str], list[str]]:
    in_scope: list[str] = []
    unsupported: list[str] = []
    raw = text or ""
    if _ASR.search(raw):
        in_scope.append(NepaliEnglishSpeechChannelTopic.SPEECH_INPUT.value)
    if _TTS.search(raw):
        in_scope.append(NepaliEnglishSpeechChannelTopic.SPEECH_OUTPUT.value)
    if _NEPALI.search(raw):
        in_scope.append(NepaliEnglishSpeechChannelTopic.NEPALI_SPEECH.value)
    if _ENGLISH.search(raw):
        in_scope.append(NepaliEnglishSpeechChannelTopic.ENGLISH_SPEECH.value)
    if _BILINGUAL.search(raw):
        in_scope.append(NepaliEnglishSpeechChannelTopic.BILINGUAL_SPEECH.value)
    if _VOICE.search(raw):
        in_scope.append(NepaliEnglishSpeechChannelTopic.VOICE_CHANNEL.value)
    if _MIC.search(raw):
        in_scope.append(
            NepaliEnglishSpeechChannelTopic.MICROPHONE_CAPTURE.value
        )
    if _UNSUPPORTED.search(raw) and not in_scope:
        unsupported.append(NepaliEnglishSpeechChannelTopic.UNSUPPORTED.value)
    return in_scope, unsupported


def build_nepali_english_speech_channel_bundle(
    request: CanonicalAIRequestV1,
) -> NepaliEnglishSpeechChannelBundleV1:
    in_scope, unsupported = _detect_topics(request.raw_text or "")
    if not in_scope and unsupported:
        return NepaliEnglishSpeechChannelBundleV1(
            analysis_status=NepaliEnglishSpeechChannelStatus.COMPLETE,
            runtime_version=RUNTIME_VERSION,
            nepali_english_speech_channel_readiness=(
                NepaliEnglishSpeechChannelReadiness.BLOCKED
            ),
            unsupported_topics=tuple(unsupported),
            reason_codes=(
                "UNSUPPORTED_TOPIC_OUTSIDE_PILOT",
                "NEPALI_ENGLISH_SPEECH_CHANNEL_BLOCKED",
                "NO_SPEECH_AUTHORITY",
                "GAP_P2_008_OPEN",
            ),
            warnings=(
                "UNSUPPORTED_TOPIC_DOCUMENTED",
                "GAP_P2_008_REMAINS_OPEN",
            ),
        )

    if not in_scope:
        return NepaliEnglishSpeechChannelBundleV1(
            analysis_status=NepaliEnglishSpeechChannelStatus.SKIP,
            runtime_version=RUNTIME_VERSION,
            nepali_english_speech_channel_readiness=(
                NepaliEnglishSpeechChannelReadiness.NOT_APPLICABLE
            ),
            reason_codes=(
                "NO_IN_SCOPE_NEPALI_ENGLISH_SPEECH_CHANNEL_TOPIC",
            ),
            warnings=("NEPALI_ENGLISH_SPEECH_CHANNEL_NOT_APPLICABLE",),
        )

    pilot_ready = (
        NepaliEnglishSpeechChannelReadiness.SCOPE_PARTIAL
        if unsupported
        else NepaliEnglishSpeechChannelReadiness.POLICY_DECLARED
    )
    reasons = [
        "PILOT_SCOPE_NEPALI_ENGLISH_SPEECH_CHANNEL_CANDIDATE_ONLY",
        "RELEASE_SUITE_NOT_RELEASED",
        "GOLD_QUESTIONS_NOT_RELEASED",
        "SPECIALIST_SIGNOFF_NOT_SIGNED",
        "NO_SPEECH_AUTHORITY",
        "SPEECH_CHANNEL_NOT_ENABLED",
        "ASR_NOT_LIVE",
        "TTS_NOT_LIVE",
        "MICROPHONE_NOT_ARMED",
        "AUDIO_NOT_PERSISTED",
        "TRANSCRIPT_NOT_AUTHORITATIVE",
        "VOICE_CHANNEL_NOT_RELEASED",
        "SPEECH_NOT_VERIFIED",
        "PRODUCTION_NOT_APPROVED",
        "GAP_P2_008_OPEN",
        *tuple(f"TOPIC_{t}" for t in in_scope),
    ]
    return NepaliEnglishSpeechChannelBundleV1(
        analysis_status=NepaliEnglishSpeechChannelStatus.COMPLETE,
        runtime_version=RUNTIME_VERSION,
        nepali_english_speech_channel_readiness=pilot_ready,
        in_scope_topics=tuple(in_scope),
        unsupported_topics=tuple(unsupported),
        reason_codes=tuple(reasons),
        warnings=(
            "GAP_P2_008_REMAINS_OPEN",
            "NEPALI_ENGLISH_SPEECH_CHANNEL_CANDIDATE_ONLY",
            "MUST_NOT_CLAIM_SPEECH_ENABLED",
            "SPECIALIST_SIGNOFF_PENDING",
            "NOT_PRODUCTION_APPROVED",
        ),
    )


def attach_nepali_english_speech_channel_to_request(
    request: CanonicalAIRequestV1,
) -> CanonicalAIRequestV1:
    bundle = build_nepali_english_speech_channel_bundle(request)
    return request.model_copy(
        update={"nepali_english_speech_channel_bundle": bundle}
    )


def assert_nepali_english_speech_channel_authority(
    bundle: NepaliEnglishSpeechChannelBundleV1 | None,
) -> None:
    if bundle is None:
        return
    if (
        bundle.is_execution_authority
        or bundle.mutation_tools_allowed
        or bundle.speech_authority_claimed
        or bundle.speech_channel_enabled
        or bundle.asr_live
        or bundle.tts_live
        or bundle.microphone_armed
        or bundle.audio_persisted
        or bundle.transcript_authoritative
        or bundle.voice_channel_released
        or bundle.speech_verified
        or bundle.production_approved
        or bundle.current_law_definitive
        or bundle.legal_effective_dates_proven
        or bundle.claims_verified
        or bundle.legal_proof_claimed
        or bundle.kb_retrieval_invoked
        or bundle.documents_retrieved != 0
        or bundle.draft_mutations != 0
        or bundle.posting_mutations != 0
        or bundle.gap_p2_008_status != "OPEN"
        or bundle.specialist_signoff_status != "NOT_SIGNED"
        or bundle.release_status != "NOT_RELEASED"
        or bundle.gold_questions_status != "NOT_RELEASED"
        or bundle.pilot_scope
        != "NEPALI_ENGLISH_SPEECH_CHANNEL_CANDIDATE_ONLY"
    ):
        raise RuntimeError("NEPALI_ENGLISH_SPEECH_CHANNEL_AUTHORITY")


def nepali_english_speech_channel_to_metadata(
    bundle: NepaliEnglishSpeechChannelBundleV1 | None,
) -> dict[str, Any]:
    if bundle is None:
        return {}
    return {
        "analysis_status": bundle.analysis_status.value,
        "runtime_version": bundle.runtime_version,
        "nepali_english_speech_channel_readiness": (
            bundle.nepali_english_speech_channel_readiness.value
        ),
        "pilot_scope": "NEPALI_ENGLISH_SPEECH_CHANNEL_CANDIDATE_ONLY",
        "in_scope_topics": list(bundle.in_scope_topics),
        "unsupported_topics": list(bundle.unsupported_topics),
        "release_status": "NOT_RELEASED",
        "gold_questions_status": "NOT_RELEASED",
        "specialist_signoff_status": "NOT_SIGNED",
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
        "gap_p2_008_status": "OPEN",
        "kb_retrieval_invoked": False,
        "documents_retrieved": 0,
        "draft_mutations": 0,
        "posting_mutations": 0,
        "reason_codes": list(bundle.reason_codes),
        "warnings": list(bundle.warnings),
        "is_execution_authority": False,
    }
