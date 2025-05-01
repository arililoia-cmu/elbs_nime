import java.security.InvalidParameterException;
import org.webbitserver.WebSocketConnection;

// all handlers have same functionality for checking the typestring, but different
// things have to happen when they are called to handle a message.
// using an abstract class, the handlers can & must be called in the same way

// handle() takes the websocket connection as an argument alongside the message itself -
// I implemented it this way because in o2/src/bridge.cpp/o2_bridge_csget_handler, the
// sending is done inside the handler, but that can easily be moved out

public abstract class O2liteWsMessageHandler{

    private String typestring;

    public O2liteWsMessageHandler(String typestring_){
        typestring = typestring_;
    }

    public void verifyTypestring(O2liteWsMsg message_) {
        // verify typestring
        if (message_.types.equals(typestring)) {
        } else {
            System.out.println("message_.types: " + message_.types);
            System.out.println("typestring: " + typestring);
            throw new InvalidParameterException();
        }
        // verify clocksync
        // timestamp = 0 - deliver now
        // >0 & not synced w sender - drop bc timestamp meaningless
        // <current time - deliver now
        // else - schedule message to be delivered later
        // dont want to put TS in message & send if not synced yet
        // but ok to assume we never get TS msgs
        // server doesn't pay attn to timestamps - can always respond immediately

    }

    public abstract void handle(O2liteWsMsg message, WebSocketConnection connection);

}
