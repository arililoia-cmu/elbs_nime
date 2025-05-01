# O2 messages

These messages run over Web Sockets between server and clients (browsers):

`/gdc/hit "iiitf" id mode_epoch drum beat amplitude` - when received 
by a client, play the drum sound at the given beat if it is 
appropriate to do so based on the step of the mode and whether or not 
this came from a conductor or player. When received by the server, 
increment the beat value by the cycle period and send a copy of the 
message to every *other* client. The cycle period depends on the 
interaction but it is typically 4 or 8 and represents the number of 
beats in each cycle or pattern. `id` is the player id, which 
corresponds to IDs in `/gdc/userinfo`. `mode_epoch` is the mode epoch 
in which the hit was made. When it is time to play a hit, the hit is 
ignored if the epoch has changed.  (This is to prevent hits at the end 
of a mode from being handled later in a new mode. If the tempo stops, 
there could be a substantial delay.)  The `drum` is twice the drum 
index plus 0 or 1 for left or right. Each drum index refers to a pair 
of drums. `beat` is the exact beat time (a float) to play the drum, 
and `amplitude` is a linear scale factor (currently always 1). 

`/gdc/mix "itfff" id when others mydrum beat` - sent when connected 
and then each time there is a change to the mixer settings. Message 
is sent 1 sec after adjusting is stopped. `time` is the real time 
when the mixer was last changed. (Message is sent at `time` + 1.) 
The purpose of the message is just to add information to the log. 

`/gdc/timemap "ittd" epoch time beat bps` - is sent to clients to 
change tempo. If the client current bps is zero, 
the timemap takes effect at the given time; otherwise, it takes place 
at the given tempo. 

The following 3 messages are sent from conductors to server and are 
ignored unless certain conditions are true, including the sender's 
`admin` flag must be set and the epoch must match the current 
epoch. All should be sent 3 seconds ahead of time so the other clients 
can be informed ahead of the change taking place. 

`/gdc/timemap "ittd" epoch time beat bps` - is sent to the server to 
change tempo. 

`/gdc/start "ittd" epoch time beat bps` - is sent to the server to 
start playing in a new epoch at the given time, beat and bps. 

`/gdc/stop "it" epoch beat` - is sent to the server to stop playing 
the given epoch at the given beat. 

`/gdc/infoentered "ssi" password username admin` -- sent by client to server 
to confirm validity of username and password. `admin` is 1 if this is 
an admin login, and 0 if this is a regular client login. 

`/gdc/infoentered "ii" is_password_correct is_username_valid` -- sent by server 
to client to verify correctness of entered username and password. 

`/gdc/userinfo "sss" usernames IDs admin_statuses ` -- sent by server 
to conductors. Arguments (all are strings) are the usernames, IDs and 
admin_statuses ("0" or "1") of all clients connected to the server. 
Individual values in the strings are separated by "." characters. 

`/gdc/chat "s" message ` -- sent by client when a message is entered and fanned 
out to all clients, including the sender, by the server. 

`/gdc/changemode "tiii" start epoch ID cycle_beats` - when received 
by the server, `epoch` is the current epoch of the client.  The server 
first checks to see if the `epoch` matches the server's epoch number 
(if not, ignore this message, which was preempted by another 
`/gdc/changemode` message). Next, ignoring `start`, a safe mode 
`start` beat is computed, allowing for `MAX_NET_DELAY` (in the server, 
this is the maximum one-way time to clients, currently set to 1.5s), 
and rounding up to the next cycle. The mode change message with this 
computed start beat and an incremented `epoch` is sent to all 
clients. When received by a client, the client will schedule the 
sequence of events which are specific to the mode to start at 
`start`, and the dropdown menu / stop button will be 
removed. Note that to allow for audio latency, the schedulers for 
modes, e.g., `sched_audio_loop` in `gdcmodes.js` are invoked 0.5 beats 
early, but with the `cycle_start_beat` parameter set to the actual 
whole number beat. See "Starting, Stopping, Tempo and Modes" below 
for more detail. 

`/gdc/adminstatusmessage` "s" message` -- send a message to admins. 
There may be no admins, in which case no message is sent, but it is 
logged anyway. Messages are: 
- "Client <n> has joined the ensemble"
- "Client <n> has left the ensemble"
- "No more clients" (This message gets logged but there is no receiver.) 

### Pseudo Messages for Log Files 

`/gdc/connect "


