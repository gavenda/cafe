# CLAUDE.md

This is a discord bot that keeps a fan leaderboard for a hand-picked list of Umamusume trainers. Each server chooses which trainer ids to watch, and cafe ranks and tallies their fan gains daily (and weekly on Mondays).

Bun is the only supported runtime. Prefer Bun built-ins (`Bun.cron`, `RedisClient` from `bun`, `Bun.sleep`, `Bun.file`) over npm packages.

### Tooling

- Format: `bun fmt` (check with `bun fmt --check`). Options are in `bunfig.toml` under `[fmt]`.
- Type check: `bun check`. TypeScript 7 is a dev dependency only so editors can pick it up.
- Lint: `bun lint`. Rules are in `bunfig.toml` under `[lint]`. It's canary-only for now, so the `lint` script runs `bunx bun@canary lint`.
- Containers are built with Podman/Buildah from `Containerfile`. Deployment is the Quadlet pod in `deploy/quadlet/`.

### Design notes

- Servers set up the leaderboard with `/leaderboard channel|add|remove|list|post` (Manage Server permission).
- Anyone can view `/standings` and `/history`.
- `uma.moe` is the API that provides fan totals. Trainers are looked up through `/api/v4/rankings/alltime?query=<trainer id>`.
- Every day at 17:00 UTC, cafe stores each watched trainer's lifetime fan total as a snapshot, then posts the leaderboard.
- Gains are computed in Redis with `ZINTERSTORE` of the day's snapshot minus the snapshot from 1 or 7 days earlier, intersected with the server's watched set.

### Redis keys

| Key                                   | Type | Contents                                                 |
| ------------------------------------- | ---- | -------------------------------------------------------- |
| `cafe:guilds`                         | SET  | Guild ids that set up cafe                               |
| `cafe:guild:{guildId}`                | HASH | `channel_id`, `daily_message_id`, `weekly_message_id`    |
| `cafe:guild:{guildId}:trainers`       | SET  | Watched trainer ids                                      |
| `cafe:trainer:{trainerId}`            | HASH | `name`, `circle_id`, `circle_name`, `fans`, `updated_at` |
| `cafe:fans:{YYYY-MM-DD}`              | ZSET | Trainer id -> lifetime fans on that UTC day (45d TTL)    |
| `cafe:board:{guildId}:{period}:{day}` | ZSET | Trainer id -> fans gained (cache, 8d TTL)                |

### References

- Uma.MOE API Documentation: <https://uma.moe/api/docs>

### Environment Variables

```
TOKEN=<discord bot token>
CLIENT_ID=<discord application id>
UMA_MOE_API_KEY=<uma.moe api key>
REDIS_URL=<redis connection url, defaults to redis://localhost:6379>
```
