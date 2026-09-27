import pytest

from app import workflow_config as wc
from app.services.storage import LocalStorage, StorageKeyError, get_storage


def test_round_trip_and_delete(tmp_path):
    s = LocalStorage(tmp_path)
    s.save("visits/1/abc.png", b"\x89PNG data")
    assert s.open("visits/1/abc.png") == b"\x89PNG data"
    assert (tmp_path / "visits" / "1" / "abc.png").exists()
    s.delete("visits/1/abc.png")
    assert not (tmp_path / "visits" / "1" / "abc.png").exists()
    s.delete("visits/1/abc.png")  # deleting a missing key is a no-op


def test_open_missing_key_raises(tmp_path):
    with pytest.raises(FileNotFoundError):
        LocalStorage(tmp_path).open("nope.png")


@pytest.mark.parametrize("key", ["../escape.png", "a/../../escape.png", "/etc/passwd", "C:/Windows/x", "", "a\\..\\..\\x"])
def test_keys_cannot_escape_media_dir(tmp_path, key):
    s = LocalStorage(tmp_path / "media")
    with pytest.raises(StorageKeyError):
        s.save(key, b"x")


def test_get_storage_uses_local_backend(tmp_path, monkeypatch):
    from app.config import get_settings

    monkeypatch.setenv("MEDIA_DIR", str(tmp_path))
    get_settings.cache_clear()
    try:
        s = get_storage()
        assert isinstance(s, LocalStorage)
        assert s.root == tmp_path.resolve()
    finally:
        get_settings.cache_clear()


def test_workflow_config_placeholders():
    assert wc.REVIEW_SLA_HOURS == 48
    assert wc.VISIT_INTERVAL_DAYS == 14
    assert wc.REWORK_LIMIT == 2
    assert wc.MAX_VIDEO_MB == 100 and wc.MAX_PHOTO_MB == 10
    assert set(wc.PHOTO_TYPES) == {"image/jpeg", "image/png", "image/webp"}
    assert set(wc.VIDEO_TYPES) == {"video/mp4", "video/webm"}
