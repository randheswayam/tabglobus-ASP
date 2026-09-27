"""The Client role reaches only the customer app's API. Every staff route rejects it."""
import re

import pytest

from app.main import app

# Routes a client may call: sign-in, their own notifications, the shared template, and the customer app API.
CLIENT_ALLOWED = re.compile(r"^/(auth/|health$|template$|notifications|client/)")


def _staff_routes():
    """Every documented route and method. The OpenAPI schema lists routes from included routers too."""
    for path, methods in app.openapi()["paths"].items():
        if CLIENT_ALLOWED.match(path):
            continue
        for method in sorted(methods):
            yield method.upper(), re.sub(r"\{[^}]+\}", "1", path)


STAFF_ROUTES = list(_staff_routes())


def test_there_are_staff_routes_to_check():
    paths = {p for _, p in STAFF_ROUTES}
    assert {"/projects", "/dashboard", "/media/1", "/users", "/reviews/queue", "/projects/1/stages"} <= paths


@pytest.mark.parametrize("method,path", STAFF_ROUTES)
def test_client_role_is_refused_on_every_staff_route(client, client_headers, method, path):
    r = client.request(method, path, headers=client_headers, json={})
    assert r.status_code == 403, f"{method} {path} -> {r.status_code}"
    assert r.json()["detail"] == "This area is for the SiteFlow team. Clients use the client app."


@pytest.mark.parametrize("method,path", STAFF_ROUTES)
def test_staff_routes_still_need_sign_in(client, method, path):
    assert client.request(method, path, json={}).status_code == 401


def test_client_can_use_allowed_routes(client, client_headers):
    assert client.get("/auth/me", headers=client_headers).json()["role"] == "client"
    assert client.get("/notifications", headers=client_headers).json() == {"unread": 0, "items": []}
    assert client.get("/template", headers=client_headers).status_code == 200


def test_staff_can_still_use_staff_routes(client, auth_headers):
    for role in ("architect", "team_lead", "civil_engineer", "admin"):
        assert client.get("/projects", headers=auth_headers(role)).status_code == 200
