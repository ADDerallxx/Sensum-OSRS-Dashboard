# Sensum V4 local runtime

This runtime is for the isolated V4 development database. It does not connect
to, migrate, or modify the live V3 dashboard or production data.

## Components

- Docker Desktop using WSL 2
- PostgreSQL 18.1, pinned by image digest and available only at
  `127.0.0.1:54329`
- Database: `sensum_v4`
- User: `sensum_v4`
- Docker volume: `sensum_v4_postgres_data`
- Memory limit: 4 GiB
- CPU limit: 4 logical CPUs

The password is stored as the user-scoped Windows environment variable
`SENSUM_V4_DB_PASSWORD`. It is not stored in Git or in this directory.

## Control commands

From the repository root:

```powershell
.\platform\local\Manage-SensumV4Local.ps1 start
.\platform\local\Manage-SensumV4Local.ps1 status
.\platform\local\Manage-SensumV4Local.ps1 backup
.\platform\local\Manage-SensumV4Local.ps1 stop
```

`start` waits for PostgreSQL, applies every unapplied migration transactionally,
and reports the migration and table totals. `stop` preserves the named database
volume. Backups are written under the ignored `.platform-local/backups` folder.

## Accepted evidence materialization

The first cross-skill adapter imports the newest independently audited raw skill
level-up inventory:

```powershell
node platform\db\materialize-skill-unlock-inventory.mjs
```

The command validates the pinned snapshot and audit before opening a database
transaction, reconciles every persisted source and evidence row before commit,
reapplies the transaction to prove idempotency, and performs an intentional
rollback probe. Imported statements remain candidate evidence and cannot enter
the optimizer or authorize a verified-best claim. Its report is written beneath
the ignored `.platform-data/cross-skill-evidence-postgresql-materialization-audits`
directory.

Do not place PostgreSQL's live data directory in Google Drive or another synced
folder. Copy verified database dumps there only as backup artifacts.
