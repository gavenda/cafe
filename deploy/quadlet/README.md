# Podman Quadlet

Runs cafe and Redis together in one pod (`cafe`). They share the pod's network, so the bot talks to Redis on `localhost:6379` and nothing is published to the host.

| File                   | What it does                                       |
| ---------------------- | -------------------------------------------------- |
| `cafe.pod`             | The pod. Starting it starts both containers.       |
| `cafe-redis.container` | Redis 8 with append-only persistence               |
| `cafe.container`       | The bot. Starts once Redis passes its health check |
| `cafe-redis.volume`    | Redis data (fan snapshots, settings)               |
| `cafe-logs.volume`     | Bot log files                                      |

## Install (rootless)

```sh
mkdir -p ~/.config/containers/systemd ~/.config/cafe
cp deploy/quadlet/cafe.pod deploy/quadlet/*.container deploy/quadlet/*.volume ~/.config/containers/systemd/
cp deploy/quadlet/cafe.env.example ~/.config/cafe/cafe.env   # then fill in the values
chmod 600 ~/.config/cafe/cafe.env

systemctl --user daemon-reload
systemctl --user start cafe-pod.service
loginctl enable-linger "$USER"   # keep it running after you log out
```

## Operate

```sh
systemctl --user status cafe-pod cafe cafe-redis
journalctl --user -u cafe -f
podman auto-update                # pull new images and restart (both containers opt in)
```

For a rootful install, copy the units to `/etc/containers/systemd/`, change `WantedBy=default.target` to `multi-user.target` in `cafe.pod`, and point `EnvironmentFile=` in `cafe.container` at an absolute path (`%h` is `/root` there).
