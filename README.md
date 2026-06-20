# Customer Feedback Analyser

[![Python Version](https://img.shields.io/badge/python-3.8%2B-blue.svg)](https://www.python.org/)
[![Lint](https://github.com/kaxshxk/customerfeedbackanalyser/actions/workflows/lint.yml/badge.svg)](https://github.com/kaxshxk/customerfeedbackanalyser/actions)
[![Tests](https://github.com/kaxshxk/customerfeedbackanalyser/actions/workflows/test.yml/badge.svg)](https://github.com/kaxshxk/customerfeedbackanalyser/actions)

## Problem Statement
Businesses receive large volumes of unstructured, free-form customer feedback daily across multiple channels. Processing this data manually to identify customer satisfaction, trending issues, and product bottlenecks is time-consuming, expensive, and prone to human bias. Automating sentiment analysis of this text allows organisations to immediately extract actionable insights and prioritize customer service responses at scale.

## Solution
**Customer Feedback Analyser** is a lightweight, production-ready Command-Line Interface (CLI) tool written in Python. It reads text feedback files, performs sentiment analysis using standard natural language processing lexicons (such as VADER/TextBlob), and exports structured classification labels and compound sentiment scores into a clean, machine-readable JSON format.

## Features
* **Simple CLI interface** powered by `argparse` with flags for custom input (`-f`/`--file`) and output (`-o`/`--output`) paths.
* **Robust error handling and validation** catching non-existent files, permission blocks, directories, and empty input files early.
* **Sentiment scoring** leveraging NLP scoring (VADER/TextBlob heuristics) to assign clear labels and intensity scores.
* **Fully tested** test suite using `pytest` to guarantee reliability.
* **Ready-to-run demo** capability built in for instant evaluation.

## Installation

Clone the repository and install the dependencies in a virtual environment:

```bash
git clone https://github.com/kaxshxk/customerfeedbackanalyser.git
cd customerfeedbackanalyser
python -m venv venv
# On Windows: venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate
pip install -r requirements.txt
```

## Usage

Run the sentiment analyser CLI with default parameters:
```bash
python main.py
```

Provide custom input and output file paths:
```bash
python main.py -f my_feedback.txt -o results.json
```

Display the help usage instructions:
```bash
python main.py --help
```

## Running the Tests

Execute the test suite with `pytest` using the quiet flag:
```bash
pytest -q
```

## Demo
You can try the application instantly on GitHub Codespaces:
1. Open the repository on GitHub.
2. Click the green **Code** button, select the **Codespaces** tab, and click **Create codespace on main**.
3. Once the environment loads, run `python main.py` in the terminal to see it in action.

## License
This project is licensed under the [MIT License](LICENSE).
