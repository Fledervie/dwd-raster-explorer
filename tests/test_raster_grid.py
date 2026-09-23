import gzip
import io
import unittest

import numpy as np
from PIL import Image
from pyproj import Transformer

from raster_grid import RasterGrid, colourize, extract_timestamp, parse_ascii_grid


GRID = b"""ncols 3
nrows 2
xllcorner 7
yllcorner 52
cellsize 1
NODATA_value -9999
1 2 -9999
4 5 6
"""


class RasterGridTest(unittest.TestCase):
    def test_plain_and_gzip(self):
        for raw, name in ((GRID, "grid_202401.asc"), (gzip.compress(GRID), "grid_202401.asc.gz")):
            grid = parse_ascii_grid(raw, name)
            self.assertEqual((grid.nrows, grid.ncols), (2, 3))
            self.assertIsNone(grid.value_at(9.5, 53.5))
            self.assertEqual(grid.value_at(7.5, 52.5), 4)
            self.assertEqual(grid.timestamp, "2024-01")

    def test_date(self):
        self.assertEqual(extract_timestamp("value_20260821.asc.gz"), "2026-08-21")

    def test_dwd_annual_max_temperature(self):
        raw = GRID.replace(b"NODATA_value -9999", b"NODATA_value -999").replace(b"1 2 -9999", b"125 130 -999")
        grid = parse_ascii_grid(gzip.compress(raw), "grids_germany_annual_air_temp_max_190117.asc.gz")
        self.assertEqual(grid.timestamp, "1901")
        self.assertEqual(grid.unit, "°C")
        self.assertEqual(grid.value_at(7.5, 53.5), 12.5)
        self.assertIsNone(grid.value_at(9.5, 53.5))

    def test_dwd_monthly_temperature_and_precipitation(self):
        raw = GRID.replace(b"NODATA_value -9999", b"NODATA_value -999").replace(b"1 2 -9999", b"125 130 -999")
        temp = parse_ascii_grid(gzip.compress(raw), "grids_germany_monthly_air_temp_max_190101.asc.gz")
        self.assertEqual((temp.timestamp, temp.period_label, temp.unit), ("1901-01", "Januar 1901", "°C"))
        self.assertAlmostEqual(temp.value_at(7.5, 53.5), 12.5)
        self.assertIn("höchsttemperatur", temp.title.lower())
        self.assertTrue(temp.verified_unit)

        rain = parse_ascii_grid(gzip.compress(raw), "grids_germany_monthly_precipitation_190101.asc.gz")
        self.assertEqual((rain.period_label, rain.unit), ("Januar 1901", "mm"))
        self.assertEqual(rain.value_at(7.5, 53.5), 125)

    def test_unknown_dwd_product_keeps_original_values(self):
        raw = GRID.replace(b"NODATA_value -9999", b"NODATA_value -999").replace(b"1 2 -9999", b"125 130 -999")
        grid = parse_ascii_grid(raw, "grids_germany_annual_drought_index_190117.asc")
        self.assertEqual(grid.timestamp, "1901")
        self.assertFalse(grid.verified_unit)
        self.assertEqual(grid.value_at(7.5, 53.5), 125)

    def test_dwd_season_and_reference_period_codes(self):
        self.assertEqual(extract_timestamp("grids_germany_seasonal_air_temp_max_190116.asc.gz"), "1901-16")
        self.assertEqual(extract_timestamp("grids_germany_multi_annual_air_temp_max_1961-199001.asc.gz"),
                         "1961-1990/01")

    def test_png_pixels_match_leaflet_mercator_positions(self):
        values = np.repeat(np.arange(79, -1, -1, dtype=np.float32)[:, None], 2, axis=1)
        grid = RasterGrid("test", values, 2, 80, 7, 0, 1, 1, -9999,
                          Transformer.from_crs(4326, 3857).source_crs, "test", None, "")
        bounds = grid.metadata("test")["bounds"]
        image = Image.open(io.BytesIO(grid.png(palette="gray", vmin=0, vmax=79)))
        to_merc = Transformer.from_crs(4326, 3857, always_xy=True)
        north_y = to_merc.transform(8, bounds[1][0])[1]
        south_y = to_merc.transform(8, bounds[0][0])[1]
        for lat in (10, 30, 50, 70):
            y = to_merc.transform(8, lat)[1]
            row = int((north_y - y) / (north_y - south_y) * image.height)
            center_y = north_y - (row + 0.5) * (north_y - south_y) / image.height
            center_lat = Transformer.from_crs(3857, 4326, always_xy=True).transform(0, center_y)[1]
            value = grid.value_at(8, center_lat)
            expected = colourize(np.array([[value / 79]], dtype=float), "gray")[0, 0]
            self.assertTrue(np.array_equal(np.asarray(image)[row, image.width // 2], expected))


if __name__ == "__main__": unittest.main()
