"""Atomic training-artifact writes and CPU-only checks before reuse."""
from contextlib import contextmanager
import json
import os
from pathlib import Path
import tempfile
import zipfile
import zlib


@contextmanager
def atomic_path(path):
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    descriptor, name = tempfile.mkstemp(prefix=target.name + '.', suffix='.tmp', dir=target.parent)
    os.close(descriptor)
    temporary = Path(name)
    try:
        yield temporary
        with temporary.open('r+b') as stream:
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, target)
    finally:
        temporary.unlink(missing_ok=True)


def save_npz(path, **arrays):
    import numpy as np
    with atomic_path(path) as temporary:
        with temporary.open('wb') as stream:
            np.savez(stream, **arrays)


def save_torch(path, value):
    import torch
    with atomic_path(path) as temporary:
        with temporary.open('wb') as stream:
            torch.save(value, stream)


def save_json(path, value):
    with atomic_path(path) as temporary:
        temporary.write_text(json.dumps(value, ensure_ascii=False, indent=1), encoding='utf8')


def valid_npz(path, required, source=None):
    try:
        if source is not None and Path(path).stat().st_mtime_ns < Path(source).stat().st_mtime_ns:
            return False
        with zipfile.ZipFile(path) as archive:
            if not {key + '.npy' for key in required}.issubset(archive.namelist()):
                return False
            return archive.testzip() is None
    except (OSError, ValueError, EOFError, zipfile.BadZipFile, RuntimeError, zlib.error):
        return False


def valid_torch(path, checkpoint=False):
    try:
        import torch
        if zipfile.is_zipfile(path):
            with zipfile.ZipFile(path) as archive:
                if archive.testzip() is not None:
                    return False
        data = torch.load(path, map_location='cpu', weights_only=True)
        if checkpoint:
            required = {'model', 'opt', 'sched', 'step', 'pos', 'perm_gen_state', 'elapsed', 'args'}
            if not isinstance(data, dict) or not required.issubset(data):
                return False
            data = data['model']
        return isinstance(data, dict) and bool(data) and all(isinstance(value, torch.Tensor) for value in data.values())
    except Exception:
        return False


def complete_stage(root, marker):
    path = Path(root) / marker
    if path.suffix == '.pt':
        return valid_torch(path)
    if path.suffix == '.npz':
        return valid_npz(path, {'raw', 'y'})
    try:
        metadata = json.loads(path.read_text(encoding='utf8'))
        teacher = path.name == 'complete.json'
        count = metadata['decisions' if teacher else 'rows']
        records = path.parent / ('teacher.trec' if teacher else 'dagger.trec')
        return (isinstance(count, int) and count > 0 and metadata['games'] > 0
                and (teacher or metadata['label_violations'] == 0)
                and records.stat().st_size == count * 128)
    except (OSError, ValueError, KeyError, TypeError):
        return False
