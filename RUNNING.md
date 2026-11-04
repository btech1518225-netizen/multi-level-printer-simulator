# Run instructions

## Command-line interface

Python 3.9 or later is recommended. From the project directory:

```text
python cli.py
```

Enter a positive maximum unfinished-job capacity and positive time per page.
At either prompt, enter `0` to use the default (100 jobs or 1 time unit).
Choose a menu number to submit, process, cancel, search, view, step, run, reset,
or exit.

## Web interface (optional)

Install the optional web dependency and start the application:

```text
python -m pip install -r requirements.txt
python app.py
```

Open `http://127.0.0.1:5000`. The Flask backend and CLI use the same
`PrinterScheduler` and custom linked FIFO queue implementation.

## Unit tests

```text
python -m unittest discover -s tests -v
```

The tests use only the Python standard library. The web interface requires
Flask.

## Files

```text
node.py                 Linked-list node
queue_structures.py     Custom linked FIFO queues
scheduler.py            Scheduling and simulation core
cli.py                  Required command-line menu
app.py                  Optional Flask API and page route
requirements.txt        Flask dependency for the optional web interface
templates/index.html    Single-page UI
static/style.css        Responsive UI styling
static/app.js           UI rendering and API calls
tests/test_scheduler.py Unit tests
docs/PROJECT_DOCUMENTATION.md  Design, complexity, samples, report outline
docs/DEMO_SCRIPT.md     Demo script and likely Q&A
RUNNING.md              Run and test instructions
```
