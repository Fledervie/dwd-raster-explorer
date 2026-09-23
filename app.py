from __future__ import annotations

import os
import re
import secrets
import math
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from flask import Flask, jsonify, render_template, request, send_file

from dwd_descriptions import fetch_description
from dwd_metadata import describe_dwd_grid
from raster_grid import parse_ascii_grid

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 200 * 1024 * 1024
RASTERS = {}
SAMPLE_PATH = Path(__file__).resolve().parent / "data" / "grids_germany_annual_air_temp_max_190117.asc.gz"
SAMPLE_ID = None
JANUARY_PATH = Path(__file__).resolve().parent / "data" / "grids_germany_monthly_air_temp_max_190101.asc.gz"
JANUARY_ID = None
DWD_HOST = "opendata.dwd.de"
DWD_ROOT = "/climate_environment/"
DWD_GRID_ROOT = "https://opendata.dwd.de/climate_environment/CDC/grids_germany/"


def error(message, status=400):
    return jsonify({"error": str(message)}), status


def valid_dwd_url(url: str, file_required=False):
    parsed = urlparse(url)
    valid = parsed.scheme == "https" and parsed.hostname == DWD_HOST and parsed.path.startswith(DWD_ROOT)
    if file_required:
        valid = valid and parsed.path.lower().endswith((".asc.gz", ".asc"))
    if not valid:
        raise ValueError("Erlaubt sind ausschließlich HTTPS-Adressen unter opendata.dwd.de/climate_environment/.")


def store(raw, name, epsg=None, unit="", source_url="", read_description=False):
    grid = parse_ascii_grid(raw, name, epsg or None, unit.strip(), source_url)
    if read_description:
        try:
            description = fetch_description(source_url)
        except Exception:
            description = None
        if description:
            grid.description_url = description.url
            if description.parameter:
                grid.description = re.sub(
                    r",?\s*in\s+1\s*/\s*10\s*°\s*C\b",
                    " · Anzeige in °C (DWD-Rohwerte ÷ 10)",
                    description.parameter, flags=re.I,
                )
            if not grid.verified_unit:
                if description.title:
                    grid.title = description.title
                if description.verified_unit:
                    grid.values *= description.scale
                    grid.unit = description.unit
                    grid.verified_unit = True
    raster_id = secrets.token_urlsafe(10)
    RASTERS[raster_id] = grid
    return grid.metadata(raster_id)


@app.get("/")
def index():
    static_dir = Path(app.static_folder)
    asset_version = max((static_dir / name).stat().st_mtime_ns for name in (
        "styles.css", "app.js", "dwd-picker.js", "climate-data.js", "climate-chart.js"
    ))
    return render_template("index.html", asset_version=asset_version)


@app.get("/api/sample")
def sample():
    global SAMPLE_ID
    if SAMPLE_ID not in RASTERS:
        url = DWD_GRID_ROOT + "annual/air_temperature_max/" + SAMPLE_PATH.name
        metadata = store(SAMPLE_PATH.read_bytes(), SAMPLE_PATH.name, source_url=url)
        SAMPLE_ID = metadata["id"]
    return jsonify(RASTERS[SAMPLE_ID].metadata(SAMPLE_ID))


@app.get("/api/sample-january")
def sample_january():
    global JANUARY_ID
    if JANUARY_ID not in RASTERS:
        url = DWD_GRID_ROOT + "monthly/air_temperature_max/01_Jan/" + JANUARY_PATH.name
        metadata = store(JANUARY_PATH.read_bytes(), JANUARY_PATH.name, source_url=url)
        JANUARY_ID = metadata["id"]
    return jsonify(RASTERS[JANUARY_ID].metadata(JANUARY_ID))


@app.post("/api/upload")
def upload():
    files = request.files.getlist("files")
    if not files: return error("Keine Datei ausgewählt.")
    epsg, unit = request.form.get("epsg"), request.form.get("unit", "")
    results, errors = [], []
    for file in files:
        try: results.append(store(file.read(), file.filename, epsg, unit))
        except Exception as exc: errors.append({"name": file.filename, "error": str(exc)})
    return jsonify({"rasters": results, "errors": errors})


@app.post("/api/import-url")
def import_url():
    payload = request.get_json(force=True)
    urls = payload.get("urls") or []
    if isinstance(urls, str): urls = [urls]
    if len(urls) > 50:
        return error("Bitte höchstens 50 Raster gleichzeitig importieren.")
    results, errors = [], []
    for url in urls:
        try:
            valid_dwd_url(url, True)
            response = requests.get(url, timeout=60, headers={"User-Agent": "DWD-Raster-Explorer/1.0"})
            response.raise_for_status()
            name = os.path.basename(urlparse(url).path)
            results.append(store(response.content, name, payload.get("epsg"), payload.get("unit", ""), url, True))
        except Exception as exc: errors.append({"name": url, "error": str(exc)})
    return jsonify({"rasters": results, "errors": errors})


@app.post("/api/dwd/list")
def list_dwd():
    url = request.get_json(force=True).get("url", "")
    try:
        valid_dwd_url(url)
        if not url.endswith("/"): url += "/"
        response = requests.get(url, timeout=30, headers={"User-Agent": "DWD-Raster-Explorer/1.0"})
        response.raise_for_status()
        hrefs = re.findall(r'href=["\']([^"\']+)["\']', response.text, flags=re.I)
        entries = []
        for href in hrefs:
            if href.startswith("?") or href == "../": continue
            full = urljoin(url, href)
            if urlparse(full).hostname != DWD_HOST: continue
            kind = "directory" if href.endswith("/") else "file"
            if kind == "file" and not href.lower().endswith((".asc.gz", ".asc")): continue
            item = {"name": href.rstrip("/"), "url": full, "kind": kind}
            if kind == "file":
                product = describe_dwd_grid(item["name"], full)
                if product:
                    item["label"] = f"{product.period_label} · {product.title}"
            entries.append(item)
        return jsonify({"url": url, "entries": entries})
    except Exception as exc: return error(exc)


@app.get("/api/places")
def search_places():
    query = request.args.get("q", "").strip()
    if len(query) < 2 or len(query) > 100:
        return error("Bitte einen Ort oder eine Postleitzahl mit mindestens 2 Zeichen eingeben.")
    try:
        response = requests.get(
            "https://geocoding-api.open-meteo.com/v1/search",
            params={"name": query, "count": 8, "language": "de", "countryCode": "DE"},
            timeout=12, headers={"User-Agent": "DWD-Raster-Explorer/1.0"},
        )
        response.raise_for_status()
        places = []
        for item in response.json().get("results", []):
            lat, lon = float(item["latitude"]), float(item["longitude"])
            if not (math.isfinite(lat) and math.isfinite(lon)):
                continue
            label = ", ".join(part for part in (item.get("name"), item.get("admin1")) if part)
            places.append({"name": label, "lat": lat, "lon": lon})
        return jsonify({"places": places})
    except (requests.RequestException, ValueError, KeyError, TypeError) as exc:
        return error(f"Ortssuche derzeit nicht verfügbar: {exc}", 502)


@app.get("/api/raster/<raster_id>/image.png")
def raster_image(raster_id):
    grid = RASTERS.get(raster_id)
    if not grid: return error("Raster nicht gefunden.", 404)
    try:
        vmin = float(request.args["min"]) if "min" in request.args else None
        vmax = float(request.args["max"]) if "max" in request.args else None
        from io import BytesIO
        return send_file(BytesIO(grid.png(request.args.get("palette", "climate"), vmin, vmax)), mimetype="image/png")
    except Exception as exc: return error(exc)


@app.post("/api/values")
def values():
    payload = request.get_json(force=True)
    lat, lon = float(payload["lat"]), float(payload["lon"])
    ids = payload.get("ids") or list(RASTERS)
    result = []
    for raster_id in ids:
        grid = RASTERS.get(raster_id)
        if grid:
            result.append({"id": raster_id, "name": grid.name, "timestamp": grid.timestamp,
                           "title": grid.title, "periodLabel": grid.period_label,
                           "productKey": grid.product_key, "unit": grid.unit,
                           "value": grid.value_at(lon, lat)})
    return jsonify({"lat": lat, "lon": lon, "values": result})


@app.delete("/api/raster/<raster_id>")
def remove(raster_id):
    RASTERS.pop(raster_id, None)
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(
        host=os.environ.get("HOST", "127.0.0.1"),
        port=int(os.environ.get("PORT", "5000")),
        debug=os.environ.get("FLASK_DEBUG") == "1",
    )
