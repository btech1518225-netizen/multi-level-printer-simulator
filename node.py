"""Linked-list node used by the printer scheduler's FIFO queues."""


class Node:
    """Store one job and the link to the next node in a priority queue."""

    def __init__(self, job):
        """Create a node containing a job with no successor."""
        self.job = job
        self.next = None
