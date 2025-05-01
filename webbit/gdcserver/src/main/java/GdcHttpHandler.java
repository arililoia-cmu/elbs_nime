// GdcHttpHandler -- just HttpHandler with an extra method to return an
//                   error message to the client's browser
//
// Roger B. Dannenberg
// Nov 2022
//
// This is used like HttpHandler in handlers that wish to invoke error()
// to produce a simple error report as a web page when things go wrong
//
// IMPORTANT: Don't forget to return; after calling error() from inside
// a handler -- you don't want to fall through an error condition and
// generate a different response.

import org.webbitserver.HttpHandler;
import org.webbitserver.HttpRequest;
import org.webbitserver.HttpResponse;
import org.webbitserver.HttpControl;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import org.apache.commons.text.StringEscapeUtils;

public abstract class GdcHttpHandler implements HttpHandler {
    public void error(HttpRequest request, HttpResponse response,
                      HttpControl control, String title, String message) {
        StringBuilder page = new StringBuilder();
        page.append("<!DOCTYPE html>\n<html>\n<head>\n").
             append("<title>").append(title).append("</title>\n").
             append("</head>\n<body>\n").
             append("<h2>").append(title).append("</h2>\n").
             append("<p>").append(message).
             append("</p>\n</body>\n</html>\n");
        response.header("Content-Type", "text/html").
                 content(page.toString()).end();
    }
}
