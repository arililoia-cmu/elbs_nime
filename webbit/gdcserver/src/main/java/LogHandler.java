// LogHandler -- delivers a CSV file from logs
//
// Roger B. Dannenberg
// Nov 2022
//
// Request must be of the form /log?name=xxxx
// where xxxx is the path beginning with Gdc.LOGPATH to CSV logfile

import org.webbitserver.HttpHandler;
import org.webbitserver.HttpRequest;
import org.webbitserver.HttpResponse;
import org.webbitserver.HttpControl;
import org.apache.commons.text.StringEscapeUtils;

import java.io.*;
import java.net.HttpCookie;
import java.nio.file.Files;
import java.nio.file.Paths;

public class LogHandler extends GdcHttpHandler {
    public void handleHttpRequest(HttpRequest request, HttpResponse response,
                                  HttpControl control) {
        HttpCookie cookie = request.cookie("admintoken");
        System.out.println("LogHandler got admintoken cookie " + cookie);
        if (cookie.getValue().equals(Gdc.adminPassword)) {
            String path = request.queryParam("name");
            String filename;
            // minimal protection to read only from Gdc.LOGPATH:
            if (path.startsWith(Gdc.LOGPATH) &&
                !path.contains("..")) {
                filename = path.substring(Gdc.LOGPATH.length());
            } else {
                System.out.println("In LogHandler, bad name: " + path);
                error(request, response, control, "Log Download Error",
                        StringEscapeUtils.escapeHtml4(
                                "Bad log file name provided: " + path));
                return;
            }
            String log = null;
            try {
                log = new String(Files.readAllBytes(Paths.get(path)));
            } catch (IOException e) {
                System.out.println(StringEscapeUtils.escapeHtml4(
                        "LogsHandler, error in Files: " + e));
                error(request, response, control, "Log Download Error",
                        "Something went wrong reading a log file: " + path);
                return;
            }
            response.header("Content-Type", "text/html").
                    header("Content-Disposition",
                            "attachment;filename=" + filename).
                    content(log).end();
        }
    }
}
