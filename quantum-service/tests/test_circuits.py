"""Sanity tests: every demo circuit produces its textbook ideal distribution, and analysis is correct."""
import unittest
import warnings

warnings.filterwarnings("ignore")

from app.circuits import SPECS, analyze_shor15, describe, ideal_distribution  # noqa: E402


class CircuitTests(unittest.TestCase):
    def test_ghz_ideal(self):
        d = ideal_distribution(SPECS["ghz"].build())
        self.assertAlmostEqual(d["000"], 0.5, places=5)
        self.assertAlmostEqual(d["111"], 0.5, places=5)

    def test_shor_ideal_peaks(self):
        d = ideal_distribution(SPECS["shor15"].build())
        self.assertEqual(sorted(d), ["000", "010", "100", "110"])
        for v in d.values():
            self.assertAlmostEqual(v, 0.25, places=5)

    def test_shor_postprocessing_finds_factors(self):
        a = analyze_shor15({"000": 250, "010": 250, "100": 250, "110": 250})
        self.assertAlmostEqual(a["successFraction"], 0.5)
        found = {tuple(r["factors"]) for r in a["outcomes"] if r["factors"]}
        self.assertEqual(found, {(3, 5)})

    def test_grover_amplifies_target(self):
        d = ideal_distribution(SPECS["grover"].build())
        self.assertGreater(d["101"], 0.94)

    def test_describe_is_json_ready(self):
        import json
        for spec in SPECS.values():
            json.dumps(describe(spec))


if __name__ == "__main__":
    unittest.main()
