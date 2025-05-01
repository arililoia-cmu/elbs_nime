# jo2lite - Java API for sending/receiving o2lite over websockets

## O2lite messages

An O2lite message consists of
1. An address, e.g. "/synth/volume"
2. A type string, e.g. "dfihsSt" means double, float, int32, int64, string, symbol, time. O2lite supports only these types. (A symbol is a unique string such as a Lisp atom or Serpent symbol. Most languages do not have this type. The distinguishing feature of a symbol is that there cannot be two symbol objects with the same name. In practice this means symbol comparison is equivalent to pointer comparison, while string compares require character-by-character comparison if the pointers are different.)
3. A timestamp (type double)
4. TCP flag: true for reliable send (TCP), false for best effort (UDP)
5. An ordered list of values corresponding in types to the type string.

## Text string representation

Over websockets, an O2lite message is a single string organized as follows. ETX is the ASCII character with code 3 (not the digit "3") and EOS is a zero byte:
1. address
2. ETX
3. type string
4. ETX
5. timestamp
6. ETX
7. TCP flag (represented as "T" or "F")
8. ETX
9. value 1 (if type string is not empty)
10. ETX (if type string is not empty)
11. value 2 (if type string has at least 1 type)
12. ETX (if type string has at least 1 type)
13. additional values according to type string, each terminated by ETX
14. EOS

Strings are encoded in UTF-8. Numbers are encoded in decimal. Integers are exact. Floats and doubles use "." for the decimal point (e.g. even if the
current locale says use ",", O2lite uses ".". Float and double values are approximate and should use the default format for the "US" locale (perhaps a future API will offer a precision parameter to send high-precision doubles). Time values should use 4 decimal places (100 microsecond precision) as a tradeoff between precision and message length, and never use scientific notation, but note that zero timestamps need only one character: "0".

## Java class declaration

The details of marshalling and unmarshalling are encapsulated within class O2liteWsMsg:

```
class O2liteWsMsg {
    public string address;
    public double time;
    public string types;
    public boolean tcpFlag;

    string msg;

    // constructor:
    O2liteWsMsg() { ... }

    // prepare to send a message: clears the object state and begins to
    //   construct a message with the given parameters
    sendStart(string address, double time, string types, boolean tcp) {}

    // add values to the message. One of the following must be called for
    //   each type specified in the type string. Results are undefined if
    //   the wrong number of values or incorrect types are added (an
    //   exception may be raised or an invalid message may be constructed).
    void addDouble(double x) { }
    void addFloat(float x) { }
    void addInt32(int i) { }
    void addInt64(long i) { }
    void addString(string s) { }
    void addSymbol(string s) { }
    void addTime(double t) { }

    // retrieve a fully formed message (to be called only after all
    //   values have been added. This may be called more than once, and
    //   the message is valid until sendStart() or is called to start a new
    //   message.
    string getMessage() { }

    // begin to unmarshal a message. Upon return, the fields address, time,
    //   types and tcpFlag are set according to the message.
    void extractStart(string s) { }

    // get values from the message. The following may be called to retrieve
    //   values from a message after the message is provided by extractStart().
    //   These get functions must be called in order and according to the
    //   types in the types field. Results are undefined if too many calls
    //   are made or if a call does not correspond to the next type (an
    //   exception may be raised or an invalid message may be constructed).
    double getDouble() { }
    float getFloat() { }
    int getInt32() { }
    long getInt64() { }
    string getString() { }
    string getSymbol() { }
    double getTime() { }
}
```

# Testing

```
O2liteWsMsg msg = O2liteWsMsg();
msg.sendStart("/p1/hit", 12.34, "dfihsSt", true);
msg.addDouble(456.789);
msg.addFloat(56.78);
...
msg.addTime(234.567);
string websockmsg = msg.getMessage();

msg.extractStart(websockmsg);
assert(msg.address == "/p1/hit");
assert(msg.time == 12.34);
assert(msg.types == "dfihsSt");
assert(msg.tcpFlag);
assert(msg.getDouble() == 456.789);
...
assert(msg.getTime() == 234.567);
```


    
