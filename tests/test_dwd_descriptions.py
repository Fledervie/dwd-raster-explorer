import unittest

from dwd_descriptions import product_folders, unit_for_parameter


class DwdDescriptionTest(unittest.TestCase):
    def test_unit_distinguishes_temperature_from_threshold_day_count(self):
        self.assertEqual(unit_for_parameter("Monatsmittel in 1/10 °C"), ("°C", 0.1, True))
        self.assertEqual(unit_for_parameter("Anzahl der Heißen Tage; Temperatur >= 30°C"),
                         ("Tage", 1.0, True))
        self.assertEqual(unit_for_parameter("Monatssumme der Niederschlagshöhe in mm"),
                         ("mm", 1.0, True))

    def test_nested_product_folder_is_checked_before_parent(self):
        url = ("https://opendata.dwd.de/climate_environment/CDC/grids_germany/"
               "monthly/air_temperature_max/01_Jan/example.asc.gz")
        folders = product_folders(url)
        self.assertTrue(folders[0].endswith("/01_Jan/"))
        self.assertTrue(folders[1].endswith("/air_temperature_max/"))


if __name__ == "__main__":
    unittest.main()
