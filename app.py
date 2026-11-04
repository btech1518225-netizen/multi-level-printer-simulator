"""Flask API and web application for the printer scheduler simulator."""

from flask import Flask, jsonify, render_template, request

from scheduler import JobNotFoundError, PrinterScheduler, SchedulerError


app = Flask(__name__)
scheduler = PrinterScheduler()


@app.get("/")
def index():
    """Render the single-page printer scheduler interface."""
    return render_template("index.html")


@app.get("/api/state")
def state():
    """Return the current scheduler snapshot as JSON."""
    return jsonify(scheduler.get_state())


@app.post("/api/jobs")
def submit_job():
    """Validate a submission payload and enqueue the requested print job."""
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "send a JSON object"}), 400
    try:
        job = scheduler.submit_job(
            data.get("name"),
            data.get("pages"),
            data.get("priority"),
            data.get("job_id"),
        )
        return jsonify({"job": scheduler._job_dict(job), "state": scheduler.get_state()}), 201
    except SchedulerError as error:
        status = 409 if "capacity" in str(error) or "duplicate" in str(error) else 400
        return jsonify({"error": str(error)}), status


@app.post("/api/step")
def step():
    """Advance the simulation by one tick and return its latest state."""
    record = scheduler.step()
    return jsonify(
        {
            "completed": scheduler._record_dict(record) if record is not None else None,
            "state": scheduler.get_state(),
        }
    )


@app.post("/api/run")
def run():
    """Run all queued and active jobs to completion."""
    elapsed = scheduler.run_until_done()
    return jsonify({"elapsed_ticks": elapsed, "state": scheduler.get_state()})


@app.post("/api/reset")
def reset():
    """Reset the shared simulation and return its empty state."""
    scheduler.reset()
    return jsonify(scheduler.get_state())


@app.delete("/api/jobs/<job_id>")
def cancel_job(job_id):
    """Cancel a pending job and return the refreshed scheduler state."""
    try:
        scheduler.cancel_job(job_id)
        return jsonify(scheduler.get_state())
    except JobNotFoundError as error:
        return jsonify({"error": str(error)}), 404
    except SchedulerError as error:
        return jsonify({"error": str(error)}), 409


if __name__ == "__main__":
    app.run(debug=False)
