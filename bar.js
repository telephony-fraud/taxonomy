$(function() {
    var timer = null, level = 1,
	max = 4,
	duration = 1000,
	r = 720 / 2
    //collatz = reverseCollatz(r, max);
    //figure=update()

    //console.log("bar  exec");

    var vis = d3.select("#chart")
    	.append("svg")
    	.attr("width", r * 2)
    	.attr("height", r * 2)
    	.append("g")
    	.attr("transform", "translate(" + r + "," + r + ")");

    function plotLevel() {
    	//console.log("plot level");
    	if (level <= max) {
    	    $('#level').slider({value: level});
    	    $('#level-val').text(level);
    	    //vis.call(figure(level, duration));
    	    //update(level)
    	    level++;
    	}
    };

    $('#level').slider({
    	value: level, min: 1, max: max, slide: function(e, ui) {
    	    level = ui.value;
    	    plotLevel();
    	}
    });

    $('#play').click(function() {
    	//console.log("play clicked");
    	if (level > max) level = 1;
    	plotLevel();
	//console.log("before setting timer");
    	if (timer) {
    	    //console.log("a timer was set, clear");
	    clearInterval(timer);
	}
	// else
	//     console.log("a timer was not set");

	
    	timer = setInterval(function() {
	    //console.log("timer function");
    	    if (level <= max) plotLevel();
    	    else $('#stop').click();
    	}, duration);
	//console.log("timer set for " + duration);
    	$(this).hide();
    	$('#stop').show();
    }).click();

    $('#stop').click(function() {
    	//console.log("stop clicked");
    	if (timer) clearInterval(timer);
    	$(this).hide();
    	$('#play').show();
    });
});

