const message = document.getElementById("message");

// Send an API request and surface backend validation errors to the interface.
async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

// Create display nodes using textContent so job names remain plain text.
function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

// Refresh every dashboard panel from the authoritative scheduler snapshot.
function render(state) {
  document.getElementById("clock").textContent = state.clock;
  document.getElementById("capacity").textContent = state.max_capacity;
  document.getElementById("queue-count").textContent =
    `${state.pending_count} queued`;

  const printer = state.active_job;
  const status = document.getElementById("printer-status");
  status.textContent = printer ? "PRINTING" : "IDLE";
  status.classList.toggle("printing", Boolean(printer));
  document.getElementById("current-job").textContent = printer
    ? `${printer.job_id} · ${printer.name}`
    : "Waiting for a job";
  const percent = printer
    ? ((printer.total_time - printer.remaining_time) / printer.total_time) * 100
    : 0;
  document.getElementById("progress").style.width = `${percent}%`;
  document.getElementById("progress-label").textContent = printer
    ? `Priority ${printer.priority} · ${printer.pages} pages`
    : "No active job";
  document.getElementById("remaining").textContent = printer
    ? `${printer.total_time - printer.remaining_time} / ${printer.total_time} units`
    : "0 / 0";

  const queues = document.getElementById("queues");
  queues.replaceChildren();
  for (const [level, data] of Object.entries(state.levels)) {
    const section = makeElement("section", `queue-level level-${level}`);
    const title = makeElement("div", "queue-title");
    const label = makeElement("span");
    const dot = makeElement("i", "priority-dot");
    label.append(dot, document.createTextNode(`${level} · ${data.name}`));
    title.append(label, makeElement("span", "count", `${data.jobs.length}`));
    const cards = makeElement("div", "job-cards");
    if (!data.jobs.length) {
      cards.append(makeElement("span", "empty-queue", "No waiting jobs"));
    }
    for (const job of data.jobs) {
      const card = makeElement("div", "job-card");
      card.append(
        makeElement("strong", "", `${job.job_id} · ${job.name}`),
        makeElement("span", "", `${job.pages} pages · arrived ${job.arrival_time}`),
      );
      cards.append(card);
    }
    section.append(title, cards);
    queues.append(section);
  }

  const logBody = document.getElementById("log-body");
  logBody.replaceChildren();
  if (!state.completion_log.length) {
    const row = makeElement("tr");
    row.append(makeElement("td", "empty-cell", "No completed jobs yet"));
    row.firstChild.colSpan = 6;
    logBody.append(row);
  }
  for (const record of state.completion_log) {
    const row = makeElement("tr");
    const values = [
      `${record.job_id} · ${record.name}`,
      record.priority,
      record.arrival_time,
      record.start_time,
      record.finish_time,
      record.waiting_time,
    ];
    for (const value of values) row.append(makeElement("td", "", String(value)));
    logBody.append(row);
  }
  document.getElementById("average-wait").textContent =
    Number(state.average_waiting_time).toFixed(2);
  const throughput = document.getElementById("throughput");
  throughput.replaceChildren(
    document.createTextNode(Number(state.throughput).toFixed(3)),
    makeElement("small", "", " jobs/unit"),
  );
}

// Fetch and render the latest server-side simulation state.
async function refresh() {
  const state = await request("/api/state");
  render(state);
}

// Show form or simulation feedback with a success/error style.
function showMessage(text, success = false) {
  message.textContent = text;
  message.classList.toggle("success", success);
}

// Validate and submit the form through the scheduler API.
document.getElementById("job-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = {
    name: form.elements.name.value.trim(),
    pages: Number(form.elements.pages.value),
    priority: Number(form.elements.priority.value),
  };
  try {
    const result = await request("/api/jobs", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    form.reset();
    form.elements.priority.value = "3";
    showMessage(`Added ${result.job.job_id} to the queue.`, true);
    render(result.state);
  } catch (error) {
    showMessage(error.message);
  }
});

// Advance one simulation tick and refresh the visual state.
document.getElementById("step-button").addEventListener("click", async () => {
  try {
    const result = await request("/api/step", { method: "POST" });
    render(result.state);
    showMessage(result.completed
      ? `${result.completed.job_id} finished.`
      : "Simulation advanced one tick.", true);
  } catch (error) {
    showMessage(error.message);
  }
});

// Finish all queued work and report the elapsed simulated ticks.
document.getElementById("run-button").addEventListener("click", async () => {
  try {
    const result = await request("/api/run", { method: "POST" });
    render(result.state);
    showMessage(`Run complete in ${result.elapsed_ticks} ticks.`, true);
  } catch (error) {
    showMessage(error.message);
  }
});

// Clear the scheduler and redraw its initial state.
document.getElementById("reset-button").addEventListener("click", async () => {
  try {
    render(await request("/api/reset", { method: "POST" }));
    showMessage("Simulation reset.", true);
  } catch (error) {
    showMessage(error.message);
  }
});

// Display initial load errors without hiding failures from the user.
refresh().catch((error) => showMessage(error.message));
