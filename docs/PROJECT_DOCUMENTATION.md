# Multi-Level Printer Job Scheduler

## Project summary

This B.Tech CSE Semester 3 mini-project simulates a shared printer. Every
submitted print job receives an ID, page count, priority, and arrival time.
The scheduler serves lower-numbered priority levels first; within a level it
preserves first-in, first-out order. A simulation clock advances in page-time
units, and completed jobs are recorded with their waiting and service times.

## Data structure design

The implementation uses four custom linked-list FIFO queues rather than a
binary heap. This matches the fixed four-level priority model directly: the
scheduler checks priority 1, then 2, 3, and 4, and removes the front node of
the first non-empty queue. Each queue stores `front`, `rear`, and `size`
pointers/counters; enqueuing and dequeuing are both O(1). Jobs at the same
priority retain FIFO order without any library queue or heap.

```text
PrinterScheduler
  level 1 (Urgent): front -> [Job] -> [Job] <- rear
  level 2 (High):   front -> [Job]                 <- rear
  level 3 (Normal): front -> empty
  level 4 (Low):    front -> [Job] -> [Job] <- rear

Node: [Job reference | next-node reference]
Job:  [ID | name | pages | priority | arrival time | sequence]
```

The pending-job search scans all level queues. Cancellation unlinks the
matching node and repairs the front/rear links. `sort_pending_jobs` copies the
pending references and runs a stable merge sort using
`(priority, arrival_time, sequence)`; it does not call a built-in sorting
function. The active print job is held separately from the waiting queues and
counts toward the configured capacity.

## Operation complexity

Let `n` be the number of pending jobs and `p = 4` be the fixed priority count.

| Operation | Time | Extra space | Reason |
|---|---:|---:|---|
| Insert/enqueue | O(1) | O(1) | Append one node using the rear pointer. |
| Delete/extract next | O(p), hence O(1) here | O(1) | Inspect up to four levels and unlink the front node. |
| Search by ID | O(n) | O(1) | Scan nodes in each linked FIFO queue. |
| Traverse/display | O(n + p) | O(n) for returned view | Visit each node once and group by level. |
| Sort pending jobs | O(n log n) | O(n) | Stable top-down merge sort on a copied reference list. |
| Cancel by ID | O(n) | O(1) | Scan nodes and unlink the matching node. |

## Scheduling and timing rules

Priorities are 1 (Urgent), 2 (High), 3 (Normal), and 4 (Low). Smaller
priority numbers are selected first. Submissions receive the current
simulation clock as arrival time and an automatically generated ID such as
`J0001`. The printer takes `pages × time_per_page` ticks per job. A tick starts
the next job if the printer is idle and then consumes one unit of its print
time. On completion, the scheduler records ID, priority, arrival, start,
finish, and `start - arrival` waiting time.

Capacity limits the total unfinished jobs (waiting plus currently printing).
Pages and priority must be integers; pages and configuration values must be
positive; priority must be one of 1–4; names and explicit IDs cannot be empty;
and IDs cannot be duplicated. A queued job may be cancelled; a job already
printing cannot. Aging is intentionally not enabled so priority and FIFO
behavior remain deterministic and easy to demonstrate.

Average waiting time is the arithmetic mean across completed jobs.
Throughput is completed jobs divided by elapsed simulation time, and is zero
when the clock is zero.

## Sample scenarios

### Scenario 1: Priority order

Input (submit each at clock 0):

```text
J0001, Design draft, 2 pages, priority 4 (Low)
J0002, Urgent form, 1 page, priority 1 (Urgent)
```

Expected processing order and completion log with one time unit per page:

```text
J0002 | priority 1 | arrival 0 | start 0 | finish 1 | waiting 0
J0001 | priority 4 | arrival 0 | start 1 | finish 3 | waiting 1
Average waiting time: 0.50
Throughput: 0.667 jobs/time unit
```

### Scenario 2: FIFO tie-break

Input:

```text
J0001, First report, 1 page, priority 2 (High), arrival 0
J0002, Second report, 1 page, priority 2 (High), arrival 0
```

Expected result: `J0001` completes first because it entered the same-level
queue first. The log shows `J0001` start/finish `0/1`, then `J0002`
start/finish `1/2`; waiting times are 0 and 1.

## Short report outline (5–8 pages)

1. **Title and abstract (½ page):** project name, course, objective, and
   summary of the implemented simulator.
2. **Problem statement and requirements (¾ page):** printer contention,
   priority policy, FIFO tie-breaking, capacity, and simulator controls.
3. **Data structure design (1½ pages):** linked node layout, four FIFO queues,
   scheduler relationships, and a queue-state diagram.
4. **Scheduling algorithm and implementation (1 page):** enqueue, extract,
   search, cancellation, tick progression, and completion logging.
5. **Complexity and testing (1 page):** operation table above and unit-test
   cases covering ordering, invalid inputs, capacity, empty state, and timing.
6. **Sample runs and interface (¾ page):** CLI and web UI screenshots or
   transcripts; explain the two scenarios above.
7. **Conclusion and future work (½ page):** summarize results and discuss
   optional aging or persistent job history.
8. **Individual contribution breakdown (½ page):** record actual work and
   review evidence for each member:

| Member | Assigned contribution | Evidence to include |
|---|---|---|
| Member 1 | Core data structures | Node and linked FIFO implementation; queue tests. |
| Member 2 | Scheduling algorithm | Priority selection, clock, completion log, metrics. |
| Member 3 | Interface and testing | CLI, Flask interface, API and unit-test execution. |
| Member 4 | Documentation and demo | Report, complexity table, diagrams, and demo coordination. |

## Running and testing

Use the commands in the repository's run instructions. The CLI and Flask
frontend both use `scheduler.py` and the same linked queue classes.
