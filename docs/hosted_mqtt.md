# Notes on running a hosted MQTT

Example using debian 13:

```
$ sudo apt install mosquitto caddy

# user and password
$ sudo mosquitto_passwd -c /etc/mosquitto/passwd user_name
# enter password

# permissions
$ sudo chown root:mosquitto /etc/mosquitto/passwd
$ sudo chmod 640 /etc/mosquitto/passwd

# in /etc/mosquitto/mosquitto.conf
listener 9001 127.0.0.1
protocol websockets
allow_anonymous false
password_file /etc/mosquitto/passwd
persistence false

$ sudo systemctl restart mosquitto

# in /etc/caddy/Caddyfile
signal.trapz.gg {
    reverse_proxy localhost:9001
}

$ sudo systemctl restart mosquitto
```
