### Project: Law Enforcement Database [LED] ###

## Running the app

Note the nested folder: this repo's root (where `.git` lives) is
`LED/`, and the actual Node app (`package.json`, `app.js`) is one
level *inside that*, at `LED/LED/`. If `npm start` complains it can't
find `package.json`, you're one directory too shallow.

```bash
cd LED/LED          # from the repo root — or use the absolute path:
                    # cd /Users/miguelcorachea/LED/LED
npm install       # first time only
cp .env.example .env   # first time only, then set SESSION_SECRET
npm start
```

The database is a local SQLite file at `LED/LED/db/db.db` — no external
DB host, no credentials to manage. It's created/versioned by the SQL
files in `db/sqlite/` (see below), not by an env var.

By default the app listens on **port 3000**. If that port is already taken
(check with `lsof -i :3000`), override it:

```bash
PORT=3055 npm start
```

Then open `http://localhost:3000` (or whichever port you used) in a browser
— you'll land on the login screen.

### First login

No accounts exist until you seed one. Create/reset a demo Admin login
(safe to re-run):

```bash
node db/seed-demo-admin.js
```

Prints:
```
Badge Number: 9000
Access Code:  Demo1234!
```
Rotate or remove this account before this ever holds real data.

### Verifying the DB and server are up

```bash
node test-db.js          # lists tables in db/db.db
curl -I http://localhost:3000/
```

A `200` on the curl means the login page rendered — that route doesn't
touch the database, so it'll render even if something's wrong with the
DB file. `test-db.js` is the real check.

### Stopping it

If started in the foreground, `Ctrl+C`. If started in the background:

```bash
npm start &> /tmp/led.log &
echo $! > /tmp/led.pid
# ...later...
kill $(cat /tmp/led.pid)
```

### Database schema

The SQLite schema lives in `LED/LED/db/sqlite/` as numbered, additive
`CREATE TABLE IF NOT EXISTS` files — run once against a fresh `db.db`:

```bash
sqlite3 db/db.db < db/sqlite/001_officers.sql
sqlite3 db/db.db < db/sqlite/002_equipment_and_audit.sql
sqlite3 db/db.db < db/sqlite/003_checkouts_and_reports.sql
```

(`db/db.db` already has all of these applied — you only need this if
you're setting up a fresh copy, e.g. for a teammate or a test DB.)

`db/migrations/001_polish_features.sql` is legacy — that was written for
the old MySQL setup and is no longer used.
