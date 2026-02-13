# Contributing to ia.json

Thank you for your interest in contributing to ia.json! This document provides guidelines for contributing.

## How to Contribute

### Reporting Issues

- Use [GitHub Issues](../../issues) to report bugs or suggest features
- Check existing issues before creating a new one
- Include as much detail as possible

### Proposing Changes to the Specification

1. Open an issue describing the proposed change
2. Discuss the change with maintainers
3. Submit a pull request with the changes

### Contributing Code

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run tests to ensure nothing is broken
5. Commit your changes (`git commit -m 'Add my feature'`)
6. Push to your fork (`git push origin feature/my-feature`)
7. Open a pull request

## Development Setup

### Validator

```bash
cd validator
npm install
npm test
```

### Node.js Library

```bash
cd libraries/node
npm install
npm test
```

### PHP Library

```bash
cd libraries/php
composer install
./vendor/bin/phpunit
```

### Python Library

```bash
cd libraries/python
pip install -e ".[dev]"
pytest
```

## Code Style

- TypeScript/JavaScript: Follow the ESLint configuration
- PHP: PSR-12 coding standard
- Python: PEP 8, enforced by ruff
- Markdown: One sentence per line

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
