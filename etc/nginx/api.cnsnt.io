
server {

  # FIXME
  # this crap has to be secured
  listen 80;
  listen [::]:80;
  
  server_name api.lifekey.cnsnt.io;
  root /srv/lifekey/api;
  location / {
    proxy_pass http://localhost:8443/;
  }
}