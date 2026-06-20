"""Sentiment Analysis Tool.

This script reads feedback from an input file, performs sentiment analysis
on the content, and writes the results to a JSON output file.
"""

import argparse
import csv
import json
import os
import sys


def analyse_sentiment(text: str) -> dict:
    """Analyze the sentiment of the input text.

    Keep this function unchanged as requested. If you have an existing implementation,
    you can replace this placeholder body with your actual logic.
    """
    # Simple rule-based heuristic for placeholder analysis
    text_lower = text.lower()
    positive_words = {"good", "great", "excellent", "love", "amazing", "best"}
    negative_words = {"bad", "poor", "terrible", "hate", "worst", "slow", "broken"}

    pos_count = sum(1 for word in positive_words if word in text_lower)
    neg_count = sum(1 for word in negative_words if word in text_lower)

    if pos_count > neg_count:
        sentiment = "POSITIVE"
        score = 1.0
    elif neg_count > pos_count:
        sentiment = "NEGATIVE"
        score = -1.0
    else:
        sentiment = "NEUTRAL"
        score = 0.0

    return {
        "text": text.strip(),
        "sentiment": sentiment,
        "score": score,
    }


def main() -> None:
    """Command-line interface entry point."""
    parser = argparse.ArgumentParser(
        description="Analyze sentiment of a feedback file and export to JSON.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "-f",
        "--file",
        type=str,
        default="feedback.txt",
        help="path to the input feedback file",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=str,
        default="sentiment_result.json",
        help="path for the JSON output file",
    )
    parser.add_argument(
        "-c",
        "--column",
        type=str,
        default="0",
        help="Column index (0-based) or header name containing feedback text (CSVs only).",
    )

    args = parser.parse_args()

    # Validation checks
    if not os.path.exists(args.file):
        print(
            f"Error: The input file '{args.file}' does not exist.",
            file=sys.stderr,
        )
        sys.exit(1)
    if not os.path.isfile(args.file):
        print(
            f"Error: '{args.file}' is a directory or not a regular file.",
            file=sys.stderr,
        )
        sys.exit(1)

    _, ext = os.path.splitext(args.file)
    ext_lower = ext.lower()
    if ext_lower not in (".txt", ".csv"):
        print(
            f"Error: '{args.file}' is not a .txt or .csv file.",
            file=sys.stderr,
        )
        sys.exit(1)

    # Read the input file and construct the content string
    if ext_lower == ".txt":
        try:
            with open(args.file, "r", encoding="utf-8") as f:
                content = f.read()
        except PermissionError:
            print(
                f"Error: Permission denied when reading '{args.file}'.",
                file=sys.stderr,
            )
            sys.exit(1)
    else:
        # It's a CSV file
        try:
            with open(args.file, "r", encoding="utf-8", newline="") as f:
                reader = csv.reader(f)
                rows = list(reader)
        except PermissionError:
            print(
                f"Error: Permission denied when reading '{args.file}'.",
                file=sys.stderr,
            )
            sys.exit(1)

        if not rows:
            print(
                f"Error: The input file '{args.file}' is empty.",
                file=sys.stderr,
            )
            sys.exit(1)

        headers = rows[0]
        col_identifier = args.column
        col_idx = None

        if col_identifier.isdigit():
            col_idx = int(col_identifier)
            if col_idx < 0 or col_idx >= len(headers):
                print(
                    f"Error: Column index {col_idx} is out of range. "
                    f"File has {len(headers)} columns.",
                    file=sys.stderr,
                )
                sys.exit(1)
        else:
            try:
                col_idx = headers.index(col_identifier)
            except ValueError:
                print(
                    f"Error: Column header '{col_identifier}' not found in CSV. "
                    f"Available headers: {', '.join(headers)}",
                    file=sys.stderr,
                )
                sys.exit(1)

        # Skip headers when constructing lines for feedback
        start_row = 1 if len(rows) > 1 else 0
        lines = []
        for row in rows[start_row:]:
            if len(row) > col_idx:
                val = row[col_idx].strip()
                if val:
                    lines.append(val)
        content = "\n".join(lines)

    # Verify content is not empty
    if not content.strip():
        print(
            f"Error: The input file '{args.file}' is empty.",
            file=sys.stderr,
        )
        sys.exit(1)

    # Perform sentiment analysis
    # (analyzing the file content as a single block, or line-by-line if desired)
    lines = [line.strip() for line in content.splitlines() if line.strip()]
    results = [analyse_sentiment(line) for line in lines]

    # Write the output JSON file
    try:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
    except FileNotFoundError:
        print(
            f"Error: The output directory for '{args.output}' does not exist.",
            file=sys.stderr,
        )
        sys.exit(1)
    except PermissionError:
        print(
            f"Error: Permission denied when writing to '{args.output}'.",
            file=sys.stderr,
        )
        sys.exit(1)
    except IsADirectoryError:
        print(
            f"Error: '{args.output}' is a directory, not a file.",
            file=sys.stderr,
        )
        sys.exit(1)

    print(
        f"Success: Analyzed {len(results)} feedback items. "
        f"Results saved to '{args.output}'."
    )


if __name__ == "__main__":
    main()
