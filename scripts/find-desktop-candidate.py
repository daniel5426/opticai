"""Find one successful platform without waiting for the other candidate jobs."""
import json
import os
import subprocess
import sys
import time


PLATFORMS = {"windows": "build-windows", "macos": "build-macos"}


def gh(*args):
    return json.loads(subprocess.check_output(["gh", *args], text=True))


def find_candidate(repo, sha, platform):
    job_name = PLATFORMS[platform]
    runs = gh("run", "list", "--repo", repo, "--workflow", "desktop-candidate.yml",
              "--commit", sha, "--limit", "20", "--json", "databaseId")
    for run in runs:
        run_id = run["databaseId"]
        pages = gh("api", "--paginate", "--slurp",
                   f"repos/{repo}/actions/runs/{run_id}/jobs?filter=latest&per_page=100")
        if not any(job["name"] == job_name and job["conclusion"] == "success"
                   for page in pages for job in page["jobs"]):
            continue
        pages = gh("api", "--paginate", "--slurp",
                   f"repos/{repo}/actions/runs/{run_id}/artifacts?per_page=100")
        if any(artifact["name"] == f"{platform}-release" and not artifact["expired"]
               for page in pages for artifact in page["artifacts"]):
            return run_id
    return None


def main():
    platform = sys.argv[1]
    if platform not in PLATFORMS:
        raise ValueError("Unknown desktop platform")
    deadline = time.monotonic() + 900
    while True:
        run_id = find_candidate(os.environ["GITHUB_REPOSITORY"], os.environ["GITHUB_SHA"], platform)
        if run_id is not None:
            with open(os.environ["GITHUB_OUTPUT"], "a") as output:
                output.write(f"run={run_id}\n")
            print(f"Using successful {platform} candidate job from run {run_id}")
            return
        if time.monotonic() >= deadline:
            raise RuntimeError(f"No successful, unexpired {platform} candidate for this SHA. "
                               "Dispatch desktop-candidate.yml on the exact ref or retry the failed platform.")
        time.sleep(10)


if __name__ == "__main__":
    main()
