"""Printer scheduling logic built on custom per-priority linked queues."""

from dataclasses import dataclass
from queue_structures import LinkedFIFOQueue


PRIORITY_NAMES = {
    1: "Urgent",
    2: "High",
    3: "Normal",
    4: "Low",
}


class SchedulerError(ValueError):
    """Represent invalid scheduler operations or input."""


class QueueFullError(SchedulerError):
    """Represent an attempt to submit when the scheduler is at capacity."""


class JobNotFoundError(SchedulerError):
    """Represent a request to cancel a job that is not pending."""


@dataclass
class Job:
    """Represent a submitted job and its immutable scheduling details."""

    job_id: str
    name: str
    pages: int
    priority: int
    arrival_time: int
    sequence: int


@dataclass
class CompletionRecord:
    """Record the timing and priority details of a completed job."""

    job_id: str
    name: str
    priority: int
    arrival_time: int
    start_time: int
    finish_time: int
    waiting_time: int
    pages: int


class PrinterScheduler:
    """Schedule jobs by priority and FIFO arrival using linked queues."""

    def __init__(self, max_capacity=100, time_per_page=1):
        """Create four priority queues and initialize the simulation state."""
        self._validate_positive_integer(max_capacity, "maximum capacity")
        self._validate_positive_integer(time_per_page, "time per page")
        self.max_capacity = max_capacity
        self.time_per_page = time_per_page
        self.queues = {level: LinkedFIFOQueue() for level in PRIORITY_NAMES}
        self.clock = 0
        self.pending_count = 0
        self.active_job = None
        self.active_start_time = None
        self.active_total_time = 0
        self.active_remaining_time = 0
        self.completion_log = []
        self._next_id = 1
        self._sequence = 0
        self._known_ids = set()

    @staticmethod
    def _validate_positive_integer(value, label):
        """Reject booleans, non-integers, and non-positive configuration."""
        if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
            raise SchedulerError("{} must be a positive integer".format(label))

    @staticmethod
    def _validate_integer(value, label):
        """Reject booleans and non-integer values for numeric job fields."""
        if isinstance(value, bool) or not isinstance(value, int):
            raise SchedulerError("{} must be an integer".format(label))

    def submit_job(self, name, pages, priority, job_id=None):
        """Validate and enqueue a job, generating an ID when one is omitted."""
        if not isinstance(name, str) or not name.strip():
            raise SchedulerError("job name must be a non-empty string")
        self._validate_integer(pages, "pages")
        if pages <= 0:
            raise SchedulerError("pages must be greater than zero")
        self._validate_integer(priority, "priority")
        if priority not in PRIORITY_NAMES:
            raise SchedulerError("unknown priority; use 1, 2, 3, or 4")
        if self.pending_count + (1 if self.active_job is not None else 0) >= self.max_capacity:
            raise QueueFullError("scheduler is at full capacity")

        if job_id is None:
            while "J{:04d}".format(self._next_id) in self._known_ids:
                self._next_id += 1
            job_id = "J{:04d}".format(self._next_id)
            self._next_id += 1
        if not isinstance(job_id, str) or not job_id.strip():
            raise SchedulerError("job ID must be a non-empty string")
        if job_id in self._known_ids:
            raise SchedulerError("duplicate job ID: {}".format(job_id))

        self._sequence += 1
        job = Job(
            job_id=job_id,
            name=name.strip(),
            pages=pages,
            priority=priority,
            arrival_time=self.clock,
            sequence=self._sequence,
        )
        self.queues[priority].enqueue(job)
        self.pending_count += 1
        self._known_ids.add(job_id)
        return job

    def extract_next(self):
        """Remove and return the next queued job at the highest priority."""
        for priority in PRIORITY_NAMES:
            job = self.queues[priority].dequeue()
            if job is not None:
                self.pending_count -= 1
                return job
        return None

    def search_job(self, job_id):
        """Find a pending or currently printing job by ID."""
        if self.active_job is not None and self.active_job.job_id == job_id:
            return self.active_job
        for priority in PRIORITY_NAMES:
            job = self.queues[priority].find(job_id)
            if job is not None:
                return job
        return None

    def cancel_job(self, job_id):
        """Cancel and return a pending job, or raise a clear error."""
        if self.active_job is not None and self.active_job.job_id == job_id:
            raise SchedulerError("a job already printing cannot be cancelled")
        for priority in PRIORITY_NAMES:
            job = self.queues[priority].remove(job_id)
            if job is not None:
                self.pending_count -= 1
                self._known_ids.discard(job_id)
                return job
        raise JobNotFoundError("no pending job found with ID {}".format(job_id))

    def traverse_queue(self):
        """Return pending jobs in their actual processing order."""
        jobs = []
        for priority in PRIORITY_NAMES:
            jobs.extend(self.queues[priority].traverse())
        return jobs

    def sort_pending_jobs(self):
        """Use a manual stable merge sort by priority, arrival, and sequence."""
        jobs = self.traverse_queue()
        return self._merge_sort(jobs)

    def _merge_sort(self, jobs):
        """Recursively merge two halves into stable scheduling order."""
        if len(jobs) <= 1:
            return jobs
        midpoint = len(jobs) // 2
        left = self._merge_sort(jobs[:midpoint])
        right = self._merge_sort(jobs[midpoint:])
        merged = []
        left_index = 0
        right_index = 0
        while left_index < len(left) and right_index < len(right):
            if self._sort_key(left[left_index]) <= self._sort_key(right[right_index]):
                merged.append(left[left_index])
                left_index += 1
            else:
                merged.append(right[right_index])
                right_index += 1
        while left_index < len(left):
            merged.append(left[left_index])
            left_index += 1
        while right_index < len(right):
            merged.append(right[right_index])
            right_index += 1
        return merged

    @staticmethod
    def _sort_key(job):
        """Return the tuple that defines priority and FIFO job ordering."""
        return job.priority, job.arrival_time, job.sequence

    def step(self):
        """Advance the clock by one unit and update the printer if occupied."""
        if self.active_job is None:
            self.active_job = self.extract_next()
            if self.active_job is None:
                return None
            self.active_start_time = self.clock
            self.active_total_time = self.active_job.pages * self.time_per_page
            self.active_remaining_time = self.active_total_time

        finished_job = self.active_job
        self.clock += 1
        self.active_remaining_time -= 1
        if self.active_remaining_time > 0:
            return None

        record = CompletionRecord(
            job_id=finished_job.job_id,
            name=finished_job.name,
            priority=finished_job.priority,
            arrival_time=finished_job.arrival_time,
            start_time=self.active_start_time,
            finish_time=self.clock,
            waiting_time=self.active_start_time - finished_job.arrival_time,
            pages=finished_job.pages,
        )
        self.completion_log.append(record)
        self.active_job = None
        self.active_start_time = None
        self.active_total_time = 0
        self.active_remaining_time = 0
        return record

    def process_next_job(self):
        """Print one whole job and return its completion record."""
        if self.active_job is None and self.pending_count == 0:
            return None
        initial_job_id = self.active_job.job_id if self.active_job is not None else None
        while self.active_job is not None or self.pending_count > 0:
            record = self.step()
            if record is not None and (
                initial_job_id is None or record.job_id == initial_job_id
            ):
                return record
        return None

    def run_until_done(self):
        """Advance simulation ticks until no pending or active jobs remain."""
        elapsed_ticks = 0
        while self.active_job is not None or self.pending_count > 0:
            self.step()
            elapsed_ticks += 1
        return elapsed_ticks

    def reset(self):
        """Clear all jobs and logs and restore the simulation clock to zero."""
        for priority in PRIORITY_NAMES:
            self.queues[priority] = LinkedFIFOQueue()
        self.clock = 0
        self.pending_count = 0
        self.active_job = None
        self.active_start_time = None
        self.active_total_time = 0
        self.active_remaining_time = 0
        self.completion_log = []
        self._next_id = 1
        self._sequence = 0
        self._known_ids.clear()

    def average_waiting_time(self):
        """Return mean completed-job wait, or zero when no job is complete."""
        if not self.completion_log:
            return 0.0
        return sum(record.waiting_time for record in self.completion_log) / len(
            self.completion_log
        )

    def throughput(self):
        """Return completed jobs per simulated time unit, or zero at time zero."""
        if self.clock == 0:
            return 0.0
        return len(self.completion_log) / self.clock

    def get_state(self):
        """Return a JSON-friendly snapshot for the CLI and Flask frontend."""
        levels = {}
        for priority, label in PRIORITY_NAMES.items():
            levels[priority] = {
                "name": label,
                "jobs": [
                    self._job_dict(job) for job in self.queues[priority].traverse()
                ],
            }
        current = None
        if self.active_job is not None:
            current = self._job_dict(self.active_job)
            current["start_time"] = self.active_start_time
            current["total_time"] = self.active_total_time
            current["remaining_time"] = self.active_remaining_time
        return {
            "clock": self.clock,
            "max_capacity": self.max_capacity,
            "pending_count": self.pending_count,
            "active_job": current,
            "levels": levels,
            "completion_log": [
                self._record_dict(record) for record in self.completion_log
            ],
            "average_waiting_time": self.average_waiting_time(),
            "throughput": self.throughput(),
        }

    @staticmethod
    def _job_dict(job):
        """Serialize a job's public scheduling fields."""
        return {
            "job_id": job.job_id,
            "name": job.name,
            "pages": job.pages,
            "priority": job.priority,
            "priority_name": PRIORITY_NAMES[job.priority],
            "arrival_time": job.arrival_time,
        }

    @staticmethod
    def _record_dict(record):
        """Serialize a completion record for display and JSON responses."""
        return {
            "job_id": record.job_id,
            "name": record.name,
            "priority": record.priority,
            "arrival_time": record.arrival_time,
            "start_time": record.start_time,
            "finish_time": record.finish_time,
            "waiting_time": record.waiting_time,
            "pages": record.pages,
        }
