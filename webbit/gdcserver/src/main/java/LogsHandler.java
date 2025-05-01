// LogsHandler -- produces list of downloadable logs
//
// Roger B. Dannenberg
// Nov 2022
//
// Request must be of the form /logs?pw=xxxx
// where xxxx is the Admin password (not secure!)

import org.webbitserver.HttpHandler;
import org.webbitserver.HttpRequest;
import org.webbitserver.HttpResponse;
import org.webbitserver.HttpControl;

import java.io.File;
import java.io.IOException;
import java.net.HttpCookie;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Collections;

import org.apache.commons.text.StringEscapeUtils;

public class LogsHandler extends GdcHttpHandler {
    public void handleHttpRequest(HttpRequest request, HttpResponse response,
                                  HttpControl control) {
        if (Gdc.adminPassword.equals(request.queryParam("pw"))) {
            HttpCookie cookie = new HttpCookie("admintoken", Gdc.adminPassword);
            cookie.setMaxAge(300);
            System.out.println("Setting cookie to " + cookie);

            StringBuilder page = new StringBuilder();
            page.append("<!DOCTYPE html>\n<html>\n<head>\n").
                 append("<title>Log File Listing</title>\n").
                 append("</head>\n<body>\n").
                 append("<h2>Log Files</h2>\n");
            ArrayList<String> paths = new ArrayList<String>();

            // gather the file names into an ArrayList for sorting
            try {
                Files.list(new File(Gdc.LOGPATH).toPath()).forEach(path -> {
                        paths.add(path.toString());
                    });
            } catch (IOException e) {
                System.out.println("LogsHandler, Files error " + e);
                error(request, response, control, "Log File Listing Error",
                      StringEscapeUtils.escapeHtml4(
                              "Something went wrong listing log files: " + e));
                return;
            }

            // add the sorted file names to the web page as links
            Collections.sort(paths);
            for (String path: paths) { 
                page.append("<p><a href=\"log?name=" + path + "\">").
                         append(path).
                         append("</a></p>\n");
            }
            page.append("</body>\n</html>\n");

            response.header("Content-Type", "text/html").
                     cookie(cookie).content(page.toString()).end();
        } else {
            System.out.println("LogsHandler, restricted to Admins " +
                               request.uri());
            error(request, response, control, "Log File Listing Error",
                  "Log files are restricted to Administrators," +
                  "password missing or invalid.");
        }
    }
}
