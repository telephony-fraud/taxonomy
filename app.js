'use strict';

var svg, tooltip, biHiSankey, path, defs, colorScale, highlightColorScale, isTransitioning;
var OPACITY = {
    NODE_DEFAULT: 0.9,
    NODE_FADED: 0.1,
    NODE_HIGHLIGHT: 0.8,
    LINK_DEFAULT: 0.6,
    LINK_FADED: 0.05,
    LINK_HIGHLIGHT: 0.9
  },
    TYPES = ["RootCauses", "Weaknesses", "Techniques", "Fraud", "Benefits"],
    //TYPES = ["Asset", "Expense", "Revenue", "Equity", "Liability"],
  TYPE_COLORS = ["#1b9e77", "#d95f02", "#7570b3", "#e7298a", "#66a61e", "#e6ab02", "#a6761d"],
  TYPE_HIGHLIGHT_COLORS = ["#66c2a5", "#fc8d62", "#8da0cb", "#e78ac3", "#a6d854", "#ffd92f", "#e5c494"],
  LINK_COLOR = "#b3b3b3",
  INFLOW_COLOR = "#2E86D1",
  OUTFLOW_COLOR = "#D63028",
  NODE_WIDTH = 170,
  COLLAPSER = {
    RADIUS: NODE_WIDTH / 5,
    SPACING: 2
  },
  OUTER_MARGIN = 2,
  MARGIN = {
    TOP: 2 * (COLLAPSER.RADIUS + OUTER_MARGIN),
    RIGHT: OUTER_MARGIN,
    BOTTOM: OUTER_MARGIN,
    LEFT: OUTER_MARGIN
  },
  TRANSITION_DURATION = 400,
  HEIGHT = 2000 - MARGIN.TOP - MARGIN.BOTTOM,
  WIDTH = 1600 - MARGIN.LEFT - MARGIN.RIGHT,
  LAYOUT_INTERATIONS = 32,
  REFRESH_INTERVAL = 7000,
  USE_TOOLTIPS = false,
  HIGHLIGHTPATH = false,
  DEBUG_DATA=false,
  DEBUG=false;

var formatNumber = function (d) {
  var numberFormat = d3.format(",.0f"); // zero decimal places
  return " " + numberFormat(d);
},

formatFlow = function (d) {
  var flowFormat = d3.format(",.0f"); // zero decimal places with sign
  return " " + flowFormat(Math.abs(d)) + (d < 0 ? " CR" : " DR");
},

// Used when temporarily disabling user interractions to allow animations to complete
disableUserInterractions = function (time) {
  isTransitioning = true;
  setTimeout(function(){
    isTransitioning = false;
  }, time);
},

hideTooltip = function () {
  return tooltip.transition()
    .duration(TRANSITION_DURATION)
    .style("opacity", 0);
},

showTooltip = function () {
  return tooltip
    .style("left", d3.event.pageX + "px")
    .style("top", d3.event.pageY + 15 + "px")
    .transition()
      .duration(TRANSITION_DURATION)
      .style("opacity", 1);
},

debug_log = function(str){
    if (DEBUG){
	console.log(str);
    }
};

colorScale = d3.scale.ordinal().domain(TYPES).range(TYPE_COLORS),
highlightColorScale = d3.scale.ordinal().domain(TYPES).range(TYPE_HIGHLIGHT_COLORS),

svg = d3.select("#chart").append("svg")
        .attr("width", WIDTH + MARGIN.LEFT + MARGIN.RIGHT)
        .attr("height", HEIGHT + MARGIN.TOP + MARGIN.BOTTOM)
      .append("g")
        .attr("transform", "translate(" + MARGIN.LEFT + "," + MARGIN.TOP + ")");

svg.append("g").attr("id", "links");
svg.append("g").attr("id", "nodes");
svg.append("g").attr("id", "collapsers");

tooltip = d3.select("#chart").append("div").attr("id", "tooltip");

tooltip.style("opacity", 0)
    .append("p")
      .attr("class", "value");

biHiSankey = d3.biHiSankey();

// Set the biHiSankey diagram properties
biHiSankey
  .nodeWidth(NODE_WIDTH)
  .nodeSpacing(5)  //old value 10
  .linkSpacing(4)
  .arrowheadScaleFactor(0.7) // Specifies that 0.5 of the link's stroke WIDTH should be allowed for the marker at the end of the link.
  .size([WIDTH, HEIGHT]);

path = biHiSankey.link().curvature(0.05); //old value 0.45

defs = svg.append("defs");

defs.append("marker")
  .style("fill", LINK_COLOR)
  .attr("id", "arrowHead")
  .attr("viewBox", "0 0 6 10")
  .attr("refX", "1")
  .attr("refY", "5")
  .attr("markerUnits", "strokeWidth")
  .attr("markerWidth", "1")
  .attr("markerHeight", "1")
  .attr("orient", "auto")
  .append("path")
    .attr("d", "M 0 0 L 1 0 L 6 5 L 1 10 L 0 10 z");

defs.append("marker")
  .style("fill", OUTFLOW_COLOR)
  .attr("id", "arrowHeadInflow")
  .attr("viewBox", "0 0 6 10")
  .attr("refX", "1")
  .attr("refY", "5")
  .attr("markerUnits", "strokeWidth")
  .attr("markerWidth", "1")
  .attr("markerHeight", "1")
  .attr("orient", "auto")
  .append("path")
    .attr("d", "M 0 0 L 1 0 L 6 5 L 1 10 L 0 10 z");

defs.append("marker")
  .style("fill", INFLOW_COLOR)
  .attr("id", "arrowHeadOutlow")
  .attr("viewBox", "0 0 6 10")
  .attr("refX", "1")
  .attr("refY", "5")
  .attr("markerUnits", "strokeWidth")
  .attr("markerWidth", "1")
  .attr("markerHeight", "1")
  .attr("orient", "auto")
  .append("path")
    .attr("d", "M 0 0 L 1 0 L 6 5 L 1 10 L 0 10 z");

function update (level) {
  var link, linkEnter, node, nodeEnter, collapser, collapserEnter;

  function dragmove(node) {
    // Do not let users move horizontally
    //node.x = Math.max(0, Math.min(WIDTH - node.width, d3.event.x));
    node.y = Math.max(0, Math.min(HEIGHT - node.height, d3.event.y));
    d3.select(this).attr("transform", "translate(" + node.x + "," + node.y + ")");
    biHiSankey.relayout();
    svg.selectAll(".node").selectAll("rect").attr("height", function (d) { return d.height; });
    link.attr("d", path);
  }

  function containChildren(node) {
    node.children.forEach(function (child) {
      child.state = "contained";
      child.parent = this;
      child._parent = null;
      containChildren(child);
    }, node);
  }

  function expand(node) {
    node.state = "expanded";
    node.children.forEach(function (child) {
      child.state = "collapsed";
      child._parent = this;
      child.parent = null;
      containChildren(child);
    }, node);
  }

  function collapse(node) {
    node.state = "collapsed";
    containChildren(node);
  }

  function restoreLinksAndNodes() {
    link
      .style("stroke", LINK_COLOR)
      .style("marker-end", function () { return 'url(#arrowHead)'; })
      .transition()
        .duration(TRANSITION_DURATION)
        .style("opacity", OPACITY.LINK_DEFAULT);

    node
      .selectAll("rect")
        .style("fill", function (d) {
          d.color = colorScale(d.type.replace(/ .*/, ""));
          return d.color;
        })
        .style("stroke", function (d) {
          return d3.rgb(colorScale(d.type.replace(/ .*/, ""))).darker(0.1);
        })
        .style("fill-opacity", OPACITY.NODE_DEFAULT);

    node.filter(function (n) { return n.state === "collapsed"; })
      .transition()
        .duration(TRANSITION_DURATION)
        .style("opacity", OPACITY.NODE_DEFAULT);
  }

  function showHideChildren(node) {
    disableUserInterractions(2 * TRANSITION_DURATION);
    hideTooltip();
    if (node.state === "collapsed") { expand(node); }
    else { collapse(node); }

    biHiSankey.relayout();
    update(level);
    link.attr("d", path);
    restoreLinksAndNodes();
  }


    // link n is a predecessor (in a link chain on the left) of link l
    function isNodePredecessorOfLink(n,l){
	var isPredecessor=false;

	//debug_log("is node "+n.name+" predecessor of link "+l.id);
	if (!l.source) return false;
	if (l.source === n) return true;
	if (l.source.leftLinks.length === 0) return false;

	l.source.leftLinks.forEach(function(ll){
	    if (ll.source === n){
		isPredecessor=true;
	    }else{
		isPredecessor = isPredecessor ||  isNodePredecessorOfLink(n,ll);
	    }
	});
	return isPredecessor;
    }

    function isNodePredecessorOfNode(n,nn){
    	var isPredecessor=false;
        //debug_log("is node "+n.name+" predecessor of node "+nn.name);
    	nn.leftLinks.forEach(function(l){
    	    if(l.source==n)
    		return true;
    	    else
    		isPredecessor = isPredecessor || isNodePredecessorOfLink(n,l);
    	});
    	return isPredecessor;

    }

    // link n is a sucessor (in a link chain on the right) of link l
    function isNodeSuccessorOfLink(n,l){
	var isSuccessor=false;

	//debug_log("is node "+n.name+" successor of link "+l.id);
	if (!l.target) return false;
	if (l.target === n) return true;
	if (l.target.rightLinks.length === 0)  return false;

	l.target.rightLinks.forEach(function(ll){
	    if (ll.dest === n){
		isSuccessor=true;
	    }else{
		isSuccessor = isSuccessor ||  isNodeSuccessorOfLink(n,ll);
	    }
	});
	return isSuccessor;
    }

    function isNodeSuccessorOfNode(n,nn){
    	var isSuccessor=false;
    	nn.rightLinks
	    // we only select the visible links (there are links from
	    // parents to parents which don't make sense for us
	    .filter(function(l){
		//debug_log("link "+ l.id+ " points to node " + l.source.name +" in state "+ l.source.state
		//	    + " from node" + l.target.name +" in state "+ l.target.state);
		if (l.source.state=="expanded"||l.source.dest=="expanded"){
		    debug_log("link "+l.id+" points to/from expanded nodes, ignore")
		    return false;
		}
		else
		    return true;
	    })
	    // then we check for each of the links if the node is a successor
	    .forEach(function(l){
    		isSuccessor = isSuccessor || isNodeSuccessorOfLink(n,l);
		if(isNodeSuccessorOfLink(n,l))
                    debug_log("node "+n.name+" successor of link "+l.id)
    	});

	if(isSuccessor)
            debug_log("node "+n.name+" successor of node "+nn.name)
    	return isSuccessor;
    }



    function highlightConnected(n) {
	link.filter(function (l) {
	    if (HIGHLIGHTPATH){
		return isNodeSuccessorOfLink(n,l)
		    || isNodePredecessorOfLink(n,l)
	    }else{
		return l.source === n;
	    }})
	    .style("marker-end", function () { return 'url(#arrowHeadInflow)'; })
	    .style("stroke", OUTFLOW_COLOR)
	    .style("opacity", OPACITY.LINK_DEFAULT);

	link.filter(function (d) { return d.target === n; })
	  .style("marker-end", function () { return 'url(#arrowHeadOutlow)'; })
	  .style("stroke", INFLOW_COLOR)
	  .style("opacity", OPACITY.LINK_DEFAULT);
    }

  function fadeUnconnected(g) {
      link.filter(function (d) {
	    if (HIGHLIGHTPATH) {
		return isNodeSuccessorOfLink(d,g)
		    || isNodePredecessorOfLink(d,g);
	    }
	  else 	{
	      return d.source !== g && d.target !== g;
	  }
      })
      .style("marker-end", function () { return 'url(#arrowHead)'; })
      .transition()
        .duration(TRANSITION_DURATION)
        .style("opacity", OPACITY.LINK_FADED);

      node.filter(function (d) {
	  //return (d.name === g.name) ? false : !biHiSankey.connected(d, g);
	return (d.name === g.name) ?
	    false
	      : !(biHiSankey.connected(d, g) || isNodeSuccessorOfNode(d, g));// || isNodePredecessorOfNode(d, g));
    }).transition()
      .duration(TRANSITION_DURATION)
      .style("opacity", OPACITY.NODE_FADED);
  }

  link = svg.select("#links").selectAll("path.link")
    .data(biHiSankey.visibleLinks(), function (d) { return d.id; });

  link.transition()
    .duration(TRANSITION_DURATION)
    .style("stroke-WIDTH", function (d) { return Math.max(1, d.thickness); })
    .attr("d", path)
    .style("opacity", OPACITY.LINK_DEFAULT);

  link.exit().remove();

  linkEnter = link.enter().append("path")
    .attr("class", "link")
    .style("fill", "none");

  linkEnter.on('mouseenter', function (d) {
    if (!isTransitioning) {
      showTooltip().select(".value").text(function () {
        if (d.direction > 0) {
          return d.source.name + " => " + d.target.name + "\n" + formatNumber(d.value);
        }
        return d.target.name + " <= " + d.source.name + "\n" + formatNumber(d.value);
      });

      d3.select(this)
        .style("stroke", LINK_COLOR)
        .transition()
          .duration(TRANSITION_DURATION / 2)
          .style("opacity", OPACITY.LINK_HIGHLIGHT);
    }
  });

  linkEnter.on('mouseleave', function () {
    if (!isTransitioning) {
      hideTooltip();

      d3.select(this)
        .style("stroke", LINK_COLOR)
        .transition()
          .duration(TRANSITION_DURATION / 2)
          .style("opacity", OPACITY.LINK_DEFAULT);
    }
  });

  linkEnter.sort(function (a, b) { return b.thickness - a.thickness; })
    .classed("leftToRight", function (d) {
      return d.direction > 0;
    })
    .classed("rightToLeft", function (d) {
      return d.direction < 0;
    })
    .style("marker-end", function () {
      return 'url(#arrowHead)';
    })
    .style("stroke", LINK_COLOR)
    .style("opacity", 0)
    .transition()
      .delay(TRANSITION_DURATION)
      .duration(TRANSITION_DURATION)
      .attr("d", path)
      .style("stroke-WIDTH", function (d) { return Math.max(1, d.thickness); })
      .style("opacity", OPACITY.LINK_DEFAULT);


  node = svg.select("#nodes").selectAll(".node")
      .data(biHiSankey.collapsedNodes(), function (d) { return d.id; });


  node.transition()
    .duration(TRANSITION_DURATION)
    .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; })
    .style("opacity", OPACITY.NODE_DEFAULT)
    .select("rect")
      .style("fill", function (d) {
        d.color = colorScale(d.type.replace(/ .*/, ""));
        return d.color;
      })
      .style("stroke", function (d) { return d3.rgb(colorScale(d.type.replace(/ .*/, ""))).darker(0.1); })
      .style("stroke-WIDTH", "1px")
      .attr("height", function (d) { return d.height; })
      .attr("width", biHiSankey.nodeWidth());


  node.exit()
    .transition()
      .duration(TRANSITION_DURATION)
      .attr("transform", function (d) {
        var collapsedAncestor, endX, endY;
        collapsedAncestor = d.ancestors.filter(function (a) {
          return a.state === "collapsed";
        })[0];
        endX = collapsedAncestor ? collapsedAncestor.x : d.x;
        endY = collapsedAncestor ? collapsedAncestor.y : d.y;
        return "translate(" + endX + "," + endY + ")";
      })
      .remove();


  nodeEnter = node.enter().append("g").attr("class", "node");

  nodeEnter
    .attr("transform", function (d) {
      var startX = d._parent ? d._parent.x : d.x,
          startY = d._parent ? d._parent.y : d.y;
      return "translate(" + startX + "," + startY + ")";
    })
    .style("opacity", 1e-6)
    .transition()
      .duration(TRANSITION_DURATION)
      .style("opacity", OPACITY.NODE_DEFAULT)
      .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; });

  nodeEnter.append("rect")
    .style("fill", function (d) {
      d.color = colorScale(d.type.replace(/ .*/, ""));
      return d.color;
    })
    .style("stroke", function (d) {
      return d3.rgb(colorScale(d.type.replace(/ .*/, ""))).darker(0.1);
    })
    .style("stroke-WIDTH", "1px")
    .attr("height", function (d) { return d.height; })
    .attr("width", biHiSankey.nodeWidth());
  nodeEnter.append("text");

    node.on("mouseenter", function (g) {
    if (!isTransitioning) {
      restoreLinksAndNodes();
      highlightConnected(g);
      fadeUnconnected(g);

      d3.select(this).select("rect")
        .style("fill", function (d) {
          d.color = d.netFlow > 0 ? INFLOW_COLOR : OUTFLOW_COLOR;
          return d.color;
        })
        .style("stroke", function (d) {
          return d3.rgb(d.color).darker(0.1);
        })
        .style("fill-opacity", OPACITY.LINK_DEFAULT);

   if(USE_TOOLTIPS){
      tooltip
        .style("left", g.x + MARGIN.LEFT + "px")
        .style("top", g.y + g.height + MARGIN.TOP + 30 + "px")
        .transition()
          .duration(TRANSITION_DURATION)
          .style("opacity", 1).select(".value")
          .text(function () {
            var additionalInstructions = g.children.length ? "\n(Double click to expand)" : "";
              return g.name + "\nNet flow: " + formatFlow(g.netFlow) + additionalInstructions +
      		  + "\nnode.name="+g.name+"\nnode.type="+g.type+"\nnode.id="+g.id
      	      	  + "\nnode.source="+g.source+"\nnode.target="+g.target;
          });
   }
    }
  });

  node.on("mouseleave", function () {
    if (!isTransitioning) {
      hideTooltip();
      restoreLinksAndNodes();
    }
  });

  node.filter(function (d) { return d.children.length; })
    .on("dblclick", showHideChildren);

  // allow nodes to be dragged to new positions
  node.call(d3.behavior.drag()
    .origin(function (d) { return d; })
    .on("dragstart", function () { this.parentNode.appendChild(this); })
    .on("drag", dragmove));

  // add in the text for the nodes
  node.filter(function (d) { return d.value !== 0; })
    .select("text")
      .attr("x", biHiSankey.nodeWidth())
      .attr("y", function (d) { return d.height / 2; })
      .attr("dy", ".35em")
      .attr("text-anchor", "end")
      .attr("transform", null)
      .text(function (d) { return d.name; })
      .filter(function (d) { return d.x < 4* WIDTH / 5; })
      .attr("x", 3) // here we add a few pix to not start the label right at the beginning of the box
      .attr("text-anchor", "start");


  collapser = svg.select("#collapsers").selectAll(".collapser")
    .data(biHiSankey.expandedNodes(), function (d) { return d.id; });


  collapserEnter = collapser.enter().append("g").attr("class", "collapser");

  collapserEnter.append("circle")
    .attr("r", COLLAPSER.RADIUS)
    .style("fill", function (d) {
      d.color = colorScale(d.type.replace(/ .*/, ""));
      return d.color;
    });

  collapserEnter
    .style("opacity", OPACITY.NODE_DEFAULT)
    .attr("transform", function (d) {
      return "translate(" + (d.x + d.width / 2) + "," + (d.y + COLLAPSER.RADIUS) + ")";
    });

  collapserEnter.on("dblclick", showHideChildren);

  collapser.select("circle")
    .attr("r", COLLAPSER.RADIUS);

  collapser.transition()
    .delay(TRANSITION_DURATION)
    .duration(TRANSITION_DURATION)
    .attr("transform", function (d, i) {
      return "translate("
        + (COLLAPSER.RADIUS + i * 2 * (COLLAPSER.RADIUS + COLLAPSER.SPACING))
        + ","
        + (-COLLAPSER.RADIUS - OUTER_MARGIN)
        + ")";
    });

  collapser.on("mouseenter", function (g) {
    if (!isTransitioning) {
      showTooltip().select(".value")
        .text(function () {
          return g.name + "\n(Double click to collapse)";
        });

      var highlightColor = highlightColorScale(g.type.replace(/ .*/, ""));

      d3.select(this)
        .style("opacity", OPACITY.NODE_HIGHLIGHT)
        .select("circle")
          .style("fill", highlightColor);

      node.filter(function (d) {
        return d.ancestors.indexOf(g) >= 0;
      }).style("opacity", OPACITY.NODE_HIGHLIGHT)
        .select("rect")
          .style("fill", highlightColor);
    }
  });

  collapser.on("mouseleave", function (g) {
   if (!isTransitioning) {
      hideTooltip();
      d3.select(this)
        .style("opacity", OPACITY.NODE_DEFAULT)
        .select("circle")
          .style("fill", function (d) { return d.color; });

      node.filter(function (d) {
        return d.ancestors.indexOf(g) >= 0;
      }).style("opacity", OPACITY.NODE_DEFAULT)
        .select("rect")
          .style("fill", function (d) { return d.color; });
    }
  });

  collapser.exit().remove();
}

var exampleNodes;
var exampleLinks;

// TODO add a field to each node wiht a longer description, this should be shown on the tooltip
// TODO add a field to each link, show details about the links (justification and citation if availavble)

if (!DEBUG_DATA){

exampleNodes = [
    {"type":"RootCauses","id":"r", "parent":null,"name":"Root causes"},
    {"type":"RootCauses","id":12,  "parent":"r","number":"1","name":"Legacy protocols"},//legacy protocols not designed security in mind
    {"type":"RootCauses","id":13,  "parent":"r","number":"1","name":"Variety of operators"},
    {"type":"RootCauses","id":14,  "parent":"r","number":"1","name":"Variety of Mediums"},//, IP convergence"}, //same as ip convergence?


    {"type":"Weaknesses","id":"w","parent":null,"number":"w","name":"Weaknesses"},
    //lack of due diligence,lack of international law enforcement,variety of laws, regulations worldwide
    {"type":"Weaknesses","id":21, "parent":"w","number":"1","name":"Legal"},
    {"type":"Weaknesses","id":211, "parent":"21","number":"1","name":"Lack of due diligence"}, //deregulated interconnect agreements
    {"type":"Weaknesses","id":212, "parent":"21","number":"1","name":"International law enforcement"},
    {"type":"Weaknesses","id":213, "parent":"21","number":"1","name":"Variety of regulation and laws"},
    {"type":"Weaknesses","id":214, "parent":"21","number":"1","name":"Difficulty of joint industry initiative"},
    {"type":"Weaknesses","id":215, "parent":"21","number":"1","name":"Number Portability"},
    {"type":"Weaknesses","id":216, "parent":"21","number":"1","name":"Arbitrage opportunities"},//result of deregulation, convergence

    {"type":"Weaknesses","id":22, "parent":"w","number":"1","name":"Protocol Weaknesses"},
    {"type":"Weaknesses","id":221, "parent":"22","number":"1","name":"Lack of Route Transperancy"},
    {"type":"Weaknesses","id":222, "parent":"22","number":"1","name":"Lack of Caller ID Authentication"},
    {"type":"Weaknesses","id":223, "parent":"22","number":"1","name":"Mobile and VOIP related"},
    {"type":"Weaknesses","id":225, "parent":"22","number":"1","name":"Lack of security mechanisms in SS7"},

    {"type":"Weaknesses","id":23, "parent":"w","number":"1","name":"Billing systems"},
    {"type":"Weaknesses","id":231, "parent":"23","number":"1","name":"Late availability of roaming CDRs"},
    {"type":"Weaknesses","id":232, "parent":"23","number":"1","name":"Billing of V.A.S"},
    {"type":"Weaknesses","id":233, "parent":"23","number":"1","name":"Tariff plan related"},

    {"type":"Weaknesses","id":24, "parent":"w","number":"1","name":"Human Negligence"},
    {"type":"Weaknesses","id":241, "parent":"24","number":"1","name":"Poor Deployment Practices"},
    {"type":"Weaknesses","id":242, "parent":"24","number":"1","name":"Software Vulnerability Management"},
    {"type":"Weaknesses","id":243, "parent":"24","number":"1","name":"Lack of awareness"}, //"of security and fraud awareness"},
    {"type":"Weaknesses","id":244, "parent":"24","number":"1","name":"Lack of audit"},// lack of internal control systems in companies"},


    {"type":"Techniques","id":"t","parent":null,"number":"t","name":"Techniques"},
    {"type":"Techniques","id":31, "parent":"t","number":"1","name":"Operator level"},
    {"type":"Techniques","id":311,"parent":"31","number":"1","name":"Manipulation of call signaling"},
    {"type":"Techniques","id":312,"parent":"31","number":"1","name":"Number range hijacking"},
    {"type":"Techniques","id":313,"parent":"31","number":"1","name":"Confusion pricing"},
    {"type":"Techniques","id":315,"parent":"31","number":"1","name":"Manipulation of call routing"},

    {"type":"Techniques","id":32, "parent":"t","number":"1","name":"Increasing Profit"},
    {"type":"Techniques","id":321, "parent":"32","number":"1","name":"Traffic pumping"},
    {"type":"Techniques","id":322, "parent":"32","number":"1","name":"Multiple simultaneous calls"},

    {"type":"Techniques","id":33, "parent":"t","number":"1","name":"Value Added Services"},
    {"type":"Techniques","id":331, "parent":"33","number":"1","name":"Premium Rate Services"},
    {"type":"Techniques","id":332, "parent":"33","number":"1","name":"CNAM"},
    {"type":"Techniques","id":333, "parent":"33","number":"1","name":"Toll Free Numbers"},



    {"type":"Techniques","id":35, "parent":"t","number":"1","name":"Protocol Attakcs"},
    {"type":"Techniques","id":351, "parent":"35","number":"1","name":"SS7 Tampering"},
    {"type":"Techniques","id":352, "parent":"35","number":"1","name":"VOIP Protocol Attacks"},
    {"type":"Techniques","id":353, "parent":"35","number":"1","name":"Caller ID Spoofing"},
    {"type":"Techniques","id":354, "parent":"35","number":"1","name":"IMSI Catchers"},



    {"type":"Techniques","id":37, "parent":"t","number":"1","name":"Other"},
    {"type":"Techniques","id":373, "parent":"37","number":"1","name":"TDOS"},
    {"type":"Techniques","id":376, "parent":"37","number":"1","name":"Social Engineering"},
    {"type":"Techniques","id":377, "parent":"37","number":"1","name":"Autodialers"},
    {"type":"Techniques","id":378, "parent":"37","number":"1","name":"PBX hacking"},
    {"type":"Techniques","id":379, "parent":"37","number":"1","name":"SIM Boxes"},
    {"type":"Techniques","id":3710, "parent":"37","number":"1","name":"Mobile malware"},
    {"type":"Techniques","id":3711, "parent":"37","number":"1","name":"Cloning and theft"},

    {"type":"Fraud","id":"f","parent":null,"number":"f","name":"Fraud types"},
    {"type":"Fraud","id":41,"parent":"f","number":"1","name":"Wholesale billing fraud"},
//    {"type":"Fraud","id":411,"parent":"41","number":"1","name":"Cherry Picking"},
//    {"type":"Fraud","id":412,"parent":"41","number":"1","name":"Tromboning"},
    {"type":"Fraud","id":413, "parent":"41","number":"1","name":"Re-origination"},
    {"type":"Fraud","id":414, "parent":"41","number":"1","name":"Route Blending"},
//    {"type":"Fraud","id":415, "parent":"41","number":"1","name":"Whipsawing"},
    {"type":"Fraud","id":416, "parent":"41","number":"1","name":"Interconnect Bypass Fraud"},
//    {"type":"Fraud","id":417, "parent":"41","number":"1","name":"Call Looping"},
    {"type":"Fraud","id":418, "parent":"41","number":"1","name":"False Answer Supervision"},
    //419- fraudulent operators
    {"type":"Fraud","id":4110, "parent":"41","number":"1","name":"Location Routing Number Fraud"},

    {"type":"Fraud","id":42, "parent":"f","number":"1","name":"Retail Billing Related Fraud"},
    //{"type":"Fraud","id":421, "parent":"42","number":"1","name":"Unauthorized International Call Resale"},
    {"type":"Fraud","id":421, "parent":"42","number":"1","name":"International Call Resale"},
    {"type":"Fraud","id":423, "parent":"42","number":"1","name":"Tariff plan abuse"},
    {"type":"Fraud","id":425, "parent":"42","number":"1","name":"Slamming"},
    {"type":"Fraud","id":426, "parent":"42","number":"1","name":"Cramming"},

    {"type":"Fraud","id":43, "parent":"f","number":"1","name":"Toll Evasion Fraud"},
//    {"type":"Fraud","id":431, "parent":"43","number":"1","name":"Phreaking"},
    {"type":"Fraud","id":432, "parent":"43","number":"1","name":"PBX Dial-through"},
    {"type":"Fraud","id":433, "parent":"43","number":"1","name":"Subscription Fraud"},
    {"type":"Fraud","id":434, "parent":"43","number":"1","name":"Internal Fraud"},
    {"type":"Fraud","id":436, "parent":"43","number":"1","name":"Superimposed Fraud"},

    {"type":"Fraud","id":44, "parent":"f","number":"1","name":"Revenue Sharing Fraud"},
    {"type":"Fraud","id":442, "parent":"44","number":"1","name":"Call Forwarding Fraud"},
    {"type":"Fraud","id":443, "parent":"44","number":"1","name":"IRSF"},
    {"type":"Fraud","id":444, "parent":"44","number":"1","name":"Toll Free Number Fraud"},
    {"type":"Fraud","id":445, "parent":"44","number":"1","name":"CNAM Fraud"},
    {"type":"Fraud","id":446, "parent":"44","number":"1","name":"Access Stimulation"},


    {"type":"Fraud","id":46, "parent":"f","number":"1","name":"Targeted Fraud"},
    {"type":"Fraud","id":461, "parent":"46","number":"1","name":"Impostering"},
    {"type":"Fraud","id":462, "parent":"46","number":"1","name":"Wardialing"},
    {"type":"Fraud","id":463, "parent":"46","number":"1","name":"Tracking and Eavesdropping"},
    {"type":"Fraud","id":464, "parent":"46","number":"1","name":"Blackmailing"},

    {"type":"Fraud","id":47, "parent":"f","number":"1","name":"Voice Spam and Scams"},
    {"type":"Fraud","id":471, "parent":"47","number":"1","name":"Advanced Fee Scam"},
    {"type":"Fraud","id":472, "parent":"47","number":"1","name":"Premium Rate Scams"},
    {"type":"Fraud","id":473, "parent":"47","number":"1","name":"Voice Phishing"},
    {"type":"Fraud","id":474, "parent":"47","number":"1","name":"Other Scams"},
    {"type":"Fraud","id":475, "parent":"47","number":"1","name":"Callback (Wangiri) Scam"},
    {"type":"Fraud","id":476, "parent":"47","number":"1","name":"Telemarketing"},
    {"type":"Fraud","id":477, "parent":"47","number":"1","name":"Robocalling"},

    {"type":"Benefits","id":"b","parent":null,"number":"b","name":"Fraud benefits"},
    {"type":"Benefits","id":51,"parent":"b","number":"1","name":"Financial benefits"},
    {"type":"Benefits","id":511,"parent":"51","number":"1","name":"Increasing revenue"},
    {"type":"Benefits","id":512, "parent":"51","number":"1","name":"Share from billing"}, // "Getting a share from billing"},
    {"type":"Benefits","id":513, "parent":"51","number":"1","name":"Reselling minutes"},// or service"},
    {"type":"Benefits","id":514, "parent":"51","number":"1","name":"Avoiding payment"},//" (totally or partially)"},
    {"type":"Benefits","id":515, "parent":"51","number":"1","name":"Earning free credits"},
    {"type":"Benefits","id":53,"parent":"b","number":"1","name":"Annonymity"},//" for criminal activities"},
    {"type":"Benefits","id":54,"parent":"b","number":"1","name":"Disrupting service"},
    {"type":"Benefits","id":55, "parent":"b","number":"1","name":"Influencing people"},
    {"type":"Benefits","id":56, "parent":"b","number":"1","name":"Privacy Invasion"},
    {"type":"Benefits","id":58, "parent":"b","number":"1","name":"Reconnaissance"}

]

exampleLinks = [
//  {"source":11, "target":231, "value":0.1},
//  {"source":11, "target":232, "value":0.1},
//  {"source":11, "target":216, "value":0.1},

  {"source":12, "target":221, "value":0.1},
  {"source":12, "target":222, "value":0.1},
//  {"source":12, "target":217, "value":0.1},
  {"source":12, "target":231, "value":0.1},
//  {"source":12, "target":224, "value":0.1},
  {"source":12, "target":223, "value":0.1},
  {"source":12, "target":225, "value":0.1},


  {"source":13, "target":211, "value":0.1},
  {"source":13, "target":212, "value":0.1},
  {"source":13, "target":213, "value":0.1},
  {"source":13, "target":214, "value":0.1},
  {"source":13, "target":215, "value":0.1},
  {"source":13, "target":216, "value":0.1},
  {"source":13, "target":221, "value":0.1},
  {"source":13, "target":222, "value":0.1},
  {"source":13, "target":241, "value":0.1},
  {"source":13, "target":242, "value":0.1},
  {"source":13, "target":243, "value":0.1},
  {"source":13, "target":244, "value":0.1},
  {"source":13, "target":232, "value":0.1},
  {"source":13, "target":233, "value":0.1},

  {"source":14, "target":213, "value":0.1},
  {"source":14, "target":214, "value":0.1},
  {"source":14, "target":215, "value":0.1},
  {"source":14, "target":216, "value":0.1},
  {"source":14, "target":221, "value":0.1},
  {"source":14, "target":222, "value":0.1},
  {"source":14, "target":241, "value":0.1},
  {"source":14, "target":242, "value":0.1},
  {"source":14, "target":243, "value":0.1},
  {"source":14, "target":244, "value":0.1},


//////////////Techniques////////////
  {"source":221, "target":311, "value":0.1},
  {"source":222, "target":311, "value":0.1},

  {"source":225, "target":311, "value":0.1},
  {"source":211, "target":311, "value":0.1},
  {"source":212, "target":311, "value":0.1},
  {"source":213, "target":311, "value":0.1},
  {"source":216, "target":311, "value":0.1},

  {"source":211, "target":312, "value":0.1},
  {"source":212, "target":312, "value":0.1},
  {"source":221, "target":312, "value":0.1},
  {"source":216, "target":312, "value":0.1},

  {"source":215, "target":313, "value":0.1},
  {"source":216, "target":313, "value":0.1},
  {"source":243, "target":313, "value":0.1},
  {"source":233, "target":313, "value":0.1},
  {"source":232, "target":313, "value":0.1},

  {"source":211, "target":315, "value":0.1},
  {"source":212, "target":315, "value":0.1},
  {"source":216, "target":315, "value":0.1},
  {"source":221, "target":315, "value":0.1},
  {"source":214, "target":315, "value":0.1},
  {"source":225, "target":315, "value":0.1},

  {"source":216, "target":321, "value":0.1},
  {"source":243, "target":321, "value":0.1},

  {"source":241, "target":322, "value":0.1},
  {"source":242, "target":322, "value":0.1},
  {"source":243, "target":322, "value":0.1},

  {"source":215, "target":331, "value":0.1},
  {"source":212, "target":331, "value":0.1},
  {"source":232, "target":331, "value":0.1},

  {"source":243, "target":332, "value":0.1},
  {"source":232, "target":332, "value":0.1},

  {"source":243, "target":333, "value":0.1},
  {"source":232, "target":333, "value":0.1},


  {"source":242, "target":378, "value":0.1},
  {"source":243, "target":378, "value":0.1},
  {"source":244, "target":378, "value":0.1},

  {"source":225, "target":351, "value":0.1},

  {"source":221, "target":352, "value":0.1},
  {"source":222, "target":352, "value":0.1},
  {"source":241, "target":352, "value":0.1},

  {"source":241, "target":354, "value":0.1},
  {"source":242, "target":354, "value":0.1},

  {"source":221, "target":379, "value":0.1},
  {"source":243, "target":379, "value":0.1},
  {"source":212, "target":379, "value":0.1},
  {"source":213, "target":379, "value":0.1},
  {"source":211, "target":379, "value":0.1},
  {"source":216, "target":379, "value":0.1},


  {"source":241, "target":3710, "value":0.1},
  {"source":242, "target":3710, "value":0.1},
  {"source":243, "target":3710, "value":0.1},

  {"source":241, "target":3711, "value":0.1},
  {"source":243, "target":3711, "value":0.1},

  {"source":222, "target":353, "value":0.1},
  {"source":243, "target":353, "value":0.1},
  {"source":214, "target":353, "value":0.1},
  {"source":215, "target":353, "value":0.1},

  {"source":241, "target":373, "value":0.1},
  {"source":242, "target":373, "value":0.1},


  {"source":243, "target":376, "value":0.1},
  {"source":244, "target":376, "value":0.1},
  {"source":241, "target":376, "value":0.1},

  {"source":242, "target":377, "value":0.1},
  {"source":243, "target":377, "value":0.1},

  {"source":231, "target":379, "value":0.1},
  {"source":223, "target":379, "value":0.1},

///////////////Fraud Schemes//////


  {"source":311, "target":413, "value":0.1},
  {"source":353, "target":413, "value":0.1},
  {"source":413, "target":511, "value":0.1},
  {"source":413, "target":514, "value":0.1},

  {"source":312, "target":414, "value":0.1},
  {"source":414, "target":511, "value":0.1},
  {"source":414, "target":514, "value":0.1},


  {"source":312, "target":416, "value":0.1},
  {"source":311, "target":416, "value":0.1},
  {"source":313, "target":416, "value":0.1},
  {"source":379, "target":416, "value":0.1},
  {"source":416, "target":511, "value":0.1},
  {"source":416, "target":514, "value":0.1},


  {"source":315, "target":418, "value":0.1},
  {"source":313, "target":418, "value":0.1},
  {"source":418, "target":511, "value":0.1},
  {"source":418, "target":514, "value":0.1},

  {"source":311, "target":4110, "value":0.1},
  {"source":4110, "target":511, "value":0.1},

  {"source":333, "target":421, "value":0.1},
  {"source":421, "target":514, "value":0.1},

  {"source":313, "target":423, "value":0.1},
  {"source":423, "target":513, "value":0.1},
  {"source":423, "target":514, "value":0.1},
  {"source":423, "target":515, "value":0.1},


  {"source":376, "target":425, "value":0.1},
  {"source":425, "target":511, "value":0.1},

  {"source":376, "target":426, "value":0.1},
  {"source":426, "target":511, "value":0.1},



  {"source":378, "target":432, "value":0.1},
  {"source":376, "target":432, "value":0.1},
  {"source":432, "target":514, "value":0.1},

  {"source":376, "target":433, "value":0.1},
  {"source":433, "target":53, "value":0.1},
  {"source":433, "target":514, "value":0.1},

  {"source":313, "target":434, "value":0.1},
  {"source":434, "target":514, "value":0.1},

  {"source":3711, "target":436, "value":0.1},
  {"source":436, "target":514, "value":0.1},

  {"source":3710, "target":442, "value":0.1},
  {"source":3711, "target":442, "value":0.1},
  {"source":378, "target":442, "value":0.1},
  {"source":442, "target":512, "value":0.1},


  {"source":315, "target":443, "value":0.1},
  {"source":312, "target":443, "value":0.1},
  {"source":331, "target":443, "value":0.1},
  {"source":443, "target":511, "value":0.1},
  {"source":443, "target":512, "value":0.1},


  {"source":333, "target":444, "value":0.1},
  {"source":444, "target":512, "value":0.1},

  {"source":332, "target":445, "value":0.1},
  {"source":353, "target":445, "value":0.1},
  {"source":377, "target":445, "value":0.1},
  {"source":445, "target":512, "value":0.1},

  {"source":321, "target":446, "value":0.1},
  {"source":446, "target":512, "value":0.1},

  {"source":376, "target":476, "value":0.1},
  {"source":476, "target":511, "value":0.1},
  {"source":476, "target":55, "value":0.1},
  {"source":377, "target":476, "value":0.1},
  {"source":353, "target":476, "value":0.1},


  {"source":376, "target":477, "value":0.1},
  {"source":47, "target":511, "value":0.1},
  {"source":477, "target":55, "value":0.1},
  {"source":377, "target":477, "value":0.1},
  {"source":353, "target":477, "value":0.1},


  {"source":376, "target":461, "value":0.1},
  {"source":461, "target":511, "value":0.1},

  {"source":377, "target":462, "value":0.1},
  {"source":462, "target":58, "value":0.1},

  {"source":351, "target":463, "value":0.1},
  {"source":463, "target":56, "value":0.1},
  {"source":463, "target":58, "value":0.1},

  {"source":373, "target":464, "value":0.1},
  {"source":464, "target":54, "value":0.1},

  {"source":353, "target":471, "value":0.1},
  {"source":376, "target":471, "value":0.1},
  {"source":377, "target":471, "value":0.1},
  {"source":471, "target":511, "value":0.1},

  {"source":353, "target":472, "value":0.1},
  {"source":376, "target":472, "value":0.1},
  {"source":331, "target":472, "value":0.1},
  {"source":377, "target":472, "value":0.1},
  {"source":472, "target":511, "value":0.1},
  {"source":472, "target":512, "value":0.1},

  {"source":353, "target":473, "value":0.1},
  {"source":376, "target":473, "value":0.1},
  {"source":377, "target":473, "value":0.1},
  {"source":473, "target":511, "value":0.1},
  {"source":473, "target":512, "value":0.1},
  {"source":473, "target":515, "value":0.1},
  {"source":473, "target":56, "value":0.1},
  {"source":473, "target":58, "value":0.1},

  {"source":353, "target":474, "value":0.1},
  {"source":376, "target":474, "value":0.1},
  {"source":377, "target":474, "value":0.1},
  {"source":474, "target":511, "value":0.1},
  {"source":474, "target":55, "value":0.1},
  {"source":474, "target":515, "value":0.1},

  {"source":376, "target":475, "value":0.1},
  {"source":377, "target":475, "value":0.1},
  {"source":475, "target":512, "value":0.1},

  // added imsi catchers => evesdropping and tracking
  {"source":354, "target":463, "value":0.1}

]

}
else{


    exampleNodes = [
	{"type":"RootCauses","id":"r", "parent":null,"name":"Root causes"},
	{"type":"RootCauses","id":11,  "parent":"r","number":"1","name":"Complexity of billing"},
	{"type":"RootCauses","id":12,  "parent":"r","number":"1","name":"Insecure/Legacy protocols"},//legacy protocols not designed security in mind
	{"type":"RootCauses","id":13,  "parent":"r","number":"1","name":"Variety and number of operators"},

	//ip convergence
	{"type":"Weaknesses","id":"w","parent":null,"number":"w","name":"Weaknesses"},
	//lack of due diligence,lack of international law enforcement,variety of laws, regulations worldwide
	{"type":"Weaknesses","id":21, "parent":"w","number":"1","name":"Law, regulation and contracts"},
	{"type":"Weaknesses","id":211, "parent":"21","number":"1","name":"Lack of due diligence"}, //deregulated interconnect agreements
	{"type":"Weaknesses","id":212, "parent":"21","number":"1","name":"Difficulty of international law enforcement"},
	{"type":"Weaknesses","id":213, "parent":"21","number":"1","name":"Variety of regulation and laws"},

	{"type":"Techniques","id":"t","parent":null,"number":"t","name":"Techniques"},
	{"type":"Techniques","id":31, "parent":"t","number":"1","name":"Operator level"},
	{"type":"Techniques","id":311,"parent":"t","number":"1","name":"Manipulation of call signaling"},
	{"type":"Techniques","id":312,"parent":"31","number":"1","name":"Number range hijacking"},
	{"type":"Techniques","id":313,"parent":"31","number":"1","name":"Confusion pricing"},

	{"type":"Fraud","id":"f","parent":null,"number":"f","name":"Fraud types"},
	{"type":"Fraud","id":41,"parent":"f","number":"1","name":"Wholesale billing fraud"},
	{"type":"Fraud","id":42,"parent":"f","number":"1","name":"Cherry Picking"},
	{"type":"Fraud","id":43,"parent":"f","number":"1","name":"Tromboning"},

	{"type":"Benefits","id":"b","parent":null,"number":"b","name":"Fraud benefits"},
	{"type":"Benefits","id":51,"parent":"b","number":"1","name":"Financial benefits"},
	{"type":"Benefits","id":53,"parent":"b","number":"1","name":"Annonymity for criminal activities"},
	{"type":"Benefits","id":54,"parent":"b","number":"1","name":"Disrupting service"}

    ]

    exampleLinks = [
	{"source":11, "target":21, "value":0.1},
	{"source":11, "target":213, "value":0.1},
	{"source":11, "target":213, "value":0.1},

	{"source":12, "target":211, "value":0.1},
	{"source":12, "target":212, "value":0.1},
	{"source":13, "target":213, "value":0.1},

	//////////////Techniques////////////
	{"source":211, "target":311, "value":0.1},
	{"source":213, "target":312, "value":0.1},
	{"source":212, "target":312, "value":0.1},
	{"source":211, "target":313, "value":0.1},


	{"source":311, "target":41, "value":0.1},
	{"source":312, "target":42, "value":0.1},
	{"source":313, "target":43, "value":0.1},


	{"source":41, "target":51, "value":0.1},
	{"source":41, "target":51, "value":0.1},
	{"source":42, "target":53, "value":0.1},
	{"source":43, "target":54, "value":0.1},
	{"source":41, "target":54, "value":0.1},
	{"source":42, "target":54, "value":0.1},

    ]
}

biHiSankey
  .nodes(exampleNodes)
  .links(exampleLinks)
  .initializeNodes(function (node) {
    node.state = node.parent ? "contained" : "collapsed";
  })
  .layout(LAYOUT_INTERATIONS);

disableUserInterractions(2 * TRANSITION_DURATION);

update(0);
