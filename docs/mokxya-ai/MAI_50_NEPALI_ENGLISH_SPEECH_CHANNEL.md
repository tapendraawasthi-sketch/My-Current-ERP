# MAI-50 — Nepali/English Speech Channel

**Date:** 2026-07-19  
**Status:** `IN_PROGRESS` (slice 1)  
**Authority:** [ADR_0067](decisions/ADR_0067_NEPALI_ENGLISH_SPEECH_CHANNEL_AUTHORITY.md)  
**Runtime:** `mai-50.0.1-slice1` (engineering; not production-approved)

## Objective

Declare a candidate policy for Nepali/English speech channel topics
(voice/speech channel, ASR/STT, TTS, Nepali/English/bilingual speech,
microphone capture) without enabling live speech, arming the microphone,
or persisting audio.

## Slice 1

1. Ingress `NEPALI_ENGLISH_SPEECH_CHANNEL_*` after
   PRODUCTION_CAPABILITY_RELEASE
2. Semantic input: cue detection (not MAI-49 production approval)
3. Scope: `NEPALI_ENGLISH_SPEECH_CHANNEL_CANDIDATE_ONLY`
4. Release / gold = `NOT_RELEASED`
5. Specialist sign-off = `NOT_SIGNED`
6. `speech_channel_enabled=false`; `asr_live=false`; `tts_live=false`;
   `microphone_armed=false`; `audio_persisted=false`;
   `transcript_authoritative=false`; `voice_channel_released=false`
7. GAP-P2-008 OPEN (and other open gaps remain open)

## Gates

| Case | Expect |
|------|--------|
| Speech / voice / ASR / TTS / Nepali / English / bilingual / mic cues | COMPLETE → `POLICY_DECLARED` |
| Purchase / VAT / production-release-only without speech cues | SKIP |
| Any live path | never enable speech / never arm mic; gaps OPEN |

## Non-goals

- Live ASR or TTS
- Microphone arming or audio persistence
- Closing GAP-P2-008 or GAP-P0-001
- Treating `InputChannelV1.VOICE` as an enabled channel
