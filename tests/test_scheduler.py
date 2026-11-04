"""Unit tests for scheduling rules, validation, and linked queue behavior."""

import unittest

from scheduler import (
    JobNotFoundError,
    PrinterScheduler,
    QueueFullError,
    SchedulerError,
)


class PrinterSchedulerTests(unittest.TestCase):
    """Cover expected scheduling behavior and all requested edge cases."""

    def setUp(self):
        """Create a fresh scheduler for each independent test."""
        self.scheduler = PrinterScheduler(max_capacity=4, time_per_page=1)

    def test_empty_queue_operations(self):
        """Verify empty extraction, processing, and traversal are safe."""
        self.assertIsNone(self.scheduler.extract_next())
        self.assertIsNone(self.scheduler.process_next_job())
        self.assertEqual(self.scheduler.traverse_queue(), [])

    def test_capacity_limit(self):
        """Reject submissions after the configured unfinished-job capacity."""
        for index in range(4):
            self.scheduler.submit_job("Job {}".format(index), 1, 3)
        with self.assertRaises(QueueFullError):
            self.scheduler.submit_job("Overflow", 1, 3)

    def test_invalid_page_count(self):
        """Reject negative and zero page counts."""
        for pages in (-1, 0):
            with self.subTest(pages=pages):
                with self.assertRaises(SchedulerError):
                    self.scheduler.submit_job("Bad", pages, 3)

    def test_invalid_priority_and_non_numeric_values(self):
        """Reject unknown priorities and non-integer pages or priorities."""
        for pages, priority in ((2, 9), ("many", 3), (2, "urgent")):
            with self.subTest(pages=pages, priority=priority):
                with self.assertRaises(SchedulerError):
                    self.scheduler.submit_job("Bad", pages, priority)

    def test_duplicate_id(self):
        """Reject a caller-supplied ID that is already in use."""
        self.scheduler.submit_job("First", 1, 2, job_id="JOB-X")
        with self.assertRaises(SchedulerError):
            self.scheduler.submit_job("Second", 1, 2, job_id="JOB-X")

    def test_priority_precedes_arrival(self):
        """Always extract a higher-priority job before a lower-priority job."""
        low = self.scheduler.submit_job("Low", 1, 4)
        high = self.scheduler.submit_job("High", 1, 1)
        self.assertEqual(self.scheduler.extract_next().job_id, high.job_id)
        self.assertEqual(self.scheduler.extract_next().job_id, low.job_id)

    def test_same_priority_is_fifo(self):
        """Serve equal-priority jobs in their original arrival order."""
        first = self.scheduler.submit_job("First", 1, 2)
        second = self.scheduler.submit_job("Second", 1, 2)
        self.assertEqual(self.scheduler.extract_next().job_id, first.job_id)
        self.assertEqual(self.scheduler.extract_next().job_id, second.job_id)

    def test_search_traverse_and_manual_sort(self):
        """Find jobs and ensure queue traversal and merge sort agree."""
        low = self.scheduler.submit_job("Low", 1, 4)
        high = self.scheduler.submit_job("High", 1, 1)
        self.assertEqual(self.scheduler.search_job(low.job_id), low)
        self.assertIsNone(self.scheduler.search_job("missing"))
        self.assertEqual(
            [job.job_id for job in self.scheduler.traverse_queue()],
            [high.job_id, low.job_id],
        )
        self.assertEqual(
            [job.job_id for job in self.scheduler.sort_pending_jobs()],
            [high.job_id, low.job_id],
        )

    def test_cancel_pending_and_missing_job(self):
        """Remove an existing pending job and report a nonexistent ID."""
        job = self.scheduler.submit_job("Cancel me", 1, 3)
        self.assertEqual(self.scheduler.cancel_job(job.job_id), job)
        with self.assertRaises(JobNotFoundError):
            self.scheduler.cancel_job("missing")

    def test_step_and_completion_record(self):
        """Track printer progress, finish time, and waiting time accurately."""
        first = self.scheduler.submit_job("Long", 2, 3)
        self.scheduler.step()
        self.assertEqual(self.scheduler.active_job.job_id, first.job_id)
        self.assertEqual(self.scheduler.active_remaining_time, 1)
        record = self.scheduler.step()
        self.assertEqual(record.job_id, first.job_id)
        self.assertEqual(record.start_time, 0)
        self.assertEqual(record.finish_time, 2)
        self.assertEqual(record.waiting_time, 0)

    def test_waiting_time_throughput_and_reset(self):
        """Calculate aggregates and clear simulation state on reset."""
        self.scheduler.submit_job("First", 1, 3)
        second = self.scheduler.submit_job("Second", 1, 3)
        self.scheduler.run_until_done()
        self.assertEqual(self.scheduler.completion_log[1].job_id, second.job_id)
        self.assertEqual(self.scheduler.completion_log[1].waiting_time, 1)
        self.assertEqual(self.scheduler.average_waiting_time(), 0.5)
        self.assertEqual(self.scheduler.throughput(), 1.0)
        self.scheduler.reset()
        self.assertEqual(self.scheduler.clock, 0)
        self.assertEqual(self.scheduler.completion_log, [])
        self.assertEqual(self.scheduler.pending_count, 0)

    def test_active_job_counts_toward_capacity_and_cannot_be_cancelled(self):
        """Keep total unfinished work bounded and prevent active-job removal."""
        limited = PrinterScheduler(max_capacity=1)
        active = limited.submit_job("Active", 2, 1)
        limited.step()
        with self.assertRaises(QueueFullError):
            limited.submit_job("Extra", 1, 1)
        with self.assertRaises(SchedulerError):
            limited.cancel_job(active.job_id)


if __name__ == "__main__":
    unittest.main()
