# Changelog

## Version 1.3.0 (2021-02-01)

- Update dependencies to support node 12

## Version 1.2.0 (2020-07-24)

- Add support for signing commits
- Fix PR url including the `.git` extension in the repo name when remote
  url has it
- Update dependencies to fix a security advisory on lodash

## Version 1.1.1 (2019-10-11)

- Fixed a bug where the remote repository URL was incorrectly parsed when it
  did not have either a `.git` extension or a trailing slash
- Updated dependencies to fix a security advisory on lodash

## Version 1.1.0 (2019-06-21)

- `realease tag` now creates the tag on the commit that changed the version
  number in `package.json` instead of the head commit

## Version 1.0.0 (2019-06-13)

- First public release
