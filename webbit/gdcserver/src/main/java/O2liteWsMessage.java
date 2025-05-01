import java.lang.String;
import java.security.InvalidParameterException;
import java.util.IllegalFormatConversionException;
import java.util.Locale;

class O2liteWsMsg {
    public String address;
    public double timestamp;
    public String types;
    public boolean tcpFlag;
    private char[] typestringCharArray;
    private int typeIndex;

    // msgBuilder is gradually built up during marshalling and unmarshalling
    private StringBuilder msgBuilder;
    private String[] toUnmarshal;

    private void init() {
        toUnmarshal = null;
        address = "";
        timestamp = -1;
        typeIndex = -1;
        types = "";
        tcpFlag = false;
        msgBuilder = new StringBuilder();
    }


    // constructor:
    O2liteWsMsg() {
        init();
    }


    O2liteWsMsg(String msg) {
        init();
        extractStart(msg);
    }


    // prepare to send a message: clears the object state and begins to
    // construct a message with the given parameters
    void sendStart(String address, double timestamp, String type_string,
                   boolean tcp) {
        // an addType function is called once for each type specific in
        // the typestring, in the order specified in the typestring
        toUnmarshal = null;  // maybe free some memory
        typeIndex = 0;
        types = type_string;
        typestringCharArray = types.toCharArray();
        msgBuilder.setLength(0);
        msgBuilder.append(address);
        // issue fixed here - had to again switch time and types
        msgBuilder.append("\u0003");
        msgBuilder.append(types);
        msgBuilder.append("\u0003");
        msgBuilder.append(String.format(Locale.US, "%.4f", timestamp));
        msgBuilder.append("\u0003");
        msgBuilder.append(tcp ? "T" : "F");
        msgBuilder.append("\u0003");
    }

    // add values to the message. One of the following must be called for
    //   each type specified in the type string. Results are undefined if
    //   the wrong number of values or incorrect types are added (an
    //   exception may be raised or an invalid message may be constructed).

    // checks that values are set / retrieved in the order specified
    // by the typestring
    void testTypeCall(char typestringToTest) throws
            IllegalStateException, InvalidParameterException {
        // if we're checking a value that should not exist
        if (typeIndex >= types.length()) {
            throw new IllegalStateException();
        }

        // if the type we want to return is not the same as the type
        // we should be based on the order of the types:
        if (typestringCharArray[typeIndex] != typestringToTest) {
            throw new InvalidParameterException();
        }
    }

    void addDouble(double x){
        testTypeCall('d');
        msgBuilder.append(x);
        msgBuilder.append("\u0003");
        typeIndex++;
    }

    void addFloat(float x) {
        testTypeCall('f');
        msgBuilder.append(x);
        msgBuilder.append("\u0003");
        typeIndex++;
    }
    void addInt32(int i) {
        testTypeCall('i');
        msgBuilder.append(i);
        msgBuilder.append("\u0003");
        typeIndex++;
    }

    //int64 is long in java
    void addInt64(long i) {
        testTypeCall('h');
        msgBuilder.append(i);
        msgBuilder.append("\u0003");
        typeIndex++;
    }

    void addString(String s) {
        testTypeCall('s');
        msgBuilder.append(s);
        msgBuilder.append("\u0003");
        typeIndex++;
    }
    void addSymbol(String S) {
        testTypeCall('S');
        msgBuilder.append(S);
        msgBuilder.append("\u0003");
        typeIndex++;
    }

    void addTime(double t) {
        testTypeCall('t');
        msgBuilder.append(String.format(Locale.US, "%.4f", t));
        msgBuilder.append("\u0003");
        typeIndex++;
    }

    // retrieve a fully formed message (to be called only after all
    // values have been added. This may be called more than once, and
    // the message is valid until sendStart() is called to start a new
    // message.
    String getMessage() {
        if (typeIndex != types.length()) {
            throw new IllegalStateException();
        } else {
            return msgBuilder.toString();
        }
    }

    
    // begin to unmarshal a message. Upon return, the fields address, time,
    // types and tcpFlag are set according to the message.
    void extractStart(String s) {
        // clear all memory of the message that may have been
        // contained in the object
        msgBuilder.setLength(0);
        typeIndex = 0;
        // important to use -1 to avoid discarding empty strings
        toUnmarshal = s.split("\u0003", -1); // "\\u0003" also works here
        // incoming message must have at least 4 fields:

        // putting this condition here to avoid triggering
        // runtime exceptions every time we send a nop
        // we'll just assume that any message of length 1 we send
        // over the websocket is a NOP message
        if (toUnmarshal.length == 1){
            System.out.println("NOP Message Received");
            return;
        }

        if (toUnmarshal.length < 4) {
            System.out.println(toUnmarshal.length);
            System.out.println(toUnmarshal);
            throw new RuntimeException(
                              "O2 message from websocket is missing fields");
        }
        address = toUnmarshal[0];
        types = toUnmarshal[1];
        timestamp = Double.parseDouble(toUnmarshal[2]);
        typestringCharArray = types.toCharArray();
        typeIndex = 0;
        if (toUnmarshal[3].equals("T")) {
            tcpFlag = true;
        } else {
            tcpFlag = false;
        }
        // after address,types,timestamp,tcpflag, there should be one more
        // element in toUnmarshal for each character in types, plus one more
        // because split will consider there to be an empty string after the
        // final ETX (and because every field is terminated by ETX):
        if (toUnmarshal.length != typestringCharArray.length + 5) {
            throw new RuntimeException(
                    "O2 message from websocket types and parameters mismatch");

        }
    }

    // get values from the message. The following may be called to retrieve
    //   values from a message after the message is provided by extractStart().
    //   These get functions must be called in order and according to the
    //   types in the types field. Results are undefined if too many calls
    //   are made or if a call does not correspond to the next type (an
    //   exception may be raised or an invalid message may be constructed).

    public double getDouble() {
        if (toUnmarshal != null) {
            testTypeCall('d');
            double parsed = Double.parseDouble(toUnmarshal[typeIndex + 4]);
            typeIndex++;
            return parsed;
        } else {
            throw new IllegalStateException();
        }
    }

    public float getFloat() {
        if (toUnmarshal != null) {
            testTypeCall('f');
            float parsed = Float.parseFloat(toUnmarshal[typeIndex + 4]);
            typeIndex++;
            return parsed;
        } else {
            throw new IllegalStateException();
        }
    }

    public int getInt32() {
        if (toUnmarshal != null) {
            testTypeCall('i');
            int parsed = Integer.parseInt(toUnmarshal[typeIndex + 4]);
            typeIndex++;
            return parsed;
        } else {
            throw new IllegalStateException();
        }
    }

    public long getInt64() {
        if (toUnmarshal != null) {
            testTypeCall('h');
            long parsed = Long.parseLong(toUnmarshal[typeIndex + 4]);
            typeIndex++;
            return parsed;
        } else {
            throw new IllegalStateException();
        }
    }
    public String getString() {
        if (toUnmarshal != null) {
            testTypeCall('s');
            String parsed = toUnmarshal[typeIndex + 4];
            typeIndex++;
            return parsed;
        } else {
            throw new IllegalStateException();
        }
    }

    public String getSymbol() {
        if (toUnmarshal != null) {
            testTypeCall('S');
            String parsed = toUnmarshal[typeIndex + 4];
            typeIndex++;
            return parsed;
        } else {
            throw new IllegalStateException();
        }
    }

    public double getTime() {
        if (toUnmarshal != null) {
            testTypeCall('t');
            double parsed = Double.parseDouble(toUnmarshal[typeIndex + 4]);
            typeIndex++;
            return parsed;
        } else {
            throw new IllegalStateException();
        }
    }

    // Convert params to string for logging purposes. Should be called
    // under the same conditions as toString
    public String getAddrParamsAsString() {
        if (toUnmarshal != null) {
            StringBuilder toReturn = new StringBuilder();
            int nParams = typestringCharArray.length;
            toReturn.append(String.format(Locale.US, "%.3f", timestamp));
            toReturn.append(",\"" + address);
            toReturn.append("\"," + types);  // note no comma yet

            for (int i = 0; i < nParams; i++) {
                String param = toUnmarshal[i + 4];
                // round floats and times to 4 decimal places
                if ("tf".indexOf(typestringCharArray[i]) >= 0) {
                    param = String.format(Locale.US, "%.4f",
                                          Float.parseFloat(param));
                // strings get quoted
                } else if (typestringCharArray[i] == 's') {
                    param = "\"" + param + "\"";
                }
                // integers and anything else are unquoted and unrounded
                toReturn.append(",").append(param);
            }
            return toReturn.toString();
        } else {
            O2liteWsMsg o2litewsmsg = new O2liteWsMsg(getMessage());
            return o2litewsmsg.getAddrParamsAsString();
        }
    }


    // Convert to human-readable string. this should be either a completed
    // message ready for getMessage() or just after getMessage(), OR this
    // can be any time after extractStart().
    @Override
    public String toString() {
        StringBuilder toPrint = new StringBuilder();
        toPrint.append("O2liteWsMsg: ");

        if (toUnmarshal != null) {  // after extractStart
            toPrint.append(address + " ");
            toPrint.append("timestamp=" + timestamp + " ");
            toPrint.append("\"" + types);
            toPrint.append(tcpFlag ? "\" tcp" : "\" udp");
            if (typestringCharArray.length > 0) {
                toPrint.append(" |");  // separator for first value
            }
            for (int i = 0; i < typestringCharArray.length; i++) {
                toPrint.append(toUnmarshal[i + 4] + "|");
            }
            return toPrint.toString();
        } else {
            return makeReadable(getMessage());
        }
    }

    // convert an String-encoded (but not yet converted to UTF-8)
    // O2liteWsMsg to a human-readable string
    static String makeReadable(String encoded) {
        O2liteWsMsg o2litewsmsg = new O2liteWsMsg(encoded);
        return o2litewsmsg.toString();
    }

}
