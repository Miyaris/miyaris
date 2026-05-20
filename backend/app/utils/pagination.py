from dataclasses import dataclass

from fastapi import Query


@dataclass
class PaginationParams:
    limit: int
    offset: int


def pagination_dep(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> PaginationParams:
    return PaginationParams(limit=limit, offset=offset)
