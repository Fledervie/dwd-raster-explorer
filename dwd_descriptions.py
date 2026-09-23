"""Read the dataset description linked from a DWD grids_germany folder."""

from __future__ import annotations

import io
import re
from dataclasses import dataclass
from functools import lru_cache
from html import unescape
from urllib.parse import urljoin, urlparse

import requests
from pypdf import PdfReader

ROOT = "https://opendata.dwd.de/climate_environment/CDC/grids_germany/"
HEADERS = {"User-Agent": "DWD-Raster-Explorer/1.0"}


@dataclass(frozen=True)
class DatasetDescription:
    title: str
    parameter: str
    url: str
    unit: str = ""
    scale: float = 1.0
    verified_unit: bool = False


def product_folders(file_url: str) -> list[str]:
    if not file_url.startswith(ROOT):
        return []
    parts = urlparse(file_url).path.split("/grids_germany/", 1)[-1].split("/")
    if len(parts) < 3 or parts[0] not in ("annual", "monthly", "seasonal", "multi_annual"):
        return []
    directories = parts[:-1]
    return [ROOT + "/".join(directories[:depth]) + "/"
            for depth in range(len(directories), 1, -1)]


def parse_description(raw: bytes, url: str) -> DatasetDescription:
    text = PdfReader(io.BytesIO(raw)).pages[0].extract_text()
    title_match = re.search(r"DATENSATZBESCHREIBUNG\s+(.*?)\s+Version\b", text, re.S | re.I)
    parameter_match = re.search(r"\bParameter\s+(.+?)\s+Unsicherheiten\b", text, re.S | re.I)
    title = " ".join(title_match.group(1).split()) if title_match else ""
    parameter = " ".join(parameter_match.group(1).split()) if parameter_match else ""
    unit, scale, verified = unit_for_parameter(parameter)
    return DatasetDescription(title, parameter, url, unit, scale, verified)


def unit_for_parameter(parameter: str) -> tuple[str, float, bool]:
    unit, scale, verified = "", 1.0, False
    if re.search(r"Anzahl\s+der\s+.+?Tage\b|Anzahl\s+.+?Tage\b", parameter, re.I):
        unit, verified = "Tage", True
    elif re.search(r"\b(?:in\s+)?1\s*/\s*10\s*°\s*C\b", parameter, re.I):
        unit, scale, verified = "°C", 0.1, True
    elif re.search(r"\bin\s+°\s*C\b", parameter, re.I):
        unit, verified = "°C", True
    elif re.search(r"\bin\s+mm\b", parameter, re.I):
        unit, verified = "mm", True
    elif re.search(r"\bin\s+h\b", parameter, re.I):
        unit, verified = "h", True
    return unit, scale, verified


@lru_cache(maxsize=128)
def _fetch_folder(folder: str) -> DatasetDescription | None:
    listing = requests.get(folder, timeout=12, headers=HEADERS)
    listing.raise_for_status()
    hrefs = re.findall(r'href=["\']([^"\']+)["\']', listing.text, re.I)
    names = [unescape(h) for h in hrefs if re.match(r"BESCHREIBUNG_[^/]+_de\.pdf$", unescape(h), re.I)]
    if not names:
        return None
    pdf_url = urljoin(folder, names[0])
    if not pdf_url.startswith(folder):
        return None
    response = requests.get(pdf_url, timeout=25, headers=HEADERS)
    response.raise_for_status()
    if len(response.content) > 5_000_000:
        return None
    return parse_description(response.content, pdf_url)


def fetch_description(file_url: str) -> DatasetDescription | None:
    for folder in product_folders(file_url):
        try:
            description = _fetch_folder(folder)
        except (requests.RequestException, ValueError, OSError):
            continue
        if description:
            return description
    return None
