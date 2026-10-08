"""Exercises the IBM hardware code path end-to-end using Qiskit Runtime's local channel (fake backends),
so the submit -> poll -> result flow is tested without spending IBM Quantum credit."""
import os
import tempfile
import time
import unittest
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")

from app import runner  # noqa: E402


class IbmPathTests(unittest.TestCase):
    def setUp(self):
        from qiskit_ibm_runtime import QiskitRuntimeService

        self._jobs_file = runner.JOBS_FILE
        runner.JOBS_FILE = Path(tempfile.mkdtemp()) / "jobs.json"
        runner._service = QiskitRuntimeService(channel="local")
        os.environ["IBM_QUANTUM_BACKEND"] = "fake_torino"

    def tearDown(self):
        runner.JOBS_FILE = self._jobs_file
        runner._service = None
        os.environ.pop("IBM_QUANTUM_BACKEND", None)

    def test_submit_poll_result(self):
        job = runner.submit("ghz", "ibm", 1024)
        self.assertEqual(job["backend"], "fake_torino")
        self.assertTrue(job["ibmJobId"])
        self.assertGreater(job["transpiled"]["twoQubitGates"], 0)
        for _ in range(60):
            j = runner.refresh(job["id"])
            if j["status"] in ("DONE", "ERROR"):
                break
            time.sleep(0.5)
        self.assertEqual(j["status"], "DONE", j.get("error") or j.get("lastPollError"))
        self.assertEqual(sum(j["counts"].values()), 1024)
        self.assertGreater(j["analysis"]["correlatedFraction"], 0.8)


if __name__ == "__main__":
    unittest.main()
