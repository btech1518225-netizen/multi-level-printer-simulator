"""Command-line interface for the multi-level printer scheduler."""

from scheduler import (
    JobNotFoundError,
    PRIORITY_NAMES,
    PrinterScheduler,
    SchedulerError,
)


def _read_integer(prompt):
    """Read an integer from the terminal and report malformed values."""
    value = input(prompt).strip()
    try:
        return int(value)
    except ValueError:
        raise SchedulerError("enter a numeric integer value")


def _print_job(job):
    """Display a job's ID, name, page count, priority, and arrival."""
    print(
        "{} | {} | {} pages | {} ({}) | arrived {}".format(
            job.job_id,
            job.name,
            job.pages,
            PRIORITY_NAMES[job.priority],
            job.priority,
            job.arrival_time,
        )
    )


def _display_queue(scheduler):
    """Print the pending jobs level by level in their processing order."""
    for priority, label in PRIORITY_NAMES.items():
        jobs = scheduler.queues[priority].traverse()
        print("\n{} (priority {}):".format(label, priority))
        if not jobs:
            print("  [empty]")
        for job in jobs:
            print("  ", end="")
            _print_job(job)


def _display_log(scheduler):
    """Print completed jobs and aggregate waiting-time and throughput data."""
    if not scheduler.completion_log:
        print("No completed jobs.")
    for record in scheduler.completion_log:
        print(
            "{} | priority {} | arrival {} | start {} | finish {} | wait {}".format(
                record.job_id,
                record.priority,
                record.arrival_time,
                record.start_time,
                record.finish_time,
                record.waiting_time,
            )
        )
    print("Average waiting time: {:.2f}".format(scheduler.average_waiting_time()))
    print("Throughput: {:.3f} jobs/time unit".format(scheduler.throughput()))


def main():
    """Run the interactive menu until the user selects Exit."""
    print("Multi-Level Printer Job Scheduler")
    try:
        capacity = _read_integer("Maximum unfinished jobs [100]: ")
        if capacity == 0:
            capacity = 100
        time_per_page = _read_integer("Time per page [1]: ")
        if time_per_page == 0:
            time_per_page = 1
        scheduler = PrinterScheduler(capacity, time_per_page)
    except SchedulerError as error:
        print("Configuration error: {}".format(error))
        return

    while True:
        current = (
            "printing {}".format(scheduler.active_job.job_id)
            if scheduler.active_job is not None
            else "idle"
        )
        print("\nClock: {} | Printer: {}".format(scheduler.clock, current))
        print(
            "1 Submit job  2 Process next  3 Cancel job  4 Search job\n"
            "5 View queue  6 View log  7 Run simulation  8 Step  9 Reset  0 Exit"
        )
        choice = input("Choice: ").strip()
        try:
            if choice == "1":
                name = input("Job name: ").strip()
                pages = _read_integer("Pages: ")
                priority = _read_integer("Priority (1 Urgent, 2 High, 3 Normal, 4 Low): ")
                job = scheduler.submit_job(name, pages, priority)
                print("Submitted:")
                _print_job(job)
            elif choice == "2":
                record = scheduler.process_next_job()
                if record is None:
                    print("Queue is empty.")
                else:
                    print("Completed {} at time {}.".format(record.job_id, record.finish_time))
            elif choice == "3":
                job_id = input("Job ID to cancel: ").strip()
                job = scheduler.cancel_job(job_id)
                print("Cancelled {}.".format(job.job_id))
            elif choice == "4":
                job_id = input("Job ID to search: ").strip()
                job = scheduler.search_job(job_id)
                if job is None:
                    print("Job not found.")
                else:
                    _print_job(job)
                    if scheduler.active_job is job:
                        print(
                            "Currently printing; {} time units remain.".format(
                                scheduler.active_remaining_time
                            )
                        )
            elif choice == "5":
                _display_queue(scheduler)
            elif choice == "6":
                _display_log(scheduler)
            elif choice == "7":
                elapsed = scheduler.run_until_done()
                print("Simulation advanced {} ticks.".format(elapsed))
                _display_log(scheduler)
            elif choice == "8":
                record = scheduler.step()
                print(
                    "Clock is now {}.".format(scheduler.clock)
                    if scheduler.active_job is not None or record is not None
                    else "Queue is empty."
                )
                if record is not None:
                    print("Completed {}.".format(record.job_id))
            elif choice == "9":
                scheduler.reset()
                print("Simulation reset.")
            elif choice == "0":
                print("Goodbye.")
                return
            else:
                print("Choose a menu number from 0 to 9.")
        except (SchedulerError, JobNotFoundError) as error:
            print("Error: {}".format(error))


if __name__ == "__main__":
    main()
