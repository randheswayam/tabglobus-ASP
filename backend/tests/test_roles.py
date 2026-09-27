"""PRD v3.2 section 5 roles: the new staff roles exist, sign in, and are staff (not clients)."""

import pytest

from app.models import Role

NEW_STAFF = ["structural_consultant", "mep_consultant", "interior_designer", "accounts", "office_coordinator"]


def test_role_values():
    assert [r.value for r in Role] == [
        "architect",
        "team_lead",
        "civil_engineer",
        "admin",
        "client",
        *NEW_STAFF,
    ]


def test_seed_has_one_user_per_staff_role(users):
    assert set(users) == {r.value for r in Role} - {"client"}


@pytest.mark.parametrize("role", NEW_STAFF)
def test_new_role_signs_in_and_reaches_me(client, auth_headers, role):
    r = client.get("/auth/me", headers=auth_headers(role))
    assert r.status_code == 200
    assert r.json()["role"] == role


@pytest.mark.parametrize("role", NEW_STAFF)
def test_new_roles_are_staff_and_see_only_member_projects(client, auth_headers, role):
    # Staff routes don't refuse them as clients; with no memberships they see no projects.
    r = client.get("/projects", headers=auth_headers(role))
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.parametrize("role", NEW_STAFF)
def test_new_roles_cannot_use_the_client_app(client, auth_headers, role):
    assert client.get("/client/projects", headers=auth_headers(role)).status_code == 403


def test_role_column_fits_the_longest_value():
    from app.models import User

    assert User.__table__.c.role.type.length >= max(len(r.value) for r in Role)
