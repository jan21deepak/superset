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
from typing import Any


def test_language_pack_is_reachable_anonymously(client: Any) -> None:
    """Embedded dashboards fetch the pack without a session or guest token."""
    response = client.get("/language_pack/en/")

    assert response.status_code in {200, 404}
    assert "/login/" not in response.headers.get("Location", "")


def test_language_pack_rejects_invalid_language(client: Any) -> None:
    assert client.get("/language_pack/..%2F..%2Fetc/").status_code in {400, 404}
