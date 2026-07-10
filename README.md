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
cp .env.example .env   # first time only, then fill in real DB_HOST/DB_USER/DB_PASSWORD/DB_NAME/SESSION_SECRET
npm start
```

By default it listens on **port 3000**. If that port is already taken
(check with `lsof -i :3000`), override it:

```bash
PORT=3055 npm start
```

Then open `http://localhost:3000` (or whichever port you used) in a browser
— you'll land on the login screen.

### Verifying it's up without a browser

```bash
curl -I http://localhost:3000/
```

A `200` means the login page rendered. Note that officer/armory/report
pages all require a working MySQL connection (`.env`) and a logged-in
session — the login page itself does not touch the database, so it'll
render even if the DB is unreachable.

### Stopping it

If started in the foreground, `Ctrl+C`. If started in the background:

```bash
npm start &> /tmp/led.log &
echo $! > /tmp/led.pid
# ...later...
kill $(cat /tmp/led.pid)
```

### Database migrations

One-time additive migration for the roster/armory/reports features lives at
`LED/db/migrations/001_polish_features.sql` — run it once against your
database:

```bash
mysql -h <DB_HOST> -u <DB_USER> -p <DB_NAME> < LED/db/migrations/001_polish_features.sql
```
