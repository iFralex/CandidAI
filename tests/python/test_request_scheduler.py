import threading
import time
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from server.request_scheduler import PriorityRequestGate


def test_realtime_waiter_gets_next_slot_before_normal_waiter():
    gate = PriorityRequestGate()
    order = []
    first_entered = threading.Event()
    release_first = threading.Event()

    def first_normal():
        with gate.slot("normal"):
            order.append("normal-active")
            first_entered.set()
            release_first.wait(timeout=2)

    def waiting_normal():
        first_entered.wait(timeout=2)
        with gate.slot("normal"):
            order.append("normal-waiting")

    def realtime():
        first_entered.wait(timeout=2)
        with gate.slot("realtime"):
            order.append("realtime")

    threads = [
        threading.Thread(target=first_normal),
        threading.Thread(target=waiting_normal),
        threading.Thread(target=realtime),
    ]
    for thread in threads:
        thread.start()
    first_entered.wait(timeout=2)
    time.sleep(0.05)
    release_first.set()
    for thread in threads:
        thread.join(timeout=2)

    assert order == ["normal-active", "realtime", "normal-waiting"]


def test_rolling_quota_delays_the_next_request():
    gate = PriorityRequestGate(max_requests=1, window_seconds=0.05)
    with gate.slot():
        pass
    started = time.monotonic()
    with gate.slot():
        pass
    assert time.monotonic() - started >= 0.04
