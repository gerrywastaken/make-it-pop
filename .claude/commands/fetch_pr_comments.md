# Fetch PR Comments

When the user runs this command, help them fetch PR review comments by:

1. First, get the current branch name and find the associated PR number
2. Output a shell command for them to run that will fetch all PR comment bodies

The command should use the GitHub CLI to fetch PR comments in a clean, readable format.

Example output format:

```shell
gh api repos/OWNER/REPO/pulls/PR_NUMBER/comments --jq '.[].body'
```

Make sure to:
- Determine the repo owner and name from the git remote
- Find the PR number associated with the current branch
- Provide the exact command ready to copy and paste
