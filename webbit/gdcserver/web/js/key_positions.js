// Accommodate differently designed keyboards
// Default: only the keys whose general positions are consistent
// across ANSI, ISO, JIS standards are listed here

const LEFT_SIDE_KEYS = new Set([
    "1", "2", "3", "4", "5",
    "q", "w", "e", "r", "t",
    "a", "s", "d", "f", "g",
    "z", "x", "c", "v",
    "Tab", "Control"]);

const RIGHT_SIDE_KEYS = new Set([
    "6", "7", "8", "9", "0",
    "y", "u", "i", "o", "p",
    "h", "j", "k", "l",
    "b", "n", "m",
    "Backspace", "Enter",
]);