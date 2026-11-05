import importlib.util
from pathlib import Path
import unittest


SPEC = importlib.util.spec_from_file_location(
    "fast_import", Path(__file__).parents[1] / "apply-customer-masters-fast.py")
fast = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(fast)


class ParallelReadTests(unittest.TestCase):
    def api(self, duplicate=False, fail=False):
        class Reader(fast.FastApi):
            def __init__(self):
                pass

            def refresh(self):
                pass

            def read_chunk(self, spec, rows):
                if fail:
                    raise RuntimeError("Verification read failed")
                return {("same" if duplicate else row["source_id"]): dict(row) for row in rows}
        return Reader()

    def rows(self, count=250):
        return [{"source_id": str(index).zfill(18)} for index in range(count)]

    def test_every_chunk_and_field_returned(self):
        rows = self.rows()
        records = fast.parallel_records(self.api(), {}, rows)
        self.assertEqual(len(records), len(rows))
        self.assertEqual(records[rows[-1]["source_id"]], rows[-1])

    def test_failed_chunk_is_not_partial_success(self):
        with self.assertRaisesRegex(RuntimeError, "Verification read failed"):
            fast.parallel_records(self.api(fail=True), {}, self.rows())

    def test_duplicates_across_chunks_stop(self):
        with self.assertRaisesRegex(RuntimeError, "Duplicate destination"):
            fast.parallel_records(self.api(duplicate=True), {}, self.rows())

    def test_invalid_keys_rejected_before_queries(self):
        with self.assertRaisesRegex(RuntimeError, "Invalid customer source"):
            fast.parallel_records(self.api(), {}, [{"source_id": "'bad'"}])


if __name__ == "__main__":
    unittest.main()
