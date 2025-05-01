# gdcserver

This is an Intellij project to build a webserver with websocket
support.

You need to put a password in src/main/resources/adminPassword.txt --
this file is not in the repo for obvious reasons. This is the password
requested by the conductor interface and required to run the conductor.

Make sure to configure the run command to start in this gdcserver
directory. (The server will expect to find the static website in the
web subdirectory.  "web" is wired into the code.)

After starting Gdc.main, visit http://localhost:8080/player and/or
http://localhost:8080/conductor (Note: "8080" is wired in the code.)

