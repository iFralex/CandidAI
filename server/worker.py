import logging
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

# Due code indipendenti, ognuna con max 1 job alla volta.
# send_emails e emails_generation girano in parallelo tra loro,
# ma i job dello stesso tipo vengono serializzati.
_executors: dict[str, ThreadPoolExecutor] = {
    "send_emails": ThreadPoolExecutor(max_workers=1, thread_name_prefix="worker-send"),
    "emails_generation": ThreadPoolExecutor(max_workers=1, thread_name_prefix="worker-gen"),
}


def enqueue(func, args: tuple = (), queue: str = "send_emails") -> None:
    executor = _executors[queue]

    def _run():
        try:
            logger.info(f"[{queue}] Esecuzione job: {func.__name__}({args[0] if args else ''})")
            func(*args)
            logger.info(f"[{queue}] Job completato: {func.__name__}")
        except Exception as e:
            logger.error(f"[{queue}] Errore durante il job run: {e}")

    executor.submit(_run)
