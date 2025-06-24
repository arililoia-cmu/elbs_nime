# Exploiting Latency In The Design Of A Networked Music Performance System For Percussive Collective Improvisation

## Setup 

Notes on [google cloud host](https://console.cloud.google.com):

Create micro instance

Edit "default" ingress http rule to include ports 80,8000,8080

SSH to instance using a browser pop-up SSH window available in `console.cloud.google.com` -- login is automated.

## Installation on Virtual Machine

Easiest method: Download repository as .zip and upload to Google Drive. 

Download runscripts/setup_script.sh, SSH to virtual machine, and move setup_script.sh into the home directory of the VM. 

OR - copy and paste the content of runscripts/setup_script.sh into a new file on the VM

On the command line, enter:  

chmod +x setup_script.sh

./setup_script.sh

Follow onscreen instructions - this process takes a while to complete, you'll have to select Y when prompted Y/n twice




