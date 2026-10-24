"""Run one queue's workflows until stopped: python -m verdict.worker <queue>."""

import argparse
import logging
import signal
import threading

from dbos import DBOS

from verdict.settings import SettingsError, load_settings
from verdict.workflows import QUEUES, launch

# Running workflows get this long to finish when the worker is stopped; the rest resume when it
# restarts. It stays under the 30 seconds a container gets between SIGTERM and SIGKILL.
STOP_TIMEOUT_SECONDS = 20


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("queue", choices=sorted(QUEUES))
    queue = parser.parse_args().queue
    logging.basicConfig(
        level=logging.INFO, format="%(levelname)s %(name)s: %(message)s"
    )
    try:
        settings = load_settings()
    except SettingsError as error:
        raise SystemExit(str(error)) from None
    launch(settings, executor_id=f"worker-{queue}", queues=[queue])
    stop = threading.Event()
    signal.signal(signal.SIGTERM, lambda *_: stop.set())
    signal.signal(signal.SIGINT, lambda *_: stop.set())
    stop.wait()
    DBOS.destroy(workflow_completion_timeout_sec=STOP_TIMEOUT_SECONDS)


if __name__ == "__main__":
    main()
