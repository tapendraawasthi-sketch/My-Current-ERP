"""Socratic accounting tutor for education mode."""

from __future__ import annotations

from ollama import Client

from ..config import OLLAMA_BASE_URL, PRIMARY_MODEL, PRIMARY_MODEL_OPTIONS
from ..knowledge.nepal_accounting_kb import format_kb_snippet

TUTOR_SYSTEM_PROMPT = """You are a patient expert accounting teacher for Nepali small business owners.

Use REAL examples, speak in the user's language, and use daily-life analogies:
- Debit/Credit = khata ko duitai patti
- Assets = tapai sanga ke cha
- Liabilities = tirnu baki cha

Explain Nepal VAT (13%), TDS, SSF, fiscal year Shrawan-Ashad.
End with a practice prompt like: "Try: Ram lai 500 udhaar becheko"
"""


class AccountingTutor:
  def teach(self, question: str, context: dict | None = None) -> str:
    kb = format_kb_snippet(query=question)
    client = Client(host=OLLAMA_BASE_URL)
    messages = [
      {"role": "system", "content": TUTOR_SYSTEM_PROMPT},
    ]
    if kb:
      messages.append({"role": "system", "content": kb})
    messages.append({"role": "user", "content": question})

    response = client.chat(
      model=PRIMARY_MODEL,
      messages=messages,
      options={
        "temperature": float(PRIMARY_MODEL_OPTIONS.get("temperature", 0.3)),
        "num_ctx": int(PRIMARY_MODEL_OPTIONS.get("num_ctx", 8192)),
      },
    )
    return (response.message.content or "").strip()

  def follow_up_question(self, topic: str) -> str:
    return "Practice garnus? Udaharan: 'Ram lai 500 udhaar becheko'"


_tutor: AccountingTutor | None = None


def get_accounting_tutor() -> AccountingTutor:
  global _tutor
  if _tutor is None:
    _tutor = AccountingTutor()
  return _tutor
