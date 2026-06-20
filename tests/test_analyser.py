# Run with: pytest -q

import os
import subprocess
import sys
import pytest

# Ensure parent directory is in path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import analyse_sentiment


def test_positive_sentiment():
    """Test clearly positive feedback returns POSITIVE label and high score."""
    result = analyse_sentiment("I love this product! It is excellent and amazing.")
    assert result["sentiment"] == "POSITIVE"
    assert result["score"] > 0.5


def test_negative_sentiment():
    """Test clearly negative feedback returns NEGATIVE label and low score."""
    result = analyse_sentiment("This product is terrible, worst purchase ever, hate it.")
    assert result["sentiment"] == "NEGATIVE"
    assert result["score"] < -0.5


def test_neutral_or_empty():
    """Test neutral/empty feedback returns NEUTRAL label and near-zero score."""
    result_neutral = analyse_sentiment("It is okay.")
    assert result_neutral["sentiment"] == "NEUTRAL"
    assert -0.1 <= result_neutral["score"] <= 0.1

    result_empty = analyse_sentiment("")
    assert result_empty["sentiment"] == "NEUTRAL"
    assert -0.1 <= result_empty["score"] <= 0.1


def test_file_not_found():
    """Test that calling the CLI with a non-existent file exits with non-zero code."""
    main_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../main.py"))
    result = subprocess.run(
        [sys.executable, main_path, "-f", "nope.txt"],
        capture_output=True,
        text=True,
    )
    assert result.returncode != 0
