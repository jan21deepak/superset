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
from datetime import datetime, tzinfo
from typing import Optional, Union

import pandas as pd
from flask_babel import gettext as _

from superset.exceptions import InvalidPostProcessingError
from superset.utils.pandas_postprocessing.utils import RESAMPLE_METHOD

TimeRange = tuple[Optional[datetime], Optional[datetime]]


def resample(
    df: pd.DataFrame,
    rule: str,
    method: str,
    fill_value: Optional[Union[float, int]] = None,
    time_range: Optional[TimeRange] = None,
) -> pd.DataFrame:
    """
    support upsampling in resample

    :param df: DataFrame to resample.
    :param rule: The offset string representing target conversion.
    :param method: How to fill the NaN value after resample.
    :param fill_value: What values do fill missing.
    :param time_range: Optional ``(start, end)`` boundaries of the query time
        range. When provided, gap filling is applied to the entire target period
        instead of only spanning the range between the first and last data
        points. ``end`` is treated as exclusive, matching the semantics of the
        time filter.
    :return: DataFrame after resample
    :raises InvalidPostProcessingError: If the request in incorrect
    """
    if not isinstance(df.index, pd.DatetimeIndex):
        raise InvalidPostProcessingError(_("Resample operation requires DatetimeIndex"))
    if method not in RESAMPLE_METHOD:
        raise InvalidPostProcessingError(
            _("Resample method should be in ") + ", ".join(RESAMPLE_METHOD) + "."
        )

    start, end = time_range or (None, None)
    if start is not None or end is not None:
        # Extend the index with the target boundaries so that resampling (and
        # therefore gap filling) covers the entire target period rather than
        # only the interval between the first and last data points. The
        # boundaries are aligned to the index timezone so tz-aware indexes
        # (e.g. ``timestamptz`` columns) don't produce an object-dtype index.
        tz = df.index.tz
        start = _align_tz(start, tz)
        end = _align_tz(end, tz)
        boundaries = pd.DatetimeIndex(
            [value for value in (start, end) if value is not None]
        )
        df = df.reindex(df.index.union(boundaries))

    if method == "asfreq" and fill_value is not None:
        _df = df.resample(rule).asfreq(fill_value=fill_value)
        _df = _df.fillna(fill_value)
    elif method == "linear":
        _df = df.resample(rule).interpolate()
    else:
        _df = getattr(df.resample(rule), method)()
        if method in ("ffill", "bfill"):
            _df = getattr(_df, method)()

    if end is not None:
        # ``end`` is exclusive, so drop any bin generated at or beyond it
        # (e.g. the boundary added above to extend the target period).
        _df = _df[_df.index < _align_tz(end, _df.index.tz)]

    return _df


def _align_tz(
    value: Optional[datetime], tz: Optional[tzinfo]
) -> Optional[pd.Timestamp]:
    """
    Align a boundary timestamp with the timezone of the resampled index.

    Boundaries derived from the query time range are timezone-naive, while the
    DataFrame index may be timezone-aware (or vice versa). Mixing the two would
    yield an object-dtype index and raise when resampling/comparing.
    """
    if value is None:
        return None
    ts = pd.Timestamp(value)
    if tz is not None:
        ts = ts.tz_localize(tz) if ts.tzinfo is None else ts.tz_convert(tz)
    elif ts.tzinfo is not None:
        ts = ts.tz_localize(None)
    return ts
