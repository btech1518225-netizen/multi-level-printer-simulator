const PRIORITIES = ['high', 'medium', 'low'];
const PRIORITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low' };
const DEMO_JOBS = [
  { name: 'Assignment A', pages: 10, priority: 'low' },
  { name: 'Exam Paper', pages: 5, priority: 'high' },
  { name: 'College Notice', pages: 3, priority: 'medium' },
  { name: 'Lab Report', pages: 8, priority: 'high' },
];

class QueueNode {
  constructor(value) {
    this.value = value;
    this.next = null;
  }
}

class LinkedQueue {
  constructor() {
    this.front = null;
    this.rear = null;
    this.length = 0;
  }

  enqueue(value) {
    const node = new QueueNode(value);
    if (this.rear) this.rear.next = node;
    else this.front = node;
    this.rear = node;
    this.length += 1;
  }

  dequeue() {
    if (!this.front) return null;
    const node = this.front;
    this.front = node.next;
    if (!this.front) this.rear = null;
    this.length -= 1;
    return node.value;
  }

  peek() {
    return this.front?.value ?? null;
  }

  toArray() {
    const jobs = [];
    for (let node = this.front; node; node = node.next) jobs.push(node.value);
    return jobs;
  }

  cancel(jobId) {
    let previous = null;
    let current = this.front;
    while (current) {
      if (current.value.id === jobId) {
        if (previous) previous.next = current.next;
        else this.front = current.next;
        if (this.rear === current) this.rear = previous;
        this.length -= 1;
        return current.value;
      }
      previous = current;
      current = current.next;
    }
    return null;
  }
}

const queues = Object.fromEntries(
  PRIORITIES.map((priority) => [priority, new LinkedQueue()]),
);
const completed = [];
let nextJobId = 1;
let simulationClock = 0;
let processing = false;

const elements = {
  form: document.getElementById('job-form'),
  name: document.getElementById('document-name'),
  pages: document.getElementById('page-count'),
  priority: document.getElementById('priority'),
  notice: document.getElementById('notice'),
  high: document.getElementById('high-queue'),
  medium: document.getElementById('medium-queue'),
  low: document.getElementById('low-queue'),
  history: document.getElementById('history-body'),
  printerState: document.getElementById('printer-state'),
  printerMessage: document.getElementById('printer-message'),
  printNext: document.getElementById('print-next'),
  processAll: document.getElementById('process-all'),
};

function showNotice(message, isError = false) {
  elements.notice.textContent = message;
  elements.notice.classList.toggle('error', isError);
  elements.notice.hidden = false;
  clearTimeout(showNotice.timeout);
  showNotice.timeout = setTimeout(() => {
    elements.notice.hidden = true;
  }, 4500);
}

function createTextElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function renderQueue(priority) {
  const list = elements[priority];
  const jobs = queues[priority].toArray();
  list.replaceChildren();
  document.getElementById(`${priority}-count`).textContent = String(
    jobs.length,
  );
  if (jobs.length === 0) {
    list.append(createTextElement('div', 'empty-queue', 'No jobs waiting'));
    return;
  }
  for (const job of jobs) {
    const card = createTextElement('article', 'job-card', '');
    const main = createTextElement('div', 'job-main', '');
    main.append(
      createTextElement('div', 'job-name', job.name),
      createTextElement(
        'div',
        'job-detail',
        `${job.pages} ${job.pages === 1 ? 'page' : 'pages'} · arrived at ${job.arrivalTime}s`,
      ),
      createTextElement(
        'span',
        'job-id',
        `JOB-${String(job.id).padStart(3, '0')}`,
      ),
    );
    const cancel = createTextElement('button', 'cancel-button', '×');
    cancel.type = 'button';
    cancel.setAttribute('aria-label', `Cancel ${job.name}`);
    cancel.title = 'Cancel waiting job';
    cancel.addEventListener('click', () => cancelJob(job.id, priority));
    card.append(main, cancel);
    list.append(card);
  }
}

function renderHistory() {
  elements.history.replaceChildren();
  document.getElementById('history-count').textContent =
    `${completed.length} ${completed.length === 1 ? 'job' : 'jobs'}`;
  if (completed.length === 0) {
    const row = createTextElement('tr', 'empty-row', '');
    const cell = createTextElement(
      'td',
      '',
      'No completed jobs yet. Your print history will appear here.',
    );
    cell.colSpan = 9;
    row.append(cell);
    elements.history.append(row);
    return;
  }
  for (const job of [...completed].reverse()) {
    const row = document.createElement('tr');
    const values = [
      `JOB-${String(job.id).padStart(3, '0')}`,
      job.name,
      PRIORITY_LABELS[job.priority],
      String(job.pages),
      `${job.arrivalTime}s`,
      `${job.startTime}s`,
      `${job.completionTime}s`,
      `${job.waitingTime}s`,
      `${job.turnaroundTime}s`,
    ];
    values.forEach((value, index) => {
      const cell = createTextElement(
        'td',
        index === 1 ? 'table-job-name' : '',
        value,
      );
      if (index === 2) {
        const tag = createTextElement(
          'span',
          `priority-tag ${job.priority}`,
          value,
        );
        cell.replaceChildren(tag);
      }
      row.append(cell);
    });
    elements.history.append(row);
  }
}

function renderStats() {
  const waiting = PRIORITIES.reduce(
    (total, priority) => total + queues[priority].length,
    0,
  );
  const totalPages = completed.reduce((total, job) => total + job.pages, 0);
  const average = (key) =>
    completed.length
      ? (
          completed.reduce((total, job) => total + job[key], 0) /
          completed.length
        ).toFixed(1)
      : '0.0';
  document.getElementById('stat-completed').textContent = String(
    completed.length,
  );
  document.getElementById('stat-waiting').textContent = String(waiting);
  document.getElementById('stat-pages').textContent = String(totalPages);
  document.getElementById('stat-wait').textContent = average('waitingTime');
  document.getElementById('stat-turnaround').textContent =
    average('turnaroundTime');
  document.getElementById('clock-value').textContent = String(simulationClock);
  elements.printNext.disabled = processing || waiting === 0;
  elements.processAll.disabled = processing || waiting === 0;
}

function render() {
  PRIORITIES.forEach(renderQueue);
  renderHistory();
  renderStats();
}

function addJob(name, pages, priority) {
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error('Enter a document name.');
  if (!Number.isInteger(pages) || pages < 1 || pages > 10000) {
    throw new Error('Page count must be a whole number from 1 to 10,000.');
  }
  if (!PRIORITIES.includes(priority))
    throw new Error('Choose a valid priority.');
  const job = {
    id: nextJobId++,
    name: normalizedName,
    pages,
    priority,
    arrivalTime: simulationClock,
    startTime: null,
    completionTime: null,
  };
  queues[priority].enqueue(job);
  render();
  return job;
}

function cancelJob(jobId, priority) {
  const job = queues[priority].cancel(jobId);
  if (!job) {
    showNotice('That waiting job could not be found.', true);
    return;
  }
  render();
  showNotice(`${job.name} was cancelled while waiting.`);
}

function selectNextJob() {
  for (const priority of PRIORITIES) {
    if (!queues[priority].peek()) continue;
    const job = queues[priority].dequeue();
    return {
      job,
      reason: `${PRIORITY_LABELS[priority]} priority queue is the highest non-empty queue`,
    };
  }
  return null;
}

function waitForPrintAnimation() {
  return new Promise((resolve) => setTimeout(resolve, 350));
}

async function printNextJob() {
  if (processing) return null;
  const selection = selectNextJob();
  if (!selection) return null;

  processing = true;
  const { job, reason } = selection;
  elements.printerState.classList.add('busy');
  elements.printerState.lastChild.textContent = ' Printing';
  elements.printerMessage.textContent = `Printing ${job.name} · ${reason}.`;
  render();
  await waitForPrintAnimation();

  job.startTime = Math.max(simulationClock, job.arrivalTime);
  job.completionTime = job.startTime + job.pages;
  job.waitingTime = job.startTime - job.arrivalTime;
  job.turnaroundTime = job.completionTime - job.arrivalTime;
  simulationClock = job.completionTime;
  completed.push(job);

  processing = false;
  elements.printerState.classList.remove('busy');
  elements.printerState.lastChild.textContent = ' Idle';
  elements.printerMessage.textContent = `Printed ${job.name}. Selected because ${reason}.`;
  render();
  showNotice(
    `Printed ${job.name} (${PRIORITY_LABELS[job.priority]}). Wait: ${job.waitingTime}s; turnaround: ${job.turnaroundTime}s.`,
  );
  return job;
}

elements.form.addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    const job = addJob(
      elements.name.value,
      Number(elements.pages.value),
      elements.priority.value,
    );
    elements.form.reset();
    elements.priority.value = 'medium';
    elements.name.focus();
    showNotice(
      `${job.name} added to the ${PRIORITY_LABELS[job.priority].toLowerCase()} priority queue.`,
    );
  } catch (error) {
    showNotice(error.message, true);
  }
});

elements.printNext.addEventListener('click', async () => {
  if (queues.high.length + queues.medium.length + queues.low.length === 0) {
    showNotice('There are no jobs waiting to print.', true);
    return;
  }
  await printNextJob();
});

elements.processAll.addEventListener('click', async () => {
  if (processing) return;
  let processed = 0;
  while (queues.high.length + queues.medium.length + queues.low.length > 0) {
    await printNextJob();
    processed += 1;
  }
  if (processed > 0)
    showNotice(
      `Finished processing ${processed} ${processed === 1 ? 'job' : 'jobs'}.`,
    );
});

document.getElementById('demo-button').addEventListener('click', () => {
  try {
    DEMO_JOBS.forEach((job) => addJob(job.name, job.pages, job.priority));
    showNotice(
      'Demo loaded: Exam Paper and Lab Report will print before the medium- and low-priority jobs.',
    );
  } catch (error) {
    showNotice(error.message, true);
  }
});

document.getElementById('reset-button').addEventListener('click', () => {
  if (processing) {
    showNotice(
      'Wait for the current print job to finish before resetting.',
      true,
    );
    return;
  }
  if (
    !window.confirm(
      'Reset the simulation? All waiting and completed jobs will be removed.',
    )
  )
    return;
  for (const priority of PRIORITIES) {
    while (queues[priority].dequeue()) {
      // Drain each linked queue to release its nodes.
    }
  }
  completed.length = 0;
  nextJobId = 1;
  simulationClock = 0;
  processing = false;
  elements.printerState.classList.remove('busy');
  elements.printerState.lastChild.textContent = ' Idle';
  elements.printerMessage.textContent = 'Ready for the next job.';
  render();
  showNotice('Simulation reset.');
});

render();
