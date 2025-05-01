// GdcWebSockets.java -- implement GDC server interface using O2lite protocol
//     over websockets
// Ari Liloia and Roger B. Dannenberg; based on HelloWebSockets.java example
//     code from Webbit server
// July 2022

import org.webbitserver.BaseWebSocketHandler;
import org.webbitserver.WebSocketConnection;

import java.io.*;
import java.net.URL;
import java.nio.file.*;

import java.util.*;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;


enum SetupState{INIT, VOTED, VALIDATED, LATE}

enum SessionState{SETUP, ACTIVE, GENERATINGMIDIS, COMPLETE}


public class GdcWebSockets extends BaseWebSocketHandler {

    public final int COMPOSER = 1;
    public final int LISTENER = 2;
    public final int PERFORMER = 3;

    public GridState gridState;

    public final int BIJECTION_VALUE = 10000;

    public final double H_VAL = 4.0;


    // IDCounter counts the number of connections that have been made
    // during the server's lifetime - the number of active connections
    // can be found with connectionsMap.size()
    private int IDCounter;
    private final String serverChatName = "Server";
    // map connection to ID, clockSynchronized, anyMessagesReceived,
    //     and adminStatus;

    private final String ensembleName = "gdc";
    public double MAX_NET_DELAY = 2.4;  // max delay to clients in seconds

//    private RecordedMessages recMessages;
    private RecordedComposition recComposition;

    private SessionState sessionState;

    class Times {
        private double time, beat;

        public Times(double time, double beat) {
            this.time = time;
            this.beat = beat;
        }

        public double getTime() {
            return time;
        }

        public double getBeat() {
            return beat;
        }
    }

    // handlersMap maps addresses to handlers
    private Map<String, O2liteWsMessageHandler> handlersMap;

    public GdcWebSockets() {

        IDCounter = 0;
        Gdc.connectionsMap = new HashMap<WebSocketConnection, ConnectionInfo>();
        handlersMap = new HashMap<String, O2liteWsMessageHandler>();
        recComposition = new RecordedComposition(100000);
        sessionState = SessionState.SETUP;
        gridState = new GridState(16, 10000);

        //register handlers
        registerHandler("_o2/ws/cs/get", new O2ws_cs_get_handler("is"));
        registerHandler("_o2/ws/dy", new O2ws_dy_handler("s"));
        registerHandler("_o2/ws/cs/cs", new O2ws_cs_cs_handler(""));
        registerHandler("gdc/timemap", new O2gdc_timemap_handler("ittd"));
        registerHandler("gdc/start", new O2gdc_start_handler("ittd"));
        registerHandler("gdc/stop", new O2gdc_stop_handler("it"));
        registerHandler("gdc/chat", new O2gdc_chat_handler("s"));
        registerHandler("gdc/infoentered", new O2gdc_infoentered_handler("ssi"));
        registerHandler("elbs/registertt", new O2elbs_registertt_handler("d"));
        registerHandler("elbs/votetostart", new O2elbs_votetostart_handler(""));
        registerHandler("elbs/rtttest", new O2elbs_rtttest_handler("i"));
        registerHandler("elbs/newdc", new O2elbs_newdc_handler("ssi"));
        registerHandler("elbs/removedc", new O2elbs_removedc_handler("i"));
        registerHandler("elbs/chit", new O2elbs_composer_hit_handler("iit"));
        registerHandler("elbs/phit", new O2elbs_performer_hit_handler("iit"));
        registerHandler("elbs/changelistenerpos", new O2elbs_changelistenerpos_handler("iiit"));

        String logsDirectoryPath = "logs";
        Path path = Paths.get(logsDirectoryPath);
        if (Files.exists(path) && Files.isDirectory(path)) {
            System.out.println("Logs directory already exists.");
        } else {
            // Create the directory
            try {
                Files.createDirectories(path);
                System.out.println("Logs Directory created successfully.");
            } catch (IOException e) {
                System.err.println("Error creating Logs directory: " + e.getMessage());
            }
        }

        String midiFilesDirectoryPath = "web/midifiles";
        Path path2 = Paths.get(midiFilesDirectoryPath);
        if (Files.exists(path2) && Files.isDirectory(path2)) {
            System.out.println("midifiles Directory already exists.");
        } else {
            // Create the directory
            try {
                Files.createDirectories(path2);
                System.out.println("midifiles Directory created successfully.");
            } catch (IOException e) {
                System.err.println("Error creating midifiles directory: " + e.getMessage());
            }
        }

        // delete midis and csvs to make sure we have nothing to start
        deleteMidisAndCSVsFromDirectory("web/composer");
        deleteMidisAndCSVsFromDirectory("web/performer");
        deleteMidisAndCSVsFromDirectory("web/listener");
        deleteMidisAndCSVsFromDirectory("logs");
        deleteMidisAndCSVsFromDirectory("web/midifiles");
    }

    private void deleteMidisAndCSVsFromDirectory(String directory){
        Path dir = Paths.get(directory);
        try{
            // "*.{csv, mid}" did not work?
            DirectoryStream<Path> stream = java.nio.file.Files.newDirectoryStream(dir, "*.csv");
            for (Path entry : stream) {
                Files.delete(entry);
                System.out.println("Deleted .csv file: " + entry.getFileName());
            }
            DirectoryStream<Path> stream2 = java.nio.file.Files.newDirectoryStream(dir, "*.mid");
            for (Path entry : stream2) {
                Files.delete(entry);
                System.out.println("Deleted .mid file: " + entry.getFileName());
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    private void registerHandler(String address,
                                 O2liteWsMessageHandler handler) {
        handlersMap.put(address, handler);
    }

    // when a new client connects, assign them a role


    // send a message to all clients; only admins if flag is set
    public void sendToClients(O2liteWsMsg msg, WebSocketConnection exclude) {
        String wsmsg = msg.getMessage();

        for (Map.Entry<WebSocketConnection, ConnectionInfo> entry :
                Gdc.connectionsMap.entrySet()) {
            WebSocketConnection client_conn = entry.getKey();
            // if the client is an admin and not to be excluded:
            if (client_conn != exclude) {
                // send the message to the client
                client_conn.send(wsmsg);
            }
        }
    }


    public void sendTimemapToClients() {
        // send timemap message
        O2liteWsMsg timemap_message = new O2liteWsMsg();
        timemap_message.sendStart("/gdc/timemap", 0.0, "ittd", true);
        timemap_message.addInt32(Gdc.tempoEpoch);
        timemap_message.addTime(Gdc.timeOffset);
        timemap_message.addTime(Gdc.beatOffset);
        timemap_message.addDouble(Gdc.bps);

        System.out.println("timemap: TempoEpoch = " + Gdc.tempoEpoch
                + " TimeOffset = " + Gdc.timeOffset +
                " BeatOffset = " + Gdc.beatOffset +
                " Bps = " + Gdc.bps);
        sendToClients(timemap_message, null);

    }


    public Times calcStartBeat() {
        // figure out beat that is MAX_NET_DELAY in the future,
        // round up to a cycle boundary. Return time and beat.
        // If bps is 0, time is the earliest time based on MAX_NET_DELAY.
        double now = Gdc.getTimeSinceStart();
        double earliestTime = now + MAX_NET_DELAY;
        // if Gdc.timeOffset is greater than now, then a tempo change is
        // going to happen in the future, which complicates things.
        // First, see if the tempo change time is more than MAX_NET_DELAY:
        if (Gdc.timeOffset > earliestTime) {   // Waiting until tempo change
            earliestTime = Gdc.timeOffset;     // is long enough.
        }
        // now, earliestTime happens at or after tempo change time, so
        // it is valid to compute earliestBeat using the time map:
        double earliestBeat = Gdc.beatOffset +
                (earliestTime - Gdc.timeOffset) * Gdc.bps;
        System.out.println("calc: now " + now + " earliestTime " +
                earliestTime + " earliestBeat " + earliestBeat);
        // add 2 to earliestBeat to allow scheduling things 1 beat ahead
        earliestBeat += 2.0;
        // now map from beat back to time if there is a positive tempo
        if (Gdc.bps > 0) {
            earliestTime = Gdc.timeOffset +
                    (earliestBeat - Gdc.beatOffset) / Gdc.bps;
        }
        System.out.println("  final bps " + Gdc.bps + " time " + earliestTime +
                " beat " + earliestBeat);
        return new Times(earliestTime, earliestBeat);
    }


    // get the user types and send to all clients
    public O2liteWsMsg buildUsersTypesMessage() {

        // TODO: remove repeated code here - put this into its own function
        // TODO: that returns an array instead of duplicating it in another fn.
        int num_composers = 0;
        int num_listeners = 0;
        int num_performers = 0;

        for (Map.Entry<WebSocketConnection, ConnectionInfo> entry :
                Gdc.connectionsMap.entrySet()) {
            int client_type = entry.getValue().getUserType();
            // if the client is an admin and not to be excluded:
            if (client_type == COMPOSER) {
                num_composers += 1;
            }
            if (client_type == LISTENER) {
                num_listeners += 1;
            }
            if (client_type == PERFORMER) {
                num_performers += 1;
            }
        }

        O2liteWsMsg updateensembletypes_message = new O2liteWsMsg();
        updateensembletypes_message.sendStart("/elbs/clientupdateclasses", 0.0, "iii", true);
        updateensembletypes_message.addInt32(num_composers);
        updateensembletypes_message.addInt32(num_listeners);
        updateensembletypes_message.addInt32(num_performers);
        return updateensembletypes_message;
    }


    public void onOpen(WebSocketConnection connection) {

        Gdc.connectionsMap.put(connection, new ConnectionInfo(IDCounter));
        IDCounter++;

        // send message with all the currently connected types
        // so we have something to display
        connection.send(buildUsersTypesMessage().getMessage());

        O2liteWsMsg chatMessage = new O2liteWsMsg();
        chatMessage.sendStart("/gdc/chat", 0.0, "ss", true);
        chatMessage.addString(serverChatName);
        chatMessage.addString("Once one of each user type has entered a valid username and " +
                "password, the confirmed users can vote to start.");
        connection.send(chatMessage.getMessage());

    }
    
    public void generateMidis(int error_code){

        sessionState = SessionState.GENERATINGMIDIS;

        O2liteWsMsg midisGeneratingMsg = new O2liteWsMsg();
        midisGeneratingMsg.sendStart("/elbs/midisgenerating", 0.0, "i", true);
        midisGeneratingMsg.addInt32(error_code);
        sendToClients(midisGeneratingMsg, null);

        File log = new File("logs/log0.csv");
        if (log.exists()) {
            System.out.println("logs/log0.csv exists.");
        } else {
            System.out.println("logs/log0.csv does not exist.");
        }


        try {

            String midiScriptPath = "python/generatemidis.py";
            String command = "python3 " + midiScriptPath;
            Process process = Runtime.getRuntime().exec(command);

            // Read the output of the Python script
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            String line;
            while ((line = reader.readLine()) != null) {
                System.out.println(line);
            }

            // Wait for the process to complete
            int exitCode = process.waitFor();
            System.out.println("Python script execution completed with exit code: " + exitCode);

            // get the files in the directory
            File directory = new File("web/midifiles");
            StringBuilder midi_file_names = new StringBuilder();
            // if directory exists (it should)
            if (directory.isDirectory()) {
                // Get the list of files in the directory
                File[] files = directory.listFiles();

                // Check if files are present in the directory
                if (files != null) {
                    // Print the names of all files in the directory
                    for (File file : files) {
                        if (file.getName().startsWith("listener")){
                            System.out.println(file.getName());
                            midi_file_names.append(file.getName()).append(",");
                        }
                    }

                    O2liteWsMsg midisReadyMsg = new O2liteWsMsg();
                    midisReadyMsg.sendStart("/elbs/midisready", 0.0, "s", true);
                    midisReadyMsg.addString(midi_file_names.toString());
                    sendToClients(midisReadyMsg, null);

                    sessionState = SessionState.COMPLETE;

                } else {
                    System.out.println("no files in dir ");

                }
            } else {
                System.out.println("directory DNE");

            }

        } catch (IOException | InterruptedException e) {
            e.printStackTrace();
            System.out.println("oops");

        }

    }


    public void onClose(WebSocketConnection connection) {
        Gdc.connectionsMap.remove(connection);
        // when no clients are connected to the server (session state
        // is irrelevant now)
        if (Gdc.connectionsMap.size() == 0) {
            // reset the bps, beat offset, time offset
            Gdc.bps = 0.0;
            Gdc.beatOffset = 0;
            Gdc.timeOffset = 0.0;
            Gdc.tempoEpoch = 0;
            IDCounter = 0;

            // record everything we've kept track of so far
            recComposition = new RecordedComposition(100000);
            sessionState = SessionState.SETUP;
            gridState = new GridState(16, 10000);

            // delete midis and csvs to make sure we have nothing to start
            // and to make sure we don't send back lots of midi files by accident
            // if we all reconnect instead of recompiling the server
            deleteMidisAndCSVsFromDirectory("web/composer");
            deleteMidisAndCSVsFromDirectory("web/performer");
            deleteMidisAndCSVsFromDirectory("web/listener");
            deleteMidisAndCSVsFromDirectory("logs");
            deleteMidisAndCSVsFromDirectory("web/midifiles");

        } else {

            // if someone disconnects during setup
            // reset voting
            if (sessionState == SessionState.SETUP){
                // set all clients having voted to false
                for (Map.Entry<WebSocketConnection, ConnectionInfo> entry :
                        Gdc.connectionsMap.entrySet()) {
                    ConnectionInfo conn = entry.getValue();
//                conn.setVotedToStart(false);
                    if (conn.getSetupState() == SetupState.VOTED){
                        conn.setSetupState(SetupState.VALIDATED);
                    }
                }
                O2liteWsMsg resetVoteMessage = new O2liteWsMsg();
                resetVoteMessage.sendStart("/elbs/clientvoteconfirmed", 0.0, "i", true);
                resetVoteMessage.addInt32(0);
                // tell all clients to reset their votes
                sendToClients(resetVoteMessage, null);
                // we are still in the setup state so we only
                // need to send information about the clients connected
                O2liteWsMsg ensembleTypesMessage = buildUsersTypesMessage();
                sendToClients(ensembleTypesMessage, null);

            }

            // if a user leaves while the session is happening
            // tell everyone that the session has been interrupted
            // and total quit has been forced.
            else if (sessionState == SessionState.ACTIVE){
                // keep track of session state on server
                sessionState = SessionState.COMPLETE;

                Gdc.tempoEpoch += 1;
                Gdc.timeOffset = Gdc.getTimeSinceStart() + MAX_NET_DELAY;
                Gdc.beatOffset = sched_time_to_beat(Gdc.timeOffset);
                Gdc.bps = 0.0;
                sendTimemapToClients(); // client ignores timestamp

                // send message to clients that interruption has happened
                O2liteWsMsg sessionInterruptedMsg = new O2liteWsMsg();
                sessionInterruptedMsg.sendStart("/elbs/sessioninterrupt", 0.0, "", true);
                sendToClients(sessionInterruptedMsg, null);
                // write finish to CSV
                recComposition.logFinish(Gdc.beatOffset);
                recComposition.writeToCsv();

                // generate all the midis
                generateMidis(1);

            }

        }
    }


    // handle a WebSocket message: interpret all msgs using O2lite protocol
    public void onMessage(WebSocketConnection connection, String message) {

        // first check to see if the thing is still in the connections map
        // now that we are taking things out of the map if they don't enter a
        // password in time before people start
        if (!Gdc.connectionsMap.containsKey(connection)){
            return;
        }

        O2liteWsMsg msg = new O2liteWsMsg();
        msg.extractStart(message);
        // look for the substring of the address that begins after the
        // first character in the map in the case of o2_cs_get it
        // could be ! or / if the clock is not synced and the
        // timestamp > 0 we discard to message otherwise we're good

        try{
            if (!((!Gdc.connectionsMap.get(connection).getClockSynchronized()) &&
                    (msg.timestamp > 0))) {
                O2liteWsMessageHandler msg_handler =
                        handlersMap.get((msg.address).substring(1));
//            System.out.println("msg.address: " + msg.address);
                msg_handler.verifyTypestring(msg);
                msg_handler.handle(msg, connection);
            }
        }catch(StringIndexOutOfBoundsException e){
            System.out.println("NOP Message Received");
        }

    }

    class O2elbs_changelistenerpos_handler extends O2liteWsMessageHandler{
        public O2elbs_changelistenerpos_handler(String typestring_) {
            super(typestring_);
        }

        @Override
        public void handle(O2liteWsMsg message,
                           WebSocketConnection connection) {

            // do not move listener if we are stopped
            if (Gdc.bps <= 0.0){
//                O2liteWsMsg chatMessage = new O2liteWsMsg();
//                chatMessage.sendStart("/gdc/chat", 0.0, "ss", true);
//                chatMessage.addString(serverChatName);
//                chatMessage.addString("Cannot move listener while ensemble is stopped.");
//                connection.send(chatMessage.getMessage());
//                return;
                  O2liteWsMsg badListenerMoveMessage = new O2liteWsMsg();
                  badListenerMoveMessage.sendStart("/elbs/blmm", 0.0, "s", true);
                  badListenerMoveMessage.addString("Cannot move listener while ensemble is stopped.");
                  connection.send(badListenerMoveMessage.getMessage());
                  return;
            }

            int listener_ID = message.getInt32();
            int nl_xgc = message.getInt32();
            int nl_ygc = message.getInt32();
            double sent_beat = message.getTime();

            Set<Integer> allBijections = new HashSet<>();
            for (Set<Integer> currentBijections : gridState.occupiedCoordsBijections.values()) {
                allBijections.addAll(currentBijections);
            }
            int listener_bijection = (nl_xgc*BIJECTION_VALUE)+nl_ygc;
            if (allBijections.contains(listener_bijection)){

                  O2liteWsMsg badListenerMoveMessage = new O2liteWsMsg();
                  badListenerMoveMessage.sendStart("/elbs/blmm", 0.0, "s", true);
                  badListenerMoveMessage.addString("There is already an element in this position.");
                  connection.send(badListenerMoveMessage.getMessage());
                  return;
            }

            // get the new and old grid coordinates
            GridCoordinate new_gc = new GridCoordinate(nl_xgc, nl_ygc);
            GridCoordinate old_gc = Gdc.connectionsMap.get(connection).getGridCoordinate();

            // replace the listener position in the occupied coords bijection set
            Set<Integer> listener_bijection_set = Set.of(listener_bijection);
            gridState.occupiedCoordsBijections.put(listener_ID, listener_bijection_set);

            // initialize the time of the latest beat at which we should play
            //double latest_restart_beat = sched_time_to_beat(sched_beat_to_time(sent_beat) + MAX_NET_DELAY);
            double latest_restart_beat = sent_beat + 4.0;

            // change the listener position in the hashmap
            // generate new downstreamusersdistances map for all performers
            // while we check to see what the restart beat should be
            // based on the max possible time it could be played
            for (Map.Entry<WebSocketConnection, ConnectionInfo> e : Gdc.connectionsMap.entrySet()) {
                // if we run into a listener
                if ((e.getValue().getUserType() == LISTENER) && (e.getValue().getID() == listener_ID)){
                    e.getValue().setGridCoordinate(new_gc);
                }

                // if we run into a performer
                else if (e.getValue().getUserType() == PERFORMER){
                    // get the performer grid coordinate
                    ConnectionInfo p_conninfo = e.getValue();
                    GridCoordinate p_gc = p_conninfo.getGridCoordinate();

                    // calculate manhattan distance between new and old
                    // listener coordinates, get the maximum
                    int new_mhd = calculate_manhattan_distance(p_gc, new_gc);
                    int old_mhd = calculate_manhattan_distance(p_gc, old_gc);

                    double plus_mhd =  sent_beat + Math.max(new_mhd, old_mhd);
                    latest_restart_beat = Math.max(latest_restart_beat, plus_mhd);

                    p_conninfo.setDownstreamUsersDistancesMap(listener_ID, new_mhd);

                }

            }

            System.out.println("sent_beat: " + sent_beat);
            System.out.println("latest_restart_beat: " + latest_restart_beat);

            // send new listener info to all connected clients
            O2liteWsMsg lpChangedMsg = new O2liteWsMsg();
            lpChangedMsg.sendStart("/elbs/listenerposchanged", 0.0, "iiit", true);
            lpChangedMsg.addInt32(listener_ID);
            lpChangedMsg.addInt32(nl_xgc);
            lpChangedMsg.addInt32(nl_ygc);
            lpChangedMsg.addTime(latest_restart_beat);
            sendToClients(lpChangedMsg, null);

            // log the moved listener
            recComposition.logListenerMove(listener_ID, sent_beat, latest_restart_beat);
            // log the new downstream user distance map
            for (Map.Entry<WebSocketConnection, ConnectionInfo> p_entry : Gdc.connectionsMap.entrySet()) {
                if (p_entry.getValue().getUserType() == PERFORMER) {
                    recComposition.logDownstreamListenerDistanceMap(p_entry.getValue().getID(), p_entry.getValue().getDownstreamUsersDistancesMap());
                }
            }

        }
    }


    public void generateGlobalViewDistancesFromRTTs() {

        System.out.println("Generating global view distances from RTTs.");

        HashMap<org.webbitserver.WebSocketConnection, GridCoordinate> generatedCoords =
                gridState.generateGridCoords(Gdc.connectionsMap);
        for (Map.Entry<WebSocketConnection, GridCoordinate> nc_entry :
                generatedCoords.entrySet()) {

            WebSocketConnection conn = nc_entry.getKey();
            GridCoordinate gc = nc_entry.getValue();
            Gdc.connectionsMap.get(conn).setGridCoordinate(gc);
        }

        // check to see if grid coords have been successfully set
        for (Map.Entry<WebSocketConnection, ConnectionInfo> wc_entry :
                Gdc.connectionsMap.entrySet()) {
            ConnectionInfo ci = wc_entry.getValue();
            System.out.println(ci.getID() + ": " + ci.getGridCoordinate().x + ", " + ci.getGridCoordinate().y);
        }

        // generate strings to send back to users
        StringBuilder IDsString = new StringBuilder();
        StringBuilder globalXCoordString = new StringBuilder();
        StringBuilder globalYCoordString = new StringBuilder();
        StringBuilder usernamesString = new StringBuilder();
        StringBuilder userTypesString = new StringBuilder();

        for (Map.Entry<WebSocketConnection, ConnectionInfo> entry :
                Gdc.connectionsMap.entrySet()) {
            IDsString.append(entry.getValue().getID()).append(".");

            int xgc = entry.getValue().getGridCoordinate().x;
            int ygc = entry.getValue().getGridCoordinate().y;
            globalXCoordString.append(xgc).append(".");
            globalYCoordString.append(ygc).append(".");

            usernamesString.append(entry.getValue().getUsername()).append(".");

            if (entry.getValue().getUserType() == COMPOSER){
                userTypesString.append("1.");
            }
            else if (entry.getValue().getUserType() == LISTENER){
                userTypesString.append("2.");
            }
            else if (entry.getValue().getUserType() == PERFORMER){
                userTypesString.append("3.");
            }

            Set<Integer> userPositionBijection = Set.of((xgc * BIJECTION_VALUE) + ygc);
            gridState.occupiedCoordsBijections.put(entry.getValue().getID(), userPositionBijection);
        }

        // caching info in downstreamusersdistancesmaps
        for (Map.Entry<WebSocketConnection, ConnectionInfo> p_entry : Gdc.connectionsMap.entrySet()) {
            if (p_entry.getValue().getUserType() == PERFORMER) {
                ConnectionInfo p_conninfo = p_entry.getValue();
                GridCoordinate p_gc = p_conninfo.getGridCoordinate();
                for (Map.Entry<WebSocketConnection, ConnectionInfo> o_entry : Gdc.connectionsMap.entrySet()) {
                    if (o_entry.getValue().getUserType() == LISTENER) {
                        ConnectionInfo l_conninfo = o_entry.getValue();
                        GridCoordinate l_gc = l_conninfo.getGridCoordinate();
                        int l_mhd = calculate_manhattan_distance(p_gc, l_gc);
                        p_conninfo.addDownstreamUserDistance(l_conninfo.getID(), l_mhd);
                    }
                    else if (o_entry.getValue().getUserType() == COMPOSER){
                        ConnectionInfo c_conninfo = o_entry.getValue();
                        GridCoordinate c_gc = c_conninfo.getGridCoordinate();
                        int p_mhd = calculate_manhattan_distance(p_gc, c_gc);
                        if (p_mhd < p_conninfo.getMinUpstreamUserDistance()) {
                            p_conninfo.setMinUpstreamUserDistance(p_mhd);
                        }
                    }
                }
                // send back the min upstream composer distance
                O2liteWsMsg minUpstreamComposerMsg = new O2liteWsMsg();
                minUpstreamComposerMsg.sendStart("/elbs/mcdist", 0.0, "i", true);
                minUpstreamComposerMsg.addInt32(p_conninfo.getMinUpstreamUserDistance());
                p_entry.getKey().send(minUpstreamComposerMsg.getMessage());
            }
        }

        // add all the downstream user distances
        // and while we're at it let's get the max RTT
        double max_tt = -1.0;
        for (Map.Entry<WebSocketConnection, ConnectionInfo> p_entry : Gdc.connectionsMap.entrySet()) {
            if (p_entry.getValue().getTT() > max_tt){
                max_tt = p_entry.getValue().getTT();
            }
            if (p_entry.getValue().getUserType() == PERFORMER) {
                recComposition.logDownstreamListenerDistanceMap(p_entry.getValue().getID(), p_entry.getValue().getDownstreamUsersDistancesMap());
            }
        }

        System.out.println("max tt: " + max_tt);

        broadcastChatMessage(serverChatName, "Everyone has voted to confirm. A composer can " +
                "now click start to begin the composition.", null);

        O2liteWsMsg everyoneVotedMessage = new O2liteWsMsg();
        everyoneVotedMessage.sendStart("/elbs/everyonevoted", 0.0, "sssss", true);
        everyoneVotedMessage.addString(IDsString.toString());
        everyoneVotedMessage.addString(globalXCoordString.toString());
        everyoneVotedMessage.addString(globalYCoordString.toString());
        everyoneVotedMessage.addString(usernamesString.toString());
        everyoneVotedMessage.addString(userTypesString.toString());
        sendToClients(everyoneVotedMessage, null);
    }


    class O2elbs_newdc_handler extends O2liteWsMessageHandler{
        public O2elbs_newdc_handler(String typestring_) {
            super(typestring_);
        }

        @Override
        public void handle(O2liteWsMsg message,
                           WebSocketConnection connection) {

            String x_grid_coords_string = message.getString();
            String y_grid_coords_string = message.getString();
            
            int dest_user_ID = message.getInt32();

            for (Map.Entry<WebSocketConnection, ConnectionInfo> entry :
                    Gdc.connectionsMap.entrySet()) {

                ConnectionInfo conninfo = entry.getValue();
                if ((conninfo.getID() == dest_user_ID) && (conninfo.getUserType() != PERFORMER)){
                    O2liteWsMsg badDCMessage = new O2liteWsMsg();
                    badDCMessage.sendStart("/elbs/bdcm", 0.0, "s", true);
                    badDCMessage.addString("You can only draw lines to performers (blue).");
                    connection.send(badDCMessage.getMessage());
                    return;
                }

            }

            String[] x_grid_coords = x_grid_coords_string.split("\\.");
            String[] y_grid_coords = y_grid_coords_string.split("\\.");

            Set<Integer> tempBijectionSet = new HashSet<>();
            Set<Integer> allBijections = new HashSet<>();

            System.out.println("newdc handler - before");
            System.out.println("x_grid_coords_string: "+x_grid_coords_string);
            System.out.println("y_grid_coords_string: "+y_grid_coords_string);
            for (Integer key : gridState.occupiedCoordsBijections.keySet()) {
                Set<Integer> value = gridState.occupiedCoordsBijections.get(key);
                StringBuilder sb = new StringBuilder();
                for (Integer num : value) {
                    int my_y = (num % BIJECTION_VALUE);
                    int my_x = ((num - my_y) / BIJECTION_VALUE);
                    sb.append("(").append(my_x).append(",").append(my_y).append(") ");
                }
                String setitems = sb.toString();
                System.out.println(key + ": " + setitems);
            }

            for (Set<Integer> currentBijections : gridState.occupiedCoordsBijections.values()) {
                allBijections.addAll(currentBijections);
            }

            // add to the tempbijectionset the bijection of the start node
            // do this before the for loop because we know this one will
            // already be in the dictionary
            for (int i=1; i<x_grid_coords.length-1; i++){
                int bijection = (Integer.parseInt(x_grid_coords[i]) * BIJECTION_VALUE)
                        + Integer.parseInt(y_grid_coords[i]);
                if (allBijections.contains(bijection)){
                    O2liteWsMsg badDCMessage = new O2liteWsMsg();
                    badDCMessage.sendStart("/elbs/bdcm", 0.0, "s", true);
                    badDCMessage.addString("There is already an element in this position.");
                    connection.send(badDCMessage.getMessage());
                    return;
                }else{
                    tempBijectionSet.add(bijection);
                }
            }

            ConnectionInfo conn = Gdc.connectionsMap.get(connection);
            int src_user_ID = conn.getID();

            int ocb_dc_key = ((src_user_ID+1) * BIJECTION_VALUE) + (dest_user_ID+1);

            gridState.occupiedCoordsBijections.put(ocb_dc_key, tempBijectionSet);

            System.out.println("newdc handler - after");
            for (Integer key : gridState.occupiedCoordsBijections.keySet()) {
                Set<Integer> value = gridState.occupiedCoordsBijections.get(key);
                StringBuilder sb = new StringBuilder();
                for (Integer num : value) {
                    int my_y = (num % BIJECTION_VALUE);
                    int my_x = ((num - my_y) / BIJECTION_VALUE);
                    sb.append("(").append(my_x).append(",").append(my_y).append(") ");
                }
                String setitems = sb.toString();
                System.out.println(key + ": " + setitems);
            }

            conn.addDownstreamUserDistance(dest_user_ID, x_grid_coords.length - 2);

            O2liteWsMsg newDCMessage = new O2liteWsMsg();
            newDCMessage.sendStart("!elbs/newdc", 0.0, "ssii", true);
            newDCMessage.addString(x_grid_coords_string);
            newDCMessage.addString(y_grid_coords_string);
            newDCMessage.addInt32(src_user_ID);
            newDCMessage.addInt32(dest_user_ID);

            sendToClients(newDCMessage, null);

        }
    }

    class O2elbs_removedc_handler extends O2liteWsMessageHandler{

        public O2elbs_removedc_handler(String typestring_) {
            super(typestring_);
        }

        @Override
        public void handle(O2liteWsMsg message,
                           WebSocketConnection connection) {

            System.out.println("removedc: before");
            for (Integer key :gridState.occupiedCoordsBijections.keySet()) {
                Set<Integer> value = gridState.occupiedCoordsBijections.get(key);
                StringBuilder sb = new StringBuilder();
                for (Integer num : value) {
                    int my_y = (num % BIJECTION_VALUE);
                    int my_x = ((num - my_y) / BIJECTION_VALUE);
                    sb.append("(").append(my_x).append(",").append(my_y).append(") ");
                }
                String setitems = sb.toString();
                System.out.println(key + ": " + setitems);
            }

            int dest_user_ID = message.getInt32();

            ConnectionInfo conn = Gdc.connectionsMap.get(connection);
            int src_user_ID = conn.getID();
            conn.removeDownstreamUserDistance(dest_user_ID);

            int ocb_dc_key = ((src_user_ID+1)*BIJECTION_VALUE)+(dest_user_ID+1);
            if (gridState.occupiedCoordsBijections.containsKey(ocb_dc_key)) {
                gridState.occupiedCoordsBijections.remove(ocb_dc_key);
            }

            System.out.println("removedc: after");
            for (Integer key : gridState.occupiedCoordsBijections.keySet()) {
                Set<Integer> value = gridState.occupiedCoordsBijections.get(key);
                StringBuilder sb = new StringBuilder();
                for (Integer num : value) {
                    int my_y = (num % BIJECTION_VALUE);
                    int my_x = ((num - my_y) / BIJECTION_VALUE);
                    sb.append("(").append(my_x).append(",").append(my_y).append(") ");
                }
                String setitems = sb.toString();
                System.out.println(key + ": " + setitems);
            }

            O2liteWsMsg removeDCMessage = new O2liteWsMsg();
            removeDCMessage.sendStart("/elbs/removedc", 0.0, "ii", true);
            removeDCMessage.addInt32(src_user_ID);
            removeDCMessage.addInt32(dest_user_ID);
            sendToClients(removeDCMessage, null);
        }
    }



    static class O2elbs_rtttest_handler extends O2liteWsMessageHandler{
        public O2elbs_rtttest_handler(String typestring_) {
            super(typestring_);
        }

        @Override
        public void handle(O2liteWsMsg message,
                           WebSocketConnection connection) {


            int rttTestIndex = message.getInt32();

            O2liteWsMsg rttTestMessage = new O2liteWsMsg();
            rttTestMessage.sendStart("/elbs/rtttest", 0.0, "i", true);
            rttTestMessage.addInt32(rttTestIndex);
            connection.send(rttTestMessage.getMessage());
        }
    }

    void broadcastChatMessage(String sender, String chatMessage, WebSocketConnection exclude){
        O2liteWsMsg chatMsg = new O2liteWsMsg();
        chatMsg.sendStart("/gdc/chat", 0.0, "ss", true);
        chatMsg.addString(sender);
        chatMsg.addString(chatMessage);
        sendToClients(chatMsg, exclude);
    }

    class O2elbs_votetostart_handler extends O2liteWsMessageHandler{
        public O2elbs_votetostart_handler(String typestring_) {
            super(typestring_);
        }

        @Override
        public void handle(O2liteWsMsg message,
                           WebSocketConnection connection) {

            if (sessionState != SessionState.SETUP){
                O2liteWsMsg chatMsg = new O2liteWsMsg();
                chatMsg.sendStart("/gdc/chat", 0.0, "ss", true);
                chatMsg.addString("Server");
                chatMsg.addString("This session is already in progress - " +
                        "no more active participats can enter.");
                connection.send(chatMsg.getMessage());
                return;
            }

            ConnectionInfo conn = Gdc.connectionsMap.get(connection);

            if (conn.getSetupState() == SetupState.VALIDATED){
                conn.setSetupState(SetupState.VOTED);
            }

            O2liteWsMsg youVotedMessage = new O2liteWsMsg();
            youVotedMessage.sendStart("/elbs/clientvoteconfirmed", 0.0, "i", true);
            youVotedMessage.addInt32(1);
            connection.send(youVotedMessage.getMessage());

            broadcastChatMessage(conn.getUsername(), " has voted to start.", null);


            // first figure out if we have enough validated users to start
            // and if everyone who has been validated has voted.
            // we check the latter by returning if we find someone whose
            // setup status is VALIDATED
            int num_performers = 0, num_listeners = 0, num_composers = 0;
            for (Map.Entry<WebSocketConnection, ConnectionInfo> entry :
                    Gdc.connectionsMap.entrySet()) {

                ConnectionInfo conninfo = entry.getValue();

                // we can't start the session if not all validated users have
                // voted to start
                if (conninfo.getSetupState() == SetupState.VALIDATED){
                    return;
                }

                if (conninfo.getSetupState() == SetupState.VOTED){
                    int client_type = entry.getValue().getUserType();
                    if (client_type == COMPOSER) { num_composers += 1; }
                    if (client_type == PERFORMER) { num_performers += 1; }
                    if (client_type == LISTENER) { num_listeners += 1; }
                }
            }

            if ((num_composers < 1) || (num_performers < 1)
                    || (num_listeners < 1)) {
                return;
            }

            // if we do have enough of each user class to proceed:
            // record the number of composers, listeners, etc in a session
            // change the session state
            sessionState = SessionState.ACTIVE;

            // send chat message to users that haven't entered a valid username and password
            for (Map.Entry<WebSocketConnection, ConnectionInfo> entry :
                    Gdc.connectionsMap.entrySet()) {
                // might as well do this while we iterate over it
                if (entry.getValue().getSetupState() == SetupState.INIT){
                    O2liteWsMsg removalMsg = new O2liteWsMsg();
                    removalMsg.sendStart("/gdc/chat", 0.0, "ss", true);
                    removalMsg.addString("Server");
                    removalMsg.addString("You have been removed from the " +
                            "group for not entering a valid username and password.");
                    entry.getKey().send(removalMsg.getMessage());
                }
            }

            // remove users that haven't entered a valid username and password
            // we have to do this in a separate block
            // also build up the string with all the info about which ID corresponds to which
            // user of which type, to register in the log

            Iterator<Map.Entry<WebSocketConnection, ConnectionInfo>> cmIterator
                    = Gdc.connectionsMap.entrySet().iterator();
            while (cmIterator.hasNext()) {
                Map.Entry<WebSocketConnection, ConnectionInfo> entry = cmIterator.next();
                if (entry.getValue().getSetupState() == SetupState.INIT){
                    cmIterator.remove();
                }
            }

            // then log the message with all the types of users
            StringBuilder composerIDs = new StringBuilder();
            StringBuilder performerIDs = new StringBuilder();
            StringBuilder listenerIDs = new StringBuilder();
            for (Map.Entry<WebSocketConnection, ConnectionInfo> entry : Gdc.connectionsMap.entrySet()) {
                if (entry.getValue().getUserType() == COMPOSER){
                    composerIDs.append(entry.getValue().getID()).append(".");
                }
                if (entry.getValue().getUserType() == PERFORMER){
                    performerIDs.append(entry.getValue().getID()).append(".");
                }
                if (entry.getValue().getUserType() == LISTENER){
                    listenerIDs.append(entry.getValue().getID()).append(".");
                }
            }

            recComposition.logUserTypes(composerIDs.toString(), listenerIDs.toString(),
                    performerIDs.toString());


            generateGlobalViewDistancesFromRTTs();

        }
    }

    class O2elbs_registertt_handler extends O2liteWsMessageHandler{

        public O2elbs_registertt_handler(String typestring_) {
            super(typestring_);
        }

        @Override
        public void handle(O2liteWsMsg message,
                           WebSocketConnection connection) {
            // unmarshal parameters
            double min_tt_from_client = message.getDouble();
            ConnectionInfo conn = Gdc.connectionsMap.get(connection);
            conn.registerTT(min_tt_from_client);
            System.out.println("User " + conn.getID() + " registered TT " +  conn.getTT());
            check_and_validate(connection);
        }
    }


    // when a new client joints the ensemble:
    // update the user typewithin the connection info object
    // send out a message to everyone that says whether or not an on/offline update
    // for a user of type (L, C, P) has been sent out, whether it has been
    // added or taken out, and whether we are now ready to start.

    class O2ws_cs_get_handler extends O2liteWsMessageHandler {

        public O2ws_cs_get_handler(String typestring_) { super(typestring_); }

        @Override
        public void handle(O2liteWsMsg message,
                           WebSocketConnection connection) {
            // unmarshal parameters
            int sequence_no = message.getInt32();
            String return_address = message.getString();

            O2liteWsMsg replyMsg = new O2liteWsMsg();

            double current_time = Gdc.getTimeSinceStart();

            // originally, this line was:
            replyMsg.sendStart(return_address, 0.0, "it", message.tcpFlag);
            replyMsg.addInt32(sequence_no);
            replyMsg.addTime(current_time);

            //send the message
            connection.send(replyMsg.getMessage());

        }
    }


    class O2ws_dy_handler extends O2liteWsMessageHandler {

        public O2ws_dy_handler(String typestring_) { super(typestring_); }

        @Override
        public void handle(O2liteWsMsg message,
                           WebSocketConnection connection) {
            // unmarshal parameters
            String e_name = message.getString();
            ConnectionInfo conn = Gdc.connectionsMap.get(connection);

            // if the ensemble name is the same as the one provided
            // and this is the first message that has been received so far
            if (ensembleName.equals(e_name) &&
                    (!conn.getAnyMessagesReceived())) {
                conn.setAnyMessagesReceived(true);

                // send ID message
                O2liteWsMsg id_message = new O2liteWsMsg();
                id_message.sendStart("!_o2/id", 0.0, "i", true);
                id_message.addInt32(conn.getID());
                connection.send(id_message.getMessage());

            } else {
                // close connection if ensemble names are not the same
                Gdc.connectionsMap.remove(connection);
            }



        }
    }


    // handle message indicating we're synced
    class O2ws_cs_cs_handler extends O2liteWsMessageHandler {

        public O2ws_cs_cs_handler(String typestring_) { super(typestring_); }

        @Override
        public void handle(O2liteWsMsg message,
                           WebSocketConnection connection) {
            // set clock synchronized
            ConnectionInfo conn = Gdc.connectionsMap.get(connection);
            conn.setClockSynchronized();
            // send timemap message
            O2liteWsMsg timemapMsg = new O2liteWsMsg();
            timemapMsg.sendStart("/gdc/timemap", 0.0, "ittd", true);
            timemapMsg.addInt32(Gdc.tempoEpoch);
            timemapMsg.addTime(Gdc.timeOffset);
            timemapMsg.addTime(Gdc.beatOffset);
            timemapMsg.addDouble(Gdc.bps);
            connection.send(timemapMsg.getMessage());

            check_and_validate(connection);

        }
    }


    private void check_and_validate(WebSocketConnection connection){

        ConnectionInfo conn_info = Gdc.connectionsMap.get(connection);
        // if clock is synchronized it is implicit that timemap has been set
        // if min rtt > 0 it is implicit that we have established min RTT
        double min_RTT = conn_info.getTT();
        // return if we haven't met all the requirements
        if (!(conn_info.getClockSynchronized() && conn_info.getValidCredentialsEntered() &&
                min_RTT > 0.0)){
            System.out.println("conn_info.getClockSynchronized(): " + conn_info.getClockSynchronized() +
                    " conn_info.getValidCredentialsEntered() " + conn_info.getValidCredentialsEntered() + " min_RTT "
            + min_RTT);
            return;
        }

        conn_info.setSetupState(SetupState.VALIDATED);
        O2liteWsMsg validatedMessage = new O2liteWsMsg();
        validatedMessage.sendStart("/elbs/validated", 0.0, "", true);
        connection.send(validatedMessage.getMessage());

        O2liteWsMsg userTypesMsg = buildUsersTypesMessage();

        // set all votes so far to false because someone new has entered
        for (Map.Entry<WebSocketConnection, ConnectionInfo> entry :
                Gdc.connectionsMap.entrySet()) {
            ConnectionInfo client_conninfo = entry.getValue();
            if (client_conninfo.getSetupState() == SetupState.VOTED){
                client_conninfo.setSetupState(SetupState.VALIDATED);
            }
        }

        sendToClients(userTypesMsg, null);
        int checkUserType = conn_info.getUserType();
        StringBuilder hasJoinedAs = new StringBuilder();





        hasJoinedAs.append(" has joined the ensemble as a ");
        if (checkUserType == LISTENER){
            hasJoinedAs.append("listener.");
            O2liteWsMsg chatMessage = new O2liteWsMsg();
            chatMessage.sendStart("/gdc/chat", 0.0, "ss", true);
            chatMessage.addString(serverChatName);
            chatMessage.addString("As a listener, you hear what performers play. Click and drag " +
                    "your node (the black dot) to change your perspective of the composition.");
            connection.send(chatMessage.getMessage());
        }

        else if (checkUserType == PERFORMER){
            hasJoinedAs.append("performer.");
            O2liteWsMsg chatMessage = new O2liteWsMsg();
            chatMessage.sendStart("/gdc/chat", 0.0, "ss", true);
            chatMessage.addString(serverChatName);
            chatMessage.addString("As a performer, you (the black dot) mimic (or choose to ignore) what composers play. " +
                    "tap your keyboard to play drums, which are broadcast to listeners.");
            connection.send(chatMessage.getMessage());
        }

        else if (checkUserType == COMPOSER){
            hasJoinedAs.append("composer.");
            O2liteWsMsg chatMessage = new O2liteWsMsg();
            chatMessage.sendStart("/gdc/chat", 0.0, "ss", true);
            chatMessage.addString(serverChatName);
            chatMessage.addString("As a composer, you can start and stop the composition, change tempo," +
                    " and send performers drums to mimic by tapping your keyboard. Click and drag from yourself" +
                    " (the black dot) to performers (blue dots) to draw connections.");
            connection.send(chatMessage.getMessage());
        }

        broadcastChatMessage(conn_info.getUsername(), hasJoinedAs.toString(), connection);

    }


    class O2gdc_infoentered_handler extends O2liteWsMessageHandler {

        public O2gdc_infoentered_handler(String typestring_) {
            super(typestring_);
        }

        @Override
        public void handle(O2liteWsMsg message,
                           WebSocketConnection connection) {

            if (sessionState != SessionState.SETUP){
                O2liteWsMsg chatMsg = new O2liteWsMsg();
                chatMsg.sendStart("/gdc/chat", 0.0, "ss", true);
                chatMsg.addString("Server");
                chatMsg.addString("This session is already in progress - " +
                        "no more active participats can enter.");
                connection.send(chatMsg.getMessage());
                return;
            }

            ConnectionInfo conn = Gdc.connectionsMap.get(connection);
            System.out.println("infoentered handler entered");
            String clientAdminPassword = message.getString();
            String checkUsername = message.getString();
            int checkUserType = message.getInt32();

            int validUsername = 0;
            int validPassword = 0;
            int validUserType = 0;

            if ((checkUserType == COMPOSER) || (checkUserType == PERFORMER) || (checkUserType == LISTENER)){
                validUserType = 1;
            }

            if (clientAdminPassword.equals(Gdc.adminPassword)) {
                // update the admin status of the connection object
                // tell the client that they have the correct password
                validPassword = 1;
            }

            if (!checkUsername.contains(".") &&
                    (!checkUsername.trim().isEmpty())) {
                validUsername = 1;
            }


            if ((validUsername == 1) && (validPassword == 1) && (validUserType == 1)){
                conn.setUsername(checkUsername);
                conn.setUserType(checkUserType);
                conn.setValidCredentialsEntered();
            }


            O2liteWsMsg replyMsg = new O2liteWsMsg();
            replyMsg.sendStart("/gdc/infoentered", 0.0, "ii", true);
            replyMsg.addInt32(validPassword);
            replyMsg.addInt32(validUsername);
            connection.send(replyMsg.getMessage());

            check_and_validate(connection);

        }
    }

    class O2gdc_chat_handler extends O2liteWsMessageHandler {

        public O2gdc_chat_handler(String typestring_) {
            super(typestring_);
        }

        @Override
        public void handle(O2liteWsMsg message,
                           WebSocketConnection connection) {
            ConnectionInfo conn = Gdc.connectionsMap.get(connection);
            System.out.println("chat handler entered");
            String clientChat = message.getString();
            // check if client has sent empty string
            if (!clientChat.trim().isEmpty()) {
                // get client username
                String sender_username = conn.getUsername();
                O2liteWsMsg chatMsg = new O2liteWsMsg();
                chatMsg.sendStart("/gdc/chat", 0.0, "ss", true);
                chatMsg.addString(sender_username);
                chatMsg.addString(clientChat);
                sendToClients(chatMsg, null);
            }
        }
    }


    private int calculate_manhattan_distance(GridCoordinate coord1, GridCoordinate coord2){
        int x_dist = coord1.x - coord2.x;
        // less expensive than importing entire Java.lang.Math library
        if (x_dist < 0){
            x_dist *= -1;
        }
        int y_dist = coord1.y - coord2.y;
        if (y_dist < 0){
            y_dist *= -1;
        }
        return x_dist + y_dist;
    }

    class O2elbs_composer_hit_handler extends O2liteWsMessageHandler {
        public O2elbs_composer_hit_handler(String typestring_) { super(typestring_); }

        @Override
        public void handle(O2liteWsMsg message,
                           WebSocketConnection connection) {

            System.out.println("Gdc.bps: " + Gdc.bps);

            if (Gdc.bps <= 0.0){
                return;
            }

            int sender_id = message.getInt32();
            int di_to_play = message.getInt32();
            double played_beat = message.getTime();

            // to the performers connected to the sender:
            // send a message with the sender ID, the di to play, the performer distance
            // (so that we don't have to rely on values we've cached in graphics things on
            // the client side to schedule audio stuff, keep it decoupled)
            // and the time the beat was sent

            ConnectionInfo composer_conn = Gdc.connectionsMap.get(connection);
            // c_dud = composer downstream user distances
            Map<Integer, Integer> c_dud
                    = composer_conn.getDownstreamUsersDistancesMap();

            // to clients that render drawnconnectiondisplays:
            O2liteWsMsg traversingHitDisplayMsg = new O2liteWsMsg();
            traversingHitDisplayMsg.sendStart("/elbs/thdm", 0.0, "it", true);
            traversingHitDisplayMsg.addInt32(sender_id);
            traversingHitDisplayMsg.addTime(played_beat);
            String thdm = traversingHitDisplayMsg.getMessage();

            for (Map.Entry<WebSocketConnection, ConnectionInfo> entry : Gdc.connectionsMap.entrySet()) {
                int entry_ID = entry.getValue().getID();
                if (entry.getValue().getUserType() == PERFORMER && c_dud.containsKey(entry_ID)) {
                    // if a performer is connected to the composer that sent the message
                    int distance = c_dud.get(entry_ID);
                    O2liteWsMsg chitToConnectedPerformer = new O2liteWsMsg();
                    chitToConnectedPerformer.sendStart("/elbs/ctocp", 0.0, "iiit", true);
                    chitToConnectedPerformer.addInt32(sender_id);
                    chitToConnectedPerformer.addInt32(di_to_play);
                    chitToConnectedPerformer.addInt32(distance);
                    chitToConnectedPerformer.addTime(played_beat);
                    entry.getKey().send(chitToConnectedPerformer.getMessage());
                }else{
                    if (entry_ID != sender_id){
                        entry.getKey().send(thdm);
                    }
                }
            }

        }
    }




    class O2elbs_performer_hit_handler extends O2liteWsMessageHandler {
        public O2elbs_performer_hit_handler(String typestring_) { super(typestring_); }

        @Override
        public void handle(O2liteWsMsg message,
                           WebSocketConnection connection) {

            if (Gdc.bps <= 0.0){
                return;
            }

            System.out.println("Gdc.bps: " + Gdc.bps);

            int sender_id = message.getInt32();
            int di_to_play = message.getInt32();
            double played_beat = message.getTime();

            recComposition.logDrumHit(played_beat, sender_id, di_to_play);
            ConnectionInfo performer_conn = Gdc.connectionsMap.get(connection);

            O2liteWsMsg propagatingHitDefaultMessage = new O2liteWsMsg();
            propagatingHitDefaultMessage.sendStart("/elbs/phdm", 0.0, "it", true);
            propagatingHitDefaultMessage.addInt32(sender_id);
            propagatingHitDefaultMessage.addTime(played_beat);
            String phdm = propagatingHitDefaultMessage.getMessage();

            for (Map.Entry<WebSocketConnection, ConnectionInfo> entry : Gdc.connectionsMap.entrySet()) {
                if (entry.getValue().getUserType() == LISTENER){
                    int listener_distance = performer_conn.getDownstreamUserDistance(entry.getValue().getID());
                    O2liteWsMsg listenerPerformerHitMessage = new O2liteWsMsg();
                    listenerPerformerHitMessage.sendStart("/elbs/lphit", 0.0, "iiit", true);
                    listenerPerformerHitMessage.addInt32(sender_id);
                    listenerPerformerHitMessage.addInt32(di_to_play);
                    listenerPerformerHitMessage.addInt32(listener_distance);
                    listenerPerformerHitMessage.addTime(played_beat);
                    entry.getKey().send(listenerPerformerHitMessage.getMessage());
                }
                else{
                    if (entry.getKey() != connection){
                        entry.getKey().send(phdm);
                    }
                }
            }
        }
    }


    class O2gdc_timemap_handler extends O2liteWsMessageHandler {

        public O2gdc_timemap_handler(String typestring_) { super(typestring_); }

        @Override
        public void handle(O2liteWsMsg message,
                           WebSocketConnection connection) {
            // check whether or not the client changing tempo is an admin
            System.out.println("timemap_handler entered");
            int epoch = message.getInt32();
            double timeOffset = message.getTime();  // ignored
            double beatOffset = message.getTime();
            double bps = message.getDouble();

            recComposition.logTempoChange(beatOffset, bps);


                // check for valid legal request
                if (epoch == Gdc.tempoEpoch && beatOffset > Gdc.beatOffset &&
                        Gdc.bps > 0 && bps > 0.0) {
                    // Note: tempo cannot be set if we are stopped. Client must
                    // send /gdc/start instead.
                    timeOffset = sched_beat_to_time(beatOffset);
                    if (timeOffset >= Gdc.getTimeSinceStart() + MAX_NET_DELAY) {
                        Gdc.timeOffset = timeOffset;
                        Gdc.beatOffset = beatOffset;
                        Gdc.bps = bps;
                        sendTimemapToClients();
                        return;
                    }
                }
            System.out.println("timemap_handler dropping message: " +
                    "beatOffset " + beatOffset + " (prev " + Gdc.beatOffset +
                    ")  epoch " + epoch + "(current " + Gdc.tempoEpoch +
                    ") bps " + bps + " (prev " + Gdc.bps + ")");
        }
    }

    class O2gdc_start_handler extends O2liteWsMessageHandler {

        public O2gdc_start_handler(String typestring_) { super(typestring_); }

        @Override
        public void handle(O2liteWsMsg message,
                           WebSocketConnection connection) {
            System.out.println("START handler entered");
                int epoch = message.getInt32();
                double timeOffset = message.getTime();
                double beatOffset = message.getTime();
                double bps = message.getDouble();
                // make sure there's enough time (since we check, client
                // is free to send 0 to mean "as soon as possible":
                if (timeOffset < Gdc.getTimeSinceStart() + MAX_NET_DELAY) {
                    timeOffset = Gdc.getTimeSinceStart() + MAX_NET_DELAY;
                }
                if (epoch != Gdc.tempoEpoch || beatOffset <= Gdc.beatOffset ||
                        timeOffset <= Gdc.timeOffset || bps <= 0.0 ||
                        Gdc.bps != 0.0) {
                    System.out.println("start_handler dropping message: " +
                            "beatOffset " + beatOffset + " (prev " +
                            Gdc.beatOffset + ") timeOffset " + timeOffset +
                            "(prev " + Gdc.timeOffset + ") epoch " + epoch +
                            "(current " + Gdc.tempoEpoch + ") bps " + bps +
                            "(prev " + Gdc.bps + ")");
                    return;
                }
                Times times = calcStartBeat();
                if (timeOffset < times.getTime() ||
                        beatOffset < times.getBeat()) {
                    timeOffset = times.getTime();
                    beatOffset = times.getBeat();
                }
                // set our internal timemap here for use by Changemode
                Gdc.tempoEpoch += 1;
                Gdc.timeOffset = timeOffset;
                Gdc.beatOffset = beatOffset - 1;  // start early for preroll
                // take care to force tempo to match audio loop:
                Gdc.bps = bps;

                sendTimemapToClients();

                recComposition.logTempoChange(Gdc.beatOffset, Gdc.bps);


        }
    }

    class O2gdc_stop_handler extends O2liteWsMessageHandler {

        public O2gdc_stop_handler(String typestring_) { super(typestring_); }

        @Override
        public void handle(O2liteWsMsg message,
                           WebSocketConnection connection) {
                int epoch = message.getInt32();
                double beat = message.getTime();
                if (epoch != Gdc.tempoEpoch || Gdc.bps == 0.0 ||
                        beat < Gdc.beatOffset) {
                    System.out.println("stop_handler dropping message: " +
                            "beat " + beat + " epoch " + epoch +
                            " current bps " + Gdc.bps);
                    return;
                }
                Gdc.tempoEpoch += 1;
                Gdc.timeOffset = Gdc.getTimeSinceStart() + MAX_NET_DELAY;
                Gdc.beatOffset = beat;
                Gdc.bps = 0.0;
                sendTimemapToClients(); // client ignores timestamp

                recComposition.logFinish(beat);

                // generate all the midis
                recComposition.writeToCsv();
                generateMidis(0);

        }
    }


    private double sched_beat_to_time(double beat) {
        if (Gdc.bps == 0) {  // music has stopped, future beat will never happen
            return 1e+10;  // return a very big number to avoid NaNs
        }
        return Gdc.timeOffset + (beat - Gdc.beatOffset) / Gdc.bps;
    }

    private double sched_time_to_beat(double time){
        return Gdc.beatOffset + (time - Gdc.timeOffset) * Gdc.bps;

    }

}


class RecordedComposition{
    private String[] allMessages;
    private int next;
    private final int csvLength;
    private int numCSVS;

    public RecordedComposition(int csvLength_){
        csvLength = csvLength_;
        numCSVS = 0;
        allMessages = new String[csvLength];
    }

    public void logFinish(double beat){
        String finishMessage = "F," +
                beat + "\n";
        allMessages[next] = finishMessage;
        next++;
        if (next == csvLength) {
            writeToCsv();
        }
    }

    public void logUserTypes(String c_IDs, String l_IDs, String p_IDs){
        String userTypesMessage = "U," +
                c_IDs + "," +
                l_IDs + "," +
                p_IDs + "\n";
        allMessages[next] = userTypesMessage;
        next++;
        if (next == csvLength) {
            writeToCsv();
        }
    }

    public void logListenerMove(int listener_ID, double transition_start_beat, double transition_end_beat){
        String listenerMoveMessage = "L," +
                listener_ID + "," +
                transition_start_beat + "," +
                transition_end_beat + "\n";
        allMessages[next] = listenerMoveMessage;
        next++;
        if (next == csvLength) {
            writeToCsv();
        }
    }

    public void logTempoChange(double beat, double bps){
        String tempoMessage = "T," +
                beat + "," +
                bps + "\n";
        allMessages[next] = tempoMessage;
        next++;
        if (next == csvLength) {
            writeToCsv();
        }
    }

    // log the distance of each listener from each performer
    // so that the time at which the listener perceives a hit from said performer
    // can be used to reconstruct the listener's perspective of the composition
    // every time a hit is received from a performer
    public void logDownstreamListenerDistanceMap(int performer_ID, Map<Integer, Integer> dud_m){
        StringBuilder dldmMessage = new StringBuilder();
        StringBuilder listenerIDs_sb = new StringBuilder();
        StringBuilder listenerDistances_sb = new StringBuilder();
        dldmMessage.append("P,");
        dldmMessage.append(performer_ID).append(",");
        for (Map.Entry<Integer, Integer> entry : dud_m.entrySet()) {
            // Append the key and value separated by a dot
            listenerIDs_sb.append(entry.getKey()).append(".");
            listenerDistances_sb.append(entry.getValue()).append(".");
        }
        dldmMessage.append(listenerIDs_sb).append(",");
        dldmMessage.append(listenerDistances_sb).append("\n");

        allMessages[next] = dldmMessage.toString();
        next++;
        if (next == csvLength) {
            writeToCsv();
        }

    }

    public void logDrumHit(double beat, int sender_id, int drum_index){
        String drumMessage = "H," +
                beat + "," +
                sender_id + "," +
                drum_index + "\n";

        allMessages[next] = drumMessage;
        next++;
        if (next == csvLength) {
            writeToCsv();
        }
    }

    public void writeToCsv(){
        String csvFilePath = "logs/log" + numCSVS + ".csv";
        try (FileWriter writer = new FileWriter(csvFilePath)) {
            for (String row : allMessages) {
                if (row != null){
                    writer.write(row);
                }
            }
            System.out.println("Data has been written to the CSV file successfully.");
        } catch (IOException e) {
            System.err.println("Error writing to CSV file: " + e.getMessage());
        }
        allMessages = new String[csvLength];
        next = 0;
        numCSVS += 1;
    }

}



class GridCoordinate{
    public int x;
    public int y;

    public GridCoordinate(int x_, int y_){
        x = x_;
        y = y_;
    }

    // reference: https://www.geeksforgeeks.org/overriding-equals-method-in-java/
    @Override
    public boolean equals(Object o){
        if (this == o){ return true; }
        if (!(o instanceof GridCoordinate)){ return false; }
        GridCoordinate c = (GridCoordinate) o;
        return (this.x == c.x) && (this.y == c.y);
    }

    @Override
    public int hashCode() {
        return Objects.hash(this.x, this.y);
    }

    public void print(){
        System.out.println("x: " + x + ", y: " + y);
    }
    
}




// TODO: refactor for listeners, composers, performers
class ConnectionInfo implements Comparable<ConnectionInfo>{
    private final int ID;
    private boolean clockSynchronized; //
    private boolean TTLocked;
    private boolean anyMessagesReceived;
    private boolean validCredentialsEntered;
    private String userName;
    private int userType;
    private GridCoordinate gridCoordinate;
    private Map<Integer, Integer> downstreamUsersDistancesMap;
    private double transmissionTime;
    private SetupState setupState;
    private int minUpstreamUserDistance;

    public ConnectionInfo(int ID_){
        ID = ID_;
        anyMessagesReceived = false;
        clockSynchronized = false;
        setupState = SetupState.INIT;
        userName = "";
        TTLocked = false;
        userType = 0;
        validCredentialsEntered = false;
        transmissionTime = -1.0;
        downstreamUsersDistancesMap = new HashMap<Integer, Integer>();
        minUpstreamUserDistance = 9999;
    }

    @Override
    public int compareTo(ConnectionInfo o) {
        return (int)(this.transmissionTime - o.getTT());
    }

    public void addDownstreamUserDistance(int downstream_user_ID, int downstream_user_path_length){
        downstreamUsersDistancesMap.put(Integer.valueOf(downstream_user_ID),
                Integer.valueOf(downstream_user_path_length));
    }

    public void removeDownstreamUserDistance(int user_ID){
        downstreamUsersDistancesMap.remove(Integer.valueOf(user_ID));
    }

    public int getDownstreamUserDistance(int downstream_user_ID){
        return downstreamUsersDistancesMap.get(downstream_user_ID);
    }

    public void setValidCredentialsEntered(){
        validCredentialsEntered = true;
    }

    public boolean getValidCredentialsEntered(){
        return validCredentialsEntered;
    }

    public Map<Integer, Integer> getDownstreamUsersDistancesMap(){
        return downstreamUsersDistancesMap;
    }

    public void setDownstreamUsersDistancesMap(int k, int v){
        assert(downstreamUsersDistancesMap.containsKey(k));
        downstreamUsersDistancesMap.put(k, v);
    }

    public int getMinUpstreamUserDistance(){ return minUpstreamUserDistance; }

    public void setMinUpstreamUserDistance(int muud){ minUpstreamUserDistance = muud; }

    public GridCoordinate getGridCoordinate() { return gridCoordinate; }

    public void setGridCoordinate( GridCoordinate gridCoordinate_ ) { gridCoordinate = gridCoordinate_; }

    public void setUserType(int userType_) { userType = userType_; }

    public int getUserType() { return userType; }

    public void setUsername( String userName_ ) { userName = userName_; }

    public String getUsername() {
        return (validCredentialsEntered) ? userName : "NULL";
    }

    public void registerTT(double TT) {
        transmissionTime = TT;
        TTLocked = true;
    }

    public double getTT(){
        return (TTLocked) ? transmissionTime : -1.0;
    }

    public int getID() {
        return ID;
    }

    public SetupState getSetupState() { return setupState; }

    // permitted:
    // init -> validated
    // validated <-> voted
    public void setSetupState(SetupState ss){
        if (setupState == SetupState.INIT && ss == SetupState.VOTED){
            System.exit(0);
        }
        if (setupState == SetupState.VALIDATED && ss == SetupState.INIT){
            System.exit(0);
        }
        if (setupState == SetupState.VOTED && ss == SetupState.INIT){
            System.exit(0);
        }
        setupState = ss;
    }

    public void setClockSynchronized() {
        // once the clock is synchronized, it won't become un-synchronized again
        System.out.println("clocksync");
        clockSynchronized = true;
    }

    public boolean getClockSynchronized() {
        return clockSynchronized;
    }

    public void setAnyMessagesReceived(boolean anyMessagesReceived_) {
        anyMessagesReceived = anyMessagesReceived_;
    }

    public boolean getAnyMessagesReceived() {
        return anyMessagesReceived;
    }


}
