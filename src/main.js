const ALGORITHMS = {
  fcfs: {
    title: 'First Come, First Served',
    mode: 'NON-PREEMPTIVE',
    description:
      'Processes run in the order they arrive. Once a process gets the CPU, it keeps it until its burst is complete.',
  },
  sjf: {
    title: 'Shortest Job First',
    mode: 'NON-PREEMPTIVE',
    description:
      'When the CPU becomes free, it selects the arrived process with the shortest burst. A running process is never interrupted.',
  },
  srtf: {
    title: 'Shortest Remaining Time',
    mode: 'PREEMPTIVE',
    description:
      'The process with the least remaining work runs next. A newly arrived shorter process can preempt the current one.',
  },
  priority: {
    title: 'Priority Scheduling',
    mode: 'NON-PREEMPTIVE',
    description:
      'Among arrived processes, the smallest priority number runs first. Equal priorities are resolved by arrival order.',
  },
  'priority-preemptive': {
    title: 'Priority Scheduling',
    mode: 'PREEMPTIVE',
    description:
      'The highest-priority ready process runs. A newly arrived process with a smaller priority number can interrupt it.',
  },
  rr: {
    title: 'Round Robin',
    mode: 'PREEMPTIVE',
    description:
      'Each ready process gets up to one time quantum, then moves to the back of the queue if it still has work.',
  },
};

const COLORS = ['blue', 'violet', 'green', 'amber', 'rose', 'cyan'];
const initialProcesses = [
  { name: 'P1', arrival: 0, burst: 7, priority: 2 },
  { name: 'P2', arrival: 2, burst: 4, priority: 1 },
  { name: 'P3', arrival: 4, burst: 1, priority: 3 },
  { name: 'P4', arrival: 5, burst: 4, priority: 2 },
];

let processes = initialProcesses.map((process, index) => ({
  ...process,
  id: index + 1,
}));
let nextProcessId = processes.length + 1;
let schedule = null;
let noticeTimer;
let playbackTimer = null;
let playbackTime = 0;
let playbackSpeed = 1;
let lastSceneProcessId = null;

const elements = {
  algorithm: document.getElementById('algorithm'),
  quantumControl: document.getElementById('quantum-control'),
  quantum: document.getElementById('quantum'),
  form: document.getElementById('process-form'),
  name: document.getElementById('process-name'),
  arrival: document.getElementById('arrival-time'),
  burst: document.getElementById('burst-time'),
  priority: document.getElementById('priority'),
  processBody: document.getElementById('process-body'),
  processCount: document.getElementById('process-count'),
  title: document.getElementById('algorithm-title'),
  description: document.getElementById('algorithm-description'),
  mode: document.getElementById('mode-badge'),
  notice: document.getElementById('notice'),
  timelineSummary: document.getElementById('timeline-summary'),
  timelineEmpty: document.getElementById('timeline-empty'),
  timelineContent: document.getElementById('timeline-content'),
  gantt: document.getElementById('gantt-chart'),
  ticks: document.getElementById('timeline-ticks'),
  resultsBody: document.getElementById('results-body'),
  resultsCount: document.getElementById('results-count'),
  playButton: document.getElementById('play-button'),
  stepButton: document.getElementById('step-button'),
  playbackSpeed: document.getElementById('playback-speed'),
  liveClock: document.getElementById('live-clock'),
  readyProcesses: document.getElementById('ready-processes'),
  queueCount: document.getElementById('queue-count'),
  decisionNote: document.getElementById('decision-note'),
  cpuStatus: document.getElementById('cpu-status'),
  scene: document.querySelector('.hero-scene'),
  sceneProcesses: document.getElementById('scene-processes'),
  scoreCard: document.getElementById('score-card'),
  efficiencyRank: document.getElementById('efficiency-rank'),
  scoreTitle: document.getElementById('score-title'),
  scoreDescription: document.getElementById('score-description'),
  achievementList: document.getElementById('achievement-list'),
};

function showNotice(message, isError = false) {
  elements.notice.textContent = message;
  elements.notice.classList.toggle('error', isError);
  elements.notice.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    elements.notice.hidden = true;
  }, 4500);
}

function createTextElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function processColor(process) {
  return COLORS[(process.id - 1) % COLORS.length];
}

function addSegment(segments, process, start, end) {
  if (end <= start) return;
  const last = segments.at(-1);
  if (last && last.process?.id === process?.id && last.end === start) {
    last.end = end;
    return;
  }
  segments.push({ process, start, end });
}

function earliestArrival(remaining) {
  return Math.min(...remaining.map((process) => process.arrival));
}

function pickReady(ready, algorithm) {
  const compareArrival = (a, b) => a.arrival - b.arrival || a.id - b.id;
  if (algorithm === 'sjf') {
    return ready.sort((a, b) => a.burst - b.burst || compareArrival(a, b))[0];
  }
  if (algorithm === 'priority') {
    return ready.sort(
      (a, b) => a.priority - b.priority || compareArrival(a, b),
    )[0];
  }
  return ready.sort(compareArrival)[0];
}

function scheduleNonPreemptive(input, algorithm) {
  const remaining = input.map((process) => ({ ...process }));
  const results = new Map();
  const segments = [];
  let time = 0;

  while (remaining.length) {
    const ready = remaining.filter((process) => process.arrival <= time);
    if (!ready.length) {
      const nextArrival = earliestArrival(remaining);
      addSegment(segments, null, time, nextArrival);
      time = nextArrival;
      continue;
    }

    const process = pickReady(ready, algorithm);
    const start = time;
    const end = start + process.burst;
    addSegment(segments, process, start, end);
    results.set(process.id, { process, start, completion: end });
    time = end;
    remaining.splice(
      remaining.findIndex((item) => item.id === process.id),
      1,
    );
  }
  return { segments, results };
}

function schedulePreemptive(input, algorithm) {
  const remaining = new Map(
    input.map((process) => [
      process.id,
      { ...process, remaining: process.burst },
    ]),
  );
  const results = new Map();
  const firstStarts = new Map();
  const segments = [];
  let time = 0;

  while (remaining.size) {
    const ready = [...remaining.values()].filter(
      (process) => process.arrival <= time,
    );
    if (!ready.length) {
      const nextArrival = earliestArrival([...remaining.values()]);
      addSegment(segments, null, time, nextArrival);
      time = nextArrival;
      continue;
    }

    ready.sort((a, b) => {
      if (algorithm === 'srtf') {
        return (
          a.remaining - b.remaining || a.arrival - b.arrival || a.id - b.id
        );
      }
      return a.priority - b.priority || a.arrival - b.arrival || a.id - b.id;
    });
    const process = ready[0];
    const start = time;
    if (!firstStarts.has(process.id)) firstStarts.set(process.id, start);
    const futureArrivals = [...remaining.values()]
      .filter((item) => item.arrival > time)
      .map((item) => item.arrival);
    const nextArrival = futureArrivals.length
      ? Math.min(...futureArrivals)
      : Infinity;
    const duration = Math.min(process.remaining, nextArrival - time);
    process.remaining -= duration;
    time += duration;
    addSegment(segments, process, start, time);

    if (process.remaining === 0) {
      results.set(process.id, {
        process,
        start: firstStarts.get(process.id),
        completion: time,
      });
      remaining.delete(process.id);
    }
  }
  return { segments, results };
}

function scheduleRoundRobin(input, quantum) {
  const pending = input
    .map((process) => ({ ...process, remaining: process.burst }))
    .sort((a, b) => a.arrival - b.arrival || a.id - b.id);
  const results = new Map();
  const firstStarts = new Map();
  const ready = [];
  const segments = [];
  let time = 0;
  let next = 0;

  while (next < pending.length || ready.length) {
    if (!ready.length && pending[next].arrival > time) {
      const nextArrival = pending[next].arrival;
      addSegment(segments, null, time, nextArrival);
      time = nextArrival;
    }
    while (next < pending.length && pending[next].arrival <= time) {
      ready.push(pending[next++]);
    }

    const process = ready.shift();
    if (!firstStarts.has(process.id)) firstStarts.set(process.id, time);
    const duration = Math.min(quantum, process.remaining);
    const start = time;
    time += duration;
    process.remaining -= duration;
    addSegment(segments, process, start, time);

    while (next < pending.length && pending[next].arrival <= time) {
      ready.push(pending[next++]);
    }
    if (process.remaining > 0) ready.push(process);
    else
      results.set(process.id, {
        process,
        start: firstStarts.get(process.id),
        completion: time,
      });
  }
  return { segments, results };
}

function calculateMetrics(process, result) {
  const turnaround = result.completion - process.arrival;
  return {
    completion: result.completion,
    turnaround,
    waiting: turnaround - process.burst,
    response: result.start - process.arrival,
  };
}

function runSimulation(autoplay = false) {
  if (!processes.length) {
    stopPlayback();
    schedule = null;
    playbackTime = 0;
    renderResults();
    showNotice('Add at least one process before running the simulation.', true);
    return;
  }
  const algorithm = elements.algorithm.value;
  const quantum = Number(elements.quantum.value);
  if (
    algorithm === 'rr' &&
    (!Number.isInteger(quantum) || quantum < 1 || quantum > 1000)
  ) {
    showNotice(
      'Time quantum must be a whole number between 1 and 1,000.',
      true,
    );
    return;
  }

  stopPlayback();
  const result =
    algorithm === 'fcfs' || algorithm === 'sjf' || algorithm === 'priority'
      ? scheduleNonPreemptive(processes, algorithm)
      : algorithm === 'rr'
        ? scheduleRoundRobin(processes, quantum)
        : schedulePreemptive(processes, algorithm);
  const rows = processes.map((process) => ({
    process,
    ...calculateMetrics(process, result.results.get(process.id)),
  }));
  const endTime = result.segments.at(-1)?.end ?? 0;
  const busyTime = processes.reduce(
    (total, process) => total + process.burst,
    0,
  );
  schedule = {
    ...result,
    rows,
    endTime,
    averageWait:
      rows.reduce((total, row) => total + row.waiting, 0) / rows.length,
    averageTurnaround:
      rows.reduce((total, row) => total + row.turnaround, 0) / rows.length,
    utilization: endTime ? (busyTime / endTime) * 100 : 0,
    throughput: endTime ? rows.length / endTime : 0,
  };
  playbackTime = 0;
  elements.scoreCard.hidden = true;
  renderResults();
  if (autoplay) startPlayback();
}

function renderProcesses() {
  elements.processBody.replaceChildren();
  elements.processCount.textContent = String(processes.length).padStart(2, '0');
  renderSceneQueue();
  if (!processes.length) {
    const row = createTextElement('tr', 'empty-row', '');
    const cell = createTextElement(
      'td',
      '',
      'No processes yet. Add one above or load the example.',
    );
    cell.colSpan = 5;
    row.append(cell);
    elements.processBody.append(row);
    return;
  }

  processes.forEach((process) => {
    const row = document.createElement('tr');
    const nameCell = document.createElement('td');
    const identity = createTextElement(
      'span',
      `process-id ${processColor(process)}`,
      process.name,
    );
    nameCell.append(identity);
    row.append(
      nameCell,
      createTextElement('td', 'mono-cell', String(process.arrival)),
      createTextElement('td', 'mono-cell', String(process.burst)),
      createTextElement('td', 'mono-cell', String(process.priority)),
    );
    const actionCell = document.createElement('td');
    const remove = createTextElement('button', 'remove-button', '×');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remove process ${process.name}`);
    remove.addEventListener('click', () => {
      processes = processes.filter((item) => item.id !== process.id);
      schedule = null;
      renderProcesses();
      renderResults();
    });
    actionCell.append(remove);
    row.append(actionCell);
    elements.processBody.append(row);
  });
}

function renderAlgorithmInfo() {
  const info = ALGORITHMS[elements.algorithm.value];
  elements.title.textContent = info.title;
  elements.description.textContent = info.description;
  elements.mode.textContent = info.mode;
  elements.quantumControl.hidden = elements.algorithm.value !== 'rr';
}

function renderStats() {
  const values = schedule
    ? [
        [schedule.averageWait, 'average-wait', 2],
        [schedule.averageTurnaround, 'average-turnaround', 2],
        [schedule.utilization, 'utilization', 1, '%'],
        [schedule.throughput, 'throughput', 3],
      ]
    : [
        [null, 'average-wait'],
        [null, 'average-turnaround'],
        [null, 'utilization'],
        [null, 'throughput'],
      ];
  values.forEach(([value, id, digits, suffix = '']) => {
    document.getElementById(id).textContent =
      value === null ? '—' : `${value.toFixed(digits)}${suffix}`;
  });
}

function renderTimeline() {
  const hasSchedule = Boolean(schedule?.segments.length);
  elements.timelineEmpty.hidden = hasSchedule;
  elements.timelineContent.hidden = !hasSchedule;
  if (!hasSchedule) {
    elements.timelineSummary.textContent =
      'Run the simulation to see the schedule';
    elements.liveClock.textContent = 'T = 0';
    elements.readyProcesses.replaceChildren(
      createTextElement('span', 'queue-empty', 'Waiting processes appear here'),
    );
    elements.queueCount.textContent = '0 READY';
    elements.decisionNote.textContent =
      'Press play or step to follow the scheduler.';
    elements.scoreCard.hidden = true;
    updateScene(null);
    return;
  }

  const duration = schedule.endTime || 1;
  elements.timelineSummary.textContent = `${schedule.rows.length} ${schedule.rows.length === 1 ? 'process' : 'processes'} · ${schedule.endTime} time units`;
  elements.gantt.replaceChildren();
  elements.ticks.replaceChildren();
  schedule.segments.forEach((segment) => {
    const block = createTextElement(
      'div',
      `gantt-segment ${segment.process ? processColor(segment.process) : 'idle-segment'}`,
      segment.process ? segment.process.name : 'IDLE',
    );
    block.style.flexGrow = String(segment.end - segment.start);
    block.style.flexBasis = '0';
    const result = segment.process
      ? schedule.rows.find((row) => row.process.id === segment.process.id)
      : null;
    block.title = segment.process
      ? `${segment.process.name} · start ${segment.start} · end ${segment.end} · wait ${result.waiting} · turnaround ${result.turnaround}`
      : `CPU idle · ${segment.start} to ${segment.end}`;
    elements.gantt.append(block);
  });
  elements.gantt.style.setProperty('--progress', '0%');
  elements.gantt.append(createTextElement('span', 'gantt-playhead', ''));

  const width = elements.gantt.clientWidth || 600;
  const boundaries = [...new Set(schedule.segments.flatMap(({ start, end }) => [start, end]))];
  let lastLabelPixel = -Infinity;
  boundaries.forEach((time, index) => {
    const pixel = (time / duration) * width;
    const isEnd = index === boundaries.length - 1;
    if (pixel - lastLabelPixel < 34) {
      if (!isEnd) return;
      const previousTick = elements.ticks.lastElementChild;
      if (previousTick && !previousTick.classList.contains('tick-start')) {
        previousTick.remove();
      }
    }
    const tick = createTextElement('span', 'timeline-tick', String(time));
    tick.style.left = `${(time / duration) * 100}%`;
    if (index === 0) tick.classList.add('tick-start');
    else if (isEnd) tick.classList.add('tick-end');
    elements.ticks.append(tick);
    lastLabelPixel = pixel;
  });
  updatePlaybackView();
}

function stopPlayback() {
  if (playbackTimer !== null) {
    clearInterval(playbackTimer);
    playbackTimer = null;
  }
  if (elements.playButton) {
    elements.playButton.textContent = '▶ Play';
    elements.playButton.setAttribute('aria-label', 'Play timeline');
  }
}

function startPlayback() {
  if (!schedule) return;
  if (playbackTime >= schedule.endTime) {
    playbackTime = 0;
    updatePlaybackView();
  }
  if (playbackTimer !== null) return;
  elements.scoreCard.hidden = true;
  elements.playButton.textContent = '❚❚ Pause';
  elements.playButton.setAttribute('aria-label', 'Pause timeline');
  playbackTimer = setInterval(() => advancePlayback(playbackSpeed), 550);
}

function advancePlayback(amount) {
  if (!schedule) return;
  playbackTime = Math.min(schedule.endTime, playbackTime + amount);
  updatePlaybackView();
  if (playbackTime >= schedule.endTime) {
    stopPlayback();
    showScoreCard();
  }
}

function updatePlaybackView() {
  if (!schedule) return;
  const duration = schedule.endTime || 1;
  const progress = Math.min(100, (playbackTime / duration) * 100);
  elements.gantt.style.setProperty('--progress', `${progress}%`);
  const playhead = elements.gantt.querySelector('.gantt-playhead');
  if (playhead) playhead.style.left = `${progress}%`;
  elements.gantt.querySelectorAll('.gantt-segment').forEach((block, index) => {
    const segment = schedule.segments[index];
    const isCurrent =
      segment.process && playbackTime >= segment.start && playbackTime < segment.end;
    block.classList.toggle('segment-current', Boolean(isCurrent));
    block.classList.toggle('segment-complete', segment.end <= playbackTime);
  });

  const currentSegment = schedule.segments.find(
    (segment) => playbackTime >= segment.start && playbackTime < segment.end,
  );
  const runningId = currentSegment?.process?.id;
  const completedIds = new Set(
    schedule.rows
      .filter((row) => row.completion <= playbackTime)
      .map((row) => row.process.id),
  );
  const ready = processes.filter(
    (process) =>
      process.arrival <= playbackTime &&
      !completedIds.has(process.id) &&
      process.id !== runningId,
  );
  elements.liveClock.textContent = `T = ${playbackTime}`;
  elements.readyProcesses.replaceChildren();
  if (ready.length) {
    ready.forEach((process) => {
      const chip = createTextElement(
        'span',
        `queue-chip ${processColor(process)}`,
        process.name,
      );
      elements.readyProcesses.append(chip);
    });
  } else {
    elements.readyProcesses.append(
      createTextElement(
        'span',
        'queue-empty',
        runningId ? 'No other processes waiting' : 'No processes ready',
      ),
    );
  }
  elements.queueCount.textContent = `${ready.length} READY`;
  if (currentSegment?.process) {
    const process = currentSegment.process;
    const justStarted = playbackTime === currentSegment.start;
    const rule =
      elements.algorithm.value === 'sjf'
        ? 'shortest available burst'
        : elements.algorithm.value === 'srtf'
          ? 'least remaining time'
          : elements.algorithm.value.startsWith('priority')
            ? 'highest priority'
            : elements.algorithm.value === 'rr'
              ? 'next Round Robin turn'
              : 'first arrival';
    elements.decisionNote.textContent = justStarted
      ? `At T=${playbackTime}, ${process.name} runs next: ${rule}.`
      : `${process.name} is running · ${ready.length} process${ready.length === 1 ? '' : 'es'} waiting.`;
  } else {
    const next = schedule.segments.find((segment) => segment.start >= playbackTime);
    elements.decisionNote.textContent = next
      ? `CPU idle until T=${next.start}, when the next process arrives.`
      : 'All processes have completed.';
  }
  updateScene(currentSegment?.process ?? null, completedIds);
}

function renderSceneQueue() {
  elements.sceneProcesses.replaceChildren();
  processes.forEach((process) => {
    const sprite = createTextElement(
      'span',
      `process-sprite ${processColor(process)}`,
      process.name,
    );
    sprite.dataset.processId = String(process.id);
    elements.sceneProcesses.append(sprite);
  });
}

function updateScene(runningProcess, completedIds = new Set()) {
  const currentId = runningProcess?.id ?? null;
  const changedProcess = currentId !== lastSceneProcessId;
  elements.scene.classList.toggle('cpu-running', Boolean(runningProcess));
  elements.cpuStatus.textContent = runningProcess
    ? `CPU // RUNNING ${runningProcess.name}`
    : 'CPU // READY';

  elements.sceneProcesses.querySelectorAll('.process-sprite').forEach((sprite) => {
    const id = Number(sprite.dataset.processId);
    sprite.classList.toggle('sprite-complete', completedIds.has(id));
    sprite.classList.toggle('sprite-active', id === currentId);
    if (id === currentId && changedProcess) {
      sprite.style.transform = '';
      requestAnimationFrame(() => {
        const sceneRect = elements.scene.getBoundingClientRect();
        const spriteRect = sprite.getBoundingClientRect();
        const cpuCenterX = sceneRect.left + (461 / 900) * sceneRect.width;
        const cpuCenterY = sceneRect.top + (97 / 190) * sceneRect.height;
        sprite.style.transform = `translate(${cpuCenterX - spriteRect.left - spriteRect.width / 2}px, ${cpuCenterY - spriteRect.top - spriteRect.height / 2}px) scale(.25)`;
      });
    } else if (id !== currentId) {
      sprite.style.transform = '';
    }
  });

  const character = elements.scene.querySelector('.scene-character');
  character.classList.toggle('character-running', Boolean(runningProcess));
  if (runningProcess && changedProcess) {
    character.style.transform = '';
    requestAnimationFrame(() => {
      const sceneRect = elements.scene.getBoundingClientRect();
      character.style.transform = `translate(${(106 / 900) * sceneRect.width}px, ${(-39 / 190) * sceneRect.height}px) scale(.5)`;
    });
  } else if (!runningProcess) {
    character.style.transform = '';
  }
  lastSceneProcessId = currentId;
}

function showScoreCard() {
  if (!schedule) return;
  const averageBurst =
    processes.reduce((total, process) => total + process.burst, 0) /
    processes.length;
  const averageWait = schedule.averageWait;
  const rank =
    averageWait === 0
      ? 'S'
      : averageWait <= averageBurst * 0.25
        ? 'A'
        : averageWait <= averageBurst
          ? 'B'
          : 'C';
  const convoyEffect =
    elements.algorithm.value === 'fcfs' &&
    schedule.segments.some(
      (segment) =>
        segment.process?.burst >= 5 &&
        processes.some(
          (process) =>
            process.arrival > segment.start &&
            process.arrival < segment.end &&
            process.burst <= 2 &&
            schedule.rows.find((row) => row.process.id === process.id).waiting > 0,
        ),
    );
  const achievements = [];
  if (averageWait === 0) achievements.push('ZERO WAIT HERO');
  if (convoyEffect) achievements.push('CONVOY EFFECT DETECTED');
  if (schedule.utilization >= 100) achievements.push('100% CPU UTILIZATION');

  elements.efficiencyRank.textContent = rank;
  elements.scoreTitle.textContent =
    rank === 'S' ? 'Zero Wait Hero' : `Rank ${rank} · Run complete`;
  elements.scoreDescription.textContent =
    `Average wait ${averageWait.toFixed(2)} time units · ${elements.algorithm.options[elements.algorithm.selectedIndex].text}`;
  elements.achievementList.replaceChildren();
  achievements.forEach((achievement) => {
    elements.achievementList.append(
      createTextElement('span', 'achievement-badge', `★ ${achievement}`),
    );
  });
  if (!achievements.length) {
    elements.achievementList.append(
      createTextElement('span', 'achievement-muted', 'No badges this run — try another algorithm.'),
    );
  }
  elements.scoreCard.hidden = false;
}

function renderResults() {
  renderStats();
  renderTimeline();
  elements.resultsBody.replaceChildren();
  if (!schedule) {
    const row = createTextElement('tr', 'empty-row', '');
    const cell = createTextElement(
      'td',
      '',
      'Run a simulation to calculate process timings.',
    );
    cell.colSpan = 7;
    row.append(cell);
    elements.resultsBody.append(row);
    elements.resultsCount.textContent = 'No results yet';
    return;
  }

  elements.resultsCount.textContent = `${schedule.rows.length} completed`;
  schedule.rows
    .slice()
    .sort((a, b) => a.process.id - b.process.id)
    .forEach((result) => {
      const row = document.createElement('tr');
      const identity = document.createElement('td');
      identity.append(
        createTextElement(
          'span',
          `process-id ${processColor(result.process)}`,
          result.process.name,
        ),
      );
      row.append(identity);
      [
        result.process.arrival,
        result.process.burst,
        result.completion,
        result.turnaround,
        result.waiting,
        result.response,
      ].forEach((value) =>
        row.append(createTextElement('td', 'mono-cell', String(value))),
      );
      elements.resultsBody.append(row);
    });
}

elements.form.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = elements.name.value.trim();
  const arrival = Number(elements.arrival.value);
  const burst = Number(elements.burst.value);
  const priority = Number(elements.priority.value);
  if (
    !name ||
    !Number.isInteger(arrival) ||
    arrival < 0 ||
    !Number.isInteger(burst) ||
    burst < 1 ||
    !Number.isInteger(priority) ||
    priority < 1 ||
    priority > 99
  ) {
    showNotice(
      'Enter a process name, arrival of 0 or more, burst of 1 or more, and priority from 1 to 99.',
      true,
    );
    return;
  }
  if (
    processes.some(
      (process) => process.name.toLowerCase() === name.toLowerCase(),
    )
  ) {
    showNotice('Process names must be unique.', true);
    elements.name.focus();
    return;
  }
  processes.push({ id: nextProcessId++, name, arrival, burst, priority });
  stopPlayback();
  schedule = null;
  playbackTime = 0;
  lastSceneProcessId = null;
  elements.scoreCard.hidden = true;
  elements.form.reset();
  elements.arrival.value = '0';
  elements.burst.value = '4';
  elements.priority.value = '2';
  renderProcesses();
  renderResults();
  elements.name.focus();
});

document.getElementById('run-button').addEventListener('click', () => runSimulation(true));
elements.algorithm.addEventListener('change', () => {
  renderAlgorithmInfo();
  if (processes.length) runSimulation(false);
});
elements.quantum.addEventListener('change', () => {
  if (elements.algorithm.value === 'rr' && processes.length) runSimulation(false);
});
elements.playButton.addEventListener('click', () => {
  if (playbackTimer !== null) stopPlayback();
  else startPlayback();
});
elements.stepButton.addEventListener('click', () => {
  stopPlayback();
  advancePlayback(1);
});
elements.playbackSpeed.addEventListener('change', () => {
  playbackSpeed = Number(elements.playbackSpeed.value);
});
document.getElementById('demo-button').addEventListener('click', () => {
  processes = initialProcesses.map((process, index) => ({
    ...process,
    id: index + 1,
  }));
  nextProcessId = processes.length + 1;
  schedule = null;
  playbackTime = 0;
  lastSceneProcessId = null;
  elements.algorithm.value = 'fcfs';
  elements.quantum.value = '2';
  renderAlgorithmInfo();
  renderProcesses();
  runSimulation(true);
  showNotice('Example loaded. Try another algorithm to compare the schedule.');
});
document.getElementById('reset-button').addEventListener('click', () => {
  stopPlayback();
  processes = [];
  nextProcessId = 1;
  schedule = null;
  playbackTime = 0;
  lastSceneProcessId = null;
  renderProcesses();
  renderResults();
  showNotice('Simulation cleared. Add a process to get started.');
});

renderAlgorithmInfo();
renderProcesses();
runSimulation(false);
