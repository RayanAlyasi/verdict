"""Modules may import each other only through `verdict/<module>/api.py` (docs/ARCHITECTURE.md)."""

import ast
from pathlib import Path

VERDICT = Path(__file__).resolve().parents[1] / "verdict"


def module_folders(root: Path) -> list[Path]:
    """Every folder under verdict/ is a module, with or without __init__.py and api.py."""
    return sorted(p for p in root.iterdir() if p.is_dir() and p.name != "__pycache__")


def imported_names(path: Path, root: Path) -> list[str]:
    package = list(path.relative_to(root.parent).parent.parts)
    names = []
    for node in ast.walk(ast.parse(path.read_text(), filename=str(path))):
        if isinstance(node, ast.Import):
            names += [alias.name for alias in node.names]
        elif isinstance(node, ast.ImportFrom):
            base = package[: len(package) - node.level + 1] if node.level else []
            module = ".".join([*base, *([node.module] if node.module else [])])
            names += [f"{module}.{alias.name}" for alias in node.names]
    return names


def boundary_breaches(root: Path) -> list[str]:
    modules = {folder.name for folder in module_folders(root)}
    breaches = []
    for module in sorted(modules):
        for path in sorted((root / module).rglob("*.py")):
            for name in imported_names(path, root):
                parts = name.split(".")
                other = parts[1] if len(parts) > 1 and parts[0] == root.name else None
                if other in modules and other != module and parts[2:3] != ["api"]:
                    breaches.append(f"{path.relative_to(root.parent)} imports {name}")
    return breaches


def test_modules_import_each_other_only_through_api() -> None:
    assert boundary_breaches(VERDICT) == []


def test_every_module_has_a_public_interface() -> None:
    missing = [
        f"{folder.name}/{name}"
        for folder in module_folders(VERDICT)
        for name in ("__init__.py", "api.py")
        if not (folder / name).is_file()
    ]
    assert missing == []


def test_the_boundary_check_catches_breaches(tmp_path: Path) -> None:
    root = tmp_path / "verdict"
    files = {
        "courses/__init__.py": "",
        "courses/api.py": "",
        "courses/models.py": "",
        "billing/models.py": "",
        "practice/__init__.py": "",
        "practice/api.py": "from verdict.courses.api import create_course\n",
        "practice/grading.py": (
            "import verdict.courses.api\n"
            "from verdict.db import Base\n"
            "from verdict.billing.models import Invoice\n"
        ),
        "practice/sessions/__init__.py": "",
        "practice/sessions/start.py": (
            "from verdict.courses.models import Course\n"
            "from ...courses import models\n"
            "from verdict.courses import api\n"
            "from ..grading import grade\n"
        ),
    }
    for name, source in files.items():
        (root / name).parent.mkdir(parents=True, exist_ok=True)
        (root / name).write_text(source)

    assert boundary_breaches(root) == [
        "verdict/practice/grading.py imports verdict.billing.models.Invoice",
        "verdict/practice/sessions/start.py imports verdict.courses.models.Course",
        "verdict/practice/sessions/start.py imports verdict.courses.models",
    ]
