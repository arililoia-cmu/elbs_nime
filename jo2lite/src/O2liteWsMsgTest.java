import org.junit.Test;

public class O2liteWsMsgTest {

    private O2liteWsMsg msg;
    private O2liteWsMsg msg2;

    @Test
    public void testParse() throws Exception {
        msg = new O2liteWsMsg();
        msg2 = new O2liteWsMsg();
        msg.sendStart("/p1/hit", 12.34, "dfishSt", true);
        msg.addDouble(456.789);
        msg.addFloat((float) 56.78);
        msg.addInt32(6);
        msg.addString("testString");
        msg.addInt64(38888);
        msg.addSymbol("testSymbol");
        msg.addTime(234.567);
        System.out.println(msg);
        String websockmsg = msg.getMessage();

        //test that new O2liteWsMsg can be loaded from a string
        System.out.println(O2liteWsMsg.makeReadable(websockmsg));
        msg2.extractStart(websockmsg);
        System.out.println(msg2);
        assert(msg2.address.equals("/p1/hit"));
        assert(msg2.time == 12.34);
        assert(msg2.types.equals("dfishSt"));
        assert(msg2.tcpFlag);
        System.out.println(msg2);
        assert(msg2.getDouble() == 456.789);
        System.out.println(msg2);
        assert(msg2.getFloat() == (float) 56.78);
        System.out.println(msg2);
        assert(msg2.getInt32() == 6);
        System.out.println(msg2);
        assert(msg2.getString().equals("testString"));
        System.out.println(msg2);
        assert(msg2.getInt64() == 38888);
        System.out.println(msg2);
        assert(msg2.getSymbol().equals("testSymbol"));
        System.out.println(msg2);
        assert(msg2.getTime() == 234.567);
        System.out.println(msg2);
    }
}
