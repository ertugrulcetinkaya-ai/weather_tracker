import re
from pathlib import Path


def test_runtime_dependencies_match_requirements_file():
    backend_root = Path(__file__).parents[1]
    pyproject = (backend_root / "pyproject.toml").read_text(encoding="utf-8")
    requirements = (backend_root / "requirements.txt").read_text(encoding="utf-8")

    dependency_block = re.search(r"(?ms)^dependencies\s*=\s*\[(.*?)^\]", pyproject)
    assert dependency_block is not None
    project_dependencies = re.findall(r'"([^\"]+)"', dependency_block.group(1))
    requirements_dependencies = [
        line.strip()
        for line in requirements.splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]

    assert project_dependencies == requirements_dependencies
