import os
import logging

_LOG_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'logs', 'video-pipeline')
os.makedirs(_LOG_DIR, exist_ok=True)

_pipeline_logger = logging.getLogger('server.video_pipeline')
if not _pipeline_logger.handlers:
    _handler = logging.FileHandler(os.path.join(_LOG_DIR, 'pipeline.log'), encoding='utf-8')
    _handler.setFormatter(logging.Formatter('%(asctime)s [%(levelname)s] %(name)s: %(message)s'))
    _pipeline_logger.addHandler(_handler)
    _pipeline_logger.setLevel(logging.INFO)
    _pipeline_logger.propagate = False
