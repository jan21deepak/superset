# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

from pathlib import Path


def test_python_common_installs_runtime_packages_only() -> None:
    repository_root = Path(__file__).resolve().parents[2]
    dockerfile = (repository_root / "Dockerfile").read_text()

    python_common, _, python_lean_build = dockerfile.partition(
        "FROM python-common AS python-lean-build"
    )
    assert "FROM python-common AS python-lean-build" in dockerfile

    for dev_package in (
        "libsasl2-dev",
        "libpq-dev",
        "libecpg-dev",
        "libldap2-dev",
    ):
        assert dev_package not in python_common
        assert dev_package in python_lean_build


def test_lean_image_copies_prebuilt_virtualenv() -> None:
    repository_root = Path(__file__).resolve().parents[2]
    dockerfile = (repository_root / "Dockerfile").read_text()

    lean_stage_start = dockerfile.index("FROM python-common AS lean")
    lean_stage = dockerfile[lean_stage_start:]
    dev_stage_start = lean_stage.index("FROM python-common AS dev")
    lean_stage = lean_stage[:dev_stage_start]

    assert "COPY --from=python-lean-build /app/.venv /app/.venv" in lean_stage
    assert "pip-install.sh" not in lean_stage
    assert "build-essential" not in lean_stage


def test_pip_install_script_purges_build_tooling() -> None:
    repository_root = Path(__file__).resolve().parents[2]
    pip_install = (repository_root / "docker" / "pip-install.sh").read_text()

    assert "apt-get purge -yqq --auto-remove build-essential" in pip_install
    assert "apt-get autoremove -yqq --purge" in pip_install
