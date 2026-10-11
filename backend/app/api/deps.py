import re
from typing import Annotated

from fastapi import Depends, Header, Request

from app.core.container import Container
from app.core.errors import InvalidProfileError

DEFAULT_PROFILE = "anonymous"
_PROFILE_RE = re.compile(r"^[A-Za-z0-9_-]{8,64}$")


def get_container(request: Request) -> Container:
    return request.app.state.container


def get_profile_id(
    x_profile_id: Annotated[
        str | None,
        Header(
            description=(
                "Optional anonymous profile id (8-64 chars: letters, digits, '-' or '_'). "
                "Generate a random one in the browser and reuse it. If omitted, a shared 'anonymous' profile is used."
            )
        ),
    ] = None,
) -> str:
    if x_profile_id is None or x_profile_id == "":
        return DEFAULT_PROFILE
    if not _PROFILE_RE.fullmatch(x_profile_id):
        raise InvalidProfileError("X-Profile-Id must be 8-64 characters: letters, digits, hyphen or underscore.")
    return x_profile_id


ContainerDep = Annotated[Container, Depends(get_container)]
ProfileDep = Annotated[str, Depends(get_profile_id)]
