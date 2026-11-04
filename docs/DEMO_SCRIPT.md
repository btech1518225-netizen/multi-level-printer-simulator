# Demo script (5–10 minutes)

## 0:00–1:00 — Introduce the problem

“This simulator manages print requests with four priority levels. Priority 1
is the most urgent. Jobs at the same level are processed FIFO. The key data
structure is implemented from scratch as four linked-list queues.”

## 1:00–2:30 — Explain the design

Show `node.py` and `queue_structures.py`. Point out the node's job and next
reference, plus each queue's front and rear pointers. Explain that insertion
and removal at the ends are O(1), while a priority scan is constant time for
four fixed levels. Show `sort_pending_jobs` to demonstrate the hand-written
merge sort.

## 2:30–5:00 — Demonstrate scheduling

Start the web page or CLI. Submit a low-priority two-page job and then an
urgent one-page job. Show that the urgent job prints first. Submit two jobs
at the same priority and show that the earlier submission remains first.
Use **Step** to show the simulation clock and progress bar advancing one tick.

## 5:00–6:30 — Show output and controls

Use **Run until done** to finish all jobs. Point out arrival, start, finish,
and waiting-time columns, along with average waiting time and throughput.
Demonstrate the empty queue and **Reset** controls.

## 6:30–8:00 — Validation and tests

Show that zero/negative pages, unknown priorities, duplicate IDs, and a full
queue are rejected. Run:

```text
python -m unittest discover -s tests -v
```

Mention that search, cancellation of queued work, FIFO order, priority order,
and completion timing are covered by unit tests.

## Likely questions and answers

**Q: Why use four queues instead of a heap?**  
A: The number of priority levels is fixed and small. Four linked FIFO queues
make the FIFO rule explicit, provide constant-time enqueue/dequeue, and make
the structure easy to inspect and explain.

**Q: How is FIFO guaranteed?**  
A: Each level appends new nodes at its rear and extracts from its front.

**Q: What is the time complexity of choosing a job?**  
A: O(p) for p priority levels; in this project p is four, so it is O(1) for
the configured levels.

**Q: Does the simulator support aging?**  
A: Aging is optional and is intentionally omitted so the required priority
and FIFO policies remain clear. It could be added by promoting long-waiting
jobs with a defined arrival-order policy.

**Q: What does waiting time measure?**  
A: The interval from arrival to print start: `start_time - arrival_time`.

**Q: What does throughput measure?**  
A: Completed jobs divided by elapsed simulation time.

**Q: What happens if a job is cancelled after printing begins?**  
A: The simulator rejects cancellation of the active print job; queued jobs
can be cancelled.
