#!/bin/bash

source ~/.bashrc
# https://wwww.example.com/
sudo apt-get update -y
sudo apt-get upgrade -y
sudo apt-get install zip unzip -y
unzip webapp.zip -d webapp

curl -sSL https://deb.nodesource.com/gpgkey/nodesource.gpg.key | sudo apt-key add -
sudo apt update -y
sudo apt install nodejs npm -y
cd ~/webapp/
sudo npm install
cd ..
sudo groupadd webapp-user
sudo useradd -m -s /bin/bash -g webapp-user webapp-user
sudo passwd -d webapp-user
sudo chown webapp-user:webapp-user -R ~/webapp/
sudo chmod 755 ~/webapp/
sudo mv ~/webapp /home/webapp-user/

sudo cat <<EOF | sudo tee /etc/systemd/system/webapp.service
[Unit]
Description=server.js - making your environment variables
Documentation=https://example.com
Wants=network-online.target
After=network-online.target cloud-final.service

[Service]
EnvironmentFile=/home/webapp-user/.env
Type=simple
User=webapp-user
WorkingDirectory=/home/webapp-user/webapp/
ExecStart=/usr/bin/node /home/webapp-user/webapp/server.js
Restart=on-failure

[Install]
WantedBy=cloud-init.target
EOF


sudo systemctl daemon-reload
sudo systemctl enable webapp.service

sudo mkdir -p /var/log/csye6225/ && sudo touch /var/log/csye6225/webapp.log

sudo mkdir -p /opt/aws/amazon-cloudwatch-agent/etc/
 
sudo cat <<EOF | sudo tee /opt/aws/amazon-cloudwatch-agent/etc/cloudwatch-config.json
{
  "agent": {
      "metrics_collection_interval": 10,
      "logfile": "/var/logs/amazon-cloudwatch-agent.log"
  },
  "logs": {
      "logs_collected": {
          "files": {
              "collect_list": [
                  {
                      "file_path": "/var/log/csye6225/webapp.log",
                      "log_group_name": "csye6225",
                      "log_stream_name": "webapp"
                  }
              ]
          }
      },
      "log_stream_name": "cloudwatch_log_stream"
  },
  "metrics":{
    "metrics_collected":{
       "statsd":{
          "service_address":":8125",
          "metrics_collection_interval":10,
          "metrics_aggregation_interval":60
       }
    }
}
}
EOF
 
sudo chown webapp-user:webapp-user /var/log/csye6225/webapp.log
 
sudo wget https://amazoncloudwatch-agent.s3.amazonaws.com/debian/amd64/latest/amazon-cloudwatch-agent.deb

sudo dpkg -i -E ./amazon-cloudwatch-agent.deb
