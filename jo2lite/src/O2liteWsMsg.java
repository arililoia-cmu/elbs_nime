

import java.lang.String;
import java.security.InvalidParameterException;

class O2liteWsMsg {
    public String address;
    public double time;
    public String types;
    public boolean tcpFlag;
    private char[] types_chars;
    private int type_index;

    // msg_builder is gradually built up during marshalling and unmarshalling
    private StringBuilder msg_builder;
    private String[] to_unmarshal;

    private void init() {
        to_unmarshal = null;
        address = "";
        time = -1;
        type_index = -1;
        types = "";
        tcpFlag = false;
        msg_builder = new StringBuilder();
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
    void sendStart(String address, double time, String type_string, boolean tcp) {
        // an addType function is called once for each type specific in
        // the typestring, in the order specified in the typestring
        to_unmarshal = null;  // maybe free some memory
        type_index = 0;
        types = type_string;
        types_chars = types.toCharArray();
        msg_builder.setLength(0);
        msg_builder.append(address);
        msg_builder.append("\u0003");
        msg_builder.append(String.format("%.4f", time));
        msg_builder.append("\u0003");
        msg_builder.append(types);
        msg_builder.append("\u0003");
        msg_builder.append(tcp ? "1" : "0");
        msg_builder.append("\u0003");
    }

    // add values to the message. One of the following must be called for
    //   each type specified in the type string. Results are undefined if
    //   the wrong number of values or incorrect types are added (an
    //   exception may be raised or an invalid message may be constructed).


    // checks that values are set / retrieved in the order specified
    // by the typestring
    void testTypeCall(char typeRepresentation) throws
            IllegalStateException, InvalidParameterException {
        // if we're checking a value that should not exist
        if (type_index >= types.length()) {
            throw new IllegalStateException();
        }

        // if the type we want to return is not the same as the type
        // we should be based on the order of the types:

        // checks that cases match (important for S and s / Symbol and String
        if (types_chars[type_index] != typeRepresentation) {
            throw new InvalidParameterException();
        }
    }

    void addDouble(double x){
        testTypeCall('d');
        msg_builder.append(x);
        msg_builder.append("\u0003");
        type_index++;
    }

    void addFloat(float x) {
        testTypeCall('f');
        msg_builder.append(x);
        msg_builder.append("\u0003");
        type_index++;
    }
    void addInt32(int i) {
        testTypeCall('i');
        msg_builder.append(i);
        msg_builder.append("\u0003");
        type_index++;
    }

    //int64 is long in java
    void addInt64(long i) {
        testTypeCall('h');
        msg_builder.append(i);
        msg_builder.append("\u0003");
        type_index++;
    }

    void addString(String s) {
        testTypeCall('s');
        msg_builder.append(s);
        msg_builder.append("\u0003");
        type_index++;
    }
    void addSymbol(String S) {
        testTypeCall('S');
        msg_builder.append(S);
        msg_builder.append("\u0003");
        type_index++;
    }

    void addTime(double t) {
        testTypeCall('t');
        msg_builder.append(String.format("%.4f", t));
        msg_builder.append("\u0003");
        type_index++;
    }

    // retrieve a fully formed message (to be called only after all
    // values have been added. This may be called more than once, and
    // the message is valid until sendStart() or is called to start a new
    // message.
    String getMessage() {
        if (type_index != types.length()) {
            throw new IllegalStateException();
        } else {
            return msg_builder.toString();
        }
    }

    // begin to unmarshal a message. Upon return, the fields address, time,
    // types and tcpFlag are set according to the message.
    void extractStart(String s) {
        // clear all memory of the message that may have been
        // contained in the object
        msg_builder.setLength(0);
        type_index = 0;
        to_unmarshal = s.split("\u0003");
        address = to_unmarshal[0];
        time = Double.parseDouble(to_unmarshal[1]);
        types = to_unmarshal[2];
        types_chars = types.toCharArray();
        type_index = 0;
        tcpFlag = Integer.parseInt(to_unmarshal[3]) != 0;
    }

    // get values from the message. The following may be called to retrieve
    //   values from a message after the message is provided by extractStart().
    //   These get functions must be called in order and according to the
    //   types in the types field. Results are undefined if too many calls
    //   are made or if a call does not correspond to the next type (an
    //   exception may be raised or an invalid message may be constructed).

    public double getDouble() {
        if (to_unmarshal != null) {
            testTypeCall('d');
            double parsed = Double.parseDouble(to_unmarshal[type_index + 4]);
            return parsed;
        } else {
            throw new IllegalStateException();
        }
    }

    public float getFloat() {
        if (to_unmarshal != null) {
            testTypeCall('f');
            float parsed = Float.parseFloat(to_unmarshal[type_index + 4]);
            return parsed;
        } else {
            throw new IllegalStateException();
        }
    }

    public int getInt32() {
        if (to_unmarshal != null) {
            testTypeCall('i');
            int parsed = Integer.parseInt(to_unmarshal[type_index + 4]);
            return parsed;
        } else {
            throw new IllegalStateException();
        }
    }

    public long getInt64() {
        if (to_unmarshal != null) {
            testTypeCall('h');
            long parsed = Long.parseLong(to_unmarshal[type_index + 4]);
            return parsed;
        } else {
            throw new IllegalStateException();
        }
    }
    public String getString() {
        if (to_unmarshal != null) {
            testTypeCall('s');
            String parsed = to_unmarshal[type_index + 4];
            return parsed;
        } else {
            throw new IllegalStateException();
        }
    }

    public String getSymbol() {
        if (to_unmarshal != null) {
            testTypeCall('S');
            String parsed = to_unmarshal[type_index + 4];
            return parsed;
        } else {
            throw new IllegalStateException();
        }
    }

    public double getTime() {
        if (to_unmarshal != null) {
            testTypeCall('t');
            double parsed = Double.parseDouble(to_unmarshal[type_index + 4]);
            return parsed;
        } else {
            throw new IllegalStateException();
        }
    }


    // Convert to human-readable string. this should be either a completed
    // message ready for getMessage() or just after getMessage(), OR this
    // can be any time after extractStart().
    @Override
    public String toString() {
        StringBuilder toPrint = new StringBuilder();
        toPrint.append("O2liteWsMsg: ");

        if (to_unmarshal != null) {  // after extractStart
            toPrint.append(address + " ");
            toPrint.append("time=" + time + " ");
            toPrint.append("\"" + types);
            toPrint.append(tcpFlag ? "\" tcp" : "\" udp");
            if (types_chars.length > 0) {
                toPrint.append(" |");  // separator for first value
            }
            for (int i = 0; i < types_chars.length; i++) {
                toPrint.append(to_unmarshal[i + 4] + "|");
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
