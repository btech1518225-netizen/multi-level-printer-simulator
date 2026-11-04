"""Custom linked FIFO queue structures for printer jobs."""

from node import Node


class LinkedFIFOQueue:
    """Implement a first-in, first-out queue using linked nodes."""

    def __init__(self):
        """Initialize an empty queue with front and rear pointers."""
        self.front = None
        self.rear = None
        self.size = 0

    def enqueue(self, job):
        """Append a job to the rear of the queue in constant time."""
        node = Node(job)
        if self.rear is None:
            self.front = node
            self.rear = node
        else:
            self.rear.next = node
            self.rear = node
        self.size += 1

    def dequeue(self):
        """Remove and return the front job, or return None when empty."""
        if self.front is None:
            return None
        job = self.front.job
        self.front = self.front.next
        self.size -= 1
        if self.front is None:
            self.rear = None
        return job

    def find(self, job_id):
        """Return the matching queued job by ID, or None if absent."""
        current = self.front
        while current is not None:
            if current.job.job_id == job_id:
                return current.job
            current = current.next
        return None

    def remove(self, job_id):
        """Unlink and return a matching job while preserving FIFO order."""
        previous = None
        current = self.front
        while current is not None:
            if current.job.job_id == job_id:
                if previous is None:
                    self.front = current.next
                else:
                    previous.next = current.next
                if current is self.rear:
                    self.rear = previous
                self.size -= 1
                if self.front is None:
                    self.rear = None
                return current.job
            previous = current
            current = current.next
        return None

    def traverse(self):
        """Return queue contents in FIFO order without changing the queue."""
        jobs = []
        current = self.front
        while current is not None:
            jobs.append(current.job)
            current = current.next
        return jobs

    def is_empty(self):
        """Report whether this queue contains no jobs."""
        return self.front is None
