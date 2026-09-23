import unittest
from unittest.mock import patch

from app import app


class SampleRasterTest(unittest.TestCase):
    def test_bundled_raster_is_ready_for_map_and_point_query(self):
        with app.test_client() as client:
            response = client.get("/api/sample")
            self.assertEqual(response.status_code, 200)
            raster = response.get_json()
            self.assertEqual((raster["timestamp"], raster["unit"], raster["crs"]),
                             ("1901", "°C", "EPSG:31467"))

            image = client.get(f"/api/raster/{raster['id']}/image.png")
            self.assertEqual(image.status_code, 200)
            self.assertTrue(image.data.startswith(b"\x89PNG\r\n\x1a\n"))

            values = client.post("/api/values", json={
                "lat": 52.52, "lon": 13.405, "ids": [raster["id"]],
            })
            self.assertEqual(values.status_code, 200)
            self.assertAlmostEqual(values.get_json()["values"][0]["value"], 13.2, places=1)

    def test_january_raster_has_documented_mean_maximum(self):
        with app.test_client() as client:
            response = client.get("/api/sample-january")
            self.assertEqual(response.status_code, 200)
            raster = response.get_json()
            self.assertEqual((raster["periodLabel"], raster["unit"]), ("Januar 1901", "°C"))
            self.assertIn("höchsttemperatur", raster["title"].lower())
            self.assertTrue(raster["descriptionUrl"].endswith("monthly_air_temperature_max_de.pdf"))
            values = client.post("/api/values", json={
                "lat": 52.52, "lon": 13.405, "ids": [raster["id"]],
            })
            self.assertAlmostEqual(values.get_json()["values"][0]["value"], -0.6, places=1)

    def test_dwd_directory_has_readable_file_label(self):
        directory = ("https://opendata.dwd.de/climate_environment/CDC/grids_germany/"
                     "monthly/air_temperature_max/01_Jan/")
        html = '<a href="grids_germany_monthly_air_temp_max_190101.asc.gz">file</a>'
        with patch("app.requests.get") as get, app.test_client() as client:
            get.return_value.text = html
            response = client.post("/api/dwd/list", json={"url": directory})
        self.assertEqual(response.status_code, 200)
        self.assertIn("Januar 1901", response.get_json()["entries"][0]["label"])

    def test_place_search_returns_coordinates_for_map_point(self):
        with patch("app.requests.get") as get, app.test_client() as client:
            get.return_value.json.return_value = {"results": [
                {"name": "Berlin", "admin1": "Berlin", "latitude": 52.52437,
                 "longitude": 13.41053},
            ]}
            response = client.get("/api/places?q=Berlin")
            self.assertEqual(get.call_args.kwargs["params"]["countryCode"], "DE")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["places"], [
            {"name": "Berlin, Berlin", "lat": 52.52437, "lon": 13.41053},
        ])

    def test_place_search_requires_query(self):
        with app.test_client() as client:
            response = client.get("/api/places?q=A")
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
