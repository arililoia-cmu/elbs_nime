// Gdc -- main program to create a simple HTTP server with websockets
import org.webbitserver.WebServer;
import org.webbitserver.WebServers;
import org.webbitserver.handler.StaticFileHandler;
import org.webbitserver.WebSocketConnection;

import java.io.*;
import java.util.Map;

public class Gdc {

    public static String adminPassword;
    public static String LOGPATH = "logs/";
    // This is essentially a global so multiple classes can access it.
    // It is created by GdcWebSockets.java
    public static Map<WebSocketConnection, ConnectionInfo> connectionsMap;
    // these "global" variables define the current timemap for clients
    public static long startTime;
    public static int tempoEpoch = 0;
    public static double bps = 0.0;
    public static double beatOffset = 0.0;
    public static double timeOffset = 0.0;


    public static double getTimeSinceStart() {
        // convert from milliseconds to seconds
        return ((double)(System.currentTimeMillis() - startTime)) * 0.001;
    }


    public static double schedTimeToBeat(double time) {
        return beatOffset + (time - timeOffset) * bps;
    }


    public static void main(String[] args) {
        System.out.println("Starting Webbit server in " +
                           System.getProperty("user.dir"));
        Gdc.startTime = System.currentTimeMillis();
        // get password from file accessible to server
        try {
            FileInputStream AdminPasswordStream =
                    new FileInputStream("src/main/resources/adminPassword.txt");
            BufferedReader readAPS = new BufferedReader(
                    new InputStreamReader(AdminPasswordStream));
            try {
                adminPassword = readAPS.readLine();
            } catch (IOException e) {
                throw new IllegalArgumentException(
                        "error reading src/main/resources/adminPassword.txt");
            }
        } catch (FileNotFoundException e) {
            throw new IllegalArgumentException(
                    "src/main/resources/adminPassword.txt not found");
        }

        try {
            WebServer webServer = WebServers.createWebServer(8080)
                    .add("/o2ws", new GdcWebSockets())
                    .add(new StaticFileHandler("web")) // path to web content
                    .add("/logs", new LogsHandler())
                    .add("/log", new LogHandler())
                    .start()
                    .get();
            System.out.println("Server running at " + webServer.getUri());
        } catch (Exception e) {
            System.out.println(e);
        }
    }
}
