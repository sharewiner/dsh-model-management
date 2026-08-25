# Changelog

All notable changes to this project are documented in this file.

## 0.2.0-beta.1 - 2026-08-25

### Added

- Provider and individual-model visibility controls synchronized with the composer model picker and `/model` command.
- Current-model preservation while an active session still uses a hidden model or disabled provider.
- Automated coverage for model visibility filtering behavior.
- English and Simplified Chinese documentation.
- Package repository metadata, MIT license, and release scripts.

### Changed

- Provider headers can be expanded or collapsed by clicking the header, empty area, or chevron.
- Restored model action label is now `显示`.

### Compatibility

- Tested with DeepSeek Harness `0.1.1-rc.2` package APIs and DSH Desktop Web profiles current on 2026-08-25.
- Model picker filtering wraps DSH's client-side `modelDirectories` service. Treat this release as beta and revalidate after DeepSeek Harness upgrades.
