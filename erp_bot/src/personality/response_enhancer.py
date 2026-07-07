"""Natural-language response polish — preserves numbers exactly."""

from __future__ import annotations

import logging
import re

from ollama import Client

from ..config import FAST_MODEL, OLLAMA_BASE_URL

logger = logging.getLogger(__name__)

ENHANCEMENT_PROMPT = """You are enhancing an accounting AI response to sound natural and warm.
Language preference: {language}

Rules:
1. Keep ALL numbers EXACTLY as given
2. Add warmth; max 2 emoji
3. Keep concise — max 3 sentences for simple entries
4. Do NOT change account names or accounting logic

Return ONLY the enhanced text."""


class ResponseEnhancer:
  def enhance(self, raw_response: str, context: dict) -> str:
    if len(raw_response) < 20:
      return raw_response

    language = context.get("language_preference", "romanized_nepali")
    try:
      client = Client(host=OLLAMA_BASE_URL)
      response = client.chat(
        model=FAST_MODEL,
        messages=[
          {
            "role": "user",
            "content": ENHANCEMENT_PROMPT.format(language=language)
            + f"\n\nEnhance:\n{raw_response}",
          }
        ],
        options={"temperature": 0.5, "num_ctx": 1024},
      )
      enhanced = (response.message.content or "").strip()
      orig_nums = set(re.findall(r"\d+(?:,\d+)*(?:\.\d+)?", raw_response))
      new_nums = set(re.findall(r"\d+(?:,\d+)*(?:\.\d+)?", enhanced))
      if orig_nums != new_nums:
        return raw_response
      return enhanced or raw_response
    except Exception as exc:
      logger.warning("Enhancement failed: %s", exc)
      return raw_response


_enhancer: ResponseEnhancer | None = None


def get_response_enhancer() -> ResponseEnhancer:
  global _enhancer
  if _enhancer is None:
    _enhancer = ResponseEnhancer()
  return _enhancer
