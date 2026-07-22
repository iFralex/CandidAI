from unittest.mock import patch
from server.emails_generation import service


def test_start_onboarding_profile_enqueues():
    with patch.object(service, "enqueue") as eq, \
         patch.object(service, "jsonify", side_effect=lambda d: d):
        body, code = service.start_onboarding_profile("u1", "job1")
    assert code == 202
    args, kwargs = eq.call_args
    assert kwargs["queue"] == "onboarding_realtime"
    assert kwargs["args"] == ("u1", "job1")
    assert args[0] is service.preview_module.generate_profile
