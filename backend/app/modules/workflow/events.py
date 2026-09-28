"""In-process domain events. publish() runs every handler at once, in registration order, inside the caller's
transaction: a handler that raises undoes the whole change when the caller rolls back. No queue, no retries;
background delivery (email, push) arrives with the worker in S15 and subscribes here too."""

from collections import defaultdict
from collections.abc import Callable

from sqlalchemy.orm import Session

Handler = Callable[..., None]
_SUBSCRIBERS: dict[str, list[Handler]] = defaultdict(list)


def subscribe(event_type: str, handler: Handler) -> Handler:
    if handler not in _SUBSCRIBERS[event_type]:
        _SUBSCRIBERS[event_type].append(handler)
    return handler


def unsubscribe(event_type: str, handler: Handler) -> None:
    if handler in _SUBSCRIBERS[event_type]:
        _SUBSCRIBERS[event_type].remove(handler)


def subscribers(event_type: str) -> list[Handler]:
    return list(_SUBSCRIBERS[event_type])


def publish(db: Session, event_type: str, **payload) -> None:
    for handler in list(_SUBSCRIBERS[event_type]):
        handler(db, **payload)
