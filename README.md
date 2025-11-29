# Zenclass Full Project — Query Runner

This project contains sample data and a Node.js script that loads the data into a local MongoDB instance and runs the queries requested in the task.

Prerequisites
- Node.js (14+)
- A running MongoDB instance on `mongodb://127.0.0.1:27017` (default local)

Install and run

PowerShell (Windows):

```powershell
cd 'C:\Users\deept\Downloads\zenclass_full_project'
npm install
npm start
```

What the script does
- Reads JSON files from `sample-data/`.
- Converts date-like fields to proper Date objects (`dateISO`, `drive_dateISO`).
- Inserts documents into the `zenclass` database.
- Runs the MongoDB queries requested (topics/tasks in October, drives in date range, drives with students, codekata stats, mentors with >15 mentees, absent users who didn't submit tasks) and prints results.

Notes
- The script expects MongoDB running locally. If your MongoDB is on a different host/port, edit `queries.js` and change the connection string.
- Date parsing uses JavaScript `Date` parsing on the sample strings. For production data, prefer importing true ISODate values or normalizing during ETL.

If you want, I can:
- Convert this to run without MongoDB (in-memory) for quick demos.
- Add command-line flags to control DB URI and whether to clear existing collections.

Connecting to MongoDB Atlas (cloud)

1. In MongoDB Atlas, create a cluster and get the connection string (click "Connect" → "Connect your application").
2. Replace the `<password>` placeholder and any `<dbname>` in the connection string.
3. Make sure your IP is whitelisted or use the temporary 0.0.0.0/0 during testing (not recommended for production).
4. You can provide the URI to the script either via an environment variable or as a CLI argument.

PowerShell example (environment variable):

```powershell
$env:MONGODB_URI = 'mongodb+srv://user:YourPassword@cluster0.abcd.mongodb.net/zenclass?retryWrites=true&w=majority'
npm start
```

Or pass the connection string as a first argument:

```powershell
npm start -- "mongodb+srv://user:YourPassword@cluster0.abcd.mongodb.net/zenclass?retryWrites=true&w=majority"
```

 Security note: Avoid committing credentials to the repo. Use environment variables or a secure secrets manager.

Using a `.env` file (recommended)

1. Copy `.env.example` to `.env`:

```powershell
cd 'C:\Users\deept\Downloads\zenclass_full_project'
Copy-Item .\.env.example .\.env
```

2. Edit `.env` and set your `MONGODB_URI` (do not commit `.env`):

Example `.env` content:

```
MONGODB_URI=mongodb+srv://<DB_USERNAME>:<DB_PASSWORD>@cluster0.gfeq99b.mongodb.net/zenclass?retryWrites=true&w=majority
```

3. Run the project (after `npm install`):

```powershell
npm start
```

The script will read `MONGODB_URI` from the environment (via `dotenv`) automatically.
# Zen Class MongoDB Project

Includes full sample dataset and queries.