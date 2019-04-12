# Realease

Ease up your releases.

## Introduction

Realease makes releases of node libs with github a bit easier.  It implements
the following workflow:

- 1. Update `package.json` with a new version number
- 2. Create a release branch with a single commit containing the version update
- 3. Push that branch to github
- 4. Make a PR from that branch and merge it
- 5. Tag the resulting commit on master with the version number

Steps 1-3 are automated with a single call of realease.

Step 4 is manual.

Step 5 can be either manual or automated from your CI pipeline.

## Project setup

Add realease to your project.

```
yarn add --dev git@github.com:njoyard/realease
```

Set up your CI to call `realease tag` on merges onto master.  For example in a
CircleCI configuration file:

```yaml

jobs:
release:
    steps:
      - run:
          name: Create release tag if not already present
          command: `yarn bin`/realease tag

workflows:
  version: 2
  test_matrix:
    jobs:
      - ...
      - release:
          requires:
            - test
            - anythingelse
          filter:
            branches:
              only: master
```

The way `realease tag` works is that it simply checks if the tag for the current
version in `package.json` exists. If not, it creates it, pointing to the latest
commit on master.

## Making a release

Run `realease major|minor|patch` from your project repository.  Click on the
generated link that it outputs to open a new PR, and merge it onto master.  Your
CI pipeline will tag the commit when it finishes running.

## Detailed usage

### `realease <major|minor|patch>`

Create and push a release branch for a new version.  Release branch will
include a new commit with updated `package.json`.

Options:
* `--add <file>`: add additional file to the release commit, may be repeated.
  This is useful if you want to add for example an updated CHANGELOG.
* `--branch <name>`:  name of the branch to create, defaults to
  `release/{version}`.
* `--force`: do not complain if we're not currently on master
* `--message <msg>`: commit message, defaults to `Release version {version}`
* `--no-push`: do not push the release branch.  This is useful when you want to
  add more commits to the release branch before pushing.
* `--remote <name>`: name of remote to push to, defaults to `origin`
* `--repo <path>`: specify path to repository, defaults to current directory

### `realease tag`

Create and push a tag for the current version.  Will not do anything if the tag
already exists.

Options:
* `--force`: do not complain if we're not currently on master
* `--message <msg>`: tag message, defaults to `Release version {version}`
* `--no-push`: do not push the tag
* `--remote <name>`: name of remote to push to, defaults to `origin`
* `--repo <path>`: specify path to repository, defaults to current directory
* `--tag <name>`: name of the tag to create, defaults to `v{version}`
