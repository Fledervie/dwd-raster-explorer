from __future__ import annotations

import gzip
import io
import math
import re
from dataclasses import dataclass
from datetime import datetime
from urllib.parse import urlparse

import numpy as np
from PIL import Image
from pyproj import CRS, Transformer

from dwd_metadata import describe_dwd_grid


HEADER_KEYS = {
    "ncols", "nrows", "xllcorner", "yllcorner", "xllcenter", "yllcenter",
    "cellsize", "dx", "dy", "nodata_value",
}


@dataclass
class RasterGrid:
    name: str
    values: np.ndarray
    ncols: int
    nrows: int
    xll: float
    yll: float
    dx: float
    dy: float
    nodata: float
    crs: CRS
    crs_source: str
    timestamp: str | None
    unit: str
    title: str = ""
    period_label: str = ""
    description: str = ""
    description_url: str = ""
    source_url: str = ""
    product_key: str = ""
    palette: str = "climate"
    verified_unit: bool = False

    @property
    def xmin(self): return self.xll
    @property
    def ymin(self): return self.yll
    @property
    def xmax(self): return self.xll + self.ncols * self.dx
    @property
    def ymax(self): return self.yll + self.nrows * self.dy

    def overlay_extent(self) -> tuple[float, float, float, float]:
        """Rectangle containing the grid in Leaflet's Web Mercator projection."""
        positions = np.linspace(0, 1, 65)
        x = self.xmin + positions * (self.xmax - self.xmin)
        y = self.ymin + positions * (self.ymax - self.ymin)
        edge_x = np.concatenate((x, x, np.full_like(y, self.xmin), np.full_like(y, self.xmax)))
        edge_y = np.concatenate((np.full_like(x, self.ymin), np.full_like(x, self.ymax), y, y))
        merc_x, merc_y = Transformer.from_crs(self.crs, 3857, always_xy=True).transform(edge_x, edge_y)
        return float(min(merc_x)), float(min(merc_y)), float(max(merc_x)), float(max(merc_y))

    def metadata(self, raster_id: str) -> dict:
        valid = self.values[np.isfinite(self.values)]
        west, south, east, north = self.overlay_extent()
        to_wgs = Transformer.from_crs(3857, 4326, always_xy=True)
        west, south = to_wgs.transform(west, south)
        east, north = to_wgs.transform(east, north)
        return {
            "id": raster_id, "name": self.name, "ncols": self.ncols,
            "nrows": self.nrows, "crs": self.crs.to_string(),
            "crsSource": self.crs_source, "timestamp": self.timestamp,
            "unit": self.unit, "min": float(valid.min()) if valid.size else None,
            "max": float(valid.max()) if valid.size else None,
            "bounds": [[south, west], [north, east]],
            "title": self.title or self.name, "periodLabel": self.period_label,
            "description": self.description, "descriptionUrl": self.description_url,
            "sourceUrl": self.source_url, "productKey": self.product_key,
            "palette": self.palette, "verifiedUnit": self.verified_unit,
        }

    def value_at(self, lon: float, lat: float) -> float | None:
        x, y = Transformer.from_crs(4326, self.crs, always_xy=True).transform(lon, lat)
        col = int(math.floor((x - self.xmin) / self.dx))
        row_from_bottom = int(math.floor((y - self.ymin) / self.dy))
        row = self.nrows - 1 - row_from_bottom
        if row < 0 or row >= self.nrows or col < 0 or col >= self.ncols:
            return None
        value = self.values[row, col]
        return None if not np.isfinite(value) else float(value)

    def png(self, palette: str = "climate", vmin: float | None = None,
            vmax: float | None = None, max_side: int = 1200) -> bytes:
        # Leaflet places image rows evenly in EPSG:3857, not evenly by latitude.
        # Sample at the centre of each displayed pixel in that same projection.
        west, south, east, north = self.overlay_extent()
        scale = min(1.0, max_side / max(self.ncols, self.nrows))
        height = max(2, round(self.nrows * scale))
        width = max(2, round(height * (east - west) / (north - south)))
        if width > max_side:
            width = max_side
            height = max(2, round(width * (north - south) / (east - west)))
        merc_x = west + (np.arange(width) + 0.5) * (east - west) / width
        merc_y = north - (np.arange(height) + 0.5) * (north - south) / height
        x_grid, y_grid = np.meshgrid(merc_x, merc_y)
        xs, ys = Transformer.from_crs(3857, self.crs, always_xy=True).transform(x_grid, y_grid)
        cols = np.floor((xs - self.xmin) / self.dx).astype(int)
        rows = self.nrows - 1 - np.floor((ys - self.ymin) / self.dy).astype(int)
        inside = (cols >= 0) & (cols < self.ncols) & (rows >= 0) & (rows < self.nrows)
        arr = np.full((height, width), np.nan, dtype=np.float32)
        arr[inside] = self.values[rows[inside], cols[inside]]
        valid = arr[np.isfinite(arr)]
        if not valid.size:
            raise ValueError("Das Raster enthält keine gültigen Werte.")
        lo = float(np.nanmin(self.values)) if vmin is None else vmin
        hi = float(np.nanmax(self.values)) if vmax is None else vmax
        if hi <= lo:
            hi = lo + 1
        norm = np.clip((arr - lo) / (hi - lo), 0, 1)
        norm[~np.isfinite(norm)] = 0
        rgba = colourize(norm, palette)
        rgba[~np.isfinite(arr), 3] = 0
        image = Image.fromarray(rgba)
        output = io.BytesIO()
        image.save(output, "PNG", optimize=True)
        return output.getvalue()


def colourize(norm: np.ndarray, palette: str) -> np.ndarray:
    palettes = {
        "climate": [(24, 52, 135), (35, 137, 218), (63, 190, 140), (248, 218, 89), (210, 55, 55)],
        "precip": [(247, 252, 253), (102, 194, 164), (44, 127, 184), (37, 52, 148)],
        "terrain": [(48, 120, 74), (209, 196, 125), (135, 87, 55), (245, 245, 240)],
        "gray": [(20, 20, 20), (245, 245, 245)],
    }
    stops = palettes.get(palette, palettes["climate"])
    pos = norm * (len(stops) - 1)
    low = np.floor(pos).astype(int)
    high = np.clip(low + 1, 0, len(stops) - 1)
    fraction = (pos - low)[..., None]
    colours = np.asarray(stops, dtype=float)
    rgb = colours[low] * (1 - fraction) + colours[high] * fraction
    alpha = np.full((*norm.shape, 1), 220)
    return np.concatenate([rgb, alpha], axis=2).astype(np.uint8)


def infer_crs(xll: float, yll: float, xmax: float, ymax: float) -> tuple[CRS, str]:
    if -180 <= xll <= 180 and -90 <= yll <= 90 and xmax <= 180 and ymax <= 90:
        return CRS.from_epsg(4326), "automatisch: geografische Koordinaten"
    if 3_000_000 <= xll <= 4_000_000 and 5_000_000 <= yll <= 7_000_000:
        return CRS.from_epsg(31467), "automatisch: DHDN / Gauß-Krüger Zone 3"
    if 2_000_000 <= xll <= 7_000_000 and 1_000_000 <= yll <= 6_000_000:
        return CRS.from_epsg(3035), "automatisch: ETRS89 / LAEA Europe"
    if 100_000 <= xll <= 900_000 and 5_000_000 <= yll <= 7_000_000:
        return CRS.from_epsg(25832), "automatisch: ETRS89 / UTM Zone 32N"
    raise ValueError("Koordinatensystem nicht eindeutig erkannt. Bitte EPSG-Code angeben.")


def extract_timestamp(name: str) -> str | None:
    dwd = describe_dwd_grid(name)
    if dwd:
        return dwd.timestamp
    matches = re.findall(r"(?<!\d)((?:18|19|20)\d{2})(\d{2})?(\d{2})?(?!\d)", name)
    if not matches:
        return None
    year, month, day = matches[-1]
    try:
        if day: return datetime(int(year), int(month), int(day)).date().isoformat()
        if month: return f"{year}-{month}"
        return year
    except ValueError:
        return None


def parse_ascii_grid(raw: bytes, name: str, epsg: str | None = None,
                     unit: str = "", source_url: str = "") -> RasterGrid:
    if raw[:2] == b"\x1f\x8b" or name.lower().endswith(".gz"):
        try:
            raw = gzip.decompress(raw)
        except gzip.BadGzipFile as exc:
            raise ValueError("Die Datei trägt .gz, ist aber nicht gültig gzip-komprimiert.") from exc
    text = raw.decode("utf-8-sig", errors="replace")
    lines = text.splitlines()
    header: dict[str, float] = {}
    data_start = 0
    for index, line in enumerate(lines[:20]):
        parts = line.strip().split()
        if len(parts) < 2 or parts[0].lower() not in HEADER_KEYS:
            data_start = index
            break
        try:
            header[parts[0].lower()] = float(parts[1].replace(",", "."))
        except ValueError as exc:
            raise ValueError(f"Ungültiger Headerwert in Zeile {index + 1}.") from exc
        data_start = index + 1
    for key in ("ncols", "nrows"):
        if key not in header:
            raise ValueError(f"Pflichtfeld {key} fehlt im ESRI-ASCII-Header.")
    ncols, nrows = int(header["ncols"]), int(header["nrows"])
    dx = header.get("dx", header.get("cellsize"))
    dy = header.get("dy", header.get("cellsize"))
    if not dx or not dy:
        raise ValueError("cellsize oder dx/dy fehlt im Header.")
    xll = header.get("xllcorner")
    yll = header.get("yllcorner")
    if xll is None and "xllcenter" in header: xll = header["xllcenter"] - dx / 2
    if yll is None and "yllcenter" in header: yll = header["yllcenter"] - dy / 2
    if xll is None or yll is None:
        raise ValueError("xllcorner/yllcorner oder Center-Koordinaten fehlen.")
    numbers = np.fromstring("\n".join(lines[data_start:]), sep=" ")
    expected = ncols * nrows
    if numbers.size != expected:
        raise ValueError(f"Erwartet: {expected:,} Rasterwerte; gefunden: {numbers.size:,}.")
    values = numbers.reshape((nrows, ncols)).astype(np.float32)
    dwd = describe_dwd_grid(name, source_url)
    nodata = header.get("nodata_value", -999.0 if dwd else -9999.0)
    values[values == nodata] = np.nan
    if dwd and dwd.verified_unit:
        values *= dwd.scale
        unit = dwd.unit
    xmax, ymax = xll + ncols * dx, yll + nrows * dy
    if epsg:
        try: crs, source = CRS.from_user_input(epsg), "manuell angegeben"
        except Exception as exc: raise ValueError(f"Ungültiges Koordinatensystem: {epsg}") from exc
    else:
        crs, source = infer_crs(xll, yll, xmax, ymax)
    source_parts = urlparse(source_url).path.split("/grids_germany/", 1)[-1].split("/") if "/grids_germany/" in source_url else []
    source_key = ":".join(source_parts[:2]) if len(source_parts) >= 3 else ""
    timestamp = extract_timestamp(name)
    return RasterGrid(name, values, ncols, nrows, xll, yll, dx, dy, nodata,
                      crs, source, timestamp, unit,
                      title=dwd.title if dwd else name,
                      period_label=dwd.period_label if dwd else timestamp or "",
                      description=dwd.description if dwd else "Originalwerte des Rasters",
                      description_url=dwd.description_url if dwd else "",
                      source_url=source_url,
                      product_key=dwd.product_key if dwd else source_key,
                      palette=dwd.palette if dwd else "climate",
                      verified_unit=dwd.verified_unit if dwd else False)
