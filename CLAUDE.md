# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LangDiff is a Python library that enables streaming structured LLM outputs to frontends through intelligent partial JSON parsing and automatic change tracking. The library consists of two main components:

1. **Streaming Parser** (`src/langdiff/parser/`): Handles progressive parsing of incomplete JSON structures as tokens arrive
2. **Change Tracker** (`src/langdiff/tracker/`): Tracks mutations on objects and generates JSON Patch diffs for efficient frontend synchronization

## Development Commands

### Environment Setup
This project uses `uv` for dependency management:
```bash
uv sync --dev  # Install dependencies including dev group
```

### Testing
```bash
uv run pytest                    # Run all tests
uv run pytest tests/test_parser.py  # Run specific test file
uv run pytest -v                # Verbose output
uv run pytest -k "test_name"    # Run specific test by name pattern
```

### Linting and Formatting
```bash
uv run ruff check              # Check for linting issues
uv run ruff check --fix        # Auto-fix linting issues
uv run ruff format             # Format code
```

### Running Examples
```bash
uv run python example.py      # Run the main demo example
```

### Building Distribution
```bash
uv build                      # Build wheel and source distribution
```

### Documentation
```bash
uv sync --group docs          # Install documentation dependencies
uv run mkdocs serve           # Start development server at http://127.0.0.1:8000
uv run mkdocs build           # Build static site to ./site directory
```

## Architecture

### Core Components

**Parser Module** (`src/langdiff/parser/`):
- `model.py`: Defines streaming data types (`Object`, `List`, `String`, `Atom`) that handle partial JSON parsing
- `parser.py`: Contains the main `Parser` class that processes token streams and triggers callbacks
- Streaming types support event callbacks (`on_append`, `on_complete`, `on_start`) for real-time updates
- Integrates with Pydantic through `to_pydantic()` method for OpenAI SDK compatibility

**Tracker Module** (`src/langdiff/tracker/`):
- `change_tracker.py`: Abstract base classes for change tracking (`ChangeTracker`, `DiffBuffer`)
- `impl.py`: Concrete implementations (`JSONPatchChangeTracker`, `EfficientJSONPatchChangeTracker`)
- `changes.py`: Operation definitions and change application utilities
- Provides object proxying to automatically capture mutations and generate JSON Patch operations

### Key Design Patterns

1. **Event-Driven Architecture**: Streaming values use callback patterns to notify consumers of updates
2. **Proxy Pattern**: Change trackers wrap objects in proxies to intercept and record mutations
3. **Builder Pattern**: Parsers incrementally build structured data as tokens arrive
4. **Type Safety**: Heavy use of generics and type hints for compile-time safety

### Integration Points

- **OpenAI SDK**: LangDiff models can be converted to Pydantic models via `to_pydantic()` for use with structured output APIs
- **JSON Patch**: Change tracking generates RFC 6902 compliant JSON Patch operations (with custom `append` operation for efficiency)
- **Pydantic**: Seamless interop with existing Pydantic-based codebases

## Testing Strategy

- Tests are organized by module: `test_parser.py`, `test_change_tracker.py`, `test_partial_json.py`
- Focus on streaming behavior, partial parsing scenarios, and change tracking accuracy
- Example-driven testing using realistic LLM output patterns

## Dependencies

Core dependencies:
- `jiter`: Fast JSON parsing
- `jsonpatch`: JSON Patch operations
- `jsonpointer`: JSON Pointer implementation  
- `pydantic`: Data validation and serialization

Development dependencies:
- `pytest`: Testing framework
- `ruff`: Linting and formatting
- `openai`: For examples and integration testing

Documentation dependencies:
- `mkdocs`: Static site generator
- `mkdocs-material`: Material Design theme for MkDocs
- `mkdocstrings[python]`: Auto-generate API docs from docstrings