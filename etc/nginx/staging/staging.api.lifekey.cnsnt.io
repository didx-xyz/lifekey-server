
# FIXME we need let'sencrypt
server {
  listen 80;
  listen [::]:80;
  root /srv/staging.api.lifekey.cnsnt.io;
  server_name staging.api.lifekey.cnsnt.io;
  location / {
    proxy_pass http://localhost:8443/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_cache_bypass $http_upgrade;
    client_max_body_size 0;
  }
}
