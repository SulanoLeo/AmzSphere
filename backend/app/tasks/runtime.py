import asyncio

from celery.signals import worker_process_shutdown

from backend.app.db import engine


_worker_loop: asyncio.AbstractEventLoop | None = None


def run_async(coroutine):
    global _worker_loop
    if _worker_loop is None or _worker_loop.is_closed():
        _worker_loop = asyncio.new_event_loop()
    asyncio.set_event_loop(_worker_loop)
    return _worker_loop.run_until_complete(coroutine)


@worker_process_shutdown.connect
def dispose_worker_loop(**_kwargs):
    global _worker_loop
    if _worker_loop is not None and not _worker_loop.is_closed():
        _worker_loop.run_until_complete(engine.dispose())
        _worker_loop.close()
    _worker_loop = None