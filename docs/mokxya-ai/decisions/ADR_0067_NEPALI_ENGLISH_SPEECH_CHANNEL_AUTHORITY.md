# ADR_0067 — Nepali/English Speech Channel Authority

- **Status:** Accepted (2026-07-19)
- **Phase:** MAI-50-NEPALI-ENGLISH-SPEECH-CHANNEL (slice 1)
- **Extends:** ADR_0001, ADR_0003

## Context

MAI-36–49 cover legal research through production-capability-release
candidates. A Nepali/English speech channel needs an explicit candidate
policy before any live ASR/TTS, microphone arming, or audio persistence.

## Decision

1. MAI-50 owns `NepaliEnglishSpeechChannelBundleV1` on
   `CanonicalAIRequestV1` after PRODUCTION_CAPABILITY_RELEASE.
2. Semantic gate: cue detection only (speech/voice channel, ASR/STT,
   TTS, Nepali/English/bilingual speech, microphone capture) — **not**
   MAI-49 production approval or prior cutover claims.
3. Slice 1: declare
   `pilot_scope=NEPALI_ENGLISH_SPEECH_CHANNEL_CANDIDATE_ONLY`,
   `release_status=NOT_RELEASED`,
   `gold_questions_status=NOT_RELEASED`,
   `specialist_signoff_status=NOT_SIGNED`,
   `speech_channel_enabled=false`,
   `asr_live=false`,
   `tts_live=false`,
   `microphone_armed=false`,
   `audio_persisted=false`,
   `transcript_authoritative=false`,
   `voice_channel_released=false`,
   `speech_verified=false`,
   `production_approved=false`,
   `gap_p2_008_status=OPEN`.
4. Never invent live speech, ASR/TTS enablement, or microphone arming from
   cue detection alone.
5. Engineering-gated: ledger `production_approved=false` remains false.

## Rejected

| Alternative | Why |
|-------------|-----|
| Gate on MAI-49 production_approved | Production remains unapproved |
| Enable ASR/TTS from cues | Specialist + privacy review required |
| Arm microphone / persist audio from cues | Explicit consent + storage policy required |
| Close GAP-P2-008 / GAP-P0-001 | Honesty + security review still required |
| Treat InputChannelV1.VOICE as live | Enum presence ≠ channel enabled |

## Related

- `docs/mokxya-ai/MAI_50_NEPALI_ENGLISH_SPEECH_CHANNEL.md`
- `docs/mokxya-ai/baselines/MAI_50_SLICE1_BASELINE_SUMMARY.md`
- `erp_bot/src/oip/modules/conversation/application/nepali_english_speech_channel_service.py`
