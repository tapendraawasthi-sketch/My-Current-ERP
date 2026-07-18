"""Ports for MAI-07 transliteration."""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from .....contracts.transliteration import TransliterationCandidateV1


@runtime_checkable
class TransliterationCandidateGeneratorPort(Protocol):
    def generate(
        self,
        surface: str,
        *,
        language_form: str,
        neighbors: tuple[str, ...] = (),
        use_context: bool = True,
    ) -> list[TransliterationCandidateV1]:
        ...


@runtime_checkable
class TransliterationCandidateRankerPort(Protocol):
    def rank(
        self,
        candidates: list[TransliterationCandidateV1],
        *,
        surface: str,
        language_form: str,
        neighbors: tuple[str, ...] = (),
        use_context: bool = True,
    ) -> list[TransliterationCandidateV1]:
        ...


@runtime_checkable
class TransliterationResourcePort(Protocol):
    @property
    def version(self) -> str:
        ...

    @property
    def content_hash(self) -> str:
        ...
