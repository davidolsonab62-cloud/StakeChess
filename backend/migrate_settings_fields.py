"""
One-off migration: backfill allow_spectators / allow_chat_broadcast.

Background
----------
PUT /users/{user_id}/settings used to (incorrectly) write these two fields
into the nested `challenge_preferences` sub-object instead of top-level,
where UserResponse and every other read site (get_user, game snapshots,
chat-broadcast checks) actually expect them. That's fixed now, but any
user who saved settings before the fix has their real preference stranded
under challenge_preferences.allow_spectators / challenge_preferences.allow_chat_broadcast,
while their top-level field is still whatever it was at registration (True).

This script finds users with either key nested under challenge_preferences,
copies the value up to the top-level field, and removes it from the
nested object so it can't cause confusion later (e.g. from stale code,
backups, or someone reading challenge_preferences directly).

Usage
-----
    python3 migrate_settings_fields.py            # dry run, prints what would change
    python3 migrate_settings_fields.py --apply    # actually writes the changes

Safe to re-run: once a user's nested keys are removed, they're no longer
matched by the query and are skipped on subsequent runs.
"""
import argparse
import asyncio
import os

from motor.motor_asyncio import AsyncIOMotorClient


async def main(apply: bool):
    mongo_url = os.environ["MONGO_URL"]
    db = AsyncIOMotorClient(mongo_url)[os.environ["DB_NAME"]]

    query = {
        "$or": [
            {"challenge_preferences.allow_spectators": {"$exists": True}},
            {"challenge_preferences.allow_chat_broadcast": {"$exists": True}},
        ]
    }

    cursor = db.users.find(query, {"_id": 0, "user_id": 1, "username": 1, "challenge_preferences": 1})
    matched = 0
    updated = 0

    async for user in cursor:
        matched += 1
        prefs = user.get("challenge_preferences") or {}
        user_id = user["user_id"]
        username = user.get("username", "<unknown>")

        set_fields = {}
        unset_fields = {}

        if "allow_spectators" in prefs:
            set_fields["allow_spectators"] = bool(prefs["allow_spectators"])
            unset_fields["challenge_preferences.allow_spectators"] = ""

        if "allow_chat_broadcast" in prefs:
            set_fields["allow_chat_broadcast"] = bool(prefs["allow_chat_broadcast"])
            unset_fields["challenge_preferences.allow_chat_broadcast"] = ""

        print(f"[{'APPLY' if apply else 'DRY RUN'}] {user_id} ({username}): "
              f"set={set_fields} unset={list(unset_fields.keys())}")

        if apply and (set_fields or unset_fields):
            update = {}
            if set_fields:
                update["$set"] = set_fields
            if unset_fields:
                update["$unset"] = unset_fields
            result = await db.users.update_one({"user_id": user_id}, update)
            if result.modified_count:
                updated += 1

    print(f"\nMatched {matched} user(s) with stale nested fields.")
    if apply:
        print(f"Updated {updated} user(s).")
    else:
        print("Dry run only - re-run with --apply to write these changes.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Actually write changes (default is dry run)")
    args = parser.parse_args()
    asyncio.run(main(apply=args.apply))
