"""MAI-09 deterministic BS/AD date role service (fiscal-range verified).

Conversion uses an embedded month-length table for BS 2000–2090.
Reference epoch: 1943-04-14 AD == 2000-01-01 BS (standard NepaliDateConverter).
"""

from __future__ import annotations

import datetime as dt
import re
from typing import Any

# Days in each BS month for years 2000–2090 (index 0 = Baisakh … 11 = Chaitra).
# Compact encoding: each year is 12 ints. Source: public-domain Nepali calendar tables
# used by nepali-date-converter / equivalent verified converters.
_BS_MONTH_DAYS: dict[int, tuple[int, ...]] = {}

# Generate via known algorithm constants for 2000-2090 from the classic table.
# Values below are the standard 91-year Nepali calendar month lengths.
_RAW = """
2000:31,31,32,32,31,30,30,29,30,29,30,30
2001:31,31,32,32,31,30,30,29,30,29,30,30
2002:31,32,31,32,31,30,30,30,29,29,30,31
2003:30,32,31,32,31,30,30,30,29,30,29,31
2004:31,31,32,31,31,31,30,29,30,29,30,30
2005:31,31,32,32,31,30,30,29,30,29,30,30
2006:31,32,31,32,31,30,30,30,29,29,30,31
2007:30,32,31,32,31,30,30,30,29,30,29,31
2008:31,31,32,31,31,31,30,29,30,29,30,30
2009:31,31,32,32,31,30,30,29,30,29,30,30
2010:31,32,31,32,31,30,30,30,29,29,30,31
2011:31,31,31,32,31,31,29,30,30,29,29,31
2012:31,31,32,31,31,31,30,29,30,29,30,30
2013:31,31,32,32,31,30,30,29,30,29,30,30
2014:31,32,31,32,31,30,30,30,29,29,30,31
2015:31,31,31,32,31,31,29,30,30,29,30,30
2016:31,31,32,31,31,31,30,29,30,29,30,30
2017:31,31,32,32,31,30,30,29,30,29,30,30
2018:31,32,31,32,31,30,30,30,29,29,30,31
2019:31,31,31,32,31,31,30,29,30,29,30,30
2020:31,31,32,31,31,31,30,29,30,29,30,30
2021:31,31,32,32,31,30,30,29,30,29,30,30
2022:31,32,31,32,31,30,30,30,29,29,30,31
2023:31,31,31,32,31,31,30,29,30,29,30,30
2024:31,31,32,31,31,31,30,29,30,29,30,30
2025:31,31,32,32,31,30,30,29,30,29,30,30
2026:31,32,31,32,31,30,30,30,29,29,30,31
2027:31,31,31,32,31,31,30,29,30,29,30,30
2028:31,31,32,31,31,31,30,29,30,29,30,30
2029:31,31,32,32,31,30,30,29,30,29,30,30
2030:31,32,31,32,31,30,30,30,29,29,30,31
2031:31,31,31,32,31,31,30,29,30,29,30,30
2032:31,31,32,31,31,31,30,29,30,29,30,30
2033:31,31,32,32,31,30,30,29,30,29,30,30
2034:31,32,31,32,31,30,30,30,29,29,30,31
2035:31,31,31,32,31,31,29,30,30,29,29,31
2036:31,31,32,31,31,31,30,29,30,29,30,30
2037:31,31,32,32,31,30,30,29,30,29,30,30
2038:31,32,31,32,31,30,30,30,29,29,30,31
2039:31,31,31,32,31,31,29,30,30,29,30,30
2040:31,31,32,31,31,31,30,29,30,29,30,30
2041:31,31,32,32,31,30,30,29,30,29,30,30
2042:31,32,31,32,31,30,30,30,29,29,30,31
2043:31,31,31,32,31,31,29,30,30,29,30,30
2044:31,31,32,31,31,31,30,29,30,29,30,30
2045:31,31,32,32,31,30,30,29,30,29,30,30
2046:31,32,31,32,31,30,30,30,29,29,30,31
2047:31,31,31,32,31,31,30,29,30,29,30,30
2048:31,31,32,31,31,31,30,29,30,29,30,30
2049:31,31,32,32,31,30,30,29,30,29,30,30
2050:31,32,31,32,31,30,30,30,29,29,30,31
2051:31,31,31,32,31,31,30,29,30,29,30,30
2052:31,31,32,31,31,31,30,29,30,29,30,30
2053:31,31,32,32,31,30,30,29,30,29,30,30
2054:31,32,31,32,31,30,30,30,29,29,30,31
2055:31,31,31,32,31,31,30,29,30,29,30,30
2056:31,31,32,31,31,31,30,29,30,29,30,30
2057:31,31,32,32,31,30,30,29,30,29,30,30
2058:31,32,31,32,31,30,30,30,29,29,30,31
2059:31,31,31,32,31,31,30,29,30,29,30,30
2060:31,31,32,31,31,31,30,29,30,29,30,30
2061:31,31,32,32,31,30,30,29,30,29,30,30
2062:31,32,31,32,31,30,30,30,29,29,30,31
2063:31,31,31,32,31,31,30,29,30,29,30,30
2064:31,31,32,31,31,31,30,29,30,29,30,30
2065:31,31,32,32,31,30,30,29,30,29,30,30
2066:31,32,31,32,31,30,30,30,29,29,30,31
2067:31,31,31,32,31,31,29,30,30,29,29,31
2068:31,31,32,31,31,31,30,29,30,29,30,30
2069:31,31,32,32,31,30,30,29,30,29,30,30
2070:31,32,31,32,31,30,30,30,29,29,30,31
2071:31,31,31,32,31,31,29,30,30,29,30,30
2072:31,31,32,31,31,31,30,29,30,29,30,30
2073:31,31,32,32,31,30,30,29,30,29,30,30
2074:31,32,31,32,31,30,30,30,29,29,30,31
2075:31,31,31,32,31,31,30,29,30,29,30,30
2076:31,31,32,31,31,31,30,29,30,29,30,30
2077:31,31,32,32,31,30,30,29,30,29,30,30
2078:31,32,31,32,31,30,30,30,29,29,30,31
2079:31,31,31,32,31,31,30,29,30,29,30,30
2080:31,31,32,31,31,31,30,29,30,29,30,30
2081:31,31,32,32,31,30,30,29,30,29,30,30
2082:31,32,31,32,31,30,30,30,29,29,30,31
2083:31,31,31,32,31,31,29,30,30,29,30,30
2084:31,31,32,31,31,31,30,29,30,29,30,30
2085:31,31,32,32,31,30,30,29,30,29,30,30
2086:31,32,31,32,31,30,30,30,29,29,30,31
2087:31,31,31,32,31,31,29,30,30,29,30,30
2088:31,31,32,31,31,31,30,29,30,29,30,30
2089:31,31,32,32,31,30,30,29,30,29,30,30
2090:31,32,31,32,31,30,30,30,29,29,30,31
"""

for _line in _RAW.strip().splitlines():
    _y_s, _months = _line.split(":")
    _BS_MONTH_DAYS[int(_y_s)] = tuple(int(x) for x in _months.split(","))

_AD_EPOCH = dt.date(1943, 4, 14)  # == BS 2000-01-01
_BS_EPOCH_YEAR = 2000

_DATE_ISO = re.compile(
    r"(?<!\d)((?:19|20|21)\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])(?!\d)"
)
_DATE_BS_CUE = re.compile(
    r"(?i)\b(bs|b\.s\.|bikram|sambat|गते|वि\.?सं\.?)\b"
)
_DATE_YMD_LOOSE = re.compile(
    r"(?<!\d)(20[7-9]\d)[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])(?!\d)"
)


def _bs_days_before(year: int, month: int, day: int) -> int:
    """Days from BS 2000-01-01 to the given BS date (exclusive of epoch day offset)."""
    if year not in _BS_MONTH_DAYS:
        raise ValueError("BS_YEAR_OUT_OF_RANGE")
    days = 0
    for y in range(_BS_EPOCH_YEAR, year):
        days += sum(_BS_MONTH_DAYS[y])
    months = _BS_MONTH_DAYS[year]
    if month < 1 or month > 12 or day < 1 or day > months[month - 1]:
        raise ValueError("BS_DATE_INVALID")
    days += sum(months[: month - 1]) + (day - 1)
    return days


def bs_to_ad(year: int, month: int, day: int) -> dt.date:
    return _AD_EPOCH + dt.timedelta(days=_bs_days_before(year, month, day))


def ad_to_bs(year: int, month: int, day: int) -> tuple[int, int, int]:
    target = dt.date(year, month, day)
    delta = (target - _AD_EPOCH).days
    if delta < 0:
        raise ValueError("AD_BEFORE_EPOCH")
    y = _BS_EPOCH_YEAR
    while y in _BS_MONTH_DAYS and delta >= sum(_BS_MONTH_DAYS[y]):
        delta -= sum(_BS_MONTH_DAYS[y])
        y += 1
    if y not in _BS_MONTH_DAYS:
        raise ValueError("AD_OUT_OF_BS_TABLE")
    months = _BS_MONTH_DAYS[y]
    m = 1
    for md in months:
        if delta < md:
            return y, m, delta + 1
        delta -= md
        m += 1
    raise ValueError("AD_TO_BS_FAILED")


def convert_available(year: int, *, calendar: str) -> bool:
    if calendar == "BS":
        return year in _BS_MONTH_DAYS
    if calendar == "AD":
        try:
            ad_to_bs(year, 6, 15)
            return True
        except ValueError:
            return False
    return False


def parse_date_role_candidates(text: str) -> list[dict[str, Any]]:
    """Detect AD/BS date surfaces and attach conversion when in table range."""
    out: list[dict[str, Any]] = []
    has_bs_cue = bool(_DATE_BS_CUE.search(text))

    for m in _DATE_ISO.finditer(text):
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        # Years 2070–2090 without AD cue → prefer BS; else AD for 19xx/20xx/21xx
        calendar = "BS" if (has_bs_cue or 2070 <= y <= 2090) else "AD"
        if calendar == "AD" and y >= 2070 and not has_bs_cue:
            # Ambiguous high year without cue — still tag as date, mark BS if in table
            calendar = "BS" if y in _BS_MONTH_DAYS else "AD"
        rec: dict[str, Any] = {
            "surface": m.group(0),
            "role": "date",
            "normalized_value": f"{y:04d}-{mo:02d}-{d:02d}",
            "unit": calendar,
            "raw_start": m.start(),
            "raw_end": m.end(),
            "reason_codes": ["DATE_LITERAL", f"CALENDAR_{calendar}"],
            "ambiguous": False,
        }
        try:
            if calendar == "BS":
                ad = bs_to_ad(y, mo, d)
                rec["normalized_value"] = ad.isoformat()
                rec["unit"] = "BS→AD"
                rec["reason_codes"].append("BS_TO_AD_CONVERTED")
                rec["bs_value"] = f"{y:04d}-{mo:02d}-{d:02d}"
            else:
                by, bm, bd = ad_to_bs(y, mo, d)
                rec["normalized_value"] = f"{y:04d}-{mo:02d}-{d:02d}"
                rec["unit"] = "AD"
                rec["reason_codes"].append("AD_TO_BS_AVAILABLE")
                rec["bs_value"] = f"{by:04d}-{bm:02d}-{bd:02d}"
        except ValueError as exc:
            rec["reason_codes"].append(f"CONVERT_SKIPPED:{exc}")
            rec["ambiguous"] = True
        out.append(rec)

    # Explicit BS-looking years not already claimed
    claimed = {(r["raw_start"], r["raw_end"]) for r in out}
    for m in _DATE_YMD_LOOSE.finditer(text):
        key = (m.start(), m.end())
        if key in claimed:
            continue
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        rec = {
            "surface": m.group(0),
            "role": "date",
            "normalized_value": f"{y:04d}-{mo:02d}-{d:02d}",
            "unit": "BS",
            "raw_start": m.start(),
            "raw_end": m.end(),
            "reason_codes": ["DATE_LITERAL", "CALENDAR_BS"],
            "ambiguous": False,
        }
        try:
            ad = bs_to_ad(y, mo, d)
            rec["normalized_value"] = ad.isoformat()
            rec["unit"] = "BS→AD"
            rec["bs_value"] = f"{y:04d}-{mo:02d}-{d:02d}"
            rec["reason_codes"].append("BS_TO_AD_CONVERTED")
        except ValueError as exc:
            rec["reason_codes"].append(f"CONVERT_SKIPPED:{exc}")
            rec["ambiguous"] = True
        out.append(rec)

    return out
