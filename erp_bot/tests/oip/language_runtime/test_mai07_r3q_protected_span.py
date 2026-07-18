"""MAI-07R3Q protected-span highlight alignment tests."""

from __future__ import annotations

from oip.modules.language_runtime.transliteration.application.mai07_r3q_candidate_runtime import (
    CANDIDATE_RUNTIME_VERSION,
    DEFAULT_ACTIVE,
    load_r3q_resources,
    transliterate_r3q,
)
from oip.modules.language_runtime.transliteration.application.r3q_protected_span_align import (
    extract_highlighted_produced,
    highlighted_slice_preserved,
)


def test_r3q_identity_not_default_active():
    assert DEFAULT_ACTIVE is False
    assert CANDIDATE_RUNTIME_VERSION == "mai-07.1.12-r3q-protspan"


def test_split_email_protected_span_preserved():
    resources = load_r3q_resources()
    text = (
        "Do not mutate protected token EMAIL-user.syn@example.test-R095 "
        "inside the posting draft case 95 (synthetic email token)"
    )
    span = "EMAIL-user.syn@example.test-R095"
    bundle = transliterate_r3q(text, resources=resources)
    assert highlighted_slice_preserved(bundle, text, span)[0] is True
    produced, source, err = extract_highlighted_produced(bundle, text=text, span=span)
    assert err is None
    assert source == span
    assert produced[0].surface == span
    assert produced[0].is_identity is True


def test_bracketed_unicode_protected_span_preserved():
    resources = load_r3q_resources()
    text = "alignment challenge 0: keep surface [cafe\u0301] intact (combining acute)"
    span = "cafe\u0301"
    bundle = transliterate_r3q(text, resources=resources)
    assert highlighted_slice_preserved(bundle, text, span)[0] is True
    produced, source, _err = extract_highlighted_produced(bundle, text=text, span=span)
    assert produced[0].surface == span
    assert produced[0].is_identity is True
    assert source == span
