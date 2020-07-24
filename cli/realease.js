#!/usr/bin/env node

/* eslint-env node */
/* eslint-disable no-console */

const { resolve } = require("path");
const { readFile, writeFile } = require("fs-extra");
const { exec: execAsync } = require("child_process");
const { promisify } = require("util");
const argparse = require("cli-argparse");
const semver = require("semver");
const Git = require("nodegit");
const Octokit = require("@octokit/rest");

const exec = promisify(execAsync);

function usage() {
  console.error(`Usage:
  realease <major|minor|patch>
    Create and push a release branch for a new version.  Release branch will
    include a new commit with updated package.json.

    Options:
    --add <file>     add additional file to the release commit, may be repeated
    --branch <name>  name of the branch to create, defaults to 'release/{version}'
    --force          do not complain if we're not currently on master
    --message <msg>  commit message, defaults to 'Release version {version}'
    --no-push        do not push the release branch
    --remote <name>  name of remote to push to, defaults to 'origin'
    --repo <path>    specify path to repository, defaults to current directory

  realease tag
    Create and push a tag for the current version.  Will not do anything if the
    tag already exists.

    Options:
    --force          do not complain if we're not currently on master
    --message <msg>  tag message, defaults to 'Release version {version}'
    --no-push        do not push the tag (ignored when using --api)
    --remote <name>  name of remote to push to, defaults to 'origin'
    --repo <path>    specify path to repository, defaults to current directory
    --tag <name>     name of the tag to create, defaults to 'v{version}'
    --api <APIKEY>   use Github API to create the tag, defaults to using Git
                     with ssh credentials from the user running realease
`);
}

async function tryAsync(operation, message) {
  try {
    return await operation();
  } catch (e) {
    console.error(`Error ${message}`);
    console.error(e);
    process.exit(1);
  }
}

async function openRepo(repoPath, force) {
  // Open the repo
  let repo = await tryAsync(
    () => Git.Repository.open(repoPath),
    `opening repository at ${repoPath}`
  );

  // Read current branch
  let currentBranch = (await tryAsync(
    () => repo.getCurrentBranch(),
    "getting current branch"
  )).shorthand();

  // Check that we are on master
  if (currentBranch !== "master" && !force) {
    console.error("Aborting, current branch is not master");
    process.exit(1);
  }

  return { repo, currentBranch };
}

async function readPackageJson(path) {
  return JSON.parse(
    await tryAsync(() => readFile(path), "reading package.json")
  );
}

async function getPackageJsonVersionLine(path) {
  let lines = (await readFile(path)).toString().split("\n");
  let versionLines = lines.filter(l => l.match(/"version"\s*:\s*"[^"]+"/));

  if (versionLines.length !== 1) {
    throw new Error("Cannot find version line in package.json");
  }

  return lines.indexOf(versionLines[0]) + 1;
}

async function main() {
  let args = argparse();

  if (args.unparsed.length !== 1) {
    usage();
    process.exit(1);
  }

  let [command] = args.unparsed;

  // Read common options
  let repoPath = args.options.repo || ".";
  let force = !!args.flags.force;
  let push = args.flags.push !== false;
  let remoteName = args.options.remote || "origin";
  let message = args.options.message || "Release version {version}";

  let pkgFile = resolve(repoPath, "package.json");

  if (["major", "minor", "patch"].indexOf(command) !== -1) {
    // Read options
    let addFiles = args.options.add || [];
    let branch = args.options.branch || "release/{version}";

    // Open repository and get current branch
    let { repo, currentBranch } = await openRepo(repoPath, force);

    // Find out if we need to sign commits
    let config = await tryAsync(
      () => repo.config(),
      "reading repository config"
    )

    let gpgsign = (await tryAsync(
      () => config.getEntry('commit.gpgsign'),
      "getting commit.gpgsign value"
    )).value() === 'true'

    // Update version in package.json
    let pkgJson = await readPackageJson(pkgFile);

    let newVersion = semver.inc(pkgJson.version, command);
    console.log(`Updating package.json to version ${newVersion}`);
    pkgJson.version = newVersion;
    await tryAsync(
      () => writeFile(pkgFile, JSON.stringify(pkgJson, null, 2)),
      "updating package.json"
    );

    // Create release branch
    let releaseBranch = branch.replace("{version}", newVersion);
    console.log(`Creating release branch ${releaseBranch}`);
    let headCommit = await tryAsync(
      () => repo.getHeadCommit(),
      "getting last HEAD commit"
    );
    await tryAsync(
      () => repo.createBranch(releaseBranch, headCommit),
      "creating release branch"
    );
    await tryAsync(
      () => repo.checkoutBranch(releaseBranch),
      "checking out release branch"
    );

    // Create commit on release branch
    let commitMessage = message.replace("{version}", newVersion);
    console.log(`Creating release commit with message ${commitMessage}`);
    let sign = Git.Signature.default(repo);
    await tryAsync(
      () =>
        repo.createCommitOnHead(
          ["package.json"].concat(addFiles),
          sign,
          sign,
          commitMessage
        ),
      "creating release commit"
    );

    if (gpgsign) {
      // We're resorting to calling git manually here as signing with NodeGit
      // implies generating the gpg signature ourselves
      console.log(`Signing release commit`);
      await tryAsync(
        () => exec("git commit --amend --no-verify --no-edit", { cwd: repoPath }),
        "amending the commit with signature"
      );
    }

    // Push to remote
    if (push) {
      console.log(`Pushing branch ${releaseBranch} to ${remoteName}`);
      let remote = await tryAsync(
        () => repo.getRemote(remoteName),
        `getting remote ${remoteName}`
      );
      await tryAsync(
        () =>
          remote.push([`refs/heads/${releaseBranch}`], {
            callbacks: {
              credentials(url, userName) {
                return Git.Cred.sshKeyFromAgent(userName);
              }
            }
          }),
        "pushing release branch"
      );

      let [, repoOrg, repoName] = remote
        .url()
        .match(/([^/:]+)\/([^/]+)(?:.git|\/)?$/);

      console.log(
        `Open the release PR here: https://github.com/${repoOrg}/${repoName}/compare/${releaseBranch}?expand=1`
      );
    }

    // Restore original branch
    await tryAsync(
      () => repo.checkoutBranch(currentBranch),
      `restoring branch ${currentBranch}`
    );
  } else if (command === "tag") {
    // Read options
    let tagName = args.options.tag || "v{version}";
    let apiKey = args.options.api || null;

    // Read version from package.json
    let { version } = await readPackageJson(pkgFile);
    let newTag = tagName.replace("{version}", version);

    // Open repository
    let { repo } = await openRepo(repoPath, force);

    // Read refs
    let refs = await tryAsync(
      () => repo.getReferenceNames(Git.Reference.TYPE.LISTALL),
      "getting repo ref names"
    );

    // Get commit that changed package.json version line
    let versionLine = await tryAsync(
      () => getPackageJsonVersionLine(pkgFile),
      "getting version line from package.json"
    );

    let blame = await tryAsync(
      () => Git.Blame.file(repo, "package.json"),
      "blaming package.json"
    );

    let hunk = blame.getHunkByLine(versionLine);
    if (!hunk) {
      console.error(
        "Cannot find blame hunk where package.json changed versions"
      );
      process.exit(1);
    }

    let versionCommit = hunk.finalCommitId();

    // Extract repo org/name
    let remote = await tryAsync(
      () => repo.getRemote(remoteName),
      `getting remote ${remoteName}`
    );
    let [, repoOrg, repoName] = remote
      .url()
      .match(/([^/:]+)\/([^/]+)(?:.git|\/)?$/);

    // Check if tag exists
    if (refs.indexOf(`refs/tags/${newTag}`) !== -1) {
      console.log(`Tag ${newTag} already exists`);
    } else {
      console.log(`Creating tag ${newTag}`);

      if (apiKey) {
        // Create API helper
        let ghapi = new Octokit({ auth: `token ${apiKey}` });

        // Create release tag
        await tryAsync(
          () =>
            ghapi.git.createRef({
              owner: repoOrg,
              repo: repoName,
              ref: `refs/tags/${newTag}`,
              sha: versionCommit
            }),
          "creating release tag with github API"
        );
      } else {
        // Create release tag
        await tryAsync(
          () =>
            repo.createTag(
              versionCommit,
              newTag,
              message.replace("{version}", version)
            ),
          "creating release tag"
        );

        // Push to remote
        if (push) {
          console.log(`Pushing tag ${newTag} to ${remoteName}`);
          await tryAsync(
            () =>
              remote.push([`refs/tags/${newTag}`], {
                callbacks: {
                  credentials(url, userName) {
                    return Git.Cred.sshKeyFromAgent(userName);
                  }
                }
              }),
            "pushing release tag"
          );
        }
      }
    }
  } else {
    usage();
    process.exit(1);
  }
}

main();
