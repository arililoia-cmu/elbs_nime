// hprint.js -- console-like text output to webpage
// Roger B. Dannenberg, November 2015
// 
// DOCUMENTATION:
//
// hprint(a, b, c, ...) -- convert arguments to strings and 
//     print them with one space separation
// hprintln() is identical to hprint() except that it prints
//     a newline after printing the arguments
// hlines(n) -- restrict the number of lines to appear,
//     if n is negative, there is no restriction
// hprecision(d) -- prints floating point numbers with up to d places
//     to the right of the decimal point. If d is negative, numbers are
//     printed using the default toString() method.
// createHlines(width, height) -- specify output size in pixels. This
//     is not required, but if called, output will appear in a scrollable box
// removeHlines() -- removes output, but output may be resumed. To resume
//     output to a scrollable box, call createHlines() again.


// EXAMPLES:
//
// hprintln("Hello World") -- prints "Hello World\n"
// hprint(3, 2, 1, 'go') -- prints "3 2 1 go"
// hprintln("" + 3 + 2 + 1 + 'go') -- prints "321go"
// hprecision(3); hprint(12.0, 1.23456) -- prints "12 1.234"

var hlinesArray = [];
var hLastLineEnded = false;
var hlinesMax = -1; // means no limit
var hdigits = -1; // means no limit
var hlinesBox;

function createHlines(w, h) {
    removeHlines(); // don't leave stragglers
    hlinesBox = createDiv("");
    hlinesBox.style("font-family", "monospace");
    hlinesBox.style("width", "" + w + "px");
    hlinesBox.style("height", "" + h + "px");
    hlinesBox.style("border", "1px solid #ccc");
    hlinesBox.style("overflow", "auto");
    hlinesBox.style("word-wrap", "break-word");
}


function removeHlines() {
    if (hlinesBox) {
        hlinesBox.remove();
        hlinesBox = false;
    } else {
        for (var i = 0; i < hlinesArray.length; i++) {
            hlinesArray[i].remove();
        }
    }
    hLastLineEnded = false;
    hlinesArray = [];
}


function hlines(n) {
    hlinesMax = n;
}


function hprecision(n) {
    hdigits = n;
}


function hprint() {
    hpPrintValues(arguments);
}


function hprintln() {
    hpPrintValues(arguments);
    hpNewline();
}


function hpPrintValues(args) {
    var s = "";
    for (var i = 0; i < args.length; i++) {
        var x = args[i];
        if (typeof x === "number" && hdigits >= 0) {
            // convert to string with hdigits, then remove trailing 0's and .:
            x = x.toFixed(hdigits).replace(/\.?0*$/,'')
        } else {
            x = x.toString();
        }
        s = s + x
        if (i < args.length - 1) s = s + " ";
    }
    while (s.length > 0) {
        var newlineIndex = s.indexOf("\n");
        if (newlineIndex != -1) {
            var sub = s.substring(0, newlineIndex);
            hpPrintString(sub);
            hpNewline();
            s = s.substring(newlineIndex + 1);
        } else {
            hpPrintString(s);
            s = "";
        }
    }
}


function hpNewline() {
    hpNeedAtLeastOneLine();
    hpAppendEmptyLine();
}


function hpAppendEmptyLine() {
    if (hlinesBox) {
        hlinesArray.push("");
    } else {
        var div = createDiv("");
        div.style("font-family", "monospace");
        div.style("word-wrap", "break-word");
        hlinesArray.push(div);
    }
}


function hpNeedAtLeastOneLine() {
    if (hlinesArray.length === 0) {
        hpAppendEmptyLine();
    }
}


function hpEscape(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').
             replace(/>/g, '&gt;').replace(/ /g, '&nbsp;');
}


function hpPrintString(s) {
    s = hpEscape(s);
    hpNeedAtLeastOneLine();
    if (hlinesBox) { // hlinesArray has strings to put in box
        hlinesArray[hlinesArray.length - 1] += s;
        if (hlinesMax >= 0) {
            hlinesArray = hlinesArray.slice(-hlinesMax);
        }
        var allText = "";
        for (var i = 0; i < hlinesArray.length; i++) {
            allText += hlinesArray[i];
            if (i < hlinesArray.length - 1) {
                allText += "<br\>";
            }
        }
        hlinesBox.html(allText);
    } else { // hlinesArray has divs
        var html = hlinesArray[hlinesArray.length - 1].html();
        hlinesArray[hlinesArray.length - 1].html(html + s);
        if (hlinesMax >= 0 && hlinesArray.length > hlinesMax) {
            for (var i = 0; i < hlinesArray.length - hlinesMax; i++) {
                hlinesArray[i].remove();
            }
            hlinesArray = hlinesArray.slice(-hlinesMax);
        }
    }
}
