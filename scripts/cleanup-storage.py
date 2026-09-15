#!/usr/bin/env python3
"""
LifeLog GitHub Actions Storage & Workflow Purge Utility
Purges old workflow runs, stored artifacts, and build caches to free 0.5 GB Actions storage quota.
"""

import sys
import os
import json
import urllib.request
import urllib.error
import time

def api_request(url, token, method="GET"):
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "Actions-Storage-Purge"
        },
        method=method
    )
    try:
        with urllib.request.urlopen(req) as resp:
            if method == "GET":
                return json.loads(resp.read().decode())
            return True
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        if e.code in (403, 429) and "secondary rate limit" in body.lower():
            print("  ⏳ Secondary rate limit hit. Pausing 10 seconds before continuing...")
            time.sleep(10)
            return api_request(url, token, method)
        if e.code != 404:
            print(f"  ⚠️ HTTP {e.code} on {method} {url}: {body[:150]}")
        return None
    except Exception as ex:
        print(f"  ⚠️ Error: {ex}")
        return None

def purge_artifacts(repo, token):
    print(f"\n📦 Step 1: Purging all stored artifacts in {repo}...")
    deleted = 0
    freed_bytes = 0
    while True:
        data = api_request(f"https://api.github.com/repos/{repo}/actions/artifacts?per_page=100", token)
        if not data or not data.get("artifacts"):
            break
        artifacts = data["artifacts"]
        if not artifacts:
            break
        batch_deleted = 0
        for art in artifacts:
            art_id = art["id"]
            size = art.get("size_in_bytes", 0)
            success = api_request(f"https://api.github.com/repos/{repo}/actions/artifacts/{art_id}", token, method="DELETE")
            if success:
                deleted += 1
                batch_deleted += 1
                freed_bytes += size
                if deleted % 10 == 0:
                    print(f"  ...deleted {deleted} artifacts ({freed_bytes / (1024*1024):.1f} MB freed)")
            time.sleep(0.2)
        if batch_deleted == 0:
            # Prevent infinite loop if unable to delete
            break
    print(f"  ✅ Finished: Deleted {deleted} artifacts, freed {freed_bytes / (1024*1024):.2f} MB storage.")

def purge_caches(repo, token):
    print(f"\n💾 Step 2: Purging build caches in {repo}...")
    total_deleted = 0
    while True:
        data = api_request(f"https://api.github.com/repos/{repo}/actions/caches?per_page=100", token)
        if not data or not data.get("actions_caches"):
            break
        caches = data["actions_caches"]
        if not caches:
            break
        batch_deleted = 0
        for c in caches:
            success = api_request(f"https://api.github.com/repos/{repo}/actions/caches/{c['id']}", token, method="DELETE")
            if success:
                total_deleted += 1
                batch_deleted += 1
            time.sleep(0.2)
        if batch_deleted == 0:
            break
    print(f"  ✅ Deleted {total_deleted} caches.")

def purge_runs(repo, token, keep_count=1):
    print(f"\n🔄 Step 3: Purging old workflow runs in {repo} (keeping latest {keep_count})...")
    all_runs = []
    page = 1
    while True:
        data = api_request(f"https://api.github.com/repos/{repo}/actions/runs?per_page=100&page={page}", token)
        if not data or not data.get("workflow_runs"):
            break
        runs = data["workflow_runs"]
        all_runs.extend(runs)
        if len(runs) < 100:
            break
        page += 1

    total_runs = len(all_runs)
    print(f"  Found {total_runs} total workflow runs in {repo}.")

    # Sort descending by id to preserve the most recent
    all_runs.sort(key=lambda r: r["id"], reverse=True)
    to_delete = all_runs[keep_count:]
    print(f"  Preserving latest {min(total_runs, keep_count)} run(s). Deleting {len(to_delete)} older runs...")

    deleted = 0
    for r in to_delete:
        run_id = r["id"]
        if r.get("status") == "in_progress":
            continue
        success = api_request(f"https://api.github.com/repos/{repo}/actions/runs/{run_id}", token, method="DELETE")
        if success:
            deleted += 1
            if deleted % 20 == 0:
                print(f"  ...deleted {deleted}/{len(to_delete)} workflow runs")
        time.sleep(0.25)

    print(f"  ✅ Finished: Successfully deleted {deleted} workflow runs.")

def clean_repository(repo, token, keep_count=1):
    print("\n" + "=" * 65)
    print(f"  🚀 Starting Storage Purge for: {repo}")
    print("=" * 65)
    purge_artifacts(repo, token)
    purge_caches(repo, token)
    purge_runs(repo, token, keep_count)
    print(f"✨ {repo} is now clean!")

def main():
    token = os.environ.get("RELEASES_TOKEN") or os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    keep_count = 1
    custom_repos = []

    args = sys.argv[1:]
    i = 0
    while i < len(args):
        arg = args[i]
        if arg in ("-t", "--token") and i + 1 < len(args):
            token = args[i + 1]
            i += 2
        elif arg in ("-k", "--keep") and i + 1 < len(args):
            keep_count = int(args[i + 1])
            i += 2
        elif arg in ("-r", "--repo", "--repos"):
            i += 1
            while i < len(args) and not args[i].startswith("-"):
                custom_repos.append(args[i])
                i += 1
        elif "/" in arg:
            custom_repos.append(arg)
            i += 1
        elif arg.isdigit():
            keep_count = int(arg)
            i += 1
        elif not token and len(arg) > 20:
            token = arg
            i += 1
        else:
            i += 1

    if not token:
        print("❌ Error: GitHub Token required.")
        print("Usage:")
        print("  python3 scripts/cleanup-storage.py <YOUR_GITHUB_TOKEN>")
        print("  python3 scripts/cleanup-storage.py --token <TOKEN> --keep 1 --repos Owner/Repo1 Owner/Repo2")
        print("  export GITHUB_TOKEN=<TOKEN> && python3 scripts/cleanup-storage.py")
        sys.exit(1)

    repos_to_clean = custom_repos if custom_repos else ["Krrish1411/Lifelog", "Krrish1411/Lifelog-Releases"]
    print(f"Target Repositories: {repos_to_clean}")
    print(f"Keeping latest {keep_count} run(s) per repo.")

    for repo in repos_to_clean:
        try:
            clean_repository(repo, token, keep_count)
        except Exception as e:
            print(f"❌ Error while cleaning {repo}: {e}")

if __name__ == "__main__":
    main()

