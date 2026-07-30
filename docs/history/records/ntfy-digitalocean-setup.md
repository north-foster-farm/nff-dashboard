# Self-Hosting ntfy on DigitalOcean

A provisioning guide for standing up a private ntfy instance on a DigitalOcean droplet, with HTTPS, basic auth, and a topic locked down so only you can publish.

## Prerequisites

- DigitalOcean account
- A subdomain you can point at the droplet (e.g., `ntfy.northfosterfarm.com`) — since you've got the domain on Cloudflare already, this is a 30-second DNS record
- SSH key uploaded to DigitalOcean (if you haven't already)

## 1. Create the droplet

In the DO control panel:

- **Image**: Ubuntu 24.04 LTS x64
- **Size**: Basic → Regular → **$4/mo (512 MB / 1 vCPU / 10 GB SSD)** is plenty. ntfy is tiny. If you want headroom, the $6/mo (1 GB) tier is fine.
- **Datacenter**: NYC3 or NYC1 (closest to RI, lowest latency)
- **Authentication**: SSH key (not password)
- **Hostname**: `ntfy-nff` or whatever you like
- Enable **monitoring** and **automatic backups** ($0.96/mo extra) if you want them

Once it spins up, grab the public IPv4.

## 2. Point DNS at the droplet

In Cloudflare:

- Add an A record: `ntfy` → `<droplet IP>`
- **Disable the orange cloud (proxy)** for now. You want DNS-only while issuing the Let's Encrypt cert. You can re-enable proxying later if you want, but ntfy uses long-lived connections that don't always play nicely with Cloudflare's free tier — leaving it gray-cloud is the path of least resistance.

Wait a couple minutes for propagation. Verify with `dig ntfy.northfosterfarm.com +short`.

## 3. Initial server hardening

SSH in as root:

```bash
ssh root@<droplet-ip>
```

Create a non-root user, basic firewall, updates:

```bash
# Update everything
apt update && apt upgrade -y

# Create your user
adduser james
usermod -aG sudo james
rsync --archive --chown=james:james ~/.ssh /home/james

# UFW firewall
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Optional but recommended: disable root SSH login
sed -i 's/^PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart ssh
```

From here on, log in as `james` and use `sudo`.

## 4. Install ntfy

The official APT repo moved to `archive.ntfy.sh` in September 2025 — older guides pointing at `archive.heckel.io` still work for now but are being phased out.

```bash
sudo mkdir -p /etc/apt/keyrings
sudo curl -L -o /etc/apt/keyrings/ntfy.gpg https://archive.ntfy.sh/apt/keyring.gpg
sudo apt install apt-transport-https -y
echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/ntfy.gpg] https://archive.ntfy.sh/apt stable main" \
  | sudo tee /etc/apt/sources.list.d/ntfy.list
sudo apt update
sudo apt install ntfy -y
```

Don't start it yet — we want to configure it first.

## 5. Configure ntfy

Edit `/etc/ntfy/server.yml`:

```bash
sudo nano /etc/ntfy/server.yml
```

Minimum config you want:

```yaml
base-url: "https://ntfy.northfosterfarm.com"
listen-http: ":2586"  # we'll put nginx in front

# Auth: lock it down so random people can't publish to your topics
auth-file: "/var/lib/ntfy/user.db"
auth-default-access: "deny-all"

# Where to store the message cache and attachments
cache-file: "/var/cache/ntfy/cache.db"
cache-duration: "12h"
attachment-cache-dir: "/var/cache/ntfy/attachments"

# Behind a reverse proxy
behind-proxy: true
```

Set ownership and start it:

```bash
sudo systemctl enable ntfy
sudo systemctl start ntfy
sudo systemctl status ntfy   # should show "active (running)"
```

## 6. Create users and the topic ACL

`auth-default-access: deny-all` means nobody can read or write anything until you grant access. Create an admin user (you) and a write-only user (your dashboard, optional but cleaner than reusing your admin creds):

```bash
# Admin — can do everything
sudo ntfy user add --role=admin james
# (it will prompt for a password)

# Optional: dedicated publisher account for the dashboard
sudo ntfy user add dashboard
sudo ntfy access dashboard "alerts" write-only

# Your dad — read-only on the alerts topic
sudo ntfy user add dad
sudo ntfy access dad "alerts" read-only
```

Now only authenticated users can hit the `alerts` topic, and the dashboard token can publish but not read.

## 7. Nginx reverse proxy + Let's Encrypt

```bash
sudo apt install nginx certbot python3-certbot-nginx -y
```

Create `/etc/nginx/sites-available/ntfy`:

```nginx
server {
    listen 80;
    server_name ntfy.northfosterfarm.com;

    client_max_body_size 0;  # ntfy handles attachment limits itself

    location / {
        proxy_pass http://127.0.0.1:2586;
        proxy_http_version 1.1;

        proxy_buffering off;
        proxy_request_buffering off;
        proxy_redirect off;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # ntfy uses long-lived connections for subscribers
        proxy_connect_timeout 3m;
        proxy_send_timeout 3m;
        proxy_read_timeout 3m;
    }
}
```

Enable it and grab a cert:

```bash
sudo ln -s /etc/nginx/sites-available/ntfy /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

sudo certbot --nginx -d ntfy.northfosterfarm.com
```

Certbot will automatically rewrite the nginx config for HTTPS and set up auto-renewal.

## 8. Test it

From your laptop:

```bash
# Should fail (no auth)
curl -d "test" https://ntfy.northfosterfarm.com/alerts

# Should succeed
curl -u dashboard:YOUR_PASSWORD \
     -d "Hello from the farm dashboard" \
     https://ntfy.northfosterfarm.com/alerts
```

## 9. Subscribe on phones

Install the **ntfy** app from the App Store / Play Store on both phones:

- Open the app → Settings → "Default server" → set to `https://ntfy.northfosterfarm.com`
- Add subscription → topic `alerts`
- When prompted for credentials, enter the user creds (`james` for you, `dad` for your dad)

That's it. Test by curling the endpoint and watching the notification land.

## 10. Wire up the dashboard

In your React dashboard, calling ntfy is one fetch:

```javascript
async function sendAlert(message, { title, priority = 3, tags = [] } = {}) {
  const auth = btoa('dashboard:YOUR_PASSWORD'); // store in env, not source
  await fetch('https://ntfy.northfosterfarm.com/alerts', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Title': title ?? 'NFF Alert',
      'Priority': String(priority),     // 1 (min) – 5 (max/emergency)
      'Tags': tags.join(','),           // emoji shortcodes, e.g. 'warning,cow'
    },
    body: message,
  });
}
```

**Important caveat**: don't ship the password in client-side code. Since you mentioned the dashboard is client + Supabase, the cleanest path is a Supabase Edge Function that holds the ntfy credentials and proxies the call. Your React app calls the edge function; the edge function calls ntfy.

## Ongoing maintenance

- **Updates**: `sudo apt update && sudo apt upgrade -y` once a month or so. ntfy releases ship through the same APT repo.
- **Cert renewal**: Certbot installs a systemd timer; nothing to do.
- **Backups**: the user database lives at `/var/lib/ntfy/user.db`. If you ever rebuild, that's the file to copy. Snapshots in DO ($0.06/GB/mo) are easier.
- **Logs**: `sudo journalctl -u ntfy -f`

## Total cost

- $4/mo droplet
- $0 domain (you have one)
- $0 ntfy
- ~$1/mo if you turn on backups

So roughly $5/mo for a private, unlimited-message, unlimited-topic notification hub that you control end to end.
