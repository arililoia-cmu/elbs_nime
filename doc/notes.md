# gdc

## Useful locations
1. `wasm/detect` -- drum hit detection example
2. `doc` -- design notes
3. `doc/o2messages.md` - O2 message formats for client-to-server info
4. `jo2lite` -- o2lite-based message interface for Java server
5. `p5js/example/index.html` -- a p5js + Web Audio example
6. `webbit/gdcserver/` -- an Intellij project, gdc server with websockets

## Global Drum Circle

This project aims to create a distributed web-based system that enables drum circle performances across the Internet. Key features of this prototype are:
1. Browser and Web Audio implementation to simplify participation.
2. Use of multiple-beat delays (e.g. 8 beats) to mask network and software latency. Participants play along with music that has been precisely delayed.
3. Directed performances using "guide" drums to establish the tempo and implementing multiple interactions that make creative use of delay.
4. Precise timestamps and synchronization throughout to preserve drum timing nuance in the presence of network, software and audio delay.

## Planning Phase
Objective is to select languages and frameworks for an implementation. 

Concrete goal is an application that displays a circle in a square. You can drag the circle with the mouse within the square. All users see the circle move. If multiple users drag the circle at the same time, updates are processed in the order received (all updates are serialized) and the last update "wins".

### Investigate multiple backend implementation strategies:
Key requirement is maintaining at least 50 connections to drummers, directing all real-time input to a central process, and sending messages out from the central process to all drummers, all with relatively low latency. We should expect several short messages per second from each participant. Because of the deliberate delays, we can probably send out 1 measure at a time. That would be about 1kB message every 2 seconds to each of 50 participants. Overall, this is a very modest amount of processing and bandwidth, but we cannot tolerate long latencies, e.g. we should never block more than 0.1s waiting for data, a reply, or a synchronous send.

The next subtopics are placeholders to record ideas and findings...
#### Java server
See NanoHTTPD. You can run a single Java process as server. Not sure how URLs map to services or how services are implemented.

See [https://www.baeldung.com/nanohttpd](https://www.baeldung.com/nanohttpd) for a quick intro.

What I learned:
1. All requests go to a single method.
2. It seems that each request runs on a new thread, so requests are asynchronous.
3. Communication between clients should be simple since there's just one process for all services, but requires synchronization for shared data.
4. Routing requests looks simple. You can map routes (URLs) to methods by writing some simple code.
5. Websocket support seems simple too -- probably the best way to set up connections that communicate with clients (as opposed to keeping a GET request open.)

TODO: [Ari] should make a server where clients can send text messages to all other clients. 

#### Python server
What options are there? I have experience running Python CGI scripts under Apache, but not getting communication between multiple users except through a shared database, which is not suitable for this project.

What I learned:
1. It's very simple to write a server in a single Python process, but it seems to be synchronous. Maybe that's OK.
2. Python works great through CGI with Apache, but then communication must be between multiple Python interpreter instances. Seems bulky and how do we keep the processes running? How do we close them?
3. Websockets would be needed
4. Or, maybe a separate websocket server should be used: see [https://autobahn.readthedocs.io/en/latest/](https://autobahn.readthedocs.io/en/latest/).
5. I didn't find a good Python-only server+websockets solution, maybe because Python is kind of low-performance for server.

TODO: If anything, create a websocket server along the lines suggested above for Java, only serve pages from some other website.

#### node.js server
Popular. One disadvantage is that there are many libraries that are more-or-less managed independently with frequent updates and many dependencies. There are tools for satisfying dependencies, but the system is an unstable platform in the sense that it is constantly changing in (usually) small ways.

What I learned:
1. Seems easy. See [https://www.piesocket.com/blog/nodejs-websocket/](https://www.piesocket.com/blog/nodejs-websocket/) and [https://karlhadwen.medium.com/node-js-websocket-tutorial-real-time-chat-room-using-multiple-clients-44a8e26a953e](https://karlhadwen.medium.com/node-js-websocket-tutorial-real-time-chat-room-using-multiple-clients-44a8e26a953e).
2. Seems to be all single-threaded, so we might need to worry about getting blocked, but I think in Javascript, all IO essentially suspends your thread and runs others rather than blocking (e.g. there's no blocking read -- it's all done by callback). Probably this is not a problem.

TODO: If anything, create a websocket server along the lines suggested above for Java.

### Investigate multiple frontend implementation strategies:

#### Plain HTML/Javascript

My [RBD] opinion is the graphics and animation we need will be a pain in raw javascript, but I haven't done it before.

#### p5.js P5.js is a simple graphics framework based on
Processing. It gives a canvas (optionally embedded within ordinary
HTML web page) and drawing primitives, but very little support for
interacting with a backend. Maybe that's a good thing since we want a
very asynchronous frontend application.

I think we're going to spend most of our frontend time programming web
audio and graphics. There are not a lot of forms, grids, lists or
menus. I think we should start with p5.js and use it until it seems
lacking in some way.

#### React A popular framework for building web apps, but rather steep
learning curve. Roger is working with this in the Soundcool Online
project, but is still a React novice.

I think React is overly complex for this application.

#### Others?
 
See [https://backbonejs.org/](https://backbonejs.org/) but it seems
oriented to MVC and coordinating application data, server data and
DOM, which do not seem like issues for us.

## Functionality, Version 1

Let's start with a system where players can simply play together. To do so, we
need:
1. Initialization
2. Clock Synchronization
3. Tempo control and beat-setting low drums
4. Send hits to other players
5. Play hits from other players

### Initialization
The first message sent by the server is a Player ID. Players are just numbered
with integers starting with 0. The integer is used to select the player's drum 
sound so that different players have different sounds.

Players ignore incoming messages except for clock synchronization until 
synchronization is achieved.

### Clock Synchronization We can use O2 and O2lite algorithms
directly. The "reference" clock will be the server.  The "follower"
clocks will be the browsers. The time will start with the server
start.  Time will be a double-precision number that counts seconds.

Tempo will be a mapping from time to beat:
> beat = beat_offset + tempo * (time - time_offset)

This is over-parameterized: Either *beat_offset* or *time_offset*
could be eliminated, but this formulation is more intuitive: "The
*beat* increases at *tempo* beats per second starting at time
*time_offset*, where we were at beat *beat_offset*."

Playing stops when tempo is zero.

Synchronization is also needed with Web Audio time, so we will use the
Web Audio time as the local time in the browser. We just need a
function to map from global (server) time to Web Audio time as well as
Web Audio time to server time.

### Tempo Control
The conductor controls starting, stopping and tempo. We will always start at
beat 0. When tempo is changed, we make the tempo change 3s in the future to
allow for synchronization between all players. To compute the new mapping,
compute the time as now + 3. Then the beat will be
> b = beat_offset + tempo * (now + 3 - time_offset)

The new mapping is simple to compute using the equation above for *b*:
> beat_offset = b
> tempo = the new tempo
> time_offset = now + 3

Changing tempo again before the first change takes effect (e.g. for gradual
change) requires computation using *beat_offset*, *tempo*, and *time_offset*
that *will be in effect* at the time of the new tempo change.

In browsers, a low drum will be played every integer beat.

### Send Hits to Other Players
For version 0, let's allow keystrokes for testing, with the option of adding
audio hit detection. So the API will be a function 
`hit_detected(player, drum, beat, dB)` will be called to say `player` (integer)
hit this `drum` (index) on `beat` with amplitude `dB`. This information
is sent to `/gdc/hit` as a integer, integer, time, float. [see /gdc/hit for updates -RBD]

The server adds 8 to the `beat` and resends to all other players along with
a player ID so that different players can have different sounds.

### Play Hits from Other Players
Playing hits should be easy: Just schedule Web Audio sounds to play at the
right time and scale factor, selecting the sound according to the Player ID.

## Basic Interfaces

Initially, we need a *Conductor* interface and a *Player* interface.

### Conductor Interface

Initially, just Start and Stop and Tempo control and a list of players currently connected.

### Player Interface

A visual interface to show when drum hits are detected and the
Play/Stop/Tempo status.

We should have a row of drum (sounds) the player can choose from. (But
initially, sounds are assigned according to Player ID which is
assigned in order by the server.)

We could also show a circle of drums and light them up every time there is a hit.

### Audio Interface for Players

We need some drum hit detection. Initially, let's just implement a
threshold detector: When RMS exceeds an ON threshold, it's a drum
beat. Wait a minimum IOI and then wait for the signal to be below some
OFF threshold before looking for the next onset.

Later, it might be possible to classify left/right hand or two types
of hits by looking at the spectrum at the peak and using nearest
neighbor. We should experiment.

Audio output is assumed to be to headphones to prevent triggering
input hits. Each player should have a different drum sound. Players
and Conductor will load all the sounds as samples, and the drums are
scaled for amplitude and added to form the whole drum circle sound. A
little global reverb can be added.

## Drum sounds 
Every player will have the same library of drum sounds
named by integers. When a player plays a sound locally, the index of
that sound is sent to other players so they get the same sound.
Currently, the user is given the option to choose between four
different sounds (conga, low conga, high bongo, low bongo) The user
can play two variations of the sound using key presses when the chip
is selected - a lower version when the key is on the right side of the
keyboard and a higher version on when the key is on the left. The
different versions of the sound are saved as different audio files.

Taking into account that international users may be using keyboards
with different layouts, the only keys the application registers as
being on the left and right halves of the keyboard are the ones that
are consistent across ANSI, ISO and JIS standards (see here:
https://commons.wikimedia.org/wiki/File:Physical_keyboard_layouts_comparison_ANSI_ISO_JIS.png)
All unique keys labeled on these diagrams are registered as being
either on the left or right side of the keyboard - users can modify
these settings by editing js/key_positions.js.

## Client States
Clients implement a state machine to manage modes and
states. `client_state` is the current state (a string).

- "init" -- initial state, but audioContext.state is not yet "running"
  When `draw` detects audioContext.state is "running" -> "syncing"

- "syncing" -- audioContext.state is "running" but clock sync has not
  been obtained (`!o2ws_clock_synchronized`) or timemap is not set
  (`!timemap_set`) or password not entered (`!correct_password_entered`).
  When `draw` detects `o2ws_clock_synchronized` and `timemap_set` -> "ready"

- "ready" -- client has clock sync and audioContext.state is "running"
  and tempo is 0.0 (stopped).
  When `draw` detects `gdc_ensemble_bps > 0` -> "playing" and start
  metronome drumming.

- "playing" -- same conditions as "ready" except tempo > 0. Metronome
  beat is scheduled. Metronome drumming is scheduled.
  When `draw` detects `gdc_ensemble_bps == 0` -> "ready" and stop
  metronome drumming.

## Starting, Stopping, Tempo and Modes
A mode is an interaction such as free play, follow the leader, play
with audio loop, etc. Modes sometimes interact with tempo, for example,
to play with an audio loop, you need a fixed tempo. Modes and tempo
interact with starting and stopping, for example, you cannot schedule
a tempo change or mode change on a future beat or even map a desired
start time to beat if the tempo is zero. Another complication is the
possibility of race conditions where multiple conductors try to set
conflicting tempo and modes.

To manage all these problems, we use the server as a central decision
point. In general, clients make requests to the server, the server
determines a precise plan for all state changes (chaning tempo, changing
mode, starting, stopping) and communicates the plan to all clients.
When there are conflicts or invalid requests, the server simply ignores
them. In some cases, requests do not have all details, e.g., a request
to change modes will change modes at the earliest possible time, but
the time is computed by the server, which has more complete knowledge.

To simplify communicaton, the server communicates *state* rather than
*events* as much as possible. The clients use *state* to schedule and
perform *events*. Generally, clients need to observe state changes
carefully.

### Tempo State
Tempo state is `tempo_epoch`, `time_offset`, `beat_offset`, and `bps`. A
tempo change request contains the current `tempo_epoch` and the three
requested tempo parameters. If the server's `tempo_epoch` matches and the
other parameters are valid and in the future, the server increments
`tempo_epoch` and sends the change to all clients. The clients must
*schedule* the tempo change to occur at `beat_offset`. If the current
`bps` is 0, scheduling is done using `SetTimout` to install the tempo
change at `time_offset` after a real-time delay.

We use *epochs* with increasing integer IDs to avoid race conditions. Any
scheduled tempo request is sent with the current epoch ID. If, when the
tempo change request is received, the epoch ID does not match the current
epoch, the change is igored. An out-of-date epoch ID indicates that some
other tempo change request has already been processed by the server, but
was unknown to this new requestor. (Note that the server could process
"stale" requests as long as their `beat_offset`s are increasing, but
that is not obviously better than ignoring them since nearly simultaneous
tempo change requests probably indicate that two conductors are not
coordinating their control very well.)

### Mode State
Modes are described by `mode_start`, `mode_epoch`, `mode_id`, 
`cycle_beats`. Two globals contain objects with these fields 
describe mode state:
- `gdc_current_mode` describes the current mode
- `gdc_next_mode` describes the next mode
There is always a tempo change preceding a mode change in case tempo is
stopped or the mode requires a certain tempo. The order of messages
and state changes is as follows:
1. tempo change message arrives and schedules timemap change 1 beat
before the mode change
2. mode change message arrives and schedules mode change events:
    - `gdc_next_mode` is to be set 4 beats before the mode change, or
      immediately if we are within 4 beats. (Do not simply set it
      immeidately, because you might set more than a full major cycle
      early and confuse the currently running interaction.)
    - 0.5 beats before mode change, the "mode scheduler" is activated.
      This is a scheduled function that implements the mode interaction
      using temporal recursion to run every major mode cycle until the
      mode_epoch changes. It always schedules itself 0.5 beats before
      the downbeat, and it always checks `gdc_next_mode` because it
      is set to the new mode early, avoiding any race condition.
    - `gdc_mode_id` and `gdc_mode_epoch` are to be set on the downbeat
      of the mode change.
3. tempo change takes place 1 beat before the mode change
4. the mode scheduler first runs 0.5 beats before the mode change and
schedules actual events starting on the downbeat, although it may be
necessary to start audio loops slighly early, which is why the mode 
scheduler is activated 0.5 beats ahead.
5. Actual mode events start on the mode downbeat.
6. `gdc_mode_id` and `gdc_mode_epoch` are set on the mode downbeat.

### Elbs - starting
The ELBS extension to gdc involves a voting system, in which all connected
clients can vote to start a session / move into global view after an appropriate
number of other clients have connected, as well as a way to update the positions 
of clients as they appear on the global view without creating a new user info table.

In my thesis proposal, I said I would make the distances between clients 
on the global grid proportional to the RTTs of messages they sent to the server.
Both clock synchronization and global grid setup occur just as a client connects.
During clock synchronization, some jitter occurs in the progression of 
client-relative O2 time, so if O2 time is used to calculate the RTT during clocksync,
it is possible for an RTT of 0 ms to be recorded between client and server. 
Thus we use a javascript Date object to keep track of time, rather than O2. 

In the o2ws_csput_handler, the client sends an `elbs/rtttest` message to
the server, which sends back an identical `elbs/rtttest` message. The RTT
in milliseconds is recorded by the client and sent back in an `elbs/registerrtt`
message, which is used by the server to calculate global view positions after
all clients have voted to start a session.

When a new client connects, the server sends them an `/elbs/clientupdateclasses` 
message before they have entered a valid username and password, which updates 
only the number of users in each class for display in the setup view. After they
enter a valid username and password, the server sends an `/elbs/userinfo` message
to all clients, which contains all connected clients' usernames, IDs, and user types.

Once a client registers that at least one listener, performer, and 
composer have entered a valid username and password, it is given the option to
vote to start the ensemble via a button on the screen. When the button is pressed,
the client sends an `elbs/votetostart` message, which registers on the server
that the client has voted. The server sends back an `/elbs/clientvoteconfirmed` 
message, which removes the user's option to vote and tells them to wait until 
all other clients vote, or a client leaves (in which case the option to vote
does not appear until 1+ of each user type connects) and voting reopens.

When all users have voted, The server sends back an `/elbs/everyonevoted` 
message, containing the positions of each client in the global view based on 
their calculated RTTs, and the `voting_over_grid_initialized = true` state is entered 
on the client side. The positions of each client are updated separately
from the other information in the table, after the clients in the ensemble
are all confirmed.

### Starting
Starting is tricky for two reasons: There is no initial timemap and
the client may have joined a session already in progress.

At the start (when clock sync is established), the server automatically
sends `/gdc/tempo` and `/gdc/changemode` messages. A similar thing happens
when the clients are stopped and the server wants to start them in
response to a `/gdc/start` request. IMPORTANT:
The `/gdc/tempo` `beat_offset` sent by the server to start things
*must* be in the future so that we can schedule the mode change
sequence at `beat_offset` - 1.

When bps = 0, `/gdc/tempo` is handled using `SetTimeout` to delay
until `time_offset` and then set the timemap.

If the session is already in progress, let's see what happens if the
server simply sends the most recent `/gdc/tempo` and `/gdc/changemode`
messages:
- `/gdc/tempo` will set the tempo running based on some time well in
  the past.
- `/gdc/changemode` will try to schedule interactions in the past,
starting at `mode_start`.

To simplify logic in the clients, the server can send the most recent
`/gdc/tempo` message, but it will recompute the `/gdc/changemode`
message to place `mode_start` in the future. What does the client do
while waiting to enter the next major cycle of the mode? It needs an
initial "not in a mode yet" state, so we will use a mode ID of 0 for
that.

What if a newcomer is scheduled to start a mode on the next cycle, and
a new mode is requested? The new mode can be scheduled for the same
time and must take priority. To implement priority, use the
`mode_epoch` field of `gdc_next_mode`. The highest number "wins", and
note that `gdc_next_mode` is set before any mode schedulers run. Only
the scheduler with a matching mode_epoch will continue to run.


### Stopping
If `/gdc/stop` is received while the bps is non-zero, a `/gdc/timemap`
message is sent with bps=0. Then the epoch is incremented. Otherwise,
the message is ignored.

Clients receive only timemap messages with epoch IDs. They do not
receive start or stop messages, which are implied by the bps parameter.

### Mode Names and Instructions
Mode names and instructions are displayed top center. Initially,
`gdc_ensemble_mode_entered` is false to indicate initial state. Name
should show "Please wait for playing to start."  If player logs on to
a mode that has started, then as soon as the mode is known, name should
show "<name> Mode: Please wait for countdown."

When the mode takes effect, `gdc_ensemble_mode_entered` is set to true.
Name text is replaced by just the name and
instructions are set to current instructions, which can change according
to the schedule coded in `sched_free_play`, `sched_follow_the_leader` and
`sched_audio_loop`.

# Message Logging - Classes and Methods

Messages are logged in the following format:

`code | sender | time | beat | address | params`

Where `code` is a string whose characters represent different different message conditions:

`R` = message was received, `S` = mesage was sent

`A` = message was broadcast (sent to All conductors/players/both)

`C` = message was sent to at least one conductor, `P`= message was sent to at least one player

##class RecordedMessages

The `RecordedMessages` class logs messages in format using the following functions:

`marshallAndInsert()`: Logs a message with the above fields.

`writeToCsv()`: Writes all messages received so far to a .csv.

It is the responsibility of each handler to call `marshallAndInsert()` when a message is sent or received.

# Drumming Display

Experimental interface. Needs button at lower left of "normal" screen to enable.

Principle: At any horizontal location, display what the *user hears* at that time. So leader and others' drumming is actually displayed once cycle later than it was actually played. This also means everyone sees a different display.

# Drum Circle Interactions

This is from memory but I have some details written somewhere. TODO: find detailed notes.

All of these require implementation to give instructions to players and in some cases mute or unmute players to achieve the desired effects.

During the performance, there is always a "guide" drummer that plays the beat (probably just quarter notes on a low drum). This gives everyone a reference. Without a reference, if one cycle is played too fast, the players will be ahead of the intended beat at the end of the cycle. They will hear this and slow down, but then they will be too slow in the next cycle. This is too unstable to settle into a groove. The guide drums (used in ordinary drum circles too) establish the tempo and keep things from drifting apart.


## Follow the Leader
```
(Key: LXn - hear leader play pattern X from cycle n,
      PXn - hear other players play pattern X from cycle n)

Cycle Leader  Player
1     LA1              Leader plays something for player to imitate
2     LA2     LA1      Player listens to leader's A only (no other players)
3     LA3     LA2      Player plays along with leader's A only (no other players)
4     LA4,PA3 LA3,PA3  Player hears everyone's imitation and can also play along
1     LB1     LA4,PA4  Player hears everyone's imitation and can also play along
2     LB2     LB1      Player listens to leader's new pattern only
3     LB3     LB2      Player plays along with leader's B only
4     LB4,PB3 LB3,PB3  Player hears everyone's imitation and can also play along
1     LC1     LB4,PB4  Player hears everyone's imitation and can also play along
... continue with C
```

Interface requirements:
- Pattern Length (conductor only - select 4 or 8 beats)
- MODE box: Players and Leader need a big box to name the current mode. Here, it's **Follow the Leader**.
- Mode selection: Conductor only: Follow the Leader, Free Play, ...
- Instruction box: 
  - for leader: "Countdown: 4", "Countdown: 3", ..., "1st time", "2nd time", "3rd time", "4th time"
  - for player: "Listen", "Imitate", "Again", "Final"
- Start mode button: give a countdown to the start of the mode (conductor and player). For follow the leader, the countdown happens 1 cycle earlier for the leader.

Server requirements:
Server send /gdc/mode "ti" beat mode_number - 0=Free Play, 1=Follow the Leader
Server sends /gdc/cyclelen "ti" beat length - change cycle length to length on beat

Cycle offset 0 from mode start: conductor countdown; player is "Listen"
1: conductor "1st time"; player "Listen"; server forwards *only* conductor
2 + 4n: conductor "2nd time"; player "Listen"; server forwards *only* conductor
3 + 4n: conductor "3rd time"; player "Imitate"; server forwards *all* to *all*
4 + 4n: conductor "4th time"; player "Again"; server forwards *all* to *only* players
5 + 4n: conductor "1st time"; player "Final"; server forwards *only* conductor

## Play with Audio Loop

This is an experiment. It's basically free play, but with a looping audio track aligned to the beginning of each cycle. Cycles are 4 beats and tempo is fixed to match the audio.

## Play a solo

Divide circle into Rhythms and Soloists -- could be half and half.

Rhythms play along in a simple beat. Each Rhythm player hears all the other Rhythm players a cycle later. Each Rhythm player also hears one of the soloists a cycle later.

Soloists hear all the Rhythm players a cycle later and improvise a solo over the rhythm parts.

Soloists can be given a cue to finish in the next cycle. Then they become Rhythm and hear another soloist.

## Layers

Needs different drum types: small drum, medium drum, shaker, wood block, bells (cow bell, agogo, or other). That's 5 which is probably plenty.

Conductor can start/stop different drum types and give each a different pattern to play by demonstration. Not sure how best to do this, so we can experiment and test.

## Layers Revisited

With long enough cycles, you can have half the instruments go in the first half, others in the second half. E.g. with a 2 measure cycle, play small and medium drums on odd measures and shaker, wood block, bells on even measures. Groups will line up even after a one cycle delay, thus it will be coherent.

## Soft/Loud

First half of cycle is soft, second is loud -- give visual direction to get this going.  Like "Layers Revisited" a one cycle delay keeps soft/loud in alignment.

## All Stop

On cue from the conductor (with visual cues to each player), everyone stops together. The last cycle, which would normally be delayed and forwarded to other players is simply stored.

## All Start

The conductor can give a start cue. Maybe there's a metronome tap for 4 beats for players. At the start, the last recorded cycle before All Stop could be played so that it sounds like the whole group starts together. After the first cycle, everyone hears what was played the previous cycle.

## Speed Up/Slow Down
By controlling the guide drums which are algorithmically generated to give a reference pulse, tempo can change. Of course when tempo changes and players are delayed by a cycle, the times will not fall on beats. Therefore, we record times in terms of beats and rescale what was played (slightly) to align it to the ever-changing tempo.

# Hosting
Skip down to **Simple Update** to update the existing Google Cloud server and start it.

VPN at CMU does not seem to work. Here are some possible free
alternatives:

 - https://baehost.com/cart.php?a=confproduct&i=0

 - https://cloud.google.com/free/docs/gcp-free-tier/#free-tier-usage-limits

Notes on [google cloud host](https://console.cloud.google.com):

Created micro instance in Oregon

Edited "default" ingress http rule to include ports 80,8000,8080

Used network connectivity to create a test, but once it was working, I could also easily test with `python3 -m http.server`

SSH to instance using a browser pop-up SSH window available in `console.cloud.google.com` -- login is automated.

## SETUP

There is a file `/gdc/runscripts/setup_script.sh` that carries out most of this process, then echoes instructions for finishing it (cannot do all of it from shell script? TODO: figure out how to do this) - To use, download only this file from the repo, move it to the top-level directory of the virtual machine being used to set up the server, then give permissions and run: 
 - `chmod +x setup_script.sh; ./setup_script.sh` 

## Install pip, numpy, midiutil
 - `sudo apt update`
 - `sudo apt install python3 python3-dev python3-venv`
 - `sudo apt-get install wget`
 - `wget https://bootstrap.pypa.io/get-pip.py`
 - `sudo python3 get-pip.py`
 - `pip3 install midiutil`
 - `pip3 install numpy`

man.db setup time may vary based on size of instance requested.

### Upgrade
 - `sudo apt upgrade`  - why not?

### Install Java JDK.

Note: This installs from oracle, but to get maven, we
seem to need Open-JDK, so maybe we don't need oracle Java at all.
  - `cd ~; mkdir downloads`
  - ```wget --no-check-certificate -c --header "Cookie: oraclelicense=accept-securebackup-cookie" https://download.oracle.com/java/18/latest/jdk-18.0.2_linux-x64_bin.tar.gz```
  - `mv jdk-18.0.2_linux-x64_bin.tar.gz downloads`
  - `sudo mkdir /usr/lib/jvm`
  - `cd /usr/lib/jvm`
  - `sudo tar -xvzf ~/downloads/jdk-18.0.2_linux-x64_bin.tar.gz`

  - `sudo nano /etc/environment` and add `:/usr/lib/jvm/jdk-18.0.2/bin` to the PATH
  
  alternatively, because nano is not installed on Google Cloud VMs by default,
  do `sudo vi` or do this in one line with vi from the command line: 
  - `sudo vi -c "normal GoPATH=:/usr/lib/jvm/jdk-18.0.2/bin" -c ":1d" -c "wq" "/etc/environment"`

  - `sudo update-alternatives --install "/usr/bin/java" "java" "/usr/lib/jvm/jdk-18.0.2/bin/java" 0`
  - `sudo update-alternatives --install "/usr/bin/javac" "javac" "/usr/lib/jvm/jdk-18.0.2/bin/javac" 0`
  - `sudo update-alternatives --set java /usr/lib/jvm/jdk-18.0.2/bin/java`
  - `sudo update-alternatives --set javac /usr/lib/jvm/jdk-18.0.2/bin/javac`
  - Check: `update-alternatives --list java`
  - Check: `update-alternatives --list javac`
  - `java -version`

### Install Maven:
  - `sudo apt-get update`
  - `MVN=3.8.8`
  - `wget https://downloads.apache.org/maven/maven-3/$MVN/binaries/apache-maven-$MVN-bin.tar.gz -P /tmp`
  - `sudo tar xf /tmp/apache-maven-$MVN-bin.tar.gz -C /opt`
  - `sudo rm /tmp/apache-maven-$MVN-bin.tar.gz`
  - `sudo ln -s /opt/apache-maven-$MVN /opt/maven`

  - `sudo nano /etc/profile.d/maven.sh` to contain
```
export JAVA_HOME=/usr/lib/jvm/jdk-18.0.2
export M2_HOME=/opt/maven
export MAVEN_HOME=/opt/maven
export PATH=$M2_HOME/bin:$PATH
```
  or: open the file with `sudo vi` and edit, or invoke vi from the command line: 
  - `sudo vi -c "normal Goexport JAVA_HOME=/usr/lib/jvm/jdk-18.0.2" -c "normal Goexport M2_HOME=/opt/maven" -c "normal Goexport MAVEN_HOME=/opt/maven" -c "normal Goexport PATH=\$M2_HOME/bin:\$PATH" -c ":1d" -c "wq" "/etc/profile.d/maven.sh"`

  - `sudo chown <your username> /etc/profile.d/maven.sh`
  - `sudo chmod +x /etc/profile.d/maven.sh`
  - `source /etc/profile.d/maven.sh`
  - `mvn -v`

### Install gdc:
  - `sudo apt install unzip`
  - `cd ~; mkdir gdc; cd gdc`
  - get zip file from github, copy to public place, scp from there
    into cloud server
  - `unzip gdc-main.zip`
  - `cp -Rp gdc-main/* gdc-main/.gitignore .`
  - `rm -rf gdc-main`

### Install netty jar file:
  - `cd ~/gdc/webbit/gdcserver`
  - `mkdir target`
  - `wget https://repo1.maven.org/maven2/io/netty/netty/3.6.5.Final/netty-3.6.5.Final.jar`

### Build gdc server:
These instructions end up with OpenJDK version 11 installed, but our gdcserver target version and source version are 16. I don't know why this works in IntelliJ, but I did not get it to work without changing versions:
  - `cd ~/gdc/webbit/gdcserver`

  - `nano pom.xml` and replace target and source versions with `11`. Save and exit.
  or: open the file with `sudo vi` and edit, or invoke vi from the command line: 
  - `vi -c ":%s/<maven.compiler.source>16/<maven.compiler.source>11/g" -c ":%s/<maven.compiler.target>16/<maven.compiler.target>11/g" -c "wq" pom.xml` 

  - `mvn package`

### Create password file (still in gdcserver)
  - `mkdir -p src/main/resources`
  - `nano src/main/resources/adminPassword.txt
  - put password on one line, end with newline, ctrl-O RETURN to save, ctrl-x to exit
  - `mkdir logs`

### Run the server:
`java -cp target/gdcserver-1.0-SNAPSHOT.jar:../../../.m2/repository/io/netty/netty/3.6.5.Final/netty-3.6.5.Final.jar Gdc`

The address is allocated from google under the name "gdc-google-cloud" and assigned to the server, which is

http://35.212.147.100:8080/player or http://35.212.147.100:8080/conductor

now available as:

http://bit.ly/globaldrumcircle

### Get the logs
Use `35.212.147.100:8080/logs?pw=XXX` where XXX is the conductor (admin) password.

Click on .csv files to download.


