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
import numpy as np
import pandas as pd
import pytest
from pandas import to_datetime

from superset.exceptions import InvalidPostProcessingError
from superset.utils import pandas_postprocessing as pp
from tests.unit_tests.fixtures.dataframes import (
    categories_df,
    timeseries_df,
    timeseries_with_gap_df,
)


def test_resample_should_not_side_effect():
    _timeseries_df = timeseries_df.copy()
    pp.resample(df=_timeseries_df, rule="1D", method="ffill")
    assert _timeseries_df.equals(timeseries_df)


def test_resample():
    post_df = pp.resample(df=timeseries_df, rule="1D", method="ffill")
    """
               label    y
    2019-01-01     x  1.0
    2019-01-02     y  2.0
    2019-01-03     y  2.0
    2019-01-04     y  2.0
    2019-01-05     z  3.0
    2019-01-06     z  3.0
    2019-01-07     q  4.0
    """
    assert post_df.equals(
        pd.DataFrame(
            index=pd.to_datetime(
                [
                    "2019-01-01",
                    "2019-01-02",
                    "2019-01-03",
                    "2019-01-04",
                    "2019-01-05",
                    "2019-01-06",
                    "2019-01-07",
                ]
            ),
            data={
                "label": ["x", "y", "y", "y", "z", "z", "q"],
                "y": [1.0, 2.0, 2.0, 2.0, 3.0, 3.0, 4.0],
            },
        )
    )


def test_resample_ffill_with_gaps():
    post_df = pp.resample(df=timeseries_with_gap_df, rule="1D", method="ffill")
    assert post_df.equals(
        pd.DataFrame(
            index=pd.to_datetime(
                [
                    "2019-01-01",
                    "2019-01-02",
                    "2019-01-03",
                    "2019-01-04",
                    "2019-01-05",
                    "2019-01-06",
                    "2019-01-07",
                ]
            ),
            data={
                "label": ["x", "y", "y", "y", "z", "z", "q"],
                "y": [1.0, 2.0, 2.0, 2.0, 2.0, 2.0, 4.0],
            },
        )
    )


def test_resample_zero_fill():
    post_df = pp.resample(df=timeseries_df, rule="1D", method="asfreq", fill_value=0)
    assert post_df.equals(
        pd.DataFrame(
            index=pd.to_datetime(
                [
                    "2019-01-01",
                    "2019-01-02",
                    "2019-01-03",
                    "2019-01-04",
                    "2019-01-05",
                    "2019-01-06",
                    "2019-01-07",
                ]
            ),
            data={
                "label": ["x", "y", 0, 0, "z", 0, "q"],
                "y": [1.0, 2.0, 0, 0, 3.0, 0, 4.0],
            },
        )
    )


def test_resample_zero_fill_with_gaps():
    post_df = pp.resample(
        df=timeseries_with_gap_df, rule="1D", method="asfreq", fill_value=0
    )
    assert post_df.equals(
        pd.DataFrame(
            index=pd.to_datetime(
                [
                    "2019-01-01",
                    "2019-01-02",
                    "2019-01-03",
                    "2019-01-04",
                    "2019-01-05",
                    "2019-01-06",
                    "2019-01-07",
                ]
            ),
            data={
                "label": ["x", "y", 0, 0, "z", 0, "q"],
                "y": [1.0, 2.0, 0, 0, 0, 0, 4.0],
            },
        )
    )


def test_resample_zero_fill_with_time_range():
    # gap filling should cover the entire target period, not only the span
    # between the first and last data points. ``end`` is exclusive.
    post_df = pp.resample(
        df=timeseries_df,
        rule="1D",
        method="asfreq",
        fill_value=0,
        time_range=(to_datetime("2018-12-30"), to_datetime("2019-01-09")),
    )
    assert post_df.equals(
        pd.DataFrame(
            index=pd.to_datetime(
                [
                    "2018-12-30",
                    "2018-12-31",
                    "2019-01-01",
                    "2019-01-02",
                    "2019-01-03",
                    "2019-01-04",
                    "2019-01-05",
                    "2019-01-06",
                    "2019-01-07",
                    "2019-01-08",
                ]
            ),
            data={
                "label": [0, 0, "x", "y", 0, 0, "z", 0, "q", 0],
                "y": [0, 0, 1.0, 2.0, 0, 0, 3.0, 0, 4.0, 0],
            },
        )
    )


def test_resample_zero_fill_upsamples_full_period():
    # single daily data point upsampled to hourly across the whole day
    df = pd.DataFrame(
        index=to_datetime(["2026-07-01 12:00:00"]),
        data={"y": [5.0]},
    )
    post_df = pp.resample(
        df=df,
        rule="1H",
        method="asfreq",
        fill_value=0,
        time_range=(
            to_datetime("2026-07-01 00:00:00"),
            to_datetime("2026-07-02 00:00:00"),
        ),
    )
    assert post_df.equals(
        pd.DataFrame(
            index=pd.date_range(start="2026-07-01 00:00:00", periods=24, freq="1H"),
            data={
                "y": [0.0 if hour != 12 else 5.0 for hour in range(24)],
            },
        )
    )


def test_resample_zero_fill_with_tz_aware_index():
    # tz-aware indexes (e.g. timestamptz columns) must not raise when the
    # tz-naive query boundaries are used to extend the target period.
    df = pd.DataFrame(
        index=to_datetime(["2026-07-01 12:00:00"]).tz_localize("UTC"),
        data={"y": [5.0]},
    )
    post_df = pp.resample(
        df=df,
        rule="1H",
        method="asfreq",
        fill_value=0,
        time_range=(
            to_datetime("2026-07-01 00:00:00"),
            to_datetime("2026-07-02 00:00:00"),
        ),
    )
    expected_index = pd.date_range(
        start="2026-07-01 00:00:00", periods=24, freq="1H", tz="UTC"
    )
    assert post_df.index.tz is not None
    assert post_df.equals(
        pd.DataFrame(
            index=expected_index,
            data={"y": [0.0 if hour != 12 else 5.0 for hour in range(24)]},
        )
    )


def test_resample_with_empty_time_range_matches_default():
    post_df = pp.resample(
        df=timeseries_df,
        rule="1D",
        method="asfreq",
        fill_value=0,
        time_range=(None, None),
    )
    default_df = pp.resample(df=timeseries_df, rule="1D", method="asfreq", fill_value=0)
    assert post_df.equals(default_df)


def test_resample_after_pivot():
    df = pd.DataFrame(
        data={
            "__timestamp": pd.to_datetime(
                [
                    "2022-01-13",
                    "2022-01-13",
                    "2022-01-13",
                    "2022-01-11",
                    "2022-01-11",
                    "2022-01-11",
                ]
            ),
            "city": ["Chicago", "LA", "NY", "Chicago", "LA", "NY"],
            "val": [6.0, 5.0, 4.0, 3.0, 2.0, 1.0],
        }
    )
    pivot_df = pp.pivot(
        df=df,
        index=["__timestamp"],
        columns=["city"],
        aggregates={
            "val": {"operator": "sum"},
        },
    )
    """
                    val
    city        Chicago   LA   NY
    __timestamp
    2022-01-11      3.0  2.0  1.0
    2022-01-13      6.0  5.0  4.0
    """
    resample_df = pp.resample(
        df=pivot_df,
        rule="1D",
        method="asfreq",
        fill_value=0,
    )
    """
                    val
    city        Chicago   LA   NY
    __timestamp
    2022-01-11      3.0  2.0  1.0
    2022-01-12      0.0  0.0  0.0
    2022-01-13      6.0  5.0  4.0
    """
    flat_df = pp.flatten(resample_df)
    """
      __timestamp  val, Chicago  val, LA  val, NY
    0  2022-01-11           3.0      2.0      1.0
    1  2022-01-12           0.0      0.0      0.0
    2  2022-01-13           6.0      5.0      4.0
    """
    assert flat_df.equals(
        pd.DataFrame(
            data={
                "__timestamp": pd.to_datetime(
                    ["2022-01-11", "2022-01-12", "2022-01-13"]
                ),
                "val, Chicago": [3.0, 0, 6.0],
                "val, LA": [2.0, 0, 5.0],
                "val, NY": [1.0, 0, 4.0],
            }
        )
    )


def test_resample_should_raise_ex():
    with pytest.raises(InvalidPostProcessingError):
        pp.resample(
            df=categories_df,
            rule="1D",
            method="asfreq",
        )

    with pytest.raises(InvalidPostProcessingError):
        pp.resample(
            df=timeseries_df,
            rule="1D",
            method="foobar",
        )


def test_resample_linear():
    df = pd.DataFrame(
        index=to_datetime(["2019-01-01", "2019-01-05", "2019-01-08"]),
        data={"label": ["a", "e", "j"], "y": [1.0, 5.0, 8.0]},
    )
    post_df = pp.resample(df=df, rule="1D", method="linear")
    """
               label    y
    2019-01-01     a  1.0
    2019-01-02   NaN  2.0
    2019-01-03   NaN  3.0
    2019-01-04   NaN  4.0
    2019-01-05     e  5.0
    2019-01-06   NaN  6.0
    2019-01-07   NaN  7.0
    2019-01-08     j  8.0
    """
    assert post_df.equals(
        pd.DataFrame(
            index=pd.to_datetime(
                [
                    "2019-01-01",
                    "2019-01-02",
                    "2019-01-03",
                    "2019-01-04",
                    "2019-01-05",
                    "2019-01-06",
                    "2019-01-07",
                    "2019-01-08",
                ]
            ),
            data={
                "label": ["a", np.NaN, np.NaN, np.NaN, "e", np.NaN, np.NaN, "j"],
                "y": [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0],
            },
        )
    )
