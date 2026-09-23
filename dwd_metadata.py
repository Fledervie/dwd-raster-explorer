"""Documented metadata for classic DWD CDC grids_germany ASCII products.

Unknown products remain readable as grids, but their values stay in the source
unit until a product description confirms a conversion.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

DWD_ROOT = "https://opendata.dwd.de/climate_environment/CDC/grids_germany/"
MONTHS = ("Januar", "Februar", "März", "April", "Mai", "Juni", "Juli",
          "August", "September", "Oktober", "November", "Dezember")
SEASONS = {13: "Frühling", 14: "Sommer", 15: "Herbst", 16: "Winter"}
PERIOD_NAMES = {"monthly": "Monatsmittel", "annual": "Jahresmittel",
                "seasonal": "Jahreszeitenmittel", "multi_annual": "Vieljähriges Mittel"}

# Product keys and conversions are backed by the DWD dataset descriptions.
PRODUCTS = {
    "air_temp_max": ("Durchschnittliche Tageshöchsttemperatur", "air_temperature_max", "°C", 0.1, "climate"),
    "air_temp_mean": ("Durchschnittliche Lufttemperatur", "air_temperature_mean", "°C", 0.1, "climate"),
    "air_temp_min": ("Durchschnittliche Tagestiefsttemperatur", "air_temperature_min", "°C", 0.1, "climate"),
    "precipitation": ("Niederschlagssumme", "precipitation", "mm", 1.0, "precip"),
    "sunshine_duration": ("Sonnenscheindauer", "sunshine_duration", "h", 1.0, "terrain"),
}

NAME_PATTERN = re.compile(
    r"^grids_germany_(monthly|annual|seasonal|multi_annual)_(.+?)_"
    r"((?:18|19|20)\d{2}(?:-(?:18|19|20)\d{2})?)_?"
    r"(0[1-9]|1[0-7])\.asc(?:\.gz)?$", re.I,
)


@dataclass(frozen=True)
class DwdMetadata:
    title: str
    period_label: str
    timestamp: str
    description: str
    description_url: str
    product_key: str
    unit: str
    scale: float
    palette: str
    verified_unit: bool


def describe_dwd_grid(name: str, source_url: str = "") -> DwdMetadata | None:
    match = NAME_PATTERN.fullmatch(name)
    if not match:
        return None
    frequency, product, years, code_text = match.groups()
    frequency, product, code = frequency.lower(), product.lower(), int(code_text)
    if ((frequency == "monthly" and code > 12)
            or (frequency == "annual" and code != 17)
            or (frequency == "seasonal" and code not in SEASONS)):
        return None
    period = (f"{MONTHS[code - 1]} {years}" if code <= 12 else
              f"{SEASONS[code]} {years}" if code in SEASONS else years)
    timestamp = f"{years}/{code:02d}" if "-" in years and code != 17 else (
        f"{years}-{code:02d}" if code != 17 else years)
    known = PRODUCTS.get(product)
    if known:
        title, directory, unit, scale, palette = known
        document = (f"{DWD_ROOT}{frequency}/{directory}/"
                    f"BESCHREIBUNG_gridsgermany_{frequency}_{directory}_de.pdf")
        # These five families have documented monthly/annual products. Temperature
        # products also have seasonal and multi-annual descriptions.
        verified = frequency in ("monthly", "annual") or product.startswith("air_temp_")
        if not verified:
            document = f"{DWD_ROOT}{frequency}/{directory}/"
            unit, scale = "", 1.0
    else:
        title = product.replace("_", " ").capitalize()
        parts = source_url.removeprefix(DWD_ROOT).split("/") if source_url.startswith(DWD_ROOT) else []
        document = (f"{DWD_ROOT}{parts[0]}/{parts[1]}/"
                    if len(parts) >= 3 and parts[0] == frequency else f"{DWD_ROOT}{frequency}/{product}/")
        unit, scale, palette, verified = "", 1.0, "climate", False
    if product == "air_temp_max":
        description = f"{PERIOD_NAMES[frequency]} der täglichen Höchsttemperatur in 2 m Höhe"
    elif product == "air_temp_min":
        description = f"{PERIOD_NAMES[frequency]} der täglichen Tiefsttemperatur in 2 m Höhe"
    elif product == "air_temp_mean":
        description = f"{PERIOD_NAMES[frequency]} der Lufttemperatur in 2 m Höhe"
    elif product in ("precipitation", "sunshine_duration") and verified:
        quantity = "Niederschlagshöhe" if product == "precipitation" else "Sonnenscheindauer"
        description = f"{'Monats' if frequency == 'monthly' else 'Jahres'}summe der {quantity}"
    else:
        description = "Originalwerte des DWD-Rasters; Einheit in der Datensatzbeschreibung prüfen"
    if code == 16 and frequency in ("seasonal", "multi_annual"):
        description += "; Winter enthält den Dezember des Vorjahres"
    return DwdMetadata(title, period, timestamp, description, document,
                       f"{frequency}:{product}", unit, scale, palette, verified)
