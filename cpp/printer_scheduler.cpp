#include <algorithm>
#include <chrono>
#include <cctype>
#include <cstdint>
#include <ctime>
#include <iomanip>
#include <iostream>
#include <queue>
#include <sstream>
#include <string>
#include <vector>

enum class Priority { Critical = 1, High = 2, Medium = 3, Low = 4 };

std::string priorityName(Priority priority) {
    switch (priority) {
        case Priority::Critical: return "Critical";
        case Priority::High: return "High";
        case Priority::Medium: return "Medium";
        case Priority::Low: return "Low";
    }
    return "Unknown";
}

using Clock = std::chrono::system_clock;

struct PrintJob {
    int id;
    std::string documentName;
    int pages;
    Priority priority;
    std::uint64_t arrivalOrder;
    Clock::time_point arrivalTime;
    Clock::time_point startTime;
    Clock::time_point completionTime;
};

struct JobComparator {
    bool operator()(const PrintJob& left, const PrintJob& right) const {
        if (left.priority != right.priority) {
            return static_cast<int>(left.priority) > static_cast<int>(right.priority);
        }
        return left.arrivalOrder > right.arrivalOrder;
    }
};

using JobQueue = std::priority_queue<PrintJob, std::vector<PrintJob>, JobComparator>;

std::string formatTimestamp(Clock::time_point timestamp) {
    const auto milliseconds =
        std::chrono::duration_cast<std::chrono::milliseconds>(timestamp.time_since_epoch());
    const std::time_t time = Clock::to_time_t(timestamp);
    const std::tm* localTime = std::localtime(&time);
    if (localTime == nullptr) return std::to_string(milliseconds.count()) + " ms since epoch";

    std::ostringstream output;
    output << std::put_time(localTime, "%Y-%m-%d %H:%M:%S") << '.'
           << std::setw(3) << std::setfill('0')
           << (milliseconds.count() % 1000);
    return output.str();
}

long long secondsBetween(Clock::time_point start, Clock::time_point end) {
    return std::chrono::duration_cast<std::chrono::seconds>(end - start).count();
}

class PrinterScheduler {
private:
    JobQueue waitingJobs_;
    std::vector<PrintJob> completedJobs_;
    int nextId_;
    std::uint64_t nextArrivalOrder_;
    Clock::time_point clock_;
    int totalPagesPrinted_;

public:
    PrinterScheduler()
        : nextId_(1),
          nextArrivalOrder_(0),
          clock_(Clock::now()),
          totalPagesPrinted_(0) {}

    int waitingCount() const { return static_cast<int>(waitingJobs_.size()); }
    int completedCount() const { return static_cast<int>(completedJobs_.size()); }
    int totalPagesPrinted() const { return totalPagesPrinted_; }
    Clock::time_point clock() const { return clock_; }
    const std::vector<PrintJob>& history() const { return completedJobs_; }

    bool addJob(const std::string& name, int pages, Priority priority) {
        if (name.find_first_not_of(" \t\n\r") == std::string::npos ||
            pages < 1 || pages > 10000 ||
            (priority != Priority::Critical && priority != Priority::High &&
             priority != Priority::Medium && priority != Priority::Low)) {
            return false;
        }

        const Clock::time_point arrivalTime = std::max(Clock::now(), clock_);
        waitingJobs_.push(PrintJob{
            nextId_++,
            name,
            pages,
            priority,
            nextArrivalOrder_++,
            arrivalTime,
            Clock::time_point{},
            Clock::time_point{}
        });
        return true;
    }

    void reset() {
        waitingJobs_ = JobQueue{};
        completedJobs_.clear();
        nextId_ = 1;
        clock_ = Clock::now();
        totalPagesPrinted_ = 0;
    }

    bool cancelJob(int id, PrintJob& cancelledJob) {
        JobQueue remaining;
        bool found = false;
        while (!waitingJobs_.empty()) {
            const PrintJob job = waitingJobs_.top();
            waitingJobs_.pop();
            if (!found && job.id == id) {
                cancelledJob = job;
                found = true;
            } else {
                remaining.push(job);
            }
        }
        waitingJobs_ = remaining;
        return found;
    }

    bool processNext(PrintJob& printedJob) {
        if (waitingJobs_.empty()) return false;

        printedJob = waitingJobs_.top();
        waitingJobs_.pop();
        printedJob.startTime = std::max(clock_, printedJob.arrivalTime);
        printedJob.completionTime =
            printedJob.startTime + std::chrono::seconds(printedJob.pages);
        clock_ = printedJob.completionTime;
        totalPagesPrinted_ += printedJob.pages;
        completedJobs_.push_back(printedJob);
        return true;
    }

    void displayQueues(std::ostream& output) const {
        JobQueue orderedJobs = waitingJobs_;
        if (orderedJobs.empty()) {
            output << "\nWaiting jobs\n  (empty)\n";
            return;
        }
        output << "\nWaiting jobs (next to print first)\n";
        while (!orderedJobs.empty()) {
            const PrintJob& job = orderedJobs.top();
            output << "  JOB-" << job.id << " | " << job.documentName
                   << " | " << job.pages << " page(s) | "
                   << priorityName(job.priority) << " | arrived "
                   << formatTimestamp(job.arrivalTime) << '\n';
            orderedJobs.pop();
        }
    }

    void displayHistory(std::ostream& output) const {
        if (completedJobs_.empty()) {
            output << "No jobs have been completed.\n";
            return;
        }
        output << "\nCompleted jobs (in processing order)\n";
        for (const PrintJob& job : completedJobs_) {
            output << "JOB-" << job.id << " | " << job.documentName
                   << " | " << priorityName(job.priority)
                   << " | arrived " << formatTimestamp(job.arrivalTime)
                   << " | started " << formatTimestamp(job.startTime)
                   << " | completed " << formatTimestamp(job.completionTime)
                   << " | waited " << secondsBetween(job.arrivalTime, job.startTime)
                   << "s\n";
        }
    }

    void displayStatistics(std::ostream& output) const {
        long long totalWait = 0;
        long long totalTurnaround = 0;
        for (const PrintJob& job : completedJobs_) {
            totalWait += secondsBetween(job.arrivalTime, job.startTime);
            totalTurnaround += secondsBetween(job.arrivalTime, job.completionTime);
        }
        const double count = static_cast<double>(completedJobs_.size());
        output << "Completed jobs: " << completedJobs_.size()
               << " | Waiting jobs: " << waitingCount()
               << " | Pages printed: " << totalPagesPrinted()
               << " | Simulation clock: " << formatTimestamp(clock_) << '\n';
        output << "Average waiting time: "
               << (count == 0 ? 0 : totalWait / count) << "s"
               << " | Average turnaround time: "
               << (count == 0 ? 0 : totalTurnaround / count) << "s\n";
    }
};

bool parseInteger(const std::string& text, int& value) {
    std::istringstream input(text);
    char extra;
    return (input >> value) && !(input >> extra);
}

int readInteger(const std::string& prompt) {
    while (true) {
        std::cout << prompt;
        std::string line;
        if (!std::getline(std::cin, line)) return -1;
        int value = 0;
        if (parseInteger(line, value)) return value;
        std::cout << "Please enter a whole number.\n";
    }
}

bool readPriority(Priority& priority) {
    while (true) {
        const int choice = readInteger(
            "Priority (1 = Critical, 2 = High, 3 = Medium, 4 = Low): ");
        if (!std::cin) return false;
        if (choice == 1) priority = Priority::Critical;
        else if (choice == 2) priority = Priority::High;
        else if (choice == 3) priority = Priority::Medium;
        else if (choice == 4) priority = Priority::Low;
        else {
            std::cout << "Choose priority 1, 2, 3, or 4.\n";
            continue;
        }
        return true;
    }
}

void runConsole() {
    PrinterScheduler scheduler;
    std::cout << "MULTI-LEVEL PRINTER JOB SCHEDULER\n"
              << "Simulation assumption: one page takes one simulated second.\n";
    bool running = true;
    while (running) {
        std::cout << "\n1. Add job  2. Print next  3. Process all  4. Display queue\n"
                  << "5. Cancel waiting job  6. Completed history  7. Statistics  8. Reset  0. Exit\n";
        const int choice = readInteger("Select an option: ");
        if (choice == 0) {
            running = false;
        } else if (choice == 1) {
            std::cout << "Document name: ";
            std::string name;
            if (!std::getline(std::cin, name)) break;
            const int pages = readInteger("Number of pages (1-10000): ");
            if (pages < 1 || pages > 10000) {
                std::cout << "Page count must be between 1 and 10000.\n";
                continue;
            }
            Priority priority;
            if (!readPriority(priority)) break;
            if (scheduler.addJob(name, pages, priority)) {
                std::cout << "Job added to " << priorityName(priority) << " priority.\n";
            } else {
                std::cout << "A document name and valid page count are required.\n";
            }
        } else if (choice == 2 || choice == 3) {
            int processed = 0;
            PrintJob job{};
            while (scheduler.processNext(job)) {
                ++processed;
                std::cout << "Printed JOB-" << job.id << " \"" << job.documentName
                          << "\" (" << priorityName(job.priority) << ", " << job.pages
                          << " page(s)); wait "
                          << secondsBetween(job.arrivalTime, job.startTime)
                          << "s. Completed "
                          << formatTimestamp(job.completionTime) << ".\n";
                if (choice == 2) break;
            }
            if (processed == 0) std::cout << "No jobs are waiting.\n";
        } else if (choice == 4) {
            scheduler.displayQueues(std::cout);
        } else if (choice == 5) {
            const int id = readInteger("Job ID to cancel (numeric part): ");
            PrintJob cancelled{};
            if (scheduler.cancelJob(id, cancelled)) {
                std::cout << "Cancelled JOB-" << cancelled.id << " \""
                          << cancelled.documentName << "\".\n";
            } else {
                std::cout << "No waiting job has that ID.\n";
            }
        } else if (choice == 6) {
            scheduler.displayHistory(std::cout);
        } else if (choice == 7) {
            scheduler.displayStatistics(std::cout);
        } else if (choice == 8) {
            std::string answer;
            std::cout << "Reset all queues, history, IDs, and statistics? (y/n): ";
            if (!std::getline(std::cin, answer)) break;
            if (!answer.empty() &&
                std::tolower(static_cast<unsigned char>(answer[0])) == 'y') {
                scheduler.reset();
                std::cout << "Simulation reset.\n";
            }
        } else if (choice != -1) {
            std::cout << "Choose one of the listed menu options.\n";
        } else {
            break;
        }
    }
}

void check(bool condition, const std::string& description, int& failures) {
    std::cout << (condition ? "[PASS] " : "[FAIL] ") << description << '\n';
    if (!condition) ++failures;
}

int runTests() {
    int failures = 0;
    {
        PrinterScheduler scheduler;
        PrintJob job{};
        check(!scheduler.processNext(job) && scheduler.waitingCount() == 0,
              "Empty queues do not produce a job", failures);
    }
    {
        PrinterScheduler scheduler;
        scheduler.addJob("Low", 1, Priority::Low);
        scheduler.addJob("Medium", 1, Priority::Medium);
        scheduler.addJob("High", 1, Priority::High);
        scheduler.addJob("Critical", 1, Priority::Critical);
        PrintJob job{};
        const std::vector<std::string> expected = {"Critical", "High", "Medium", "Low"};
        bool correctOrder = true;
        for (const std::string& name : expected) {
            correctOrder = scheduler.processNext(job) &&
                           correctOrder && job.documentName == name;
        }
        check(correctOrder,
              "Jobs are processed Critical, High, Medium, then Low", failures);
    }
    {
        PrinterScheduler scheduler;
        scheduler.addJob("First high", 1, Priority::High);
        scheduler.addJob("Second high", 1, Priority::High);
        PrintJob job{};
        scheduler.processNext(job);
        const bool first = job.documentName == "First high";
        scheduler.processNext(job);
        check(first && job.documentName == "Second high",
              "Equal-priority jobs preserve FIFO arrival order", failures);
    }
    {
        PrinterScheduler scheduler;
        scheduler.addJob("Earlier low", 1, Priority::Low);
        scheduler.addJob("Later critical", 1, Priority::Critical);
        PrintJob job{};
        scheduler.processNext(job);
        check(job.documentName == "Later critical",
              "A later critical job precedes a waiting low-priority job", failures);
    }
    {
        PrinterScheduler scheduler;
        scheduler.addJob("Keep", 1, Priority::Medium);
        scheduler.addJob("Cancel", 1, Priority::Medium);
        PrintJob cancelled{};
        PrintJob job{};
        const bool removed = scheduler.cancelJob(2, cancelled);
        scheduler.processNext(job);
        check(removed && cancelled.documentName == "Cancel" &&
                  job.documentName == "Keep" && scheduler.waitingCount() == 0,
              "Cancellation removes a waiting job without disturbing others", failures);
    }
    {
        PrinterScheduler scheduler;
        check(!scheduler.addJob("Invalid pages", 0, Priority::High) &&
                  !scheduler.addJob("Too many", 10001, Priority::High) &&
                  !scheduler.addJob("", 1, Priority::High) &&
                  !scheduler.addJob("   ", 1, Priority::High) &&
                  !scheduler.addJob("Invalid priority", 1, static_cast<Priority>(5)) &&
                  scheduler.waitingCount() == 0,
              "Invalid page counts, priorities, and empty names are rejected", failures);
    }
    {
        PrinterScheduler scheduler;
        scheduler.addJob("Low", 2, Priority::Low);
        scheduler.addJob("High 1", 3, Priority::High);
        scheduler.addJob("High 2", 1, Priority::High);
        PrintJob job{};
        int processed = 0;
        while (scheduler.processNext(job)) ++processed;
        check(processed == 3 && scheduler.completedCount() == 3 &&
                  scheduler.waitingCount() == 0 && scheduler.totalPagesPrinted() == 6,
              "Processing all jobs drains the queue and updates totals", failures);
    }
    {
        PrinterScheduler scheduler;
        scheduler.addJob("First", 5, Priority::High);
        scheduler.addJob("Second", 3, Priority::High);
        PrintJob first{};
        PrintJob second{};
        scheduler.processNext(first);
        scheduler.processNext(second);
        check(first.arrivalOrder < second.arrivalOrder &&
                  first.startTime == first.arrivalTime &&
                  first.completionTime == first.startTime + std::chrono::seconds(5) &&
                  second.startTime == first.completionTime &&
                  second.completionTime == second.startTime + std::chrono::seconds(3) &&
                  secondsBetween(second.arrivalTime, second.startTime) >= 4,
              "Arrival ordering, chrono timestamps, and waiting time are recorded", failures);
    }
    std::cout << failures << " test(s) failed.\n";
    return failures == 0 ? 0 : 1;
}

int main(int argc, char* argv[]) {
    if (argc > 1 && std::string(argv[1]) == "--test") return runTests();
    runConsole();
    return 0;
}
