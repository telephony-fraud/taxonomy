This is a demonstration of a bi-directional hierarchical sankey diagram produced in javascript, html and css using [d3](http://d3js.org/). (Refresh page to generate new random data)

[Sankey diagrams](http://en.wikipedia.org/wiki/Sankey_diagram) represent flows between nodes by varying the thickness of the connecting links.

This diagram was based off of [Mike Bostock's sankey diagram](http://bost.ocks.org/mike/sankey/), but additionally incorporates bi-directionality into the flow and caters for hierarchical relationships between nodes to allow drill down into the data.

All javascript code to generate the diagram markup is contained in the `app.js` file, but the underlying calculations are performed using a custom plugin: [bihisankey.js](https://github.com/Neilos/bihisankey).


Original Fraud figure 
http://www.s3.eurecom.fr/~merve/survey/voice_telephony_fraud.png



See examples in :

http://localhost:8888/energy/
http://localhost:8888/collatz-graph/


D3 book on safari:
http://chimera.labs.oreilly.com/books/1230000000345/ch09.html


Starting a simple web server :
python -m SimpleHTTPServer 8888
