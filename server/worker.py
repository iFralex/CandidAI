import queue
import threading
import logging

logger = logging.getLogger(__name__)

_job_queue: queue.Queue = queue.Queue()


def _worker() -> None:
    while True:
        func, args = _job_queue.get()
        try:
            logger.info(f"Esecuzione job: {func.__name__}({args[0] if args else ''})")
            func(*args)
            logger.info(f"Job completato: {func.__name__}")
        except Exception as e:
            logger.error(f"Errore durante il job {func.__name__}: {e}")
        finally:
            _job_queue.task_done()


threading.Thread(target=_worker, daemon=True, name="candidai-worker").start()


def enqueue(func, args: tuple = ()) -> None:
    _job_queue.put((func, args))
