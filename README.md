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
yarn add --dev git://github.com/njoyard/realease
```

Set up your CI to call `realease tag` on merges onto master.  For example in a
CircleCI configuration file:

```yaml

jobs:
  release:
    steps:
      - run:
          name: Create release tag if not already present
          command: npx realease tag

workflows:
  version: 2
  test_matrix:
    jobs:
      - ...
      - release:
          requires:
            - test
            - anythingelse
          filters:
            branches:
              only: master
```

The way `realease tag` works is that it simply checks if the tag for the current
version in `package.json` exists. If not, it creates it, pointing to the last
commit that changed the version number.

> **Note:** calling `realease tag` this way requires that your CI uses a deploy
> key that is able to push to the repository.  If that's not the case, you can
> use the GitHub API instead.
> * Create an API token with `repo` access
> * Store that token in an environment variable in your CI project settings
> * Call `realease tag --api $APITOKENVARIABLE` instead

## Making a release

Run `realease major|minor|patch` from your project repository.  Click on the
generated link that it outputs to open a new PR, and merge it onto master.  Your
CI pipeline will tag the commit when it finishes running.

> **Note:** realease needs a SSH agent to authenticate with the git server when
> pushing a branch.  Please ensure that you have a SSH agent running (you can
> check that by looking for a `$SSH_AUTH_SOCK` environment variable) and that
> it knows the SSH key you use to authenticate (on most systems you can add a
> key using `ssh-add -K /path/to/private/key`).

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
* `--no-push`: do not push the tag.  Ignored when using `--api`.
* `--remote <name>`: name of remote to push to, defaults to `origin`
* `--repo <path>`: specify path to repository, defaults to current directory
* `--tag <name>`: name of the tag to create, defaults to `v{version}`
* `--api <APIKEY>`: use Github API to create the tag, defaults to using Git with
  ssh credentials from the user running realease
