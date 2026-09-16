# CLAUDE.md

This is a discord bot which manages fan count and rankings for the Club: Bogosume-E

### Design notes

- A brew is a `:` delimited string, in the format of guildId:textChannelId:circleId.
- In a brew, `guildId` is the discord guild, `textChannelId` is the channel in which the rankings are sent and updated, `circleId` is the club id that resides in `uma.moe`.
- `uma.moe` is the API that provides live updates to the fan count.
- The fan count is updated `daily` and `weekly`.

### References

- Uma.MOE API Documentation: <https://uma.moe/api/docs>

### Environment Variables

```
TOKEN=<discord bot token>
CLIENT_ID=<discord application id>
CAFE_BREW=<brews delimited by ;>
UMA_MOE_API_KEY=<uma.moe api key>
```
