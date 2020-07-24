# Changelog

## Next release

- Add support for signing commits

## Version 1.1.1 (2019-10-11)

- Fixed a bug where the remote repository URL was incorrectly parsed when it
  did not have either a `.git` extension or a trailing slash
- Updated dependencies to fix a security advisory on lodash

## Version 1.1.0 (2019-06-21)

- `realease tag` now creates the tag on the commit that changed the version
  number in `package.json` instead of the head commit

## Version 1.0.0 (2019-06-13)

- First public release
